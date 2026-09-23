# MVP — Main Flows

Mục tiêu MVP: chứng minh **luồng xuyên suốt**
`đặt lịch tập → thực hiện → ghi kết quả`, cộng khám bệnh và owner xem dữ liệu.
Cắt hết phần phụ.

## Main flows bắt buộc

1. **Setup** (MANAGER): tạo user → tạo horse → gán owner cho horse
2. **Training** (TRAINER): tạo session tập cho horse →
   (TRAINER/GROOM) đánh dấu hoàn thành + nhập kết quả
3. **Health** (VET): tạo health record cho horse
4. **View** (OWNER): xem horse của mình + lịch tập + hồ sơ y tế

## Data model rút gọn — 4 bảng

```
users             (id, name, email, password_hash, role, created_at)
                  role ∈ MANAGER | TRAINER | VET | GROOM | OWNER

horses            (id, name, breed, birth_date, owner_id → users.id,
                   status ∈ ACTIVE | RESTING | RETIRED, created_at)

training_sessions (id, horse_id → horses.id, trainer_id → users.id,
                   scheduled_at, type,
                   status ∈ PLANNED | DONE | CANCELLED,
                   result_metric, result_value, notes,
                   created_at, updated_at)
                  # kết quả gộp thẳng vào session cho gọn

health_records    (id, horse_id → horses.id, vet_id → users.id,
                   exam_date, diagnosis, treatment, created_at)
```

**Bỏ tạm khỏi MVP**: stalls, training_plans, vaccinations, medications,
daily_care_logs, facility_tasks, audit_logs, reports.

## Endpoints MVP (`/api/v1`)

```
POST   /auth/login

POST   /users                       (MANAGER)      # seed sẵn 1 manager
GET    /users?role=

POST   /horses                      (MANAGER)
GET    /horses                      # OWNER chỉ thấy ngựa của mình
GET    /horses/:id

POST   /horses/:id/sessions         (TRAINER)
GET    /horses/:id/sessions
PATCH  /sessions/:id                (TRAINER / GROOM: status + result)

POST   /horses/:id/health-records   (VET)
GET    /horses/:id/health-records
```

## Phân quyền MVP

| Endpoint | MANAGER | TRAINER | VET | GROOM | OWNER |
|---|:-:|:-:|:-:|:-:|:-:|
| tạo user / horse | ✅ | | | | |
| xem horse | ✅ tất cả | ✅ tất cả | ✅ tất cả | ✅ tất cả | ✅ của mình |
| tạo session | | ✅ | | | |
| cập nhật session (status/result) | | ✅ | | ✅ | |
| tạo health record | | | ✅ | | |
| xem health record | ✅ | ✅ | ✅ | ✅ | ✅ của mình |

Enforce ở tầng API (middleware check role + ownership). Không tin frontend.

## Frontend MVP

Một app React duy nhất, đổi giao diện theo role sau login (chưa tách web con).

Màn hình:
- Login
- Horse list + Horse detail (tabs: **Sessions** | **Health**)
- Form tạo session (TRAINER)
- Form cập nhật kết quả session (TRAINER / GROOM)
- Form health record (VET)
- Manager: form tạo user + tạo horse

## Seed data

- 1 MANAGER (đăng nhập sẵn)
- 1 TRAINER, 1 VET, 1 GROOM, 2 OWNER
- 3 horses (gán cho 2 owner)
- vài training_sessions ở trạng thái PLANNED và DONE
- 1-2 health_records

## Định nghĩa "xong MVP" — ✅ ĐẠT (2026-09-09)

- [x] Đăng nhập được bằng cả 5 role (seed: manager/trainer/vet/groom/owner1/owner2)
- [x] Manager tạo được horse; duyệt user PENDING (gán role + ACTIVE) qua `/admin/users`
- [x] Trainer tạo session → Groom đánh dấu DONE + nhập result
- [x] Vet tạo health record (+ upload đính kèm PDF/ảnh)
- [x] Owner đăng nhập chỉ thấy ngựa + lịch + hồ sơ y tế của mình (API ép ownership; owner khác → 403)
- [x] Swagger chạy (`/api/docs`), seed script chạy được từ DB trống (idempotent)
- [x] Frontend React demo được cả 4 luồng, song ngữ vi/en

Chi tiết triển khai: [specs/](specs/) phase 1–5 · [STATE.md](STATE.md).

## Sau MVP

Tách web con theo role → thêm module facility / vaccination / medication /
reports / audit log. Xem [DATA_MODEL.md](DATA_MODEL.md).
