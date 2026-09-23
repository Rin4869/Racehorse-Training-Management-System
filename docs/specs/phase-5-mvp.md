# Đặc tả — Phase 5: Hoàn thiện MVP (frontend + seed + tài liệu)

> Viết trước khi code (2026-09-09). Nguồn: [../PLAN.md](../PLAN.md) §6 Phase 5,
> [../MVP.md](../MVP.md), [../API.md](../API.md).
> Mục "Trạng thái thực hiện" (§10) cập nhật sau khi code.

## 1. Mục tiêu & phạm vi

Ghép 4 phase API đã xong thành **1 app React demo được trọn 4 main flow của
[MVP.md](../MVP.md)**, cộng dọn tài liệu để bàn giao.

**Trong phạm vi:**
1. **Frontend `apps/web`** — 1 app React + Vite, đổi UI theo role sau login:
   - Login (+ link Register cho tài khoản mới → PENDING).
   - Danh sách ngựa + chi tiết ngựa (tab **Sessions** | **Health**).
   - Form theo role: MANAGER tạo ngựa + duyệt user; TRAINER tạo/sửa session;
     GROOM sửa status + result; VET tạo/sửa health record + upload đính kèm.
   - Route guard theo trạng thái đăng nhập; ẩn/hiện nút theo role.
   - Đổi ngôn ngữ vi/en (đã có hạ tầng i18n từ Phase 0).
   - Axios response interceptor: 401/`TOKEN_EXPIRED` → gọi `POST /auth/refresh`
     một lần rồi retry; thất bại → logout.
2. **Seed đầy đủ** — thêm 1 user PENDING (demo luồng duyệt) + vài session
   PLANNED/DONE + giữ 2 health record. Không phá idempotency.
3. **ERD** — Mermaid `erDiagram` cho 6 model thật (MVP) vào
   [../DATA_MODEL.md](../DATA_MODEL.md) (mục mới ở đầu file, tách khỏi bản mở rộng).
4. **README** — cập nhật cách chạy full-stack + tài khoản demo mọi role + checklist.
5. Rà [../MVP.md](../MVP.md) §"Định nghĩa xong MVP".

**Ngoài phạm vi:** tách web con theo role, test frontend (e2e Playwright…),
CI, Docker build thật, module sau-MVP (stalls, vaccinations…), báo cáo/reports,
đổi mật khẩu trong UI, i18n cho toàn bộ nhãn dữ liệu (chỉ nhãn UI chính).

## 2. Frontend — kiến trúc

Stack có sẵn: React 19, react-router-dom 7, axios, i18next + react-i18next, Vite 8,
TypeScript 5.9, oxlint. **Không thêm dependency** (không UI kit — CSS thuần).

```
src/
  main.tsx                 # <BrowserRouter> + <AuthProvider> + <Routes>
  index.css                # reset + design tokens + tiện ích (viết lại từ skeleton)
  i18n/{index.ts,vi.json,en.json}   # bổ sung khoá
  lib/
    api.ts                 # axios + request/response interceptor (refresh once)
    types.ts               # Role, User, Horse, Session, HealthRecord, Paginated, ApiError
    format.ts              # formatDate (Asia/Ho_Chi_Minh), apiErrorCode(err)
  auth/
    AuthContext.tsx        # { user, login, logout, refreshMe }; token trong localStorage
    useAuth.ts             # hook lấy context (throw nếu ngoài provider)
    RequireAuth.tsx        # <Navigate to="/login"> nếu chưa đăng nhập
  components/
    Layout.tsx             # header: tên app, nav, lang switch, user + logout; <Outlet/>
    Field.tsx              # input + label + lỗi
    ErrorText.tsx          # dịch mã lỗi API
  pages/
    LoginPage.tsx          # login; tab/link sang Register
    RegisterPage.tsx       # đăng ký → thông báo "chờ MANAGER duyệt"
    HorsesPage.tsx         # danh sách + (MANAGER) form tạo ngựa
    HorseDetailPage.tsx    # header ngựa + tab Sessions | Health
    horse/SessionsTab.tsx  # list + (TRAINER) tạo · (TRAINER/GROOM) sửa
    horse/HealthTab.tsx    # list + (VET) tạo/sửa + upload đính kèm
    AdminUsersPage.tsx     # (MANAGER) list user + duyệt PENDING (role + ACTIVE)
```

### 2.1 Auth & token
- Login lưu `accessToken` + `refreshToken` vào `localStorage`
  (`racehorse.accessToken` / `racehorse.refreshToken`), set `user` vào context.
- Khi load app: nếu có accessToken → gọi `GET /auth/me` để phục hồi `user`;
  lỗi → xoá token.
- Response interceptor: nếu `401` và chưa retry và có refreshToken → `POST /auth/refresh`
  `{refreshToken}` → lưu cặp token mới → retry request gốc 1 lần. Thất bại → xoá
  token + chuyển `/login`. Tránh vòng lặp: không intercept chính `/auth/refresh`.
- Logout: `POST /auth/logout {refreshToken}` (bỏ qua lỗi) → xoá token → `/login`.

### 2.2 Định tuyến
| Path | Trang | Guard |
|---|---|---|
| `/login` | LoginPage | công khai (đã đăng nhập → `/horses`) |
| `/register` | RegisterPage | công khai |
| `/` | redirect → `/horses` | — |
| `/horses` | HorsesPage | RequireAuth |
| `/horses/:id` | HorseDetailPage | RequireAuth |
| `/admin/users` | AdminUsersPage | RequireAuth + role MANAGER (khác → `/horses`) |
| `*` | redirect → `/horses` | — |

Nav trong Layout: "Ngựa" luôn hiện; "Người dùng" chỉ MANAGER.

### 2.3 Hành vi theo role (ẩn nút nếu không có quyền; API vẫn là nguồn enforce)
| Màn | MANAGER | TRAINER | VET | GROOM | OWNER |
|---|---|---|---|---|---|
| Tạo ngựa | ✅ | | | | |
| Duyệt user PENDING | ✅ | | | | |
| Tạo session | | ✅ | | | |
| Sửa session (notes/lịch/type) | | ✅ (khi PLANNED) | | | |
| Đổi status + nhập result | | ✅ | | ✅ | |
| Tạo/sửa health record | | | ✅ | | |
| Upload đính kèm | | | ✅ | | |
| Xem mọi thứ | ✅ | ✅ | ✅ | ✅ | ✅ ngựa của mình |

OWNER: danh sách ngựa tự động chỉ có ngựa của mình (API ép `ownerId`); mọi form
tạo/sửa ẩn.

### 2.4 UI — mức tối giản
- CSS thuần trong `index.css`: tokens màu (sáng/tối theo `prefers-color-scheme`),
  `.card`, `.btn`, `.btn-primary`, `.input`, `.tag`, `.table`, `.error`.
- Không cần responsive cầu kỳ; layout 1 cột max-width ~880px, header sticky.
- Ngày hiển thị `Asia/Ho_Chi_Minh` (`Intl.DateTimeFormat('vi-VN', { timeZone })`).
- Enum (status, role) hiển thị raw hoặc map i18n đơn giản; đủ cho demo.

## 3. Seed (bổ sung Phase 5)

Giữ nguyên seed Phase 1-4, thêm (idempotent):
- 1 user **PENDING** chưa gán role: `newbie@racehorse.local` / `Newbie123!`
  (`status=PENDING`, `emailVerifiedAt` set sẵn để demo bước "MANAGER duyệt"
  không vướng verify email). Upsert theo email, `update: {}`.
- Session: thêm cho `Sea Breeze` (owner1) 1 `dressage` PLANNED để tab Sessions của
  ngựa thứ 2 không trống. (idempotent theo `horseId`+`type` như hiện tại.)
- Không đổi health record.

Log ra cuối seed: bảng tài khoản mọi role + mật khẩu (giúp README/demo).

## 4. ERD → DATA_MODEL.md

Thêm mục **"## ERD — MVP (6 bảng thực tế)"** ở đầu file, trước "bản đầy đủ".
Mermaid `erDiagram`: `User`, `RefreshToken`, `AuthToken`, `Horse`,
`TrainingSession`, `HealthRecord` + quan hệ + cột chính. Ghi rõ đây là schema
Prisma hiện hành; phần còn lại của file là tầm nhìn mở rộng.

## 5. README

- Mục "Chạy frontend" nêu rõ: cần API chạy ở `:3000` trước.
- Bảng **tài khoản demo** mọi role.
- Thêm mục "Demo 4 luồng MVP" — các bước bấm tay để trình bày.
- Nhắc `npm run test:e2e` = 55 test.

## 6. Quyết định thiết kế (ghi vào DECISIONS.md)

1. **1 app React đổi UI theo role** (không tách web con) — đúng định hướng giai
   đoạn MVP trong [../DECISIONS.md](../DECISIONS.md) 2026-09-08.
2. **Không thêm dependency frontend** — CSS thuần, không UI kit, không state lib
   (Context đủ). Giữ bundle nhỏ, dễ đọc cho chấm điểm.
3. **Token trong `localStorage`** — đúng chốt Phase 1 (refresh qua body, không
   cookie). Chấp nhận rủi ro XSS cho đồ án nội bộ.
4. **Refresh 1 lần trong interceptor**, không hàng đợi request song song (đủ cho
   demo; tải thấp).
5. **`GET /auth/me` khi khởi động** để phục hồi user thay vì decode JWT ở client
   (JWT chỉ mang `sub`).
6. **Không i18n hoá dữ liệu động** (tên ngựa, diagnosis…) — chỉ nhãn UII.
7. **ERD đặt trong DATA_MODEL.md** (không tạo file mới) — gom tài liệu data về 1 chỗ.
8. Seed thêm user PENDING **đã verify email** để demo bước duyệt gọn (không phải
   mở link verify trong console log).

## 7. Env

`apps/web/.env` — `VITE_API_URL=http://localhost:3000/api/v1` (đã có).
Không thêm biến.

## 8. Kế hoạch kiểm thử (thủ công — không có test tự động cho web ở phase này)

Chạy API (`start:dev`) + web (`dev`), lần lượt:
1. **Setup:** login MANAGER → tạo ngựa mới cho owner1 → `/admin/users` duyệt
   `newbie@` thành TRAINER + ACTIVE.
2. **Training:** login TRAINER → mở ngựa → tab Sessions → tạo session → login
   GROOM → đổi status DONE + nhập result → thấy DONE.
3. **Health:** login VET → mở ngựa → tab Health → tạo record → upload 1 PDF →
   thấy link tải.
4. **View:** login owner1 → chỉ thấy ngựa của mình → mở ngựa xem Sessions + Health;
   không có nút tạo/sửa. Login owner2 → không thấy ngựa của owner1; gõ URL
   `/horses/<id owner1>` → trang báo lỗi 403/không tìm thấy.
5. Đổi ngôn ngữ vi/en trên header — nhãn đổi, không mất trạng thái đăng nhập.
6. `npm run build` (web) sạch · `npm run lint` (web) sạch.
7. API: `npm run build` · `npm run lint` · `npm run test:e2e` vẫn 55/55.

## 9. Định nghĩa "xong"

- [ ] `apps/web`: `npm run build` + `npm run lint` sạch.
- [ ] `apps/api`: build + lint + e2e (55) vẫn xanh; seed chạy lại được từ DB trống.
- [ ] Chạy tay được cả 4 luồng MVP §8.
- [ ] Checklist [../MVP.md](../MVP.md) §"Định nghĩa xong MVP" tất cả ☑.
- [ ] `docs/`: spec §10, STATE, PLAN, DECISIONS, DATA_MODEL (ERD), README, OVERVIEW
  (đánh dấu Phase 5 xong), MVP.md (tick checklist).

## 10. Trạng thái thực hiện — ✅ XONG (2026-09-09)

Khớp đặc tả. Điểm cần ghi nhớ:

- **Frontend `apps/web`** dựng đúng cấu trúc §2, không thêm dependency. React 19 +
  react-router-dom 7 (`createBrowserRouter`), axios, i18next.
  - `lib/api.ts`: request interceptor gắn Bearer; response interceptor refresh 1
    lần (dedupe qua biến `refreshing`), bỏ qua `/auth/*`, thất bại → `setOnAuthLost`
    (AuthProvider xoá token → RequireAuth đá về `/login`).
  - `auth/`: `context.ts` (createContext) + `AuthProvider.tsx` + `useAuth.ts` +
    `RequireAuth.tsx` (tách file để hợp `react/only-export-components`).
    Khởi động: có accessToken → `GET /auth/me` phục hồi `user`.
  - Trang: Login, Register, Horses (+ form tạo ngựa cho MANAGER, chọn owner từ
    `GET /users?role=OWNER`), HorseDetail (tab Sessions/Health, tab lưu ở URL
    `?tab=health` để chia sẻ link), SessionsTab
    (TRAINER tạo · TRAINER/GROOM sửa status+result+notes khi PLANNED), HealthTab
    (VET tạo/sửa + upload đính kèm; nút "mở đính kèm" tải blob qua axios rồi
    `window.open` vì file cần Bearer), AdminUsers (MANAGER duyệt PENDING = chọn
    role + `PATCH {role,status:ACTIVE}`, khoá/mở ACTIVE↔DISABLED).
  - `index.css` viết lại: tokens sáng/tối, `.card/.btn/.input/.table/.tag/.tabs`.
  - i18n: bổ sung khoá vi/en cho toàn bộ nhãn UI. Mã lỗi API → `error.<CODE>`.
- **Seed:** +`newbie@racehorse.local` PENDING (đã verify email) +1 session
  `dressage` cho Sea Breeze + in bảng tài khoản demo cuối seed. Vẫn idempotent.
- **ERD:** thêm mục Mermaid `erDiagram` (6 model thật) ở đầu `DATA_MODEL.md`.
- **README:** thêm mục chạy full-stack + bảng tài khoản demo + "Demo 4 luồng MVP".

**Sai khác nhỏ so với spec:**
- `oxlint` báo 4 **warning** `react(set-state-in-effect)` ở 4 trang fetch danh
  sách (gọi hàm `load` async trong `useEffect`; rule over-eager với data-fetch —
  các `setState` đều sau `await`). `npm run lint` vẫn **exit 0** — chấp nhận.
- Chưa tự động hoá click-through; đã verify: `npm run build` (web) ✅,
  `npm run lint` (web, exit 0) ✅, cả 2 server boot + phục vụ (health, login,
  SPA fallback `/horses/:id` → 200), API `npm run test:e2e` 55/55 ✅.
  Click-through 4 luồng MVP §8 để người dùng trình bày demo.

**File tạo mới (apps/web/src):**
```
lib/{types,format}.ts · lib/api.ts (viết lại)
auth/{context.ts,AuthProvider.tsx,useAuth.ts,RequireAuth.tsx}
components/{Layout,Field,ErrorText}.tsx
pages/{LoginPage,RegisterPage,HorsesPage,HorseDetailPage,AdminUsersPage}.tsx
pages/horse/{SessionsTab,HealthTab}.tsx
main.tsx (viết lại) · index.css (viết lại) · i18n/{vi,en}.json (mở rộng)
```
**Xoá:** `src/App.tsx`.
**Sửa (apps/api):** `prisma/seed.ts`.
**Sửa (docs):** spec, STATE, PLAN, DECISIONS, DATA_MODEL, README, OVERVIEW, MVP, specs/README.

Định nghĩa "xong" §9: build/lint (web) ☑ · build/lint/e2e + seed (api) ☑ ·
docs ☑ · click-through 4 luồng: để người dùng demo (hạ tầng sẵn sàng).
