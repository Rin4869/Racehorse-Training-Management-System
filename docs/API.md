# API — danh sách endpoint đầy đủ

Base path: `/api/v1`. Auth: `Authorization: Bearer <accessToken>` (JWT ~15').
Role trong token quyết định quyền + phạm vi dữ liệu (ownership filter).

Ký hiệu quyền: chữ trong ngoặc = role được phép gọi.
Trạng thái: ✅ = đã code + test (Phase 1-2); còn lại = kế hoạch.

## Auth ✅ (Phase 1 — spec: PLAN.md §4, STATE.md §3b)

```
POST   /auth/register           {name,email,password} → tạo User PENDING + mail verify
GET    /auth/verify-email?token=                       → set emailVerifiedAt
POST   /auth/login              {email,password}       → {accessToken, refreshToken, user}
POST   /auth/refresh            {refreshToken}         → cặp token mới (rotation)
POST   /auth/logout             {refreshToken}         → revoke refresh token
POST   /auth/forgot-password    {email}                → luôn 200 (không lộ email tồn tại)
POST   /auth/reset-password     {token,newPassword}    → đổi pass + revoke mọi refresh
GET    /auth/me                 (auth)                 → user hiện tại
```
Login lỗi (theo thứ tự kiểm tra): `UNAUTHENTICATED` (sai pass) → `EMAIL_NOT_VERIFIED`
→ `ACCOUNT_PENDING` → `ACCOUNT_DISABLED`.

## Users ✅ (Phase 1)

```
GET    /users?status=&role=&page=&limit=   (MANAGER)  → {data, meta}
GET    /users/:id                          (MANAGER)
PATCH  /users/:id       {name?,role?,status?} (MANAGER)  # duyệt PENDING = role + status=ACTIVE
DELETE /users/:id                          (MANAGER)  # soft delete, không tự xoá mình
```
Chưa có `POST /users` (đăng ký qua `/auth/register`).

## Horses ✅ (Phase 2 — spec: specs/phase-2-horses.md)

```
POST   /horses                 (MANAGER)  {name, ownerId, breed?, birthDate?, status?}
GET    /horses?ownerId=&status=&q=&page=&limit=  (auth)  # OWNER bị ép ownerId = chính mình
GET    /horses/:id             (auth, OWNER chỉ ngựa của mình → 403 nếu không)
PATCH  /horses/:id             (MANAGER)  {name?,breed?,birthDate?,status?,ownerId?}  # null xoá breed/birthDate
DELETE /horses/:id             (MANAGER)  # soft delete
POST   /horses/:id/photo       (MANAGER)  multipart field "file" (jpg/png/webp ≤5MB) → Horse (photoUrl)
```
`ownerId` phải là user role=OWNER (sai → `VALIDATION_ERROR`). Object trả về có
`photoUrl` = `/api/v1/files/<photoPath>` hoặc null.

## Files ✅ (Phase 2 + 4)

```
GET    /files/horse-photos/:filename        (auth, ownership như GET /horses/:id)
GET    /files/health-attachments/:filename  (auth, ownership qua record→horse)
```
`horse-photos`: filename `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$`.
`health-attachments`: filename `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|pdf)$`.
Không khớp / không có resource tương ứng / file không tồn tại → 404; OWNER khác chủ → 403.

## Training ✅ (Phase 3 — spec: specs/phase-3-training.md)

```
POST   /horses/:id/sessions   (TRAINER)  {scheduledAt, type, notes?}   # trainerId = người gọi, status=PLANNED
GET    /horses/:id/sessions?status=&from=&to=&page=&limit=  (mọi role, OWNER*)  # sort scheduledAt asc
GET    /sessions/:id          (mọi role, OWNER*)   # ownership qua session→horse
PATCH  /sessions/:id          (TRAINER: mọi field khi PLANNED | GROOM: status + result)
```
State machine: `PLANNED → DONE | CANCELLED` (DONE/CANCELLED là trạng thái cuối).
Chuyển `DONE` phải kèm `resultMetric` + `resultValue` (payload hoặc đã có) → thiếu
= `VALIDATION_ERROR`. GROOM gửi field ngoài `{status,resultMetric,resultValue}` →
`FORBIDDEN`. Không có endpoint xoá — hủy = `CANCELLED`.
Chưa làm: `training-plans`, `/sessions/:id/results` riêng (kết quả gộp trong session).

## Health ✅ (Phase 4 — spec: specs/phase-4-health.md)

```
POST   /horses/:id/health-records           (VET)  {examDate, diagnosis, treatment?}
                                                   # vetId = người gọi; examDate không được tương lai
GET    /horses/:id/health-records?from=&to=&page=&limit=  (mọi role, OWNER*)  # sort examDate desc
GET    /health-records/:id                   (mọi role, OWNER*)   # ownership qua record→horse
PATCH  /health-records/:id                   (VET)  {examDate?, diagnosis?, treatment?}  # treatment:null để xoá
POST   /health-records/:id/attachment        (VET)  multipart field "file" (jpg/png/webp/pdf ≤5MB) → HealthRecord
```
Object trả về có `attachmentUrl` = `/api/v1/files/<attachmentPath>` hoặc null.
Không có endpoint DELETE (model không có `deletedAt`/`updatedAt`).
Chưa làm: `vaccinations`, `medications`.

## Health & Injury ✅ (Phase 8 — spec: specs/phase-8-health-injury.md)

```
POST   /horses/:id/incidents         (GROOM)  {description, severity: LOW|MEDIUM|HIGH}
                                     # severity=HIGH tự khoá ngựa (gọi lại PATCH lock của Phase 7)
GET    /horses/:id/incidents?status=&page=&limit=  (mọi role, OWNER*)  # sort createdAt desc
GET    /incidents/:id                (mọi role, OWNER*)
PATCH  /incidents/:id                (VET)  {status?: OPEN|IN_PROGRESS|RESOLVED, healthRecordId?}
                                     # status chỉ tiến; RESOLVED khi đang khoá → tự mở khoá

GET    /notifications?unread=&page=&limit=  (auth, luôn của chính mình)
PATCH  /notifications/:id/read       (auth, chỉ của chính mình)
```
`healthRecordId` (nếu gửi) phải là hồ sơ khám của cùng ngựa. Mỗi lần
`PATCH /horses/:id/lock` (Phase 7) hoặc auto-lock/unlock từ sự cố đổi
`locked` → tạo `Notification` (`TRAINING_LOCKED`/`TRAINING_UNLOCKED`) cho
chủ ngựa + mọi MANAGER; tạo sự cố (mọi severity) → thêm `INCIDENT_REPORTED`.
Không có DELETE cho `IncidentReport`/`Notification`.
**Đủ cả 3 luồng mở rộng sau-MVP** (Pedigree & Races, Training Plan & Lock,
Health & Injury).

## Training Plan & Lock ✅ (Phase 7 — spec: specs/phase-7-training-plan-lock.md)

```
PATCH  /horses/:id/lock              (VET)  {locked, reason?}  # reason chỉ giữ khi locked=true
POST   /horses/:id/training-plans    (TRAINER)  {goal, startDate, endDate?}
GET    /horses/:id/training-plans?page=&limit=  (mọi role, OWNER*)  # sort startDate desc
GET    /training-plans/:id           (mọi role, OWNER*)  → TrainingPlan + sessions[]
PATCH  /training-plans/:id           (TRAINER)  {goal?, startDate?, endDate?}
POST   /horses/:id/sessions          (TRAINER)  + planId? (route sẵn có, mở rộng)
                                     # chặn nếu horse.locked=true → VALIDATION_ERROR
```
`endDate` (nếu có) phải `>= startDate`. Không có DELETE cho `TrainingPlan`.

## Pedigree & Races ✅ (Phase 6 — spec: specs/phase-6-pedigree.md)

```
PATCH  /horses/:id                (MANAGER)  + sireId?, damId?, fitnessScore?  # route sẵn có, mở rộng field
GET    /horses/:id/pedigree       (mọi role, OWNER*)   # cây phả hệ 3 đời

POST   /races                     (MANAGER)  {name, date, venue?, distance?, surface?, prizePool?}
GET    /races?from=&to=&page=&limit=  (auth, mọi role — không ownership)  # sort date desc
GET    /races/:id                 (auth)  → Race + entries (join horse)
PATCH  /races/:id                 (MANAGER)
POST   /races/:id/entries         (MANAGER)  {horseId, position?, time?}  # 1 ngựa/giải, trùng → 409
GET    /horses/:id/race-entries?page=&limit=  (mọi role, OWNER*)  # sort race.date desc
PATCH  /race-entries/:id          (MANAGER)  {position?, time?}
```
`sireId`/`damId`: phải trỏ ngựa tồn tại khác chính nó, khác nhau; `fitnessScore`
0..100. Không dò vòng lặp phả hệ sâu. `Race`/`RaceEntry` không có DELETE.

## Health — kế hoạch sau MVP

```
POST   /horses/:id/vaccinations              (VET)
GET    /horses/:id/vaccinations              (MANAGER, VET, OWNER*)

POST   /health-records/:id/medications       (VET)
GET    /health-records/:id/medications       (MANAGER, VET, OWNER*)
```

## Care & Facility

```
POST   /horses/:id/care-logs                 (GROOM)
GET    /horses/:id/care-logs?from=&to=       (MANAGER, TRAINER, GROOM, OWNER*)

GET    /stalls?status=                       (MANAGER, GROOM)
POST   /stalls                               (MANAGER)
PATCH  /stalls/:id                           (MANAGER, GROOM: status)

POST   /facility-tasks                       (MANAGER)
GET    /facility-tasks?assigned_to=&status=  (MANAGER, GROOM)
PATCH  /facility-tasks/:id                   (MANAGER, GROOM: status)
```

## Reports (MANAGER)

```
GET    /reports/summary?from=&to=            tổng số session, tỉ lệ hoàn thành,
                                             số ca khám, ngựa theo status
GET    /reports/horse/:id?from=&to=          lịch sử tập + y tế của 1 ngựa
```

`*` OWNER: chỉ truy cập được khi resource thuộc ngựa mà họ sở hữu, ngược lại 403.

## Quy ước response

- Lỗi: `{ "error": { "code": "FORBIDDEN", "message": "..." } }`
- List: `{ "data": [...], "meta": { "page", "limit", "total" } }`
- Timestamp: ISO 8601 UTC.
- Mã HTTP: 200/201, 400 validation, 401 chưa auth, 403 sai quyền, 404, 409 conflict.
