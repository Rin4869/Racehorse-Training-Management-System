# Đặc tả — Phase 8: Health & Injury (sự cố + thông báo)

> Viết trước khi code (2026-09-14). Nguồn: [../DECISIONS.md](../DECISIONS.md)
> mục "2026-09-12 — Mở rộng data model theo 3 activity diagram + ERD",
> [../DATA_MODEL.md](../DATA_MODEL.md) §"bản đầy đủ" (nhóm sự cố & thông báo).
> Đây là **luồng thứ 3/3 (cuối cùng)** của việc mở rộng sau-MVP (luồng 1:
> Pedigree & Races — [phase-6-pedigree.md](phase-6-pedigree.md); luồng 2:
> Training Plan & Lock — [phase-7-training-plan-lock.md](phase-7-training-plan-lock.md),
> cả hai đã xong). Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

Luồng demo **"Health & Injury"**: GROOM báo sự cố cho 1 ngựa → sự cố nặng
(`HIGH`) tự động kích hoạt Training Lock (Phase 7) → VET xử lý (gắn hồ sơ
khám đã tạo qua `/horses/:id/health-records` từ Phase 4, chuyển trạng thái
sự cố) → khi VET đánh dấu `RESOLVED`, ngựa tự mở khoá. Mọi thay đổi khoá +
sự cố mới gửi **thông báo** cho chủ ngựa + MANAGER.

**Trong phạm vi:**
- Model mới `IncidentReport` (`horseId, reportedById, description, severity,
  status, healthRecordId?`).
- Model mới `Notification` (`userId, type, message, read`).
- `POST/GET /horses/:id/incidents`, `GET/PATCH /incidents/:id`.
- `GET /notifications`, `PATCH /notifications/:id/read`.
- **Đồng bộ với Training Lock (Phase 7):** tạo sự cố `severity=HIGH` → tự
  khoá ngựa (gọi lại `HorsesService.lock()`); sự cố chuyển `RESOLVED` khi
  ngựa đang khoá → tự mở khoá.
- **Đồng bộ thông báo:** mọi lần `HorsesService.lock()` chạy (dù gọi từ
  `PATCH /horses/:id/lock` tay của VET — Phase 7 — hay tự động từ sự cố)
  đều tạo `Notification` cho chủ ngựa + mọi MANAGER. Tạo sự cố (mọi severity)
  cũng tạo thông báo riêng.
- Seed: 1 sự cố `HIGH` cho 1 ngựa (tự khoá), 1 sự cố `LOW` đã `RESOLVED`.
- e2e phủ happy path + 403/400/404 + rule khoá/mở khoá tự động + thông báo.

**Ngoài phạm vi (không làm):**
- Đẩy thông báo real-time (WebSocket/SSE/push) — chỉ poll qua `GET /notifications`.
- Đánh dấu đọc hàng loạt (`read-all`) — chỉ đánh dấu từng thông báo.
- Sự cố nhiều `healthRecordId` (1 sự cố tối đa gắn 1 hồ sơ khám).
- Xoá `IncidentReport`/`Notification` — không có DELETE.
- Gửi email cho thông báo (khác `mail` module Phase 1, vốn chỉ dùng cho
  auth) — thông báo chỉ nằm trong DB, xem qua API/FE.

## 2. Data model

### 2.1 Model mới `IncidentReport`

```prisma
enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
}

enum IncidentStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}

model IncidentReport {
  id             String           @id @default(uuid())
  horseId        String
  horse          Horse            @relation(fields: [horseId], references: [id])
  reportedById   String
  reportedBy     User             @relation("IncidentReporter", fields: [reportedById], references: [id])
  description    String
  severity       IncidentSeverity
  status         IncidentStatus   @default(OPEN)
  healthRecordId String?
  healthRecord   HealthRecord?    @relation(fields: [healthRecordId], references: [id])
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([horseId])
  @@index([status])
}
```

### 2.2 Model mới `Notification`

```prisma
enum NotificationType {
  TRAINING_LOCKED
  TRAINING_UNLOCKED
  INCIDENT_REPORTED
}

model Notification {
  id        String           @id @default(uuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  type      NotificationType
  message   String
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())

  @@index([userId, read])
}
```

`Horse` +`incidents IncidentReport[]`; `HealthRecord` +`incidents
IncidentReport[]` (back-relation bắt buộc của Prisma); `User` +`reportedIncidents
IncidentReport[] @relation("IncidentReporter")` + `notifications Notification[]`.

Không soft-delete cho cả 2 model. Migration:
`npx prisma migrate dev --name phase8_incidents_notifications`.

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.
List: `{ data: [...], meta: { page, limit, total } }`.

### 3.1 `POST /horses/:id/incidents` — (GROOM, `HorseOwnershipGuard`)

```jsonc
{ "description": "Ngã khi tập, chân trước sưng nhẹ", "severity": "HIGH" }
```
`description`, `severity` bắt buộc. `reportedById` = người gọi, `status`
luôn khởi tạo `OPEN`.
**Side effect:** nếu `severity === "HIGH"` → gọi
`HorsesService.lock(horseId, { locked: true, reason: "Incident: <description>" })`
(tự khoá, tự tạo thông báo `TRAINING_LOCKED` — xem §3.5). Luôn tạo thêm 1
thông báo `INCIDENT_REPORTED` cho chủ ngựa + mọi MANAGER (bất kể severity).
Response `201`: `IncidentReport` (kèm `reportedBy`, `horse` join).
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN` (không phải GROOM), `NOT_FOUND` (horse).

### 3.2 `GET /horses/:id/incidents?status=&page=&limit=` — (auth, ownership)

Sắp xếp `createdAt desc`. Lỗi: `NOT_FOUND`, `FORBIDDEN` (OWNER ngựa khác).

### 3.3 `GET /incidents/:id` — (auth, ownership qua incident→horse ở service)

Giống pattern `/sessions/:id`/`/health-records/:id`/`/training-plans/:id`.
Lỗi: `NOT_FOUND`, `FORBIDDEN`.

### 3.4 `PATCH /incidents/:id` — (VET)

```jsonc
{ "status": "IN_PROGRESS", "healthRecordId": "uuid" }
```
Cả 2 field optional (≥1). `status` chỉ tiến, không lùi:
thứ tự `OPEN → IN_PROGRESS → RESOLVED`, cho phép nhảy bước (`OPEN` →
`RESOLVED` thẳng); gửi status có thứ tự **nhỏ hơn** hiện tại, hoặc sự cố đã
`RESOLVED` (trạng thái cuối) → `VALIDATION_ERROR`. `healthRecordId` (nếu
gửi) phải là `HealthRecord` **của cùng ngựa** → sai `VALIDATION_ERROR`.

**Side effect:** nếu `status` chuyển thành `RESOLVED` **và** ngựa đang
`locked === true` → gọi `HorsesService.lock(horseId, { locked: false })`
(tự mở khoá + tự tạo thông báo `TRAINING_UNLOCKED`). Nếu ngựa không bị
khoá, không gọi (tránh no-op).

Response `200`: `IncidentReport`. Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`
(không phải VET), `NOT_FOUND`.

### 3.5 `HorsesService.lock()` — mở rộng (route `PATCH /horses/:id/lock` đã có từ Phase 7)

Không đổi hợp đồng route. Chỉ thêm side effect nội bộ: mỗi lần `lock()`
**thực sự đổi** `locked` (so với giá trị hiện có — bỏ qua nếu gọi lại cùng
giá trị) → tạo `Notification` cho **chủ ngựa** + **mọi MANAGER** (`status
ACTIVE`, `deletedAt: null`):
- `locked: true` → type `TRAINING_LOCKED`, message
  `"<Horse.name> đã bị khoá tập luyện: <lockReason>"`.
- `locked: false` → type `TRAINING_UNLOCKED`, message
  `"<Horse.name> đã được mở khoá tập luyện"`.

Áp dụng cho **cả** lời gọi tay (`PATCH /horses/:id/lock`, VET) **lẫn** tự
động (từ `IncidentReport` §3.1/§3.4) — cùng 1 method, không tách 2 code path.

### 3.6 `GET /notifications?unread=&page=&limit=` — (auth, chỉ của chính mình)

Không có `:id` ngựa — luôn lọc `userId = người gọi`, không có route nào xem
thông báo người khác (không cần ownership guard kiểu horse). `unread=true`
lọc `read=false`. Sắp xếp `createdAt desc`.
Response `200`: `{ data: Notification[], meta }`.

### 3.7 `PATCH /notifications/:id/read` — (auth, chỉ của chính mình)

Không cần body. Set `read=true`. Sai chủ (`notification.userId !== user.id`)
→ `FORBIDDEN`. Không tồn tại → `NOT_FOUND`.
Response `200`: `Notification`.

### 3.8 Hình dạng object

```jsonc
// IncidentReport
{
  "id": "uuid", "horseId": "uuid",
  "horse": { "id": "uuid", "name": "Sea Breeze", "ownerId": "uuid" },
  "reportedById": "uuid",
  "reportedBy": { "id": "uuid", "name": "Groom One", "email": "..." },
  "description": "…", "severity": "HIGH", "status": "OPEN",
  "healthRecordId": null, "createdAt": "ISO", "updatedAt": "ISO"
}
// Notification
{
  "id": "uuid", "userId": "uuid", "type": "TRAINING_LOCKED",
  "message": "…", "read": false, "createdAt": "ISO"
}
```

## 4. RBAC & ownership

| Route | Role | Ownership |
|---|---|---|
| POST /horses/:id/incidents | GROOM | `HorseOwnershipGuard` |
| GET /horses/:id/incidents | mọi role | `HorseOwnershipGuard` |
| GET /incidents/:id | mọi role | service: incident→horse, OWNER phải là chủ |
| PATCH /incidents/:id | VET | — (giống PATCH health-records, không ownership) |
| GET /notifications | mọi role | luôn tự lọc `userId=self` |
| PATCH /notifications/:id/read | mọi role | service: `notification.userId===self` |

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **Luồng 3/3 (cuối) của việc mở rộng "2026-09-12"** — hoàn tất cả 3 luồng
   activity diagram đã chốt.
2. **Chỉ `severity=HIGH` tự khoá khi tạo sự cố** — `LOW`/`MEDIUM` không ảnh
   hưởng lịch tập, chỉ ghi nhận + thông báo. VET vẫn có thể khoá tay qua
   `PATCH /horses/:id/lock` (Phase 7) cho `LOW`/`MEDIUM` nếu cần, ngoài luồng
   tự động này.
3. **`HorsesService.lock()` là nơi DUY NHẤT gửi thông báo khoá/mở khoá** —
   dùng chung cho cả lời gọi tay (Phase 7) và tự động (sự cố), tránh trùng
   lặp logic thông báo ở 2 chỗ. Chỉ gửi khi giá trị `locked` **thực sự đổi**
   (idempotent — gọi lại cùng giá trị không spam thông báo).
4. **Không có `NotificationType` riêng cho "sự cố đã xử lý xong"** — khi sự
   cố `RESOLVED` mở khoá ngựa, thông báo `TRAINING_UNLOCKED` đã đủ ngữ cảnh;
   tránh 2 thông báo trùng ý cho cùng 1 sự kiện.
5. **`INCIDENT_REPORTED` gửi cho MỌI severity**, không chỉ `HIGH` — chủ ngựa
   cần biết cả sự cố nhẹ, ngay cả khi không khoá tập.
6. **Người nhận thông báo cố định: chủ ngựa + mọi MANAGER**, không thêm
   TRAINER/VET phụ trách — đơn giản hoá cho MVP mở rộng (không có bảng phân
   công trainer/vet theo ngựa).
7. **`status` sự cố chỉ tiến, cho phép nhảy bước** (`OPEN→RESOLVED` thẳng,
   không bắt buộc qua `IN_PROGRESS`) — VET có thể xử lý xong ngay lần khám
   đầu. Khác `TrainingSession` (chỉ 2 bước `PLANNED→DONE|CANCELLED`, không
   có bước giữa).
8. **`healthRecordId` optional, không bắt buộc** — 1 sự cố `LOW` có thể
   đóng mà không cần tạo hồ sơ khám riêng (VD: theo dõi tại chỗ, không cần
   khám chính thức).
9. **`PATCH /incidents/:id` không có ownership guard** — chỉ VET tới được,
   VET xử lý mọi sự cố mọi ngựa (giống pattern health-records/training-plans).
10. **`GET /notifications` không nhận `userId` query** — luôn tự động của
    người gọi, không có khái niệm "xem thông báo hộ người khác" kể cả
    MANAGER — đơn giản, không rò rỉ.
11. **Không xoá `IncidentReport`/`Notification`** — giống pattern các model
    khác ở MVP mở rộng.
12. **Migration `phase8_incidents_notifications`** — chỉ thêm bảng mới,
    không đổi cột hiện có (khác Phase 6/7 vốn có sửa `Horse`).

## 6. Cấu trúc code

```
prisma/schema.prisma          # + enum IncidentSeverity/IncidentStatus/NotificationType,
                              #   model IncidentReport/Notification, back-relations
prisma/migrations/<ts>_phase8_incidents_notifications/

src/notifications/            # module mới, không phụ thuộc horses/incidents
  notifications.module.ts
  notifications.controller.ts # NotificationsController (notifications)
  notifications.service.ts    # + notifyUsers(userIds, type, message) dùng nội bộ
  dto/notifications.dto.ts    # ListNotificationsQueryDto

src/horses/
  horses.module.ts            # import NotificationsModule
  horses.service.ts           # lock() gọi notifications.notifyUsers() khi locked đổi

src/incidents/                # module mới
  incidents.module.ts         # import HorsesModule (dùng lại HorsesService.lock())
  incidents.controller.ts     # HorseIncidentsController + IncidentsController
  incidents.service.ts
  dto/incidents.dto.ts

prisma/seed.ts                 # + 1 incident HIGH (tự khoá), 1 incident LOW RESOLVED
test/incidents.e2e-spec.ts     # incident CRUD + auto-lock/unlock
test/notifications.e2e-spec.ts # list + mark-read + ownership
src/app.module.ts              # + NotificationsModule, + IncidentsModule
```

`NotificationsModule` đứng độc lập (không import gì từ horses/incidents) để
tránh vòng phụ thuộc — `HorsesModule` và `IncidentsModule` đều import nó.

## 7. Env

Không thêm biến mới.

## 8. Seed (bổ sung, idempotent)

- 1 `IncidentReport` `HIGH` cho **Midnight** (owner2): `description="Va chạm
  khi vận chuyển, nghi ngờ chấn thương chân sau"`, `reportedById`=GROOM seed
  → tự khoá Midnight (`locked=true`, `lockReason="Incident: …"`), tạo thông
  báo cho owner2 + MANAGER.
- 1 `IncidentReport` `LOW` cho **Thunderbolt** (owner1), đã `RESOLVED`,
  `healthRecordId` = health record "Routine checkup" đã seed từ Phase 4
  (nếu tồn tại) — demo trạng thái đã xử lý xong, không khoá.
- In số thông báo đã tạo cho owner1/owner2/manager.

## 9. Kế hoạch test

`test/incidents.e2e-spec.ts` (đăng nhập manager, groom, vet, trainer, owner1,
owner2; 1 ngựa test owner1; cleanup `afterAll` xoá incident + notification +
horse):

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | GROOM POST incident `LOW` | 201, `status=OPEN`, ngựa **không** bị khoá |
| 2 | GROOM POST incident `HIGH` (ngựa khác) | 201 + ngựa tự `locked=true` |
| 3 | POST thiếu `description` | 400 |
| 4 | VET/TRAINER/OWNER POST incident | 403 |
| 5 | POST cho horseId lạ | 404 |
| 6 | owner1 GET `/horses/:id/incidents` (ngựa mình) | 200, thấy 2 incident |
| 7 | owner2 GET incidents ngựa owner1 | 403 |
| 8 | GET `/incidents/:id` ownership + 404 | đúng như trên |
| 9 | VET PATCH `status=IN_PROGRESS` | 200 |
| 10 | PATCH `status=OPEN` (lùi) | 400 |
| 11 | GROOM/TRAINER PATCH incident | 403 |
| 12 | VET PATCH `healthRecordId` sai ngựa | 400 |
| 13 | VET PATCH `status=RESOLVED` (ngựa đang khoá từ #2) | 200, ngựa tự `locked=false` |
| 14 | PATCH incident đã `RESOLVED` | 400 |
| 15 | PATCH `status=RESOLVED` khi ngựa không bị khoá (incident #1) | 200, không lỗi, không gọi lock thừa |

`test/notifications.e2e-spec.ts` (dùng lại incident `HIGH` ở trên để có dữ
liệu thông báo cho owner1/manager):

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | owner1 GET `/notifications` | 200, thấy `TRAINING_LOCKED` + `INCIDENT_REPORTED` |
| 2 | GET `/notifications?unread=true` | chỉ thông báo `read=false` |
| 3 | owner2 GET `/notifications` | 200, **không** thấy thông báo của owner1 |
| 4 | owner1 PATCH `/notifications/:id/read` | 200, `read=true` |
| 5 | owner2 PATCH thông báo của owner1 | 403 |
| 6 | PATCH thông báo lạ | 404 |
| 7 | MANAGER GET `/notifications` | 200, thấy thông báo khoá (nhận cùng owner1) |

## 10. Định nghĩa "xong"

- [ ] `npx prisma migrate dev` chạy sạch, không mất dữ liệu cũ
- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (96 test cũ + test mới)
- [ ] Seed chạy lại idempotent, in đủ log
- [ ] `docs/`: cập nhật spec §11, STATE.md, PLAN.md, DECISIONS.md,
      DATA_MODEL.md (đưa incident_reports/notifications vào ERD MVP đang
      chạy — **xong cả 3 luồng mở rộng**), API.md, specs/README.md
- [ ] Frontend (`apps/web`) cho incidents + notifications — **không bắt
      buộc để tính "xong" phase này**, làm lượt sau (giống Phase 6/7).

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-14)

Khớp đặc tả. Điểm cần ghi nhớ:

- Migration `phase8_incidents_notifications` áp dụng sạch — chỉ thêm 2 bảng
  + 3 enum, không đổi cột hiện có.
- `NotificationsModule` đứng độc lập như kế hoạch; `HorsesModule` và
  `IncidentsModule` đều import nó, không có vòng phụ thuộc.
- `HorsesService.lock()` (từ Phase 7) chỉ gửi thông báo khi `existing.locked
  !== dto.locked` — verify bằng test "resolving the LOW incident (never
  locked) succeeds without error" (không gọi `lock()` thừa khi ngựa vốn
  không khoá).
- `IncidentsService` inject thẳng `HorsesService` (qua import `HorsesModule`
  đã export sẵn từ Phase 6) — tái dùng nguyên method `lock()`, không tạo
  API nội bộ riêng, đúng quyết định #3 trong spec.
- Seed **không thể gọi service** (script chạy ngoài Nest DI) nên phải tự tay
  lặp lại side-effect (set `locked`/`lockReason` + tạo `Notification`) —
  ghi rõ trong comment đầu file `seed.ts` để phiên sau không nhầm là bug.
- `ListNotificationsQueryDto.unread` dùng `@Transform` thủ công thay vì
  `@Type(() => Boolean)` — query string `"false"` qua `Boolean("false")` sẽ
  thành `true` nếu dùng `@Type`, đã tránh bug này ngay từ đầu.

**File tạo mới:**
```
prisma/migrations/20260914113952_phase8_incidents_notifications/
src/notifications/notifications.{module,controller,service}.ts
src/notifications/dto/notifications.dto.ts
src/incidents/incidents.{module,controller,service}.ts
src/incidents/dto/incidents.dto.ts
test/incidents.e2e-spec.ts
test/notifications.e2e-spec.ts
```
**Sửa:** `prisma/schema.prisma` (+3 enum, +model IncidentReport/Notification,
+back-relations trên Horse/HealthRecord/User) · `src/horses/horses.service.ts`
(+notify trong `lock()`) · `src/horses/horses.module.ts` (+import
NotificationsModule) · `src/app.module.ts` (+NotificationsModule
+IncidentsModule) · `prisma/seed.ts` (+1 incident HIGH tự khoá, +1 incident
LOW RESOLVED gắn health record).

**Kiểm chứng:**
- `npx prisma migrate dev` ✅ · `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **117/117** (96 cũ + incidents 14 + notifications 7) ✅
- `npm run db:seed` chạy lại idempotent, in đủ log incident + lock.

Định nghĩa "xong" §10: build/lint/e2e/seed/docs ☑ — **cả 3 luồng mở rộng
sau-MVP (Phase 6-8) nay đã xong phần API.** Frontend incidents/notifications:
**chưa làm**, để lượt sau (không chặn "xong" của phase này theo §10).
