# Đặc tả — Phase 9: Training safety rules (EX-01 + UC-12)

> Viết trước khi code (2026-09-24). Nguồn: `CLAUDE_CODE_BACKEND_FULL.md`
> (Sprint 2) + [../DECISIONS.md](../DECISIONS.md) mục "2026-09-24 — Đối
> chiếu CLAUDE_CODE_BACKEND_FULL.md với code thật". Đây là **Sprint 2 phần
> còn thiếu** — 2 rule an toàn cho luồng Training chưa có ở Phase 3/7.
> Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

Hai rule độc lập, không phụ thuộc nhau, gắn vào 2 route **đã có sẵn** từ
Phase 3/7 — không thêm route mới:

**Trong phạm vi:**
- **EX-01 — chặn trùng lịch:** `POST /horses/:id/sessions` từ chối
  (`409 CONFLICT`) nếu ngựa đó đã có 1 buổi tập `PLANNED` trong khoảng
  **±60 phút** quanh giờ đang tạo.
- **UC-12 — cảnh báo ngưỡng thể lực:** `PATCH /sessions/:id` khi chuyển
  sang `DONE` với `resultMetric === "heart_rate_max"` và
  `resultValue > 195` → tạo thông báo `FITNESS_WARNING` cho HLV tạo buổi
  tập + mọi GROOM đang hoạt động + chủ ngựa.
- Thêm `NotificationType.FITNESS_WARNING` vào schema (migration nhỏ).

**Ngoài phạm vi:**
- Không thêm field `duration` cho `TrainingSession` — cửa sổ 60 phút áp
  dụng đối xứng quanh `scheduledAt`, đủ dùng cho MVP mở rộng.
- Không check trùng lịch khi **sửa giờ** một session đã `PLANNED` qua
  `PATCH /sessions/:id` — chỉ áp dụng lúc **tạo mới** (đúng phạm vi EX-01
  nêu trong task list gốc).
- Không đánh giá metric nào khác ngoài `heart_rate_max` — `resultMetric`
  là free text do người dùng tự đặt, không thể suy luận ý nghĩa của các
  giá trị tuỳ ý khác.
- Không thêm cấu hình ngưỡng qua `.env`/admin UI — ngưỡng cố định trong
  code, ghi rõ trong quyết định thiết kế để đổi sau nếu cần.

## 2. Data model

Chỉ thêm 1 giá trị enum, không có bảng/cột mới:

```prisma
enum NotificationType {
  TRAINING_LOCKED
  TRAINING_UNLOCKED
  INCIDENT_REPORTED
  FITNESS_WARNING   // mới — Phase 9
}
```

Migration: `npx prisma migrate dev --name phase9_fitness_warning_notification`.

## 3. Hợp đồng API — mở rộng 2 route đã có

### 3.1 `POST /horses/:id/sessions` (TRAINER) — thêm rule EX-01

Không đổi request/response body. Thêm điều kiện: nếu ngựa đã có session
`status=PLANNED` với `scheduledAt` cách giờ đang tạo **dưới 60 phút** (cả
hai chiều) → `409 CONFLICT`, message nêu rõ giờ của session đang xung đột.
Check này **sau** rule Training Lock đã có (Phase 7) — khoá ngựa vẫn ưu
tiên báo lỗi trước (400) nếu cả 2 đều đúng, giữ thứ tự lỗi nhất quán với
service hiện tại.

### 3.2 `PATCH /sessions/:id` (TRAINER/GROOM) — thêm rule UC-12

Không đổi request/response body, không đổi validate hiện có (vẫn cần
`resultMetric`+`resultValue` khi chuyển `DONE`). Sau khi update thành công,
**nếu** `resultMetric === "heart_rate_max"` **và** `resultValue > 195` →
tạo `Notification` (`type=FITNESS_WARNING`) cho:
- HLV tạo buổi tập (`session.trainerId`),
- mọi user `role=GROOM`, `status=ACTIVE`, `deletedAt:null`,
- chủ ngựa (`horse.ownerId`).

Không chặn/không đổi response nếu vượt ngưỡng — chỉ tạo thông báo, giống
cách `HorsesService.lock()` không đổi response khi gửi thông báo phụ.

## 4. RBAC & ownership

Không đổi — dùng nguyên guard/role hiện có của 2 route này
(`HorseOwnershipGuard` cho POST, `@Roles(TRAINER, GROOM)` cho PATCH).

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **Cửa sổ xung đột cố định 60 phút**, không thêm field `duration` —
   `TrainingSession` không có khái niệm thời lượng; 60 phút là ước lượng
   hợp lý cho 1 buổi tập, đủ để demo rule mà không phải đổi schema.
2. **Chỉ check lúc tạo mới, không check khi sửa giờ** — giữ đúng phạm vi
   nêu trong `CLAUDE_CODE_BACKEND_FULL.md` ("validation in
   `POST /horses/:id/sessions`"), tránh side-effect phức tạp khi PATCH.
3. **Chỉ đánh giá 1 metric cố định `heart_rate_max`**, ngưỡng `> 195` —
   lấy đúng ví dụ minh hoạ trong task list gốc (`heartRateMax > 195`).
   Không suy luận ý nghĩa của các `resultMetric` tự do khác.
4. **"GROOM liên quan" = mọi user role GROOM đang ACTIVE`** — schema hiện
   không gán 1 GROOM cụ thể cho từng ngựa/session (khác TRAINER — có
   `trainerId` trên session), nên không thể lọc hẹp hơn. Giống cách
   `managerIds()` gửi cho mọi MANAGER ở Phase 8.
5. **Không tạo `NotificationsService` mới** — tái dùng service đã có từ
   Phase 8, chỉ thêm 1 helper `groomIds()` song song với `managerIds()`
   đã có.
6. **Migration chỉ thêm 1 giá trị enum** — không đổi bảng nào khác, an
   toàn tuyệt đối với dữ liệu cũ.

## 6. Cấu trúc code

```
prisma/schema.prisma          # + FITNESS_WARNING vào NotificationType
prisma/migrations/<ts>_phase9_fitness_warning_notification/

src/notifications/notifications.service.ts   # + groomIds() (song song managerIds())
src/training/training.module.ts              # import NotificationsModule
src/training/training.service.ts             # + assertNoScheduleConflict() trong create()
                                              # + fitness-warning check trong update() sau khi DONE hợp lệ

test/training-safety.e2e-spec.ts             # mới
```

`TrainingModule` cần import `NotificationsModule` để inject
`NotificationsService` vào `TrainingService` (giống cách `IncidentsModule`
đã làm ở Phase 8).

## 7. Env

Không thêm biến mới. Ngưỡng `195` và cửa sổ `60` phút là hằng số trong
`training.service.ts` (`FITNESS_HEART_RATE_MAX = 195`,
`SESSION_CONFLICT_WINDOW_MIN = 60`), có comment trỏ về mục quyết định #1/#3
ở trên để người sau biết đổi ở đâu nếu ngưỡng thay đổi.

## 8. Seed

Không bắt buộc thêm — 2 rule này test qua e2e là đủ, seed hiện tại giữ nguyên.

## 9. Kế hoạch test — `test/training-safety.e2e-spec.ts`

Đăng nhập manager, trainer, groom, vet, owner1; 1 ngựa test (owner1, không
khoá); cleanup `afterAll` (xoá session + notification liên quan + ngựa).

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | TRAINER tạo session giờ X | 201 |
| 2 | TRAINER tạo session khác cho **cùng ngựa** trong vòng 60' quanh giờ X | 409 `CONFLICT` |
| 3 | TRAINER tạo session cách giờ X đúng 61 phút | 201 (không xung đột) |
| 4 | TRAINER tạo session cho **ngựa khác** cùng giờ X | 201 (không liên quan tới ngựa X) |
| 5 | Khoá ngựa rồi tạo session trùng giờ | 400 (rule Training Lock ưu tiên trước, không phải 409) |
| 6 | GROOM chuyển session #1 `DONE` với `resultMetric="heart_rate_max"`, `resultValue=210` | 200; sau đó TRAINER + GROOM + owner1 đều có `Notification` mới `type=FITNESS_WARNING` |
| 7 | Chuyển 1 session khác `DONE` với `resultMetric="heart_rate_max"`, `resultValue=180` (dưới ngưỡng) | 200, **không** có thông báo mới |
| 8 | Chuyển 1 session `DONE` với `resultMetric` khác (vd `"time_1200m_s"`), giá trị lớn | 200, **không** có thông báo (không đánh giá metric khác) |

## 10. Định nghĩa "xong"

- [ ] `npx prisma migrate dev` chạy sạch
- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (117 test cũ + test mới)
- [ ] `docs/`: cập nhật spec §11, STATE.md, PLAN.md, DECISIONS.md, API.md, specs/README.md

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-24)

Khớp đặc tả. Điểm cần ghi nhớ:

- Migration `phase9_fitness_warning_notification` chỉ thêm 1 giá trị enum
  (`NotificationType.FITNESS_WARNING`), không đổi bảng nào khác.
- `assertNoScheduleConflict()` chạy **sau** rule Training Lock và **sau**
  validate `planId` trong `create()` — thứ tự lỗi: khoá (400) → planId sai
  (400) → trùng lịch (409). Test `training-safety.e2e-spec.ts` xác nhận
  khoá ngựa vẫn báo 400 trước, không phải 409, kể cả khi cả 2 điều kiện
  đều đúng.
- `maybeWarnFitness()` không throw — lỗi khi gửi thông báo (nếu có) sẽ làm
  request 500 thay vì âm thầm nuốt lỗi; chấp nhận được vì
  `notifyUsers()` hiện không có nhánh lỗi thực tế (chỉ `createMany`).
- **2 test cũ bị vỡ do rule EX-01 mới** (không phải bug ở Phase 9, mà do
  test cũ tạo nhiều session "now" cho cùng 1 ngựa, giờ va vào cửa sổ 60
  phút): `training.e2e-spec.ts` ("CANCELLED without a result") và
  `training-plan.e2e-spec.ts` ("session linked to a plan") — sửa bằng cách
  dời giờ tạo session lệch +2 tiếng so với session trước đó trong cùng
  test, kèm comment giải thích lý do. Không đổi hành vi được test, chỉ
  tránh trùng lịch giả (test artifact).

**File tạo mới:**
```
prisma/migrations/20260924090416_phase9_fitness_warning_notification/
test/training-safety.e2e-spec.ts
```
**Sửa:** `prisma/schema.prisma` (+FITNESS_WARNING) ·
`src/notifications/notifications.service.ts` (+`groomIds()`) ·
`src/training/training.module.ts` (+import NotificationsModule) ·
`src/training/training.service.ts` (+`assertNoScheduleConflict()`,
+`maybeWarnFitness()`, +2 hằng số) · `test/training.e2e-spec.ts` +
`test/training-plan.e2e-spec.ts` (sửa giờ tạo session để tránh EX-01 giả).

**Kiểm chứng:**
- `npx prisma migrate dev` ✅ · `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **125/125** (117 cũ + 8 mới) ✅

Định nghĩa "xong" §10: build/lint/e2e/docs ☑.
