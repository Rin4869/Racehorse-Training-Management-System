# DEPLOY — đưa lên mạng để demo cho giảng viên

> Mục tiêu: **demo/nộp bài**, không phải vận hành lâu dài. Công thức dưới
> đây **miễn phí hoàn toàn**, không giới hạn thời gian (khác free Postgres
> của Render, tự xoá dữ liệu sau 30 ngày). Người thực hiện: bất kỳ ai trong
> nhóm có quyền push code — cần tài khoản GitHub (đã có, repo:
> `Rin4869/Racehorse-Training-Management-System`).

## Bức tranh chung

```
apps/web (React)  ──deploy──▶  Vercel        (frontend, tĩnh)
apps/api (NestJS) ──deploy──▶  Render         (API server)
                                     │
                                     ▼
                                Neon.tech      (PostgreSQL)
```

3 dịch vụ, 3 tài khoản free riêng biệt, không cái nào cần thẻ tín dụng.

## ⚠️ Giới hạn cần biết trước khi demo

`apps/api` lưu ảnh/đính kèm (ảnh ngựa, đính kèm hồ sơ khám, ảnh sự cố)
**thẳng vào ổ đĩa server**, không dùng cloud storage. Free Web Service của
Render có ổ đĩa **tạm thời** — mỗi lần server "ngủ" rồi thức dậy hoặc mỗi
lần deploy lại, **các file đã upload sẽ mất** (dữ liệu trong Postgres thì
không mất, chỉ mất file). Với nhu cầu demo, chấp nhận được — tránh demo
tính năng upload ảnh sau khi server đã ngủ lâu, hoặc upload lại ảnh mẫu
ngay trước buổi demo.

Free Web Service của Render còn **ngủ sau ~15 phút không ai gọi** — lần gọi
đầu tiên sau đó chậm khoảng 30-60 giây (cold start). Nếu demo trực tiếp cho
cô, mở link API trước buổi demo ~2 phút để "đánh thức" server.

## Bước 1 — Database: Neon.tech

1. Vào [neon.tech](https://neon.tech) → đăng ký bằng GitHub.
2. Tạo project mới (chọn region gần VN nhất, vd Singapore).
3. Vào project → **Connection string** → copy dạng
   `postgresql://<user>:<password>@<host>/<db>?sslmode=require`.
   Đây chính là `DATABASE_URL` sẽ dùng ở Bước 2.

## Bước 2 — API: Render.com

1. Vào [render.com](https://render.com) → đăng ký bằng GitHub → cho phép
   truy cập repo `Rin4869/Racehorse-Training-Management-System`.
2. **New** → **Web Service** → chọn repo đó.
3. Điền:
   | Trường | Giá trị |
   |---|---|
   | Root Directory | `apps/api` |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run prisma:generate && npm run build` |
   | Start Command | `npx prisma migrate deploy && node dist/main.js` |
   | Instance Type | Free |

   ⚠️ `--include=dev` là bắt buộc — vì `NODE_ENV=production` (khai ở bước
   sau) khiến `npm install` mặc định bỏ qua `devDependencies`, trong đó có
   `@nestjs/cli` (lệnh `nest` để build). Thiếu cờ này build sẽ lỗi
   `sh: 1: nest: not found`. `--include=dev` không ảnh hưởng lúc chạy thật —
   `dist/main.js` sau khi build xong không cần devDependencies nữa.
4. Tab **Environment** → thêm các biến (copy từ `apps/api/.env.example`,
   điền giá trị thật):

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | connection string từ Neon (Bước 1) |
   | `JWT_ACCESS_SECRET` | chuỗi ngẫu nhiên dài (tự gõ bừa hoặc dùng [1password.com/password-generator](https://1password.com/password-generator/)) |
   | `JWT_ACCESS_TTL` | `15m` |
   | `JWT_REFRESH_SECRET` | 1 chuỗi ngẫu nhiên **khác** chuỗi trên |
   | `JWT_REFRESH_TTL` | `7d` |
   | `APP_WEB_URL` | URL Vercel ở Bước 3 (điền sau khi có, có thể để tạm `http://localhost:5173` rồi sửa lại) |
   | `SMTP_HOST` | `smtp.gmail.com` (hoặc để trống nếu chưa cần gửi mail thật) |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` / `SMTP_PASS` | Gmail + app password thật, hoặc để trống — thiếu thì API tự log email ra console thay vì gửi, không lỗi |
   | `MAIL_FROM` | `"Racehorse Club <your-gmail@gmail.com>"` |
   | `UPLOAD_DIR` | `./uploads` |
   | `UPLOAD_MAX_MB` | `5` |
   | `NODE_ENV` | `production` |

   Render tự cấp biến `PORT` — không cần thêm tay, code đã đọc
   `process.env.PORT` sẵn (`src/main.ts`).
5. **Create Web Service** — Render tự build + chạy. Lần đầu tiên
   `prisma migrate deploy` sẽ tạo toàn bộ bảng trên Neon.
6. Sau khi chạy xong, chạy seed 1 lần để có tài khoản demo — mở tab
   **Shell** trên Render (hoặc chạy từ máy local, trỏ `DATABASE_URL` sang
   Neon):
   ```powershell
   $env:DATABASE_URL="<connection string Neon>"
   cd apps/api
   npm run db:seed
   ```
7. Copy URL Render cấp (dạng `https://<tên>.onrender.com`) — đây là API
   thật, kiểm tra bằng cách mở `https://<tên>.onrender.com/api/v1/health`.

## Bước 3 — Frontend: Vercel

1. Vào [vercel.com](https://vercel.com) → đăng ký bằng GitHub → **Add New
   Project** → chọn repo đó.
2. Điền:
   | Trường | Giá trị |
   |---|---|
   | Root Directory | `apps/web` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` (mặc định) |
   | Output Directory | `dist` (mặc định) |
3. **Environment Variables** → thêm:
   | Biến | Giá trị |
   |---|---|
   | `VITE_API_URL` | `https://<tên>.onrender.com/api/v1` (URL Render ở Bước 2, nhớ thêm `/api/v1`) |
4. **Deploy**. Xong thì quay lại Render (Bước 2) sửa `APP_WEB_URL` thành
   URL Vercel vừa có (`https://<tên>.vercel.app`) — dùng để dựng link trong
   email xác thực/reset password.

## Sau khi deploy xong

- Link đưa cho giảng viên xem: URL Vercel (`https://<tên>.vercel.app`).
- Tài khoản demo: xem bảng trong [README.md](../README.md) — vẫn dùng được
  vì đã seed ở Bước 2.6.
- Muốn cập nhật lên bản deploy: chỉ cần `git push` lên nhánh Render/Vercel
  đang theo dõi (mặc định là `main`, hoặc đổi sang nhánh đang làm việc trong
  cài đặt mỗi dịch vụ) — cả 2 tự build lại.
- Muốn xem dữ liệu trên Neon: dùng chính `npx prisma studio` từ máy local,
  trỏ `DATABASE_URL` sang Neon như bước 6, hoặc dùng SQL Editor có sẵn trên
  trang Neon.

## Nếu sau này cần chạy ổn định lâu dài (không chỉ demo)

Xem lại 2 vấn đề đã nêu ở đầu file (server ngủ + mất file upload) — cách xử
lý triệt để là chuyển sang gói trả phí có ổ đĩa bền (Render persistent
disk, ~vài đô/tháng) hoặc đổi hạ tầng lưu file sang cloud storage
(S3-compatible) — đây là thay đổi kiến trúc, cần bàn riêng khi tới lúc.
