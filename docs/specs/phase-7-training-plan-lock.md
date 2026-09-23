# Đặc tả — Phase 7: Training Plan & Training Lock

> Viết trước khi code (2026-09-14). Nguồn: [../DECISIONS.md](../DECISIONS.md)
> mục "2026-09-12 — Mở rộng data model theo 3 activity diagram + ERD",
> [../DATA_MODEL.md](../DATA_MODEL.md) §"bản đầy đủ" (nhóm huấn luyện).
> Đây là **luồng thứ 2/3** của việc mở rộng sau-MVP (luồng 1: Pedigree & Races
> — [phase-6-pedigree.md](phase-6-pedigree.md), đã xong; luồng 3: Health &
> Injury — phase sau). Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

Luồng demo **"Training Plan"**: TRAINER lập kế hoạch tập luyện (mục tiêu +
khoảng thời gian) cho 1 ngựa, gắn các buổi tập (đã có từ Phase 3) vào kế
hoạch. Kèm **Training Lock**: VET khoá tập luyện của 1 ngựa (vd sau chấn
thương) → TRAINER không tạo được buổi tập mới cho tới khi VET mở khoá.

**Trong phạm vi:**
- Thêm `Horse.locked` (boolean, default false) + `Horse.lockReason` (nullable).
- `PATCH /horses/:id/lock` (VET) — khoá/mở khoá + lý do.
- Model mới `TrainingPlan` (`horseId, trainerId, goal, startDate, endDate?`).
- `POST/GET /horses/:id/training-plans`, `GET/PATCH /training-plans/:id`.
- `TrainingSession` thêm `planId` (nullable) — buổi tập có thể gắn vào 1 kế
  hoạch (tuỳ chọn, không bắt buộc).
- **`POST /horses/:id/sessions` chặn khi `horse.locked === true`** (route đã
  có từ Phase 3, chỉ thêm 1 điều kiện) → `VALIDATION_ERROR`.
- Seed: 1 kế hoạch cho 1 ngựa, khoá thử 1 ngựa khác (demo TRAINER bị chặn tạo
  buổi tập).
- e2e phủ happy path + 403/400/404 cho route mới + rule khoá.

**Ngoài phạm vi (để phase sau hoặc không làm):**
- `incident_reports` (thuộc luồng Health & Injury — phase sau); ở phase này
  VET tự khoá/mở khoá tay qua `PATCH /horses/:id/lock`, chưa gắn tự động vào
  1 sự cố cụ thể (chưa có bảng đó). Khi Phase 8 làm `incident_reports`, có thể
  gọi lại chính service này để khoá tự động — không đổi hợp đồng ở đây.
- `notifications` khi khoá/mở khoá (thuộc Health & Injury).
- Xoá `TrainingPlan`, đóng kế hoạch tự động khi hết `endDate` (cron) — không
  làm ở MVP mở rộng này.
- Chặn PATCH buổi tập đã lên kế hoạch khi ngựa bị khoá (chỉ chặn **tạo mới**
  — xem §5.5).

## 2. Data model

### 2.1 Sửa `Horse` (migration mới, cột nullable/default — không phá dữ liệu cũ)

```prisma
model Horse {
  // ...existing fields...
  locked       Boolean  @default(false)
  lockReason   String?  // lý do khoá, VET nhập khi locked=true

  trainingPlans TrainingPlan[]
}
```

### 2.2 Model mới `TrainingPlan`

```prisma
model TrainingPlan {
  id        String    @id @default(uuid())
  horseId   String
  horse     Horse     @relation(fields: [horseId], references: [id])
  trainerId String
  trainer   User      @relation("PlanTrainer", fields: [trainerId], references: [id])
  goal      String
  startDate DateTime
  endDate   DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  sessions  TrainingSession[]

  @@index([horseId])
}
```

### 2.3 Sửa `TrainingSession` — thêm liên kết tuỳ chọn tới kế hoạch

```prisma
model TrainingSession {
  // ...existing fields...
  planId String?
  plan   TrainingPlan? @relation(fields: [planId], references: [id])
}
```

`User` thêm `planTrainerFor TrainingPlan[] @relation("PlanTrainer")` (tách
khỏi relation `SessionTrainer` đã có, giống cách Phase 6 tách
`HorsePedigree_Sire`/`_Dam`).

Không soft-delete cho `TrainingPlan` (giống `TrainingSession`/`Race`).
Migration: `npx prisma migrate dev --name phase7_training_plan_lock`.

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.
List: `{ data: [...], meta: { page, limit, total } }`.

### 3.1 `PATCH /horses/:id/lock` — (VET, `HorseOwnershipGuard`)

```jsonc
{ "locked": true, "reason": "Left fore lameness, rest 2 weeks" }
```
`locked` bắt buộc (boolean); `reason` optional (`<=500` ký tự, chỉ có ý nghĩa
khi `locked=true`, lưu `null` khi `locked=false` dù có gửi `reason` hay không
— mở khoá thì xoá lý do cũ).
Response `200`: `HorseView` (đã có từ Phase 2) + `locked`, `lockReason`.
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN` (không phải VET / OWNER khác ngựa),
`NOT_FOUND`.

### 3.2 `POST /horses/:id/training-plans` — (TRAINER, `HorseOwnershipGuard`)

```jsonc
{ "goal": "Build stamina for Spring Derby", "startDate": "2026-09-15T00:00:00.000Z",
  "endDate": "2026-10-15T00:00:00.000Z" }
```
`goal`, `startDate` bắt buộc; `endDate` optional, nếu có phải `>= startDate`
→ sai `VALIDATION_ERROR`. `trainerId` = người gọi. **Không bị chặn bởi
`locked`** — lập kế hoạch được ngay cả khi ngựa đang khoá (kế hoạch cho
tương lai, chờ mở khoá).
Response `201`: `TrainingPlan` (kèm `trainer` join). Lỗi: `VALIDATION_ERROR`,
`FORBIDDEN`, `NOT_FOUND` (horse).

### 3.3 `GET /horses/:id/training-plans?page=&limit=` — (auth, ownership)

Sắp xếp `startDate desc`. Lỗi: `NOT_FOUND`, `FORBIDDEN` (OWNER ngựa khác).

### 3.4 `GET /training-plans/:id` — (auth, ownership qua plan→horse ở service)

Giống pattern `/sessions/:id`/`/health-records/:id`. Response gồm
`sessions: [{id, scheduledAt, type, status}]` (tóm tắt buổi tập gắn kế
hoạch, sort `scheduledAt asc`). Lỗi: `NOT_FOUND`, `FORBIDDEN`.

### 3.5 `PATCH /training-plans/:id` — (TRAINER)

Body: `{goal?, startDate?, endDate?}` (≥1 field, `endDate: null` để xoá).
Validate lại `endDate >= startDate` (dùng giá trị mới hoặc giá trị cũ nếu
field kia không gửi). Không cho sửa `horseId`/`trainerId`.
Response `200`: `TrainingPlan`. Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`.
Không cần ownership guard riêng — chỉ TRAINER tới được, TRAINER xem/sửa mọi
kế hoạch (giống VET với health-records ở Phase 4, 1 CLB ít trainer).

### 3.6 `POST /horses/:id/sessions` — mở rộng (route đã có từ Phase 3)

Thêm field optional `planId` vào `CreateSessionDto`. Nếu gửi, phải trỏ tới
`TrainingPlan` **thuộc cùng ngựa** (`planId` tồn tại + `plan.horseId === id`)
→ sai `VALIDATION_ERROR`.

**Rule mới:** nếu `horse.locked === true` → tạo buổi tập mới bị chặn:
`VALIDATION_ERROR` message `"Horse training is locked: <lockReason>"`.
Áp dụng cho mọi buổi tập mới bất kể có `planId` hay không.

### 3.7 Hình dạng object `TrainingPlan`
```jsonc
{
  "id": "uuid",
  "horseId": "uuid",
  "trainerId": "uuid",
  "trainer": { "id": "uuid", "name": "Trainer One", "email": "..." },
  "goal": "Build stamina for Spring Derby",
  "startDate": "ISO",
  "endDate": "ISO | null",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```
`GET /training-plans/:id` thêm `sessions: [...]` (xem §3.4).

## 4. RBAC & ownership

| Route | Role | Ownership |
|---|---|---|
| PATCH /horses/:id/lock | VET | `HorseOwnershipGuard` |
| POST /horses/:id/training-plans | TRAINER | `HorseOwnershipGuard` |
| GET /horses/:id/training-plans | mọi role | `HorseOwnershipGuard` |
| GET /training-plans/:id | mọi role | service: plan→horse, OWNER phải là chủ |
| PATCH /training-plans/:id | TRAINER | — (không ownership, giống VET/health-records) |
| POST /horses/:id/sessions | TRAINER | `HorseOwnershipGuard` (đã có) + rule `locked` mới |

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **VET là người duy nhất khoá/mở khoá** (`PATCH /horses/:id/lock`), không
   phải MANAGER — đúng chốt "Training Lock do Vet ban hành" trong
   DATA_MODEL.md. `HorseOwnershipGuard` vẫn áp dụng (dù VET luôn qua) để nhất
   quán với các route khác trên `:id`.
2. **Không có `incident_reports` ở phase này** — khoá là hành động tay của
   VET, chưa gắn với 1 hồ sơ sự cố cụ thể (bảng đó thuộc Phase 8). Khi làm
   Phase 8, `incident_reports` có thể gọi cùng service `lock()`/`unlock()`
   này thay vì tạo API riêng.
3. **`lockReason` bị xoá khi mở khoá** (`locked=false` → `lockReason=null`
   luôn, không giữ lịch sử lý do cũ) — không có bảng lịch sử khoá ở MVP mở
   rộng này; muốn xem lại thì tra `updatedAt` của Horse (đã có).
4. **Chỉ chặn TẠO buổi tập mới khi khoá**, không chặn PATCH buổi tập đã có
   — một buổi `PLANNED` từ trước khi khoá vẫn sửa được (thường là để
   `CANCELLED` khi ngựa bị thương, hoặc `DONE` nếu đã tập trước khi phát
   hiện chấn thương). Không thêm rule chặn PATCH để giữ đơn giản.
5. **Lập kế hoạch (`POST training-plans`) không bị chặn bởi `locked`** — kế
   hoạch là dự định tương lai, hợp lý ngay cả khi ngựa đang nghỉ; chỉ **thực
   hiện buổi tập cụ thể** (tạo session) mới bị chặn.
6. **`planId` trên session là optional, không bắt buộc buổi tập phải thuộc
   1 kế hoạch** — giữ tương thích ngược với Phase 3 (buổi tập tạo tự do vẫn
   hoạt động như cũ).
7. **`PATCH /training-plans/:id` không có ownership guard** — chỉ TRAINER
   tới được, TRAINER xem/sửa mọi kế hoạch mọi ngựa (giống VET với
   health-records ở Phase 4 — 1 CLB, ít trainer, không cần "trainer nào tạo
   thì trainer đó sửa").
8. **Không có DELETE** cho `TrainingPlan` — giống pattern `HealthRecord`/`Race`.
9. **Tách relation Prisma `"PlanTrainer"` khỏi `"SessionTrainer"`** trên
   `User` — 2 khái niệm khác nhau (ai lập kế hoạch vs ai tạo buổi tập), dù
   thường cùng 1 người.
10. **Migration tên `phase7_training_plan_lock`**, chỉ thêm cột
    default/nullable + bảng mới — không phá Phase 0-6.

## 6. Cấu trúc code

```
prisma/schema.prisma          # + locked/lockReason trên Horse, model TrainingPlan,
                              #   + planId trên TrainingSession, + relation PlanTrainer trên User
prisma/migrations/<ts>_phase7_training_plan_lock/

src/horses/
  dto/horses.dto.ts           # + LockHorseDto (không chung UpdateHorseDto — route riêng)
  horses.service.ts           # + lock() method
  horses.controller.ts        # + PATCH :id/lock

src/training/
  dto/training.dto.ts         # + CreateTrainingPlanDto, UpdateTrainingPlanDto,
                              #   ListTrainingPlansQueryDto; CreateSessionDto + planId?
  training.controller.ts      # + HorseTrainingPlansController (horses/:id/training-plans)
                              # + TrainingPlansController (training-plans/:id)
  training.service.ts         # + createPlan/listPlansByHorse/getPlan/updatePlan
                              #   + create() kiểm tra horse.locked + validate planId

prisma/seed.ts                 # + 1 training plan, khoá 1 ngựa demo
test/training-plan.e2e-spec.ts # plan CRUD + lock rule
src/app.module.ts              # không đổi (TrainingModule/HorsesModule đã import)
```

`LockHorseDto` tách khỏi `UpdateHorseDto` vì route riêng (`PATCH
:id/lock`), khác role (VET, không phải MANAGER) — dùng chung DTO dễ nhầm
field được phép sửa ở route nào.

## 7. Env

Không thêm biến mới.

## 8. Seed (bổ sung, idempotent)

- 1 `TrainingPlan` cho Thunderbolt (owner1): goal "Build stamina for Spring
  Derby 2026", `startDate` hôm nay, `endDate` +30 ngày, `trainerId` = TRAINER seed.
- Khoá **Sea Breeze** (owner1): `locked=true`,
  `lockReason="Mild tendon strain — resting per vet advice"` — demo TRAINER
  bị chặn tạo buổi tập mới cho ngựa này.

## 9. Kế hoạch test — `test/training-plan.e2e-spec.ts`

Đăng nhập manager, trainer, vet, owner1, owner2; 2 ngựa test (`horseA` bình
thường, `horseB` sẽ bị khoá) — owner1; cleanup `afterAll`.

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | TRAINER POST training-plan hợp lệ | 201, `trainerId`=trainer |
| 2 | POST thiếu `goal` | 400 |
| 3 | POST `endDate < startDate` | 400 |
| 4 | VET/OWNER POST training-plan | 403 |
| 5 | POST cho horseId lạ | 404 |
| 6 | owner1 GET `/horses/horseA/training-plans` | 200, thấy plan |
| 7 | owner2 GET training-plans ngựa owner1 | 403 |
| 8 | GET `/training-plans/:id` | 200, có `sessions: []` |
| 9 | TRAINER PATCH plan `goal` | 200 |
| 10 | PATCH `endDate` < `startDate` hiện có | 400 |
| 11 | VET PATCH plan | 403 |
| 12 | VET PATCH `/horses/horseB/lock` `{locked:true, reason}` | 200, `locked=true` |
| 13 | MANAGER PATCH lock | 403 (không phải VET) |
| 14 | TRAINER POST session cho horseB (đã khoá) | 400 `VALIDATION_ERROR` |
| 15 | TRAINER POST session cho horseA (không khoá) | 201 (rule cũ Phase 3 vẫn chạy) |
| 16 | TRAINER POST session với `planId` hợp lệ (horseA) | 201, `planId` set |
| 17 | TRAINER POST session với `planId` thuộc ngựa khác | 400 |
| 18 | VET PATCH `/horses/horseB/lock` `{locked:false}` | 200, `locked=false`, `lockReason=null` |
| 19 | TRAINER POST session cho horseB sau khi mở khoá | 201 |

## 10. Định nghĩa "xong"

- [ ] `npx prisma migrate dev` chạy sạch, không mất dữ liệu cũ
- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (77 test cũ + test mới)
- [ ] Seed chạy lại idempotent, in đủ log
- [ ] `docs/`: cập nhật spec §11, STATE.md, PLAN.md, DECISIONS.md,
      DATA_MODEL.md (đưa training_plans + locked vào ERD MVP đang chạy),
      API.md, specs/README.md
- [ ] Frontend (`apps/web`) cho training plan + lock — **không bắt buộc để
      tính "xong" phase này**, làm lượt sau (giống Phase 6).

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-14)

Khớp đặc tả. Điểm cần ghi nhớ:

- Migration `phase7_training_plan_lock` áp dụng sạch, không mất dữ liệu cũ
  (chỉ thêm cột default/nullable trên `Horse`/`TrainingSession` + bảng mới).
- `LockHorseDto` tách khỏi `UpdateHorseDto` đúng như kế hoạch — route
  `PATCH :id/lock` dùng `@Roles(VET)` riêng, không lẫn với `PATCH :id`
  (`@Roles(MANAGER)`).
- `TrainingService.create()` (tạo session) kiểm tra `locked` **trước**
  `planId` — nếu ngựa vừa khoá vừa có `planId` sai ngựa, lỗi trả về là do
  `locked` (message có kèm `lockReason`), không phải lỗi `planId`. Test đã
  ghi chú rõ (`test/training-plan.e2e-spec.ts`).
- `assertPlanDates()` dùng chung cho `createPlan`/`updatePlan` — PATCH chỉ
  gửi 1 field (`endDate` hoặc `startDate`) vẫn validate đúng nhờ lấy giá trị
  hiện có cho field không gửi.
- `getPlan()` join `sessions` tóm tắt (`id, scheduledAt, type, status`) —
  không kéo toàn bộ object session, tránh vòng lặp include không cần thiết.

**File tạo mới:**
```
prisma/migrations/20260914112940_phase7_training_plan_lock/
test/training-plan.e2e-spec.ts
```
**Sửa:** `prisma/schema.prisma` (+locked/lockReason trên Horse, +model
TrainingPlan, +planId trên TrainingSession, +relation PlanTrainer trên User)
· `src/horses/dto/horses.dto.ts` (+LockHorseDto) ·
`src/horses/horses.service.ts` (+lock()) · `src/horses/horses.controller.ts`
(+PATCH :id/lock) · `src/training/dto/training.dto.ts` (+planId trên
CreateSessionDto, +3 DTO training-plan) · `src/training/training.service.ts`
(+rule locked, +validate planId, +4 method plan) ·
`src/training/training.controller.ts` (+2 controller mới) ·
`src/training/training.module.ts` (+2 controller) · `prisma/seed.ts` (+1
training plan, khoá Sea Breeze).

**Kiểm chứng:**
- `npx prisma migrate dev` ✅ · `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **96/96** (77 cũ + 19 mới) ✅
- `npm run db:seed` chạy lại idempotent, in đủ log plan + lock.

Định nghĩa "xong" §10: build/lint/e2e/seed/docs ☑. Frontend training-plan/lock:
**chưa làm**, để lượt sau (không chặn "xong" của phase này theo §10).
