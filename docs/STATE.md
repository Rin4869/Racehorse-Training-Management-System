# STATE — tiến độ & điểm bàn giao

> File này là **điểm vào cho mỗi phiên làm việc mới**. Đọc file này trước, rồi
> mới tới [PLAN.md](PLAN.md) và [DECISIONS.md](DECISIONS.md).
> Cập nhật file này mỗi khi kết thúc một mảng việc.

Cập nhật lần cuối: **2026-09-14** — kết thúc Phase 8 (Health & Injury), luồng
3/3 (cuối) của việc mở rộng sau-MVP. **MVP (Phase 0-5) vẫn DONE**; cả 3 luồng
mở rộng (Phase 6-8) nay đã xong phần API.

---

## 1. Tóm tắt 30 giây

- Đồ án: **Racehorse Training & Management System** (dự án bắt buộc số 1).
- Kiến trúc: **1 Core API (NestJS)** + **1 frontend React/Vite** trong monorepo
  `apps/`. Xem [OVERVIEW.md](OVERVIEW.md).
- Đang ở giai đoạn: **MVP theo main flow**, kế hoạch 6 phase trong [PLAN.md](PLAN.md) §6.
- **Phase 0 → 5 — XONG. MVP hoàn chỉnh** (Core API + frontend React demo được
  cả 4 main flow).
- **Phase 6 (Pedigree & Races) — XONG (API).** Luồng 1/3 của việc mở rộng
  sau-MVP chốt ngày 2026-09-12 (xem [DECISIONS.md](DECISIONS.md)).
- **Phase 7 (Training Plan & Training Lock) — XONG (API).** Luồng 2/3.
- **Phase 8 (Health & Injury) — XONG (API).** Luồng 3/3 (cuối cùng) — **cả 3
  luồng mở rộng sau-MVP đã xong phần API.** Frontend cho cả 3 (pedigree/races,
  training-plan/lock, incidents/notifications) **chưa làm** — xem §4.
- Từ Phase 2: mỗi phase có file đặc tả trong [specs/](specs/) viết trước khi code.

## 2. Môi trường máy (đã dựng sẵn)

| Thành phần | Trạng thái |
|---|---|
| Node | 24.19, npm 11 |
| PostgreSQL | Bản portable `C:\Users\Lenovo\pgsql`, data `C:\Users\Lenovo\pgdata`, port **5432**, user/pass `postgres`/`postgres`, DB **`racehorse`** đã tạo |
| PG autostart | `scripts/pg-autostart.vbs` đã đặt trong Startup folder → tự chạy khi login. Không đăng ký được Windows service (bị chặn quyền). Bật/tắt tay: `scripts/pg-start.ps1` / `pg-stop.ps1` |
| `apps/api` deps | Đã cài đủ. Prisma **6.19.3** (KHÔNG lên 7/8 — v7+ bỏ `url` trong schema, bắt buộc driver adapter) |
| `apps/web` deps | Đã cài: react-router-dom, axios, i18next, react-i18next, vite |
| npm config | `maxsockets=3`, retry cao, `prefer-offline` — mạng hay `ECONNRESET`, cứ chạy lại `npm install` nếu đứt |
| npm 11 allow-scripts | Đã approve script cho `@prisma/*`, `bcrypt`, `@parcel/watcher`, `unrs-resolver`; denied `@scarf/scarf`. Khi thêm dep có postinstall, chạy `npm approve-scripts <pkg>` |

## 3. Phase 0 đã làm gì

### apps/api (NestJS)
- Scaffold chuẩn `nest new`. Đã xoá `app.controller/service`.
- `src/config/env.ts` — validate biến môi trường bằng **zod** (bootstrap fail sớm nếu thiếu).
- `src/prisma/` — `PrismaModule` (global) + `PrismaService` (connect/disconnect theo lifecycle).
- `src/common/app-exception.ts` — class `AppException(code, message?, details?)` + map `code → HTTP status`.
- `src/common/filters/all-exceptions.filter.ts` — render mọi lỗi thành
  `{ error: { code, message, details? } }`. Mã lỗi ổn định (xem [PLAN.md](PLAN.md) §4).
- `src/health/` — `GET /api/v1/health` → `{ status, db: up|down, time }` (có ping DB).
- `src/main.ts` — prefix `/api/v1`, `helmet`, `ValidationPipe` (whitelist + forbidNonWhitelisted + transform),
  global exception filter, Swagger tại `/api/docs`, CORS bật.
- `prisma/schema.prisma` — **6 model**: `User`, `RefreshToken`, `AuthToken`,
  `Horse`, `TrainingSession`, `HealthRecord` (đủ cho cả Phase 1-4).
- `prisma/migrations/` — migration `init` **đã apply** vào DB.
- `prisma/seed.ts` — tạo 1 MANAGER: `manager@racehorse.local` / `Manager123!`
  (ACTIVE + đã verify email).
- `.env` (gitignored, đã điền Gmail `quocbinh072517@gmail.com` + app password) và `.env.example`.
- `tsconfig`: `tsconfig.json` include cả `src/test/prisma` cho tooling;
  `tsconfig.build.json` có `rootDir: src` + loại `test/prisma` → build ra `dist/main.js` phẳng.
- eslint: tắt `no-unsafe-enum-comparison`; nới các rule `no-unsafe-*` cho file test.
- **Đã verify:** `npm run build` OK · `npm run lint` sạch · `npm run test:e2e` pass
  (test health) · chạy `node dist/main.js` → `/health` trả `db:"up"`, `/api/docs` = 200,
  route lạ trả đúng envelope 404.

Scripts có sẵn trong `apps/api/package.json`:
`start:dev`, `build`, `lint`, `test`, `test:e2e`,
`prisma:generate`, `prisma:migrate`, `prisma:studio`, `db:seed`.

### apps/web (Vite + React + TS)
- Scaffold `create-vite react-ts`.
- `src/lib/api.ts` — axios client (baseURL từ `VITE_API_URL`), interceptor gắn Bearer token.
- `src/i18n/` — `index.ts` + `vi.json` + `en.json` (khởi tạo i18next).
- `src/App.tsx`, `src/main.tsx` — skeleton router.
- `.env` / `.env.example` — `VITE_API_URL=http://localhost:3000/api/v1`.
- ⚠️ Mới ở mức skeleton — UI thật làm ở **Phase 5**.

### Root
- `README.md` (hướng dẫn chạy), `.gitignore`, `docker-compose.yml` (Postgres tuỳ chọn),
  `scripts/` (pg-start / pg-stop / pg-autostart).
- **Chưa `git init`** — chờ người dùng quyết.

## 3b. Phase 1 đã làm gì (Auth & Users)

**Chốt:** refresh token trả qua **body JSON** (không cookie); không captcha/rate-limit.
Chi tiết lý do trong [DECISIONS.md](DECISIONS.md) mục 2026-09-08 Phase 1.

### apps/api — module mới
- `src/common/decorators/` — `@Public()`, `@Roles(...)`, `@CurrentUser()` (+ type `AuthUser`).
- `src/common/guards/` — `JwtAuthGuard` (global, bỏ qua `@Public()`; verify access JWT
  rồi **load user từ DB** kiểm tra status/soft-delete) · `RolesGuard` (global, đọc `@Roles`).
- `src/common/duration.ts` — parse `"15m"`/`"7d"` → ms.
- `src/mail/` — `MailService` (nodemailer; thiếu SMTP ⇒ log ra console) +
  `sendVerifyEmail` / `sendResetPassword`. `@Global`.
- `src/auth/`
  - `token.service.ts` — access JWT (payload chỉ `sub`), refresh token (hash SHA-256,
    **rotation**), auth token VERIFY_EMAIL (24h) / RESET_PASSWORD (1h). Chỉ lưu hash.
  - `auth.service.ts` + `auth.controller.ts` — `POST /auth/register` · `GET /auth/verify-email?token=` ·
    `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` ·
    `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` (auth).
    Login chặn theo thứ tự: sai pass → `UNAUTHENTICATED`; chưa verify → `EMAIL_NOT_VERIFIED`;
    PENDING → `ACCOUNT_PENDING`; DISABLED → `ACCOUNT_DISABLED`.
  - `auth.module.ts` — `@Global`, export `TokenService` + `JwtModule`.
- `src/users/` (class-level `@Roles(MANAGER)`)
  - `GET /users?status=&role=&page=&limit=` → `{ data, meta:{page,limit,total} }` (lọc `deletedAt:null`).
  - `GET /users/:id` · `PATCH /users/:id` `{name?,role?,status?}` (set ACTIVE bắt buộc có role) ·
    `DELETE /users/:id` (soft delete + revoke refresh; không tự xoá mình).
- `src/app.module.ts` — đăng ký 2 `APP_GUARD` (Jwt rồi Roles), import Mail/Auth/Users.
- `src/health/health.controller.ts` — thêm `@Public()`.
- `nest-cli.json` — bật plugin `@nestjs/swagger`.
- `test/auth.e2e-spec.ts` — 9 test: register → duplicate 409 → login chặn (chưa verify) →
  verify → login chặn (PENDING) → MANAGER duyệt (role+ACTIVE) → non-manager list 403 →
  login OK → me → refresh rotation → tái dùng token cũ 401 → logout → refresh sau logout 401.
  Override `MailService` bằng fake bắt token (không cần SMTP thật).

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e` (9/9) ✅ ·
smoke `node dist/main.js`: `/api/docs` 200, `/auth/me` không token → envelope
`UNAUTHENTICATED`, login MANAGER trả access+refresh+user, register sai → `VALIDATION_ERROR`.

Seed vẫn chỉ 1 MANAGER (`manager@racehorse.local` / `Manager123!`).

## 3c. Phase 2 đã làm gì (Horses)

Đặc tả đầy đủ: **[specs/phase-2-horses.md](specs/phase-2-horses.md)** (viết trước khi code).
Không cần migration — bảng `Horse` đã có từ `init`.

### apps/api — module mới
- `src/common/guards/horse-ownership.guard.ts` — `HorseOwnershipGuard`: load Horse
  theo `:id` (`deletedAt:null`), 404 nếu không có, 403 nếu OWNER truy cập ngựa
  người khác; gắn `req.horse`. Dùng lại cho Phase 3/4.
- `src/horses/`
  - `POST /horses` (MANAGER) — `ownerId` phải là user `role=OWNER`; `birthDate`
    không được tương lai.
  - `GET /horses?ownerId=&status=&q=&page=&limit=` — **OWNER bị ép `ownerId=self`**.
  - `GET /horses/:id` (guard ownership) · `PATCH /horses/:id` (MANAGER, cho `null`
    để xoá `breed`/`birthDate`, đổi chủ) · `DELETE /horses/:id` (MANAGER, soft delete).
  - `POST /horses/:id/photo` (MANAGER, multipart field `file`) — ảnh jpg/png/webp
    ≤ `UPLOAD_MAX_MB`, ghi đè ảnh cũ (xoá file cũ best-effort).
  - Object trả về có thêm `photoUrl` (tính từ `photoPath`).
- `src/files/`
  - `file-storage.service.ts` — thuần fs (mkdir lúc boot, `removeQuietly`, resolve path).
  - `upload.ts` — cấu hình multer `diskStorage` (`uploads/horse-photos/<horseId>-<rand>.<ext>`),
    fileFilter mime, limit size; regex `SAFE_FILENAME` chống path traversal.
  - `files.module.ts` — `MulterModule.registerAsync` + `FileStorageService` (không
    phụ thuộc domain → tránh circular).
  - `files.controller.ts` (đăng ký trong `HorsesModule`) —
    `GET /files/horse-photos/:filename` (auth + ownership; validate filename; serve file).
- `src/common/filters/all-exceptions.filter.ts` — thêm nhánh `MulterError`
  (`LIMIT_FILE_SIZE`…) → `VALIDATION_ERROR` 400.
- `src/app.module.ts` — import `HorsesModule`.
- `prisma/seed.ts` — thêm `owner1@` / `owner2@racehorse.local` (`Owner123!`, OWNER,
  ACTIVE+verified) + 3 ngựa (Thunderbolt, Sea Breeze, Midnight).
- `apps/api/uploads/.gitkeep`.
- `test/horses.e2e-spec.ts` — 15 test: create 201 · ownerId sai role 400 · birthDate
  tương lai 400 · non-manager 403 · OWNER list bị scope · OWNER không mở rộng scope
  qua query · OWNER xem ngựa người khác 403 · OWNER xem ngựa mình 200 · patch status ·
  upload ảnh 201 + `photoUrl` · upload non-image 400 · owner tải ảnh 200 image/png ·
  owner khác tải ảnh 403 · filename traversal 404 · soft-delete → GET 404 · id lạ 404.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(25/25:** health 1 + auth 9 + horses 15**)** ✅ · smoke curl: upload ảnh →
tải lại `200 image/png`, không token `401`, traversal `404`.

Seed hiện có: 1 MANAGER + 2 OWNER + 3 ngựa.

## 3d. Phase 3 đã làm gì (Training sessions)

Đặc tả đầy đủ: **[specs/phase-3-training.md](specs/phase-3-training.md)**.
Không cần migration — bảng `TrainingSession` đã có từ `init`.

### apps/api — module mới `src/training/`
- **2 controller:**
  - `HorseSessionsController` (`@Controller('horses/:id/sessions')`, class-level
    `@UseGuards(HorseOwnershipGuard)`):
    - `POST` (TRAINER) — `{scheduledAt, type, notes?}`; `trainerId` = người gọi;
      luôn khởi tạo `PLANNED`.
    - `GET ?status=&from=&to=&page=&limit=` — sắp xếp `scheduledAt asc`.
  - `SessionsController` (`@Controller('sessions')`):
    - `GET /sessions/:id` — ownership check ở service (session→horse; OWNER phải là chủ).
    - `PATCH /sessions/:id` (`@Roles(TRAINER, GROOM)`).
- **State machine** (`training.service.ts`): hợp lệ `PLANNED → DONE | CANCELLED`;
  `DONE`/`CANCELLED` là trạng thái cuối → PATCH tiếp → `VALIDATION_ERROR`.
  Chuyển `DONE` bắt buộc có `resultMetric` + `resultValue` (từ payload hoặc đã có).
  Field `scheduledAt/type/notes` chỉ sửa khi đang `PLANNED`.
- **GROOM field-whitelist:** chỉ `status`, `resultMetric`, `resultValue`; gửi field
  khác → `FORBIDDEN`. Lọc key theo `v !== undefined` (class-transformer hay thêm
  field optional = undefined).
- `TrainingModule` tự provide `HorseOwnershipGuard` (chỉ cần `PrismaService`).
- `prisma/seed.ts` — thêm `trainer@` / `vet@` / `groom@racehorse.local`
  (`Trainer123!` / `Vet123!` / `Groom123!`, ACTIVE+verified) + 3 session
  (Thunderbolt: gallop PLANNED + sprint DONE có result; Midnight: trot PLANNED).
- `src/app.module.ts` — import `TrainingModule`.
- `test/training.e2e-spec.ts` — 14 test: create 201/PLANNED · thiếu type 400 ·
  GROOM/OWNER create 403 · horse lạ 404 · owner xem session ngựa mình / owner khác 403 ·
  `GET /sessions/:id` ownership + 404 · TRAINER sửa notes · `DONE` thiếu result 400 ·
  GROOM `DONE` + result 200 · GROOM sửa `type` 403 · PATCH session đã DONE 400 ·
  `CANCELLED` không cần result 200 · filter `status`.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(39/39:** health 1 + auth 9 + horses 15 + training 14**)** ✅ · smoke curl chạy
trọn luồng MVP #2 (trainer tạo → groom DONE+result → owner xem thấy).

Seed hiện có: MANAGER + TRAINER + VET + GROOM + 2 OWNER + 3 ngựa + 3 session.

## 3e. Phase 4 đã làm gì (Health records)

Đặc tả đầy đủ: **[specs/phase-4-health.md](specs/phase-4-health.md)**.
Không cần migration — bảng `HealthRecord` đã có từ `init`
(**không có `updatedAt`/`deletedAt`**).

### apps/api — module mới `src/health/health-records.*`
- Tên tách bạch với `HealthController` (health-check `GET /api/v1/health` từ Phase 0):
  `HealthRecordsModule` / `HealthRecordsService`, file `health-records.{module,controller,service}.ts`,
  dto `dto/health.dto.ts`.
- **3 controller:**
  - `HorseHealthRecordsController` (`@Controller('horses/:id/health-records')`,
    class-level `HorseOwnershipGuard`):
    - `POST` (VET) — `{examDate, diagnosis, treatment?}`; `vetId` = người gọi;
      `examDate` **không được tương lai** → `VALIDATION_ERROR`.
    - `GET ?from=&to=&page=&limit=` — sắp xếp `examDate desc`.
  - `HealthRecordsController` (`@Controller('health-records')`):
    - `GET /health-records/:id` — ownership ở service (record→horse; OWNER phải là chủ).
    - `PATCH /health-records/:id` (VET) — `{examDate?, diagnosis?, treatment?}`
      (`treatment: null` để xoá). Không cần ownership guard (chỉ VET tới, VET xem mọi ngựa).
    - `POST /health-records/:id/attachment` (VET, multipart `file`) — jpg/png/webp/**pdf**
      ≤ `UPLOAD_MAX_MB`, ghi đè file cũ.
  - `HealthFilesController` (`@Controller('files')`) —
    `GET /files/health-attachments/:filename` (auth + ownership; validate filename).
- Object trả về có thêm `attachmentUrl` (tính từ `attachmentPath`).
- `src/files/upload.ts` — thêm `HEALTH_ATTACHMENT_KIND`, `ATTACHMENT_MIME_TO_EXT`
  (+pdf), `SAFE_ATTACHMENT_FILENAME`, `buildAttachmentMulterOptions()` (đọc
  `process.env`, dùng inline trong `FileInterceptor`).
- `src/files/file-storage.service.ts` — `onModuleInit` tạo cả 2 thư mục
  (`horse-photos` + `health-attachments`).
- `src/app.module.ts` — import `HealthRecordsModule`.
- `prisma/seed.ts` — +2 health record (Thunderbolt: routine checkup;
  Midnight: mild colic + treatment).
- `test/health.e2e-spec.ts` — 16 test: VET tạo 201 · thiếu diagnosis 400 ·
  examDate tương lai 400 · TRAINER/OWNER tạo 403 · horse lạ 404 · owner xem list
  ngựa mình / owner khác 403 · `GET /health-records/:id` ownership + 404 ·
  VET PATCH treatment · TRAINER PATCH 403 · VET upload PDF 201 + `attachmentUrl` ·
  upload .txt 400 · owner tải attachment 200 application/pdf · owner khác 403 ·
  filename traversal 404 · filter theo `from`.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(55/55:** health-check 1 + auth 9 + horses 15 + training 14 + health-records 16**)** ✅.

Seed hiện có: MANAGER + TRAINER + VET + GROOM + 2 OWNER + 3 ngựa + 3 session + 2 health record.

## 3f. Phase 5 đã làm gì (Hoàn thiện MVP + frontend)

Đặc tả đầy đủ: **[specs/phase-5-mvp.md](specs/phase-5-mvp.md)**.

### apps/web — frontend React demo (1 app, đổi UI theo role)
- Không thêm dependency. React 19 + react-router-dom 7 (`createBrowserRouter`) +
  axios + i18next. `npm run build` (tsc + vite) ✅, `npm run lint` (oxlint) exit 0
  (4 warning `set-state-in-effect` ở trang fetch danh sách — chấp nhận).
- `src/lib/`: `types.ts`, `format.ts` (ngày Asia/Ho_Chi_Minh), `api.ts` viết lại —
  request gắn Bearer; response interceptor **refresh 1 lần** (dedupe), bỏ qua
  `/auth/*`, hỏng → `setOnAuthLost` → xoá token → về `/login`.
- `src/auth/`: `context.ts` + `AuthProvider.tsx` (khởi động gọi `GET /auth/me`) +
  `useAuth.ts` + `RequireAuth.tsx` (guard đăng nhập + role).
- `src/components/`: `Layout` (header: nav, lang VI/EN, user, logout), `Field`, `ErrorText`
  (dịch mã lỗi API qua khoá `error.<CODE>`).
- `src/pages/`: `LoginPage`, `RegisterPage` (đăng ký → PENDING), `HorsesPage`
  (list + form tạo ngựa cho MANAGER, chọn owner từ `GET /users?role=OWNER`),
  `HorseDetailPage` (tab Sessions/Health), `horse/SessionsTab` (TRAINER tạo;
  TRAINER/GROOM sửa status+result+notes khi PLANNED), `horse/HealthTab` (VET
  tạo/sửa + upload đính kèm; "mở đính kèm" = tải blob qua axios rồi `window.open`),
  `AdminUsersPage` (MANAGER duyệt PENDING = chọn role + `PATCH {role,status:ACTIVE}`,
  khoá/mở ACTIVE↔DISABLED).
- `src/index.css` viết lại (tokens sáng/tối, card/btn/input/table/tag/tabs).
- `src/i18n/{vi,en}.json` mở rộng đủ nhãn UI. Xoá `src/App.tsx`.
- Route: `/login`, `/register` công khai; `/horses`, `/horses/:id` cần đăng nhập;
  `/admin/users` cần role MANAGER; `*` → `/horses`.

### apps/api
- `prisma/seed.ts`: +`newbie@racehorse.local` / `Newbie123!` (PENDING, đã verify
  email — demo bước duyệt) + 1 session `dressage` PLANNED cho Sea Breeze + in
  bảng tài khoản demo ở cuối. Vẫn idempotent. `test:e2e` giữ **55/55**.

### docs
- `DATA_MODEL.md`: thêm **ERD Mermaid** (6 model thật) ở đầu file.
- `README.md`: mục chạy full-stack + bảng tài khoản demo + "Demo 4 luồng MVP".
- `MVP.md`: tick checklist "Định nghĩa xong MVP".

**Đã verify:** web `build` + `lint` ✅ · api `build`+`lint`+`test:e2e` (55/55) ✅ ·
seed chạy lại OK · 2 server boot + phục vụ (health, login, SPA fallback). Click-through
4 luồng MVP để người dùng demo (không có test tự động cho web ở phase này).

## 3g. Phase 6 đã làm gì (Pedigree & Races)

Đặc tả đầy đủ: **[specs/phase-6-pedigree.md](specs/phase-6-pedigree.md)**.
Migration mới `phase6_pedigree_races` (cột nullable trên `Horse` + 2 bảng mới
— không phá dữ liệu cũ).

### apps/api — module mới `src/races/` + mở rộng `src/horses/`
- `Horse` +`sireId`/`sire`, `damId`/`dam` (tự tham chiếu, 2 relation riêng
  `HorsePedigree_Sire`/`HorsePedigree_Dam`), `+fitnessScore` (Int? 0..100).
- `horses.service.ts`: `assertPedigree()` (chặn tự tham chiếu + `sireId===damId`
  + phải trỏ ngựa tồn tại) dùng trong `update()`; `pedigree()` + `pedigreeNode()`
  đệ quy 3 đời (horse → cha/mẹ → ông/bà), cắt bằng `Set` chống vòng lặp dữ liệu lỗi.
- `horses.controller.ts`: `+GET /horses/:id/pedigree` (`HorseOwnershipGuard`).
- Model mới `Race` (`name, date, venue?, distance?, surface?, prizePool?`) +
  `RaceEntry` (`raceId, horseId, position?, time?`, `@@unique([raceId,horseId])`,
  không soft-delete).
- `src/races/`: `RacesController` (`/races`, `/races/:id/entries`) +
  `HorseRaceEntriesController` (`/horses/:id/race-entries`, `HorseOwnershipGuard`)
  + `RaceEntriesController` (`/race-entries/:id`) — cùng `RacesModule`, tự
  provide `HorseOwnershipGuard` (giống `TrainingModule`).
- `src/app.module.ts` — import `RacesModule`.
- `prisma/seed.ts` — +2 ngựa tổ tiên (RETIRED, không hiển thị nổi bật) gán
  làm sire/dam của Thunderbolt, `fitnessScore` cho Thunderbolt/Midnight, +1
  race ("Spring Derby 2026") +2 entry (chưa có kết quả).
- `test/pedigree.e2e-spec.ts` (9 test) + `test/races.e2e-spec.ts` (13 test):
  validate pedigree (tự tham chiếu, trùng, ngựa lạ, fitnessScore ngoài range,
  403 non-manager), cây phả hệ 3 đời + ownership; CRUD race + entry (409 trùng
  entry, 404 ngựa lạ, 403 non-manager, ownership `race-entries` theo ngựa).

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(77/77:** 55 cũ + pedigree 9 + races 13**)** ✅ · seed chạy lại idempotent.

Chưa làm ở phase này: UI frontend cho pedigree/race history (API trước, FE
sau nếu còn thời gian); Training Lock, `incident_reports`, `notifications`
(2 luồng còn lại của việc mở rộng — xem §4).

## 3h. Phase 7 đã làm gì (Training Plan & Training Lock)

Đặc tả đầy đủ: **[specs/phase-7-training-plan-lock.md](specs/phase-7-training-plan-lock.md)**.
Migration mới `phase7_training_plan_lock` (cột default/nullable trên
`Horse`/`TrainingSession` + bảng mới `TrainingPlan` — không phá dữ liệu cũ).

### apps/api — mở rộng `src/horses/` + `src/training/`
- `Horse` +`locked` (Boolean, default false), `+lockReason` (String?).
- `horses.service.ts`: `+lock()` — set `locked` + `lockReason` (mở khoá luôn
  xoá `lockReason`, không giữ lịch sử).
- `horses.controller.ts`: `+PATCH /horses/:id/lock` (`@Roles(VET)` +
  `HorseOwnershipGuard`), DTO riêng `LockHorseDto` (tách khỏi
  `UpdateHorseDto` vì khác role).
- Model mới `TrainingPlan` (`horseId, trainerId, goal, startDate, endDate?`,
  không soft-delete) + `TrainingSession.planId` (nullable FK).
- `training.service.ts`:
  - `create()` (tạo session) mở rộng: chặn nếu `horse.locked===true` →
    `VALIDATION_ERROR` kèm `lockReason` trong message; validate `planId`
    (nếu gửi) phải thuộc cùng ngựa.
  - `+createPlan/listPlansByHorse/getPlan/updatePlan` — `getPlan` join
    `sessions` tóm tắt; `assertPlanDates()` chặn `endDate < startDate`
    (dùng cho cả create và update, so với giá trị hiện có nếu field kia
    không gửi).
- `training.controller.ts`: `+HorseTrainingPlansController`
  (`horses/:id/training-plans`, `HorseOwnershipGuard`) +
  `+TrainingPlansController` (`training-plans/:id`) — cùng `TrainingModule`.
- `prisma/seed.ts` — +1 training plan (Thunderbolt, TRAINER seed), khoá
  **Sea Breeze** (`locked=true`, lý do "tendon strain") để demo TRAINER bị
  chặn tạo buổi tập.
- `test/training-plan.e2e-spec.ts` (19 test): plan CRUD + ownership (404/403),
  validate ngày, lock/unlock (VET-only, 403 MANAGER), chặn tạo session khi
  khoá + thông báo lý do, `planId` hợp lệ/sai ngựa, hành vi sau mở khoá.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(96/96:** 77 cũ + 19 mới**)** ✅ · seed chạy lại idempotent.

Chưa làm ở phase này: UI frontend cho training plan/lock; `incident_reports`,
`notifications` (luồng Health & Injury — nay đã xong, xem §3i).

## 3i. Phase 8 đã làm gì (Health & Injury) — luồng cuối (3/3)

Đặc tả đầy đủ: **[specs/phase-8-health-injury.md](specs/phase-8-health-injury.md)**.
Migration mới `phase8_incidents_notifications` (2 bảng mới + 3 enum, không
đổi cột hiện có).

### apps/api — 2 module mới `src/notifications/` + `src/incidents/`
- `NotificationsModule` đứng độc lập (không phụ thuộc horses/incidents) —
  `NotificationsService.notifyUsers()` (helper nội bộ, tạo hàng loạt qua
  `createMany`) + `managerIds()` (mọi MANAGER `ACTIVE`, `deletedAt:null`).
  `NotificationsController`: `GET /notifications?unread=&page=&limit=` (luôn
  tự lọc `userId=self`) + `PATCH /notifications/:id/read` (403 nếu không
  phải chủ, 404 nếu không tồn tại).
- `HorsesService.lock()` (Phase 7) **mở rộng**: sau khi update `locked`, nếu
  giá trị **thực sự đổi** so với trước → gọi `notifications.notifyUsers()`
  cho chủ ngựa + mọi MANAGER (`TRAINING_LOCKED`/`TRAINING_UNLOCKED`). Chỉ 1
  nơi gửi thông báo khoá/mở khoá, dùng chung cho lời gọi tay (VET,
  `PATCH /horses/:id/lock`) và tự động (từ sự cố).
- Model mới `IncidentReport` (`horseId, reportedById, description, severity,
  status, healthRecordId?`) + `Notification` (`userId, type, message, read`)
  + 3 enum `IncidentSeverity`/`IncidentStatus`/`NotificationType`.
- `IncidentsModule` import `HorsesModule` (dùng lại `HorsesService.lock()`)
  + `NotificationsModule`.
  - `IncidentsService.create()`: tạo `IncidentReport` (`status=OPEN`); nếu
    `severity=HIGH` → gọi `horses.lock(horseId, {locked:true, reason:
    "Incident: <description>"})`; luôn gửi `INCIDENT_REPORTED` (mọi severity).
  - `IncidentsService.update()`: `status` chỉ tiến (`STATUS_ORDER` index,
    cho nhảy bước), `RESOLVED` là trạng thái cuối; `healthRecordId` (nếu
    gửi) phải thuộc cùng ngựa; chuyển `RESOLVED` **khi ngựa đang khoá** →
    gọi `horses.lock(horseId, {locked:false})` (bỏ qua nếu không khoá, tránh
    no-op).
  - `HorseIncidentsController` (`horses/:id/incidents`, `HorseOwnershipGuard`,
    POST=GROOM) + `IncidentsController` (`incidents/:id`, PATCH=VET, GET
    ownership qua service như training-plans/health-records).
- `src/app.module.ts` — import `NotificationsModule` + `IncidentsModule`.
- `prisma/seed.ts` — seed dùng raw prisma (không có Nest DI), nên **tự tay
  lặp lại** hiệu ứng của service: 1 incident `HIGH` cho Midnight (tự khoá +
  tạo `Notification` cho owner2 + MANAGER), 1 incident `LOW` `RESOLVED` cho
  Thunderbolt (gắn `healthRecordId` của hồ sơ "Routine checkup" đã seed).
- `test/incidents.e2e-spec.ts` (14 test) + `test/notifications.e2e-spec.ts`
  (7 test): CRUD + ownership, forward-only status, `healthRecordId` sai
  ngựa, auto-lock khi tạo `HIGH`, auto-unlock khi `RESOLVED` lúc đang khoá,
  resolve ngựa không khoá không lỗi; list/mark-read thông báo (chỉ của
  chính mình, filter `unread`).

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(117/117:** 96 cũ + 21 mới**)** ✅ · seed chạy lại idempotent.

Chưa làm: UI frontend cho incidents/notifications (không chặn "xong" phase
này — xem §4).

## 4. Việc tiếp theo

MVP (Phase 0-5) đủ 4 main flow gốc. **Cả 3 luồng mở rộng sau-MVP (Phase
6-8: Pedigree & Races, Training Plan & Lock, Health & Injury) nay đã xong
phần API** — không còn luồng activity-diagram nào chờ spec từ chốt
2026-09-12. Còn lại:
- **Frontend cho cả 3 luồng** (pedigree/races, training-plan/lock,
  incidents/notifications) — API đã đủ, chưa có UI; làm khi người dùng cần
  demo trực quan (không bắt buộc để các phase trên tính "xong").
- Việc khác (chưa ưu tiên, chờ chốt): tách web con theo role, `stalls`,
  `vaccinations`, `medications`, `care_logs`, `facility_tasks`, `audit_logs`
  (nếu có yêu cầu mới ngoài 3 luồng đã chốt), CI (GitHub Actions), Dockerfile
  build thật, test frontend (Playwright/Vitest), deliverable giảng viên
  (ERD/UML, Scrum, coverage).
- `git init` — vẫn **chưa làm**, chờ người dùng quyết.

## 5. Cách một phiên mới tiếp tục

1. Đọc `docs/STATE.md` → `docs/PLAN.md` → `docs/DECISIONS.md` → `docs/specs/` của phase đang làm.
2. Kiểm tra Postgres đang chạy: `powershell -File scripts/pg-start.ps1`.
3. `cd apps/api && npm run start:dev` — xác nhận `/api/v1/health` trả `db:"up"`.
4. Viết spec phase mới trong `docs/specs/` **trước khi code**, rồi code theo spec, test ngay.
5. Làm xong → cập nhật §3x/§4 file này + `specs/<phase>.md` §11 + mục trong `DECISIONS.md`.
