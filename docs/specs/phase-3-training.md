# Đặc tả — Phase 3: Training sessions

> Viết trước khi code (2026-09-08). Nguồn: [../PLAN.md](../PLAN.md) §6 Phase 3,
> [../MVP.md](../MVP.md) §Main flow 2, [../API.md](../API.md).
> Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

Luồng chính của MVP: **TRAINER đặt lịch tập cho ngựa → TRAINER/GROOM đánh dấu
hoàn thành + nhập kết quả → OWNER xem được**. Kết quả tập gộp thẳng vào bản ghi
session (không bảng riêng).

**Trong phạm vi:**
- `POST /horses/:id/sessions` (TRAINER) — tạo session `PLANNED`.
- `GET /horses/:id/sessions` — list theo ngựa + filter `status`/`from`/`to` + phân trang.
- `GET /sessions/:id` — chi tiết 1 session (có ownership).
- `PATCH /sessions/:id` — sửa; **state machine** + rule "DONE phải có result";
  TRAINER sửa mọi field, GROOM chỉ `status` + result.
- Seed: +TRAINER +VET +GROOM + vài session PLANNED/DONE.
- e2e phủ happy path + 403/400/404.

**Ngoài phạm vi:** `training_plans`, endpoint `/sessions/:id/results` riêng,
lịch lặp lại, xung đột lịch, thông báo/nhắc lịch, phân công nhiều trainer.

## 2. Data model

`TrainingSession` **đã tồn tại** trong migration `20260908032635_init` →
**không cần migration mới**.

```prisma
model TrainingSession {
  id           String        @id @default(uuid())
  horseId      String
  horse        Horse         @relation(fields: [horseId], references: [id])
  trainerId    String
  trainer      User          @relation("SessionTrainer", fields: [trainerId], references: [id])
  scheduledAt  DateTime
  type         String
  status       SessionStatus @default(PLANNED)   // PLANNED | DONE | CANCELLED
  resultMetric String?
  resultValue  Float?
  notes        String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  @@index([horseId, scheduledAt])
  @@index([status])
}
```

Không có `deletedAt` → session **không soft-delete** ở phase này (không có endpoint
xoá). Hủy lịch = `status = CANCELLED`.

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.
List: `{ data: [...], meta: { page, limit, total } }`.

### 3.1 `POST /horses/:id/sessions` — (TRAINER)

`:id` = horseId. Guard: `HorseOwnershipGuard` (OWNER không tới được đây vì thiếu
role, nhưng guard vẫn cho 404 nếu ngựa không tồn tại).

Request:
```jsonc
{
  "scheduledAt": "2026-09-20T08:00:00.000Z",  // bắt buộc, ISO 8601
  "type": "gallop",                            // bắt buộc, 1..80 ký tự
  "notes": "warm up 15'"                       // optional, <=2000
}
```
- `trainerId` = **người gọi** (không nhận từ body).
- `status` luôn khởi tạo `PLANNED`.
- `scheduledAt` cho phép cả quá khứ (ghi nhận hồi tố) lẫn tương lai.

Response `201`: object `Session` (§3.6).
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN` (không phải TRAINER), `NOT_FOUND` (ngựa).

### 3.2 `GET /horses/:id/sessions` — (mọi role, ownership)

Guard: `HorseOwnershipGuard`.
Query: `status?` (enum), `from?` / `to?` (ISO, lọc theo `scheduledAt`, khoảng đóng),
`page=1`, `limit=20` (max 100).
Response `200`: danh sách `Session` + `meta`, sắp xếp `scheduledAt asc`.
Lỗi: `NOT_FOUND` (ngựa), `FORBIDDEN` (OWNER xem ngựa người khác).

### 3.3 `GET /sessions/:id` — (mọi role, ownership qua session→horse)

Không có horseId trên URL → ownership check ở **service**: load session kèm
`horse`; nếu người gọi là OWNER và `horse.ownerId !== user.id` → `FORBIDDEN`.
Response `200`: `Session`. Lỗi: `NOT_FOUND`, `FORBIDDEN`.

### 3.4 `PATCH /sessions/:id` — (TRAINER hoặc GROOM)

Body (mọi field optional, cần ít nhất 1):
`scheduledAt?`, `type?`, `notes?`, `status?`, `resultMetric?`, `resultValue?`.

**Giới hạn theo role:**
| Role | Được sửa |
|---|---|
| TRAINER | mọi field |
| GROOM | chỉ `status`, `resultMetric`, `resultValue` — gửi field khác → `FORBIDDEN` |
| khác | không (403 do RolesGuard) |

**State machine (`status`):**
- Hợp lệ: `PLANNED → DONE`, `PLANNED → CANCELLED`.
- `DONE` và `CANCELLED` là **trạng thái cuối** — mọi PATCH lên session đã ở trạng
  thái cuối → `VALIDATION_ERROR` ("session is already DONE/CANCELLED").
- Không truyền `status` → giữ nguyên (chỉ sửa field khác, chỉ khi đang `PLANNED`).

**Rule kết quả:**
- Chuyển sang `DONE` ⇒ sau khi áp payload, session phải có **cả** `resultMetric`
  (chuỗi không rỗng) **và** `resultValue` (số hữu hạn). Thiếu → `VALIDATION_ERROR`.
- Chuyển sang `CANCELLED` ⇒ không yêu cầu result; result giữ nguyên nếu có.
- `resultValue` phải là số hữu hạn (`class-validator` + kiểm tra `Number.isFinite`).

Response `200`: `Session` sau cập nhật.
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`.

### 3.6 Hình dạng object `Session`
```jsonc
{
  "id": "uuid",
  "horseId": "uuid",
  "horse": { "id": "uuid", "name": "Thunderbolt", "ownerId": "uuid" },
  "trainerId": "uuid",
  "trainer": { "id": "uuid", "name": "Trainer One", "email": "..." },
  "scheduledAt": "ISO",
  "type": "gallop",
  "status": "PLANNED",
  "resultMetric": null,
  "resultValue": null,
  "notes": null,
  "createdAt": "ISO", "updatedAt": "ISO"
}
```

## 4. RBAC & ownership

| Route | Role | Ownership |
|---|---|---|
| POST /horses/:id/sessions | TRAINER | `HorseOwnershipGuard` (404 ngựa) |
| GET /horses/:id/sessions | mọi role | `HorseOwnershipGuard` |
| GET /sessions/:id | mọi role | service: session→horse, OWNER phải là chủ |
| PATCH /sessions/:id | TRAINER, GROOM | service: OWNER không tới (RolesGuard); GROOM field-whitelist |

Service luôn nhận `currentUser`. GROOM field-whitelist: so khớp `Object.keys(dto)`
với `{status, resultMetric, resultValue}`.

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **Không tạo `SessionOwnershipGuard`** — `/sessions/:id` mang sessionId chứ không
   phải horseId; check ownership trong service (load session kèm horse 1 lần).
   `/horses/:id/sessions*` vẫn dùng lại `HorseOwnershipGuard`.
2. **`trainerId` = người tạo**, không nhận từ body. Không cho MANAGER tạo session
   (đúng bảng quyền MVP: chỉ TRAINER).
3. **`DONE`/`CANCELLED` là trạng thái cuối**, không quay lại / không sửa tiếp.
   Giữ state machine tối giản, đủ cho MVP.
4. **GROOM chỉ đụng `status` + result** — kiểm ở service bằng whitelist key, trả
   `FORBIDDEN` nếu vượt (không phải `VALIDATION_ERROR` vì đây là vấn đề quyền).
5. **GROOM được đặt cả `DONE` lẫn `CANCELLED`** (không chỉ DONE) — thực tế groom
   cũng có thể hủy buổi tập; đơn giản hơn việc phân biệt.
6. **`scheduledAt` không ràng buộc quá khứ/tương lai** — cho phép ghi hồi tố.
7. **Không soft-delete session** — không có endpoint DELETE; hủy = `CANCELLED`.
8. **List sắp xếp `scheduledAt asc`** (khác Horses dùng `createdAt desc`) — người
   dùng xem lịch theo thứ tự thời gian.
9. Chỉ TRAINER được sửa `scheduledAt/type/notes`, và **chỉ khi `PLANNED`**.

## 6. Cấu trúc code

```
src/training/
  training.module.ts
  training.controller.ts      # cả 2 nhóm route: /horses/:id/sessions và /sessions/:id
  training.service.ts
  dto/training.dto.ts         # CreateSessionDto, UpdateSessionDto, ListSessionsQueryDto
prisma/seed.ts                # +TRAINER +VET +GROOM + vài session
test/training.e2e-spec.ts
```

`TrainingModule` import `HorsesModule` (để dùng `HorseOwnershipGuard` — export từ
`HorsesModule`) hoặc tự cung cấp guard. → Guard chỉ cần `PrismaService` (global),
nên **provide trực tiếp trong `TrainingModule`**. Import vào `AppModule`.

Controller: một `TrainingController` không prefix cố định, dùng path tuyệt đối
trên method (`@Controller()` + `@Get('horses/:id/sessions')` …) — hoặc 2 controller.
→ Chọn **2 controller** cho rõ: `HorseSessionsController` (`@Controller('horses/:id/sessions')`)
+ `SessionsController` (`@Controller('sessions')`).

## 7. Env

Không thêm biến mới.

## 8. Seed (bổ sung)

Users mới (ACTIVE + verified):
- `trainer@racehorse.local` / `Trainer123!` — TRAINER
- `vet@racehorse.local` / `Vet123!` — VET (dùng ở Phase 4, seed luôn cho gọn)
- `groom@racehorse.local` / `Groom123!` — GROOM

Sessions (idempotent theo `horseId`+`scheduledAt`+`type`):
- Thunderbolt (owner1): `gallop` PLANNED (+3 ngày), `sprint` DONE (−7 ngày,
  `resultMetric="time_1200m_s"`, `resultValue=74.2`)
- Midnight (owner2): `trot` PLANNED (+2 ngày)

## 9. Kế hoạch test — `test/training.e2e-spec.ts`

Đăng nhập: manager, trainer, groom, owner1, owner2. Tạo 1 ngựa test (owner1) để
thao tác, cleanup ở `afterAll` (xóa session + ngựa).

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | TRAINER POST session hợp lệ | 201, `status=PLANNED`, `trainerId`=trainer, `trainer` join |
| 2 | POST thiếu `type` | 400 |
| 3 | GROOM POST session | 403 |
| 4 | owner1 POST session | 403 |
| 5 | POST session cho horseId lạ | 404 |
| 6 | owner1 GET /horses/:id/sessions (ngựa mình) | 200, có session vừa tạo |
| 7 | owner2 GET /horses/:id/sessions (ngựa owner1) | 403 |
| 8 | owner1 GET /sessions/:id | 200 |
| 9 | owner2 GET /sessions/:id | 403 |
| 10 | GET /sessions/<uuid lạ> | 404 |
| 11 | TRAINER PATCH `notes` (đang PLANNED) | 200 |
| 12 | PATCH `status=DONE` không result | 400 `VALIDATION_ERROR` |
| 13 | GROOM PATCH `status=DONE` + `resultMetric`+`resultValue` | 200, `status=DONE` |
| 14 | GROOM PATCH kèm `type` | 403 |
| 15 | PATCH lại session đã DONE | 400 (terminal) |
| 16 | TRAINER tạo session #2 → PATCH `status=CANCELLED` (không result) | 200, `status=CANCELLED` |
| 17 | GET /horses/:id/sessions?status=PLANNED | chỉ trả session PLANNED |

## 10. Định nghĩa "xong"

- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (health + auth + horses + training)
- [ ] Smoke: TRAINER tạo → GROOM DONE + result → OWNER xem thấy (qua curl)
- [ ] `docs/`: cập nhật spec §11, STATE, PLAN, DECISIONS, API.md

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-08)

Khớp đặc tả. Điểm cần ghi nhớ:

- **class-transformer materialise field optional chưa gửi thành `undefined`** →
  `Object.keys(dto)` có cả field không gửi. Fix: lọc `Object.entries(dto)` theo
  `v !== undefined` trước khi kiểm GROOM-whitelist và "có field nào để update không".
- 2 controller: `HorseSessionsController` (`horses/:id/sessions`, gắn
  `HorseOwnershipGuard` ở class) + `SessionsController` (`sessions/:id`).
- `TrainingModule` provide `HorseOwnershipGuard` trực tiếp (chỉ cần `PrismaService`
  global), không phải import `HorsesModule`.
- Không cần migration.

**File tạo mới:**
```
src/training/{training.module,training.controller,training.service}.ts
src/training/dto/training.dto.ts
test/training.e2e-spec.ts
```
**Sửa:** `app.module.ts` (+TrainingModule) · `prisma/seed.ts` (+TRAINER/VET/GROOM
+ 3 session).

**Kiểm chứng:**
- `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **39/39** (health 1 + auth 9 + horses 15 + training 14) ✅
- Smoke curl: TRAINER tạo session → GROOM `DONE` thiếu result `400` →
  GROOM `DONE` + result `200` → OWNER `GET /sessions/:id` thấy `DONE` →
  GROOM sửa `type` `403`.

Định nghĩa "xong" §10: tất cả ☑.
