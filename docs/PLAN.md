# PLAN — Core API (MVP)

Trạng thái: **Phase 0 → 5 XONG (2026-09-09) — MVP hoàn chỉnh** (Core API + frontend React demo).
**Phase 6/7/8 (Pedigree & Races, Training Plan & Lock, Health & Injury — API)
XONG (2026-09-14)** — cả 3 luồng mở rộng sau-MVP chốt 2026-09-12; xem
[STATE.md](STATE.md) §4 cho việc còn lại (chủ yếu là frontend).
Đặc tả từng phase (từ Phase 2): [specs/](specs/).

## 0. Chốt từ Q&A (2026-09-08)

| Mục | Quyết định |
|---|---|
| Stack API | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL — mỗi người tự cài lên Windows |
| Auth | Đầy đủ: đăng ký → PENDING, MANAGER duyệt & gán role; email verify + reset password + refresh token |
| Email | Gmail + App Password (SMTP qua nodemailer), config trong `.env` |
| Upload file | Có — lưu ổ đĩa local (`apps/api/uploads/`) |
| Repo | Monorepo: `apps/api` + `apps/web` |
| Tenant | Một câu lạc bộ duy nhất (không có bảng clubs) |
| Deploy | Chưa xác định — vẫn thêm Dockerfile + docker-compose để sẵn |
| Ngôn ngữ | Song ngữ i18n ở frontend; API trả `code` lỗi ổn định + message mặc định; enum trả raw |
| Timeline | Cả học kỳ (> 8 tuần) |
| Phạm vi mình build | Core API + 1 frontend React/Vite MVP demo |
| Git host | GitHub (nhóm vào được) |
| Package manager | npm · Node 24.19 |

## 1. Scale — kết luận

Hệ nội bộ 1 CLB: < 200 user, < 200 ngựa, ~100k-300k session sau vài năm, 10-50
concurrent. → **1 API instance + 1 Postgres**. Không Redis, không queue, không
cache layer. Việc "nhắc lịch tái khám/tiêm phòng" (nếu làm sau) = 1 cron job
`@nestjs/schedule`, chưa cần hạ tầng thêm.

Ưu tiên kỹ thuật: phân lớp sạch, RBAC + ownership chặt ở API, migration, seed,
test, OpenAPI, README.

## 2. Cấu trúc repo

```
racehorse/
├── docs/                     # tài liệu (đã có)
├── apps/
│   ├── api/                  # NestJS Core API
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/           # guards, interceptors, filters, decorators, dto base
│   │   │   │   ├── guards/        (JwtAuthGuard, RolesGuard, HorseOwnershipGuard)
│   │   │   │   ├── decorators/    (@Roles, @CurrentUser, @Public)
│   │   │   │   ├── interceptors/  (response envelope)
│   │   │   │   └── filters/       (http-exception → {error})
│   │   │   ├── config/           # env schema (zod/joi), config module
│   │   │   ├── prisma/           # PrismaModule + PrismaService
│   │   │   ├── mail/             # MailModule (nodemailer + templates)
│   │   │   ├── auth/             # register, login, verify, forgot/reset, refresh
│   │   │   ├── users/            # CRUD user, duyệt PENDING, gán role
│   │   │   ├── horses/           # CRUD horse, filter theo role
│   │   │   ├── training/         # training_sessions + kết quả
│   │   │   ├── health/           # health_records
│   │   │   └── files/            # upload/serve file local
│   │   ├── test/                 # e2e (supertest) cho 4 main flow
│   │   ├── .env.example
│   │   └── package.json
│   └── web/                   # React + Vite (frontend MVP demo)
│       ├── src/
│       │   ├── lib/api.ts        # axios client + interceptor gắn token + refresh
│       │   ├── auth/             # context, login, guard route theo role
│       │   ├── i18n/             # vi.json / en.json
│       │   ├── pages/            # Login, Horses, HorseDetail, Admin...
│       │   └── components/
│       └── package.json
├── docker-compose.yml        # postgres (+ api optional)
├── .gitignore
└── README.md
```

Không dùng monorepo tool (Nx/Turbo) cho gọn — mỗi app `package.json` riêng, chạy
độc lập. Script tiện ở root README.

## 3. Data model MVP (Prisma) — cập nhật so với MVP.md

Thêm field phục vụ auth đầy đủ + upload.

```prisma
enum Role      { MANAGER TRAINER VET GROOM OWNER }
enum UserStatus{ PENDING ACTIVE DISABLED }
enum HorseStatus { ACTIVE RESTING RETIRED }
enum SessionStatus { PLANNED DONE CANCELLED }

model User {
  id             String     @id @default(uuid())
  name           String
  email          String     @unique
  passwordHash   String
  role           Role?                        // null khi PENDING chưa gán
  status         UserStatus @default(PENDING)
  emailVerifiedAt DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  deletedAt      DateTime?
  horses         Horse[]        @relation("HorseOwner")
  trainerSessions TrainingSession[] @relation("SessionTrainer")
  vetRecords     HealthRecord[]
  refreshTokens  RefreshToken[]
  tokens         AuthToken[]   // verify + reset
}

model RefreshToken {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  tokenHash  String                       // hash, không lưu plaintext
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime @default(now())
}

model AuthToken {                          // email verify + password reset
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String                        // "VERIFY_EMAIL" | "RESET_PASSWORD"
  tokenHash String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}

model Horse {
  id         String      @id @default(uuid())
  name       String
  breed      String?
  birthDate  DateTime?
  ownerId    String
  owner      User        @relation("HorseOwner", fields: [ownerId], references: [id])
  status     HorseStatus @default(ACTIVE)
  photoPath  String?
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  deletedAt  DateTime?
  sessions       TrainingSession[]
  healthRecords  HealthRecord[]
}

model TrainingSession {
  id           String        @id @default(uuid())
  horseId      String
  horse        Horse         @relation(fields: [horseId], references: [id])
  trainerId    String
  trainer      User          @relation("SessionTrainer", fields: [trainerId], references: [id])
  scheduledAt  DateTime
  type         String
  status       SessionStatus @default(PLANNED)
  resultMetric String?
  resultValue  Float?
  notes        String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([horseId, scheduledAt])
  @@index([status])
}

model HealthRecord {
  id         String   @id @default(uuid())
  horseId    String
  horse      Horse    @relation(fields: [horseId], references: [id])
  vetId      String
  vet        User     @relation(fields: [vetId], references: [id])
  examDate   DateTime
  diagnosis  String
  treatment  String?
  attachmentPath String?
  createdAt  DateTime @default(now())

  @@index([horseId, examDate])
}
```

- Timestamp: `timestamptz`, luôn lưu UTC. Hiển thị theo `Asia/Ho_Chi_Minh` ở frontend.
- Soft delete: `deletedAt` trên User, Horse. Mọi query mặc định lọc `deletedAt: null`.
- Audit log: **hoãn**, nhưng sẽ thêm bảng `AuditLog` khi module đầu tiên ổn định.

## 4. Hợp đồng API

- Base: `/api/v1`. Swagger tại `/api/docs`.
- Auth header: `Authorization: Bearer <accessToken>` (JWT ~15 phút).
  Refresh token (~7 ngày) lưu httpOnly cookie **hoặc** body — chốt ở Phase 1.
- Response:
  - single: object thẳng
  - list: `{ "data": [...], "meta": { "page", "limit", "total" } }`
  - lỗi: `{ "error": { "code": "STRING_ENUM", "message": "…", "details"?: {...} } }`
- Mã lỗi ổn định để frontend i18n: `VALIDATION_ERROR`, `UNAUTHENTICATED`,
  `EMAIL_NOT_VERIFIED`, `ACCOUNT_PENDING`, `ACCOUNT_DISABLED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `TOKEN_EXPIRED`, `TOKEN_INVALID`.
- Validation: `class-validator` + `ValidationPipe` (whitelist + forbidNonWhitelisted).
- Phân trang: `?page=1&limit=20` (limit max 100).

### Endpoint MVP

```
# Auth (public)
POST   /auth/register            {name,email,password}     → tạo User PENDING + gửi email verify
GET    /auth/verify-email?token=                            → set emailVerifiedAt
POST   /auth/login               {email,password}           → {accessToken, refreshToken, user}
POST   /auth/refresh             {refreshToken}             → cặp token mới (rotation)
POST   /auth/logout              {refreshToken}             → revoke
POST   /auth/forgot-password     {email}                    → gửi email reset
POST   /auth/reset-password      {token,newPassword}
GET    /auth/me                                             (auth)

# Users (MANAGER)
GET    /users?status=&role=&page=&limit=
GET    /users/:id
PATCH  /users/:id                {role?,status?,name?}      # duyệt PENDING = set role + status ACTIVE
DELETE /users/:id                                           # soft delete

# Horses
POST   /horses                   (MANAGER)  {name,breed?,birthDate?,ownerId,status?}
GET    /horses?ownerId=&status=&page=&limit=  (auth)  # OWNER ép ownerId = mình
GET    /horses/:id               (auth, OWNER chỉ ngựa của mình)
PATCH  /horses/:id               (MANAGER)
DELETE /horses/:id               (MANAGER)
POST   /horses/:id/photo         (MANAGER)  multipart → photoPath

# Training
POST   /horses/:id/sessions      (TRAINER)  {scheduledAt,type,notes?}
GET    /horses/:id/sessions?status=&from=&to=  (auth, OWNER chỉ ngựa của mình)
GET    /sessions/:id             (auth + ownership)
PATCH  /sessions/:id             (TRAINER: mọi field | GROOM: status+result)
                                 # validate: PLANNED→DONE|CANCELLED; DONE cần resultMetric+resultValue

# Health
POST   /horses/:id/health-records   (VET)  {examDate,diagnosis,treatment?}
GET    /horses/:id/health-records    (auth, OWNER chỉ ngựa của mình)
POST   /health-records/:id/attachment (VET) multipart

# Files
GET    /files/:kind/:filename    (auth) — serve file có kiểm tra quyền
```

## 5. RBAC — cách enforce

1. `JwtAuthGuard` global (trừ route `@Public()`).
2. `RolesGuard` đọc `@Roles(Role.TRAINER, …)` trên handler.
3. `HorseOwnershipGuard` cho route có `:id` horse hoặc resource con: nếu user là
   OWNER thì `horse.ownerId === user.id`, sai → 403. MANAGER/TRAINER/VET/GROOM bỏ qua.
4. Service layer luôn nhận `currentUser` và tự lọc, không tin controller.
5. Login chặn nếu `status !== ACTIVE` hoặc `emailVerifiedAt == null`.

## 6. Kế hoạch theo phase

Mỗi phase = 1 nhánh `feat/<phase>` → PR → merge `main`. Xong mới sang phase kế.

### Phase 0 — Scaffold (mình làm ngay sau khi bạn duyệt)
- `apps/api`: NestJS, Prisma, config module (validate env bằng zod), PrismaService,
  global ValidationPipe + exception filter + response interceptor, Swagger,
  `/health`. `docker-compose.yml` cho Postgres. `.env.example`.
- `apps/web`: Vite + React + TS + react-router + axios + i18n skeleton.
- Root `README.md` (cách cài Postgres, tạo DB, chạy migrate/seed/dev).
- **Tiêu chí xong:** `npm run start:dev` chạy, `/health` OK, `/api/docs` mở được,
  `prisma migrate dev` chạy sạch.

### Phase 1 — Auth & Users ✅ XONG (2026-09-08)
- Schema User/RefreshToken/AuthToken + migration.
- MailModule (nodemailer + template HTML verify/reset).
- register / verify-email / login / refresh (rotation) / logout / forgot / reset / me.
- Users module: list (filter status/role), get, patch (duyệt + gán role), soft delete.
- Seed: 1 MANAGER ACTIVE + đã verify.
- e2e: đăng ký → (giả lập verify) → login fail vì PENDING → manager duyệt → login OK → refresh.
- **Tiêu chí xong:** chạy trọn vòng đời tài khoản qua test.

### Phase 2 — Horses ✅ XONG (2026-09-08) — [specs/phase-2-horses.md](specs/phase-2-horses.md)
- Schema Horse (đã có từ `init`, không cần migration). CRUD + filter theo role +
  `HorseOwnershipGuard`.
- Upload ảnh (Multer diskStorage, ≤5MB, jpg/png/webp), serve qua
  `/files/horse-photos/:filename` có auth + ownership.
- Seed: +2 OWNER +3 ngựa.
- e2e 15 test (tổng 25/25 xanh). Chi tiết: [STATE.md](STATE.md) §3c.

### Phase 3 — Training sessions ✅ XONG (2026-09-08) — [specs/phase-3-training.md](specs/phase-3-training.md)
- Schema TrainingSession (đã có từ `init`, không migration).
- `POST/GET /horses/:id/sessions` (HorseOwnershipGuard) + `GET/PATCH /sessions/:id`.
- State machine `PLANNED → DONE|CANCELLED` + rule "DONE cần result"; GROOM chỉ
  đụng status+result.
- Seed: +TRAINER/VET/GROOM + 3 session.
- e2e 14 test (tổng 39/39 xanh). Chi tiết: [STATE.md](STATE.md) §3d.

### Phase 4 — Health records ✅ XONG (2026-09-09) — [specs/phase-4-health.md](specs/phase-4-health.md)
- Schema HealthRecord (đã có từ `init`, không migration).
- `POST/GET /horses/:id/health-records` (HorseOwnershipGuard) + `GET/PATCH /health-records/:id`
  + `POST /health-records/:id/attachment` (VET) + serve `GET /files/health-attachments/:filename`.
- `vetId` = người gọi; `examDate` không được tương lai; list `examDate desc`;
  attachment cho phép PDF; không soft-delete.
- Seed: +2 health record.
- e2e 16 test (tổng 55/55 xanh). Chi tiết: [STATE.md](STATE.md) §3e.

### Phase 5 — Hoàn thiện MVP ✅ XONG (2026-09-09) — [specs/phase-5-mvp.md](specs/phase-5-mvp.md)
- Frontend `apps/web`: 1 app React đổi UI theo role — Login/Register, danh sách +
  chi tiết ngựa (tab Sessions/Health), form theo role, guard route, i18n vi/en,
  axios refresh-once interceptor. Không thêm dependency.
- Seed: +1 user PENDING + 1 session; in bảng tài khoản demo.
- ERD Mermaid trong [DATA_MODEL.md](DATA_MODEL.md); README full-stack + demo script.
- Checklist [MVP.md](MVP.md) tất cả ☑. Chi tiết: [STATE.md](STATE.md) §3f.

## 7. Testing

- Unit (Jest): service có logic (auth token, state machine session, ownership).
- e2e (supertest + Postgres test DB riêng): 4 main flow ở Phase 1-4.
- Chưa có yêu cầu coverage từ giảng viên → mục tiêu nội bộ: phủ hết happy path +
  các nhánh 403/validation chính. Cập nhật khi cô chốt.

## 8. Env vars (`apps/api/.env.example`)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/racehorse?schema=public
JWT_ACCESS_SECRET=change-me
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=change-me
JWT_REFRESH_TTL=7d
APP_WEB_URL=http://localhost:5173          # dựng link trong email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM="Racehorse Club <your-gmail@gmail.com>"
UPLOAD_DIR=./uploads
UPLOAD_MAX_MB=5
```

## 9. Git workflow

- `main` luôn xanh. Nhánh `feat/phase-N-...`. PR nhỏ theo phase.
- Commit message tiếng Anh, conventional (`feat:`, `fix:`, `chore:`).
- `.gitignore`: `node_modules`, `.env`, `apps/api/uploads/*` (giữ `.gitkeep`),
  `dist`, `coverage`.

## 10. Việc còn mở (không chặn Phase 0)

- ~~Refresh token qua cookie hay body~~ → **chốt: body JSON** (2026-09-08).
- Bảng AuditLog — thêm sau Phase 2.
- Yêu cầu deliverable của giảng viên (ERD/UML/Scrum/coverage) — cập nhật khi có.
- CI (GitHub Actions chạy lint + test) — thêm sau Phase 1 nếu nhóm muốn.

## 11. Nhật ký thực hiện

### Phase 0 — XONG (2026-09-08)

Đã dựng và verify chạy được:

- `apps/api`: NestJS 11 + Prisma **6.19.3** + PostgreSQL. Module `config` (validate
  env bằng zod), `PrismaModule/Service`, `AllExceptionsFilter` (envelope
  `{error:{code,message,details}}` + mã lỗi ổn định), `HealthController`
  (`GET /api/v1/health` có check DB), `main.ts` (helmet, ValidationPipe global,
  Swagger `/api/docs`, prefix `/api/v1`, CORS).
- `prisma/schema.prisma`: 6 model (User, RefreshToken, AuthToken, Horse,
  TrainingSession, HealthRecord) + enum. Migration `20260908032635_init` đã apply.
- `prisma/seed.ts`: tạo 1 MANAGER (`manager@racehorse.local` / `Manager123!`).
- `apps/web`: Vite 8 + React 19 + TS **5.9** (hạ từ TS6 do xung đột peer
  react-i18next). axios client (`src/lib/api.ts`) + i18n vi/en (`src/i18n/`).
  `App.tsx` skeleton gọi thử `/health` + nút đổi ngôn ngữ.
- Root: `README.md`, `.gitignore`, `docker-compose.yml`, `scripts/pg-start.ps1`
  + `pg-stop.ps1`.
- Kiểm tra: `npm run build` (cả api + web) ✅ · `npm run lint` (api) ✅ ·
  `npm run test:e2e` (api, test health) ✅ · smoke test API trả health/docs/404 ✅.

**Sai khác so với kế hoạch gốc:**

- **PostgreSQL**: winget tải bị treo (mạng) → dùng bản **portable ZIP** giải nén
  vào `C:\Users\Lenovo\pgsql`, data `C:\Users\Lenovo\pgdata`, port 5432.
  Không đăng ký được Windows service / scheduled task (bị chặn quyền) → dùng
  **`scripts/pg-autostart.vbs`** đặt trong Startup folder của user để tự chạy khi
  đăng nhập (đã test OK). Điều khiển tay: `scripts/pg-start.ps1` / `pg-stop.ps1`.
- **Prisma 6 thay vì 7**: Prisma 7 (bản mới) bỏ `url` trong schema, bắt buộc
  driver adapter + `prisma.config.ts` → quá nhiều ma sát cho đồ án. Đã ghim 6.19.3.
- npm trên mạng này hay `ECONNRESET` → đã set `fetch-retries=6`, `maxsockets=3`,
  `prefer-offline`. npm 11 chặn install script mặc định → đã `npm approve-scripts`
  cho prisma/bcrypt (field `allowScripts` trong package.json).

### Phase 1 — XONG (2026-09-08)

Auth & Users. Chốt: refresh token qua **body JSON**. Module `mail` (fallback log khi
thiếu SMTP), `auth` (register/verify/login/refresh-rotation/logout/forgot/reset/me),
2 guard global (`JwtAuthGuard` + `RolesGuard`), `users` (MANAGER: list/get/patch/soft-delete).
Access JWT chỉ mang `sub`, guard load user từ DB mỗi request. Token chỉ lưu hash.
`test/auth.e2e-spec.ts` 9 test phủ trọn vòng đời tài khoản — build/lint/e2e xanh.
Chi tiết: [STATE.md](STATE.md) §3b · [DECISIONS.md](DECISIONS.md).

### Phase 2 — XONG (2026-09-08)

Horses: CRUD + `HorseOwnershipGuard` + upload/serve ảnh. Quyết định: `ownerId`
phải là role OWNER; OWNER xem ngựa người khác → 403 (không phải 404); 1 ảnh/ngựa
ghi đè; serve file qua controller (ép auth). Chi tiết:
[specs/phase-2-horses.md](specs/phase-2-horses.md) · [DECISIONS.md](DECISIONS.md).

### Phase 3 — XONG (2026-09-08)

Training sessions. Quyết định: không tạo `SessionOwnershipGuard` (check trong
service cho `/sessions/:id`); `trainerId` = người tạo; `DONE`/`CANCELLED` là
trạng thái cuối; GROOM whitelist field. Chi tiết:
[specs/phase-3-training.md](specs/phase-3-training.md) · [DECISIONS.md](DECISIONS.md).

### Phase 4 — XONG (2026-09-09)

Health records. Quyết định: không tạo `RecordOwnershipGuard` (check trong service
cho `/health-records/:id`); `vetId` = người tạo; `examDate` không được tương lai;
`PATCH` chỉ VET, không cần ownership; list `examDate desc`; attachment cho phép
PDF; không soft-delete. Module đặt tên `health-records.*` để không đụng
`HealthController` (health-check) có sẵn. Chi tiết:
[specs/phase-4-health.md](specs/phase-4-health.md) · [DECISIONS.md](DECISIONS.md).

### Phase 5 — XONG (2026-09-09)

Frontend `apps/web` (1 app React đổi UI theo role, refresh-once interceptor,
guard route, i18n vi/en) + seed PENDING/session + ERD Mermaid + README full-stack.
Quyết định: không thêm dependency FE, token localStorage, `GET /auth/me` khi
khởi động, ERD gộp vào DATA_MODEL.md. Chi tiết:
[specs/phase-5-mvp.md](specs/phase-5-mvp.md) · [DECISIONS.md](DECISIONS.md).

**MVP hoàn chỉnh.** Việc sau-MVP: xem [STATE.md](STATE.md) §4.

### Phase 6 — Pedigree & Races ✅ XONG (2026-09-14) — [specs/phase-6-pedigree.md](specs/phase-6-pedigree.md)

Luồng 1/3 của việc mở rộng data model chốt 2026-09-12 (xem
[DECISIONS.md](DECISIONS.md)). Migration `phase6_pedigree_races` — thêm
`sireId`/`damId`/`fitnessScore` (nullable) vào `Horse` + model mới
`Race`/`RaceEntry`. `PATCH /horses/:id` mở rộng nhận pedigree fields;
`GET /horses/:id/pedigree` trả cây 3 đời; `/races` + `/races/:id/entries` +
`/horses/:id/race-entries` + `/race-entries/:id` (MANAGER ghi, mọi role đọc,
ownership riêng cho route gắn 1 ngựa). Không DELETE cho Race/RaceEntry, không
dò vòng lặp phả hệ sâu. e2e 22 test (tổng 77/77 xanh). Chi tiết:
[STATE.md](STATE.md) §3g.

2 luồng còn lại lúc đó (Training Plan + Lock, Health & Injury) — Training
Plan + Lock nay đã xong (xem Phase 7 dưới), làm kế tiếp theo cùng cách (spec
trước, code sau).

### Phase 7 — Training Plan & Training Lock ✅ XONG (2026-09-14) — [specs/phase-7-training-plan-lock.md](specs/phase-7-training-plan-lock.md)

Luồng 2/3 của việc mở rộng data model. Migration
`phase7_training_plan_lock` — thêm `Horse.locked`/`lockReason` (default/
nullable) + model mới `TrainingPlan` + `TrainingSession.planId` (nullable).
`PATCH /horses/:id/lock` (VET) khoá/mở khoá; `POST /horses/:id/sessions`
(đã có từ Phase 3) chặn khi `horse.locked=true`. `training-plans` CRUD
(không DELETE) theo pattern Phase 4/6 (PATCH không ownership guard, chỉ
role-gate). e2e 19 test (tổng 96/96 xanh). Chi tiết: [STATE.md](STATE.md) §3h.

Luồng cuối (3/3, Health & Injury) — xem Phase 8 dưới.

### Phase 8 — Health & Injury ✅ XONG (2026-09-14) — [specs/phase-8-health-injury.md](specs/phase-8-health-injury.md)

Luồng 3/3 (cuối cùng) của việc mở rộng data model — **hoàn tất cả 3 luồng
activity diagram chốt 2026-09-12**. Migration `phase8_incidents_notifications`
— model mới `IncidentReport` + `Notification`, 3 enum, không đổi cột hiện có.
`POST/GET /horses/:id/incidents` (GROOM tạo, mọi role đọc + ownership),
`GET/PATCH /incidents/:id` (VET, status chỉ tiến, `healthRecordId` phải
cùng ngựa); `severity=HIGH` khi tạo tự khoá ngựa (gọi lại
`HorsesService.lock()` của Phase 7), `status=RESOLVED` khi đang khoá tự mở
khoá. `GET /notifications` + `PATCH /notifications/:id/read` (luôn của
chính mình) — `HorsesService.lock()` giờ là nơi duy nhất gửi thông báo
`TRAINING_LOCKED`/`TRAINING_UNLOCKED`, dùng chung cho khoá tay (Phase 7) và
tự động (Phase 8). e2e 21 test (tổng 117/117 xanh). Chi tiết:
[STATE.md](STATE.md) §3i.

**Cả 3 luồng mở rộng sau-MVP nay đã xong phần API.** Việc còn lại: xem
[STATE.md](STATE.md) §4 (chủ yếu là frontend cho 3 luồng này).
