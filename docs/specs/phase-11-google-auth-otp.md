# Đặc tả — Phase 11: Đăng nhập Google + xác thực email bằng OTP

> Viết trước khi code (2026-09-29). Theo yêu cầu người dùng: đăng nhập bằng
> Google, xác thực email đăng ký bằng mã OTP (thay cho link), đăng ký vẫn
> qua bước MANAGER duyệt như cũ (không đổi). Mục "Trạng thái thực hiện"
> (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

**Trong phạm vi:**
- Thay cơ chế xác thực email đăng ký: bỏ link token, dùng **mã OTP 6 số**
  gửi qua email, người dùng nhập ngay trên web sau khi đăng ký.
- `POST /auth/google` — đăng nhập/đăng ký bằng tài khoản Google, xác thực
  qua **Google ID token** (không dùng redirect OAuth2 truyền thống — xem
  quyết định #1).
- Tài khoản tạo qua Google **vẫn phải chờ MANAGER duyệt** giống đăng ký
  thường (dùng lại đúng luồng `status=PENDING` → duyệt ở `/admin/users`
  đã có sẵn, không code lại).
- Frontend: nút "Đăng nhập bằng Google" ở trang Login; màn hình nhập OTP
  sau khi đăng ký (thay màn hình tĩnh hiện tại); nút gửi lại mã.

**Ngoài phạm vi:**
- Không đổi luồng duyệt tài khoản ở `/admin/users` (đã đúng yêu cầu, xem
  `AdminUsersPage.tsx` hiện tại — PENDING → chọn role → Duyệt).
- Không thêm "liên kết tài khoản Google" cho user đã đăng nhập sẵn (chỉ
  xử lý lúc đăng nhập/đăng ký) — nếu email trùng tài khoản có sẵn, tự động
  gắn `googleId` vào user đó (xem quyết định #3), không có UI riêng.
- Không đổi `POST /auth/forgot-password` / `reset-password` (vẫn dùng
  link token qua `AuthToken`, không liên quan OTP).
- Không thêm giới hạn tần suất gửi lại OTP (cooldown theo giây) — chỉ giới
  hạn số lần **nhập sai** (xem quyết định #4). Đủ cho quy mô demo.

## 2. Data model

```prisma
// User: passwordHash trở thành optional (tài khoản Google không có mật khẩu)
//       + googleId String? @unique
//       + otpCodes OtpCode[]

model OtpCode {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String
  attempts  Int       @default(0)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

- `passwordHash String` → `String?`: tài khoản tạo qua Google không có mật
  khẩu cục bộ. `AuthService.login()` (email+password) đã có check
  `bcrypt.compare` — thêm guard: nếu `passwordHash` null thì coi như sai
  mật khẩu (báo `UNAUTHENTICATED`), không crash.
- `OtpCode` là model mới (không tái dùng `AuthToken`) — vì cần thêm
  `attempts` (đếm số lần nhập sai) mà `AuthToken` không có, và mã 6 số
  ngắn hơn hẳn token hex 64 ký tự hiện tại (xem quyết định #2).
- `AuthToken.type` bỏ giá trị `"VERIFY_EMAIL"` khỏi luồng dùng (code
  `TokenService.AUTH_TOKEN_TYPES` chỉ còn `RESET_PASSWORD`) — các dòng cũ
  còn lại trong DB (nếu có) không bị đọc tới, không cần xoá.

Migration: `npx prisma migrate dev --name phase11_google_otp`.

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.

### 3.1 Đăng ký + OTP (thay `GET /auth/verify-email`)

```
POST /auth/register          (Public, không đổi request body)
  → { message } — luôn kèm: "đã gửi mã OTP tới email"

POST /auth/verify-otp        (Public)  { email, code }
  → { message } — đúng mã: set emailVerifiedAt, trả về nhắc "chờ MANAGER duyệt"
  → sai mã: 401 TOKEN_INVALID (tăng attempts)
  → hết hạn (10 phút): 401 TOKEN_EXPIRED
  → quá 5 lần sai / không có mã nào đang hiệu lực: 401 TOKEN_INVALID
    (kèm message gợi ý bấm "Gửi lại mã")

POST /auth/resend-otp        (Public)  { email }
  → { message } — LUÔN trả cùng 1 message chung (không phân biệt email có
    tồn tại hay không, giống `forgot-password` đã có, tránh dò email) —
    nếu user tồn tại và chưa verify, phát mã mới (vô hiệu hoá mã cũ chưa
    dùng bằng cách chỉ query mã mới nhất — xem quyết định #2)
```

`GET /auth/verify-email?token=` — **xoá bỏ** (không còn route, không còn
dùng trong `MailService`).

### 3.2 Đăng nhập Google

```
POST /auth/google   (Public)   { idToken }
  → 200 { accessToken, refreshToken, user }  — giống hệt response /auth/login
  → 401 UNAUTHENTICATED — idToken không hợp lệ / sai audience / email
    chưa verify bên Google
  → 403 ACCOUNT_PENDING — user mới tạo hoặc user cũ đang PENDING (giống
    login thường — frontend đã có sẵn xử lý message này)
  → 403 ACCOUNT_DISABLED — user bị khoá
```

Luồng xử lý trong `AuthService.googleLogin()`:
1. Verify `idToken` bằng `google-auth-library` (`OAuth2Client.verifyIdToken`,
   `audience = GOOGLE_CLIENT_ID`). Payload sai / hết hạn / audience sai →
   `UNAUTHENTICATED`.
2. Lấy `payload.email`, `payload.name`, `payload.sub` (googleId). Nếu
   `payload.email_verified !== true` → `UNAUTHENTICATED` (không tin email
   chưa verify bên Google).
3. Tìm `User` theo `googleId`. Nếu không có, tìm theo `email`:
   - Có sẵn (đăng ký thường trước đó, chưa liên kết) → gắn `googleId` vào
     user đó, set `emailVerifiedAt` nếu chưa có (Google đã verify hộ).
   - Không có → tạo mới: `name`, `email`, `passwordHash: null`, `googleId`,
     `status: PENDING`, `role: null`, `emailVerifiedAt: now()`.
4. Áp đúng luật như `login()`: `PENDING` → `ACCOUNT_PENDING`; khác `ACTIVE`
   → `ACCOUNT_DISABLED`; `ACTIVE` → phát `accessToken`/`refreshToken`.

## 4. RBAC & ownership

Không đổi — cả 4 route mới đều `@Public()` (trước khi có JWT), giống
`register`/`login`/`forgot-password` hiện có. Không có ownership liên quan.

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **Google login xác thực bằng ID token (Google Identity Services ở
   frontend), không dùng luồng OAuth2 redirect + `passport-google-oauth20`
   phía server.** Lý do: frontend (Vercel) và API (Render) ở 2 domain khác
   nhau — luồng redirect cần cấu hình callback URL/cookie cross-domain
   phức tạp hơn hẳn, trong khi dự án hiện không dùng `@nestjs/passport` ở
   đâu cả (auth thuần JWT tự viết). Luồng ID-token: frontend nhúng nút
   Google chính thức, nhận `credential` (JWT) ngay trên trình duyệt, POST
   thẳng lên `/auth/google` để backend tự verify bằng `google-auth-library`
   — chỉ cần 1 biến `GOOGLE_CLIENT_ID`, không cần `GOOGLE_CLIENT_SECRET`
   hay callback URL nào cả. Phù hợp quy mô demo.
2. **OTP là model mới (`OtpCode`), không tái dùng `AuthToken`.** `AuthToken`
   lưu token hex dài, không có bộ đếm sai. OTP cần TTL ngắn hơn (10 phút
   so với 24h của link cũ) + đếm số lần nhập sai (chống dò mã 6 số bằng
   brute-force — không gian chỉ 1 triệu khả năng, ngắn hơn hẳn token hex).
   "Gửi lại mã" không xoá mã cũ, chỉ tạo dòng mới; `verifyOtp` luôn lấy
   dòng **mới nhất chưa dùng** theo `createdAt desc`, nên mã cũ tự động
   hết tác dụng mà không cần thao tác xoá riêng.
3. **Email trùng tài khoản có sẵn → tự gắn `googleId`, không báo lỗi
   CONFLICT.** Vì Google đã xác minh chủ sở hữu email đó — coi như cùng
   một người, không bắt đăng ký lại. Không có ảnh hưởng bảo mật thêm vì
   Google login không cho biết/đổi mật khẩu cũ.
4. **Không giới hạn tần suất gửi lại OTP theo thời gian, chỉ giới hạn số
   lần nhập sai (5 lần/mã).** Thêm cooldown theo giây là một trục phòng
   thủ khác (chống spam email) — ngoài phạm vi yêu cầu hiện tại, để dành
   khi cần (ghi chú ở mục "Ngoài phạm vi").
5. **`passwordHash` chuyển sang optional**, không tách bảng "GoogleAccount"
   riêng — chỉ 1 field mới trên `User` đủ để phân biệt (user Google thuần
   có `passwordHash = null`, không đăng nhập được bằng mật khẩu, chỉ bằng
   Google). Đơn giản hơn hẳn so với tách bảng cho 1 field.
6. **Route `GET /auth/verify-email` xoá hẳn, không giữ song song** — theo
   lựa chọn "thay hẳn bằng OTP" đã chốt, tránh 2 cơ chế xác thực cùng tồn
   tại gây rối cho FE/test.

## 6. Cấu trúc code

```
prisma/schema.prisma          # User.passwordHash optional, +googleId, +otpCodes; model OtpCode
prisma/migrations/<ts>_phase11_google_otp/

apps/api/package.json         # + google-auth-library

src/auth/token.service.ts     # AUTH_TOKEN_TYPES bỏ VERIFY_EMAIL;
                               # + issueOtp(userId), + verifyOtp(userId, code)
src/auth/auth.service.ts      # register() dùng issueOtp thay issueAuthToken;
                               # bỏ verifyEmail(); + verifyOtp(dto), + resendOtp(dto),
                               # + googleLogin(dto); login() thêm guard passwordHash null
src/auth/auth.controller.ts   # bỏ GET verify-email; + POST verify-otp, resend-otp, google
src/auth/dto/auth.dto.ts      # + VerifyOtpDto, ResendOtpDto, GoogleLoginDto; bỏ VerifyEmailQueryDto
src/mail/mail.service.ts      # sendVerifyEmail(link) → sendVerifyOtp(code)

apps/web/index.html           # + script Google Identity Services
apps/web/.env(.example)       # + VITE_GOOGLE_CLIENT_ID
apps/web/src/auth/context.ts       # + loginWithGoogle(idToken)
apps/web/src/auth/AuthProvider.tsx # + loginWithGoogle()
apps/web/src/pages/LoginPage.tsx   # + nút Google (render bằng GSI script)
apps/web/src/pages/RegisterPage.tsx # sau khi đăng ký → màn hình nhập OTP thay vì text tĩnh
apps/web/src/i18n/vi.json, en.json # + chuỗi OTP/Google

apps/api/prisma/seed.ts       # không đổi (user Google không seed, không cần thiết cho demo)
apps/api/test/auth.e2e-spec.ts # + test OTP + Google (mock verifyIdToken)
```

## 7. Env

Backend (`apps/api/.env.example`, Render):
```
GOOGLE_CLIENT_ID=<client id từ Google Cloud Console>
```
(Không cần `GOOGLE_CLIENT_SECRET` — xem quyết định #1.)

Frontend (`apps/web/.env`, Vercel):
```
VITE_GOOGLE_CLIENT_ID=<cùng client id — Google OAuth Client ID là public,
                        an toàn khi lộ ra ở frontend>
```

## 8. Kế hoạch test — mở rộng `test/auth.e2e-spec.ts`

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | Đăng ký → không truyền OTP, thử login thẳng | vẫn 403 `EMAIL_NOT_VERIFIED` như cũ |
| 2 | Đăng ký → lấy mã OTP (test đọc qua Prisma trực tiếp, giống cách test cũ đọc `AuthToken`) → `verify-otp` đúng mã | 200, `emailVerifiedAt` được set |
| 3 | `verify-otp` sai mã 1 lần | 401 `TOKEN_INVALID`, `attempts=1` |
| 4 | `verify-otp` sai mã 5 lần liên tiếp | lần thứ 6 dù đúng mã cũng 401 (đã khoá mã đó) |
| 5 | `resend-otp` với email không tồn tại | vẫn 200 message chung (không lộ thông tin) |
| 6 | `resend-otp` rồi verify bằng mã **mới** | 200 (mã cũ không còn tác dụng) |
| 7 | `POST /auth/google` với idToken giả/không verify được | 401 `UNAUTHENTICATED` (mock `OAuth2Client.verifyIdToken` throw) |
| 8 | `POST /auth/google` user mới (mock payload hợp lệ, email chưa tồn tại) | tạo user PENDING, trả 403 `ACCOUNT_PENDING` |
| 9 | MANAGER duyệt user Google đó (PATCH /users/:id) → gọi lại `/auth/google` cùng idToken | 200, có token |
| 10 | `POST /auth/google` với email trùng user thường đã ACTIVE (chưa gắn googleId) | 200, gắn `googleId`, đăng nhập được luôn |

Mock `google-auth-library`: dùng `jest.spyOn` / `jest.mock('google-auth-library')`
trên `OAuth2Client.prototype.verifyIdToken`, trả `{ getPayload: () => ({...}) }`
giả — không gọi mạng thật trong e2e.

## 9. Định nghĩa "xong"

- [ ] `npx prisma migrate dev` chạy sạch
- [ ] `npm run build` sạch (api + web)
- [ ] `npm run lint` sạch (api + web)
- [ ] `npm run test:e2e` xanh (140 test cũ + test mới)
- [ ] Web: đăng ký → nhập OTP → thấy màn "chờ duyệt"; nút Google hiển thị
      và gọi được `/auth/google` (test thủ công vì cần Google Client ID thật)
- [ ] `docs/`: cập nhật spec §11 này, STATE.md, PLAN.md, DECISIONS.md,
      API.md, DATA_MODEL.md, specs/README.md, DEPLOY.md (thêm biến
      `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` vào bảng env)

## 10. Trạng thái thực hiện — ✅ XONG (2026-09-29)

Khớp đặc tả. Điểm cần ghi nhớ:

- Migration tạo thủ công (`prisma migrate dev` từ chối chạy vì môi trường
  Bash/PowerShell ở đây không có TTY thật — `npx prisma migrate diff
  --from-url ... --to-schema-datamodel ... --script` sinh đúng SQL, đặt vào
  thư mục `prisma/migrations/<ts>_phase11_google_otp/` theo đúng chuẩn thư
  mục Prisma, rồi áp bằng `prisma migrate deploy` (không cần TTY). Cách này
  chỉ dùng khi `migrate dev` không chạy được do môi trường, SQL sinh ra
  giống hệt những gì `migrate dev` sẽ tạo.
- `TokenService.AUTH_TOKEN_TYPES` bỏ `VERIFY_EMAIL`, chỉ còn
  `RESET_PASSWORD` — các dòng `AuthToken` cũ kiểu `VERIFY_EMAIL` trong DB
  (nếu có từ trước) không bị đọc tới nữa, không cần xoá tay.
- `AuthService.googleLogin()` không tự động set `role` khi tạo user mới —
  giữ `role: null` giống hệt luồng đăng ký thường, MANAGER chọn role lúc
  duyệt ở `/admin/users` (không đổi `AdminUsersPage.tsx`).
- Frontend: `GoogleSignInButton` tự ẩn (`return null`) khi chưa cấu hình
  `VITE_GOOGLE_CLIENT_ID` — không phá trang Login khi biến môi trường chưa
  set (đúng lúc code xong, người dùng chưa tạo Google OAuth Client).
- Test e2e mock `google-auth-library` bằng `jest.mock` +
  `mockVerifyIdToken` (biến bắt đầu bằng `mock` để qua được babel-plugin
  hoist của Jest) — không gọi mạng Google thật trong e2e.

**File tạo mới:**
```
prisma/migrations/20260929051852_phase11_google_otp/
apps/web/src/components/GoogleSignInButton.tsx
```
**Sửa:** `prisma/schema.prisma` (User.passwordHash optional, +googleId,
+otpCodes; +model OtpCode) · `src/auth/token.service.ts` (bỏ
`VERIFY_EMAIL`, +`issueOtp`/`verifyOtp`) · `src/auth/auth.service.ts`
(+`verifyOtp`/`resendOtp`/`googleLogin`, bỏ `verifyEmail`, login() guard
`passwordHash` null) · `src/auth/auth.controller.ts` (bỏ `GET
verify-email`, +`POST verify-otp/resend-otp/google`) ·
`src/auth/dto/auth.dto.ts` (+`VerifyOtpDto`/`ResendOtpDto`/`GoogleLoginDto`,
bỏ `VerifyEmailQueryDto`) · `src/mail/mail.service.ts` (`sendVerifyEmail`→
`sendVerifyOtp`) · `apps/api/.env.example` (+`GOOGLE_CLIENT_ID`) ·
`apps/web/index.html` (+script Google Identity Services) ·
`apps/web/.env.example` (+`VITE_GOOGLE_CLIENT_ID`) ·
`apps/web/src/auth/context.ts`/`AuthProvider.tsx` (+`loginWithGoogle`) ·
`apps/web/src/pages/LoginPage.tsx` (+nút Google) ·
`apps/web/src/pages/RegisterPage.tsx` (+bước nhập/gửi lại OTP) ·
`apps/web/src/i18n/vi.json`/`en.json` (+chuỗi OTP/Google, đổi
`TOKEN_EXPIRED`/`TOKEN_INVALID` sang câu chung hơn) ·
`apps/web/src/index.css` (+`.auth-divider`) ·
`apps/api/test/auth.e2e-spec.ts` (+test OTP sai/gửi lại/Google, mock
`google-auth-library`).

**Kiểm chứng:**
- `npx prisma migrate deploy` ✅ (migration thủ công áp sạch)
- `npm run build` ✅ (api + web) · `npm run lint` ✅ (api + web)
- `npm run test:e2e` → **145/145** (139 cũ + 6 mới trong `auth.e2e-spec.ts`) ✅
- `npm run db:seed` chạy lại idempotent, không lỗi.
- Chưa test thủ công nút Google trên trình duyệt thật (cần
  `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` thật — hướng dẫn tạo ở
  DEPLOY.md, người dùng tự điền và thử sau).

Định nghĩa "xong" §9: build/lint/e2e ☑; test thủ công UI Google/OTP để
sau khi có Google Client ID thật; docs ☑ (mục này + STATE.md/PLAN.md/
DECISIONS.md/API.md/DATA_MODEL.md/specs/README.md/DEPLOY.md).
