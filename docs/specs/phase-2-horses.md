# Đặc tả — Phase 2: Horses

> Viết trước khi code (2026-09-08). Nguồn: [../PLAN.md](../PLAN.md) §6 Phase 2,
> [../API.md](../API.md), [../DATA_MODEL.md](../DATA_MODEL.md).
> Phần "Trạng thái thực hiện" ở cuối được cập nhật sau khi code + test xong.

## 1. Mục tiêu & phạm vi

Quản lý hồ sơ ngựa của câu lạc bộ: MANAGER tạo/sửa/xoá, các role khác chỉ đọc,
OWNER chỉ thấy ngựa của mình. Kèm upload + phục vụ ảnh ngựa (lưu ổ đĩa local).

**Trong phạm vi:**
- CRUD `Horse` + filter + phân trang.
- `HorseOwnershipGuard` — chặn OWNER truy cập ngựa không thuộc mình (dùng lại được
  cho Phase 3/4).
- Upload 1 ảnh / ngựa (`POST /horses/:id/photo`), phục vụ qua `GET /files/...`
  có kiểm tra quyền.
- Seed: thêm 2 OWNER + 3 ngựa.
- e2e phủ happy path + các nhánh 403/400/404.

**Ngoài phạm vi (phase sau):** stalls, training sessions, health records, nhiều
ảnh / gallery, xoá cứng file khi xoá ngựa, chống trùng tên ngựa.

## 2. Data model

`Horse` **đã tồn tại** trong migration `20260908032635_init` — **không cần
migration mới** ở phase này.

```prisma
model Horse {
  id        String      @id @default(uuid())
  name      String
  breed     String?
  birthDate DateTime?
  ownerId   String
  owner     User        @relation("HorseOwner", fields: [ownerId], references: [id])
  status    HorseStatus @default(ACTIVE)   // ACTIVE | RESTING | RETIRED
  photoPath String?                        // đường dẫn tương đối, vd "horse-photos/<file>"
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  deletedAt DateTime?                       // soft delete
  @@index([ownerId])
  @@index([status])
}
```

Quy ước: mọi query lọc `deletedAt: null`. FK `ownerId` là `ON DELETE RESTRICT`
→ không xoá cứng được OWNER còn ngựa (đúng ý muốn; MANAGER chỉ soft-delete user).

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.
List: `{ data: [...], meta: { page, limit, total } }`.

### 3.1 `POST /horses` — (MANAGER)

Request:
```jsonc
{
  "name": "Thunderbolt",       // bắt buộc, 1..120 ký tự
  "ownerId": "<uuid>",         // bắt buộc, phải là user role=OWNER, chưa xoá
  "breed": "Thoroughbred",     // optional, <=120
  "birthDate": "2019-04-01",   // optional, ISO date, không được tương lai
  "status": "ACTIVE"           // optional, enum HorseStatus, mặc định ACTIVE
}
```
Response `201`: object `Horse` (xem 3.7).
Lỗi: `VALIDATION_ERROR` (body sai, `birthDate` tương lai, `ownerId` không phải
OWNER hợp lệ), `FORBIDDEN` (không phải MANAGER).

### 3.2 `GET /horses` — (mọi role đã đăng nhập)

Query: `ownerId?`, `status?`, `q?` (tìm gần đúng theo `name`, không phân biệt hoa
thường), `page=1`, `limit=20` (max 100).
- **OWNER**: luôn bị ép `ownerId = <chính mình>` (bỏ qua giá trị client gửi).
- Role khác: dùng filter như gửi lên.
Response `200`: danh sách `Horse` + `meta`. Sắp xếp `createdAt desc`.

### 3.3 `GET /horses/:id` — (mọi role, có ownership)

Response `200`: `Horse`.
Lỗi: `NOT_FOUND` (không tồn tại / đã soft-delete), `FORBIDDEN` (OWNER xem ngựa
người khác).

### 3.4 `PATCH /horses/:id` — (MANAGER)

Request (mọi field optional, ít nhất 1): `name?`, `breed?` (cho `null` để xoá),
`birthDate?` (`null` để xoá), `status?`, `ownerId?` (chuyển chủ, phải là OWNER hợp lệ).
Response `200`: `Horse` sau cập nhật.
Lỗi: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`.

### 3.5 `DELETE /horses/:id` — (MANAGER)

Soft delete: set `deletedAt = now()`. Response `200`: `{ "message": "Horse deleted" }`.
Lỗi: `NOT_FOUND` (đã xoá rồi cũng trả 404), `FORBIDDEN`.
Không xoá file ảnh ở phase này (ghi nợ).

### 3.6 `POST /horses/:id/photo` — (MANAGER), `multipart/form-data`

Field: `file` — 1 ảnh. Chấp nhận `image/jpeg`, `image/png`, `image/webp`.
Giới hạn kích thước = `UPLOAD_MAX_MB` (mặc định 5 MB).
- Lưu vào `${UPLOAD_DIR}/horse-photos/<horseId>-<random8>.<ext>`.
- Set `horse.photoPath = "horse-photos/<file>"`. Nếu đã có ảnh cũ → xoá file cũ
  (best-effort, lỗi xoá chỉ log).
Response `200`: `Horse` (đã có `photoPath` mới).
Lỗi: `VALIDATION_ERROR` (thiếu file / sai mime / quá lớn), `NOT_FOUND`, `FORBIDDEN`.

### 3.7 `GET /files/horse-photos/:filename` — (mọi role, có ownership)

Trả nội dung file ảnh (`Content-Type` theo đuôi). Tìm `Horse` có
`photoPath` = `horse-photos/<filename>` và `deletedAt: null`; áp ownership như
`GET /horses/:id`. Không khớp → `NOT_FOUND`. OWNER khác chủ → `FORBIDDEN`.
`filename` được validate regex `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$` (chống path traversal).

### Hình dạng object `Horse` trả về
```jsonc
{
  "id": "uuid",
  "name": "Thunderbolt",
  "breed": "Thoroughbred",      // hoặc null
  "birthDate": "2019-04-01T00:00:00.000Z", // hoặc null
  "status": "ACTIVE",
  "ownerId": "uuid",
  "owner": { "id": "uuid", "name": "Owner One", "email": "..." },
  "photoPath": "horse-photos/xxx.png", // hoặc null
  "photoUrl": "/api/v1/files/horse-photos/xxx.png", // hoặc null (tiện cho FE)
  "createdAt": "ISO", "updatedAt": "ISO"
}
```

## 4. RBAC & ownership

| Route | Role được phép | Ownership |
|---|---|---|
| POST /horses | MANAGER | — |
| GET /horses | mọi role | OWNER ép `ownerId=self` (ở service) |
| GET /horses/:id | mọi role | `HorseOwnershipGuard` |
| PATCH /horses/:id | MANAGER | — |
| DELETE /horses/:id | MANAGER | — |
| POST /horses/:id/photo | MANAGER | — |
| GET /files/horse-photos/:filename | mọi role | check trong `FilesService` |

**`HorseOwnershipGuard`** (dùng lại Phase 3/4):
- Đọc `req.params.id` (id của Horse). Load `Horse` (`deletedAt: null`).
  Không thấy → `AppException('NOT_FOUND')`.
- Nếu `user.role === OWNER` và `horse.ownerId !== user.id` → `FORBIDDEN`.
- Các role khác: cho qua.
- Gắn `req.horse` để controller/service dùng lại (tránh query 2 lần).

Service **luôn nhận `currentUser`**, không tin controller (theo PLAN §5).

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **`ownerId` phải trỏ tới user `role = OWNER`, `deletedAt: null`.** Sai →
   `VALIDATION_ERROR` (không phải 404) vì đây là lỗi dữ liệu đầu vào của form.
2. **OWNER xem ngựa người khác → `FORBIDDEN` (403), không phải 404.** Theo bảng
   quyền trong API.md. (Đánh đổi: lộ việc "id này có tồn tại". Chấp nhận cho nội bộ 1 CLB.)
3. **Ảnh: 1 ảnh/ngựa, ghi đè.** Không làm gallery. Lưu đường dẫn tương đối trong
   DB, thư mục con `horse-photos/`. Tên file `<horseId>-<random8>.<ext>` — đoán
   được horseId nhưng vẫn phải qua auth + ownership mới tải được.
4. **Serve file qua controller Nest** (không mở static folder) để ép kiểm tra quyền.
5. **`multer` diskStorage** trực tiếp (không lưu memory) — đơn giản, đủ cho quy mô.
   Thư mục `uploads/horse-photos` được tạo lúc khởi động (`FilesService.onModuleInit`).
6. **Xoá ngựa không xoá file** — ghi nợ, dọn sau nếu cần (cron hoặc script).
7. **`photoUrl`** được service tính thêm khi trả về cho tiện frontend; DB chỉ giữ `photoPath`.
8. **`FileInterceptor` + `ParseFilePipe`** để validate mime/size; lỗi map về
   `VALIDATION_ERROR` qua exception filter.

## 6. Cấu trúc code

```
src/common/guards/horse-ownership.guard.ts   # mới
src/horses/
  horses.module.ts
  horses.controller.ts
  horses.service.ts
  dto/horses.dto.ts        # CreateHorseDto, UpdateHorseDto, ListHorsesQueryDto
src/files/
  files.module.ts
  files.controller.ts
  files.service.ts
  upload.ts                # cấu hình multer (storage + fileFilter + limits)
prisma/seed.ts             # mở rộng: 2 OWNER + 3 ngựa
apps/api/uploads/.gitkeep  # giữ thư mục
```

`HorsesModule` + `FilesModule` import vào `AppModule`. `FilesModule` cần
`MulterModule` (từ `@nestjs/platform-express`).

## 7. Env

Không thêm biến mới. Dùng lại `UPLOAD_DIR` (`./uploads`), `UPLOAD_MAX_MB` (`5`),
`APP_WEB_URL` không liên quan. `config/env.ts` đã có sẵn.

## 8. Seed (bổ sung)

- `owner1@racehorse.local` / `Owner123!` — OWNER, ACTIVE, verified.
- `owner2@racehorse.local` / `Owner123!` — OWNER, ACTIVE, verified.
- 3 ngựa: `Thunderbolt` (owner1, ACTIVE), `Sea Breeze` (owner1, RESTING),
  `Midnight` (owner2, ACTIVE).
- Idempotent: upsert user theo email; ngựa `findFirst({ name })` rồi mới create.

## 9. Kế hoạch test — `test/horses.e2e-spec.ts`

Đăng nhập sẵn: MANAGER (seed), owner1, owner2.

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | MANAGER POST /horses hợp lệ | 201, `photoPath=null`, `owner.id=owner1` |
| 2 | POST /horses `ownerId` = id của MANAGER (không phải OWNER) | 400 `VALIDATION_ERROR` |
| 3 | POST /horses `birthDate` tương lai | 400 |
| 4 | owner1 POST /horses | 403 `FORBIDDEN` |
| 5 | owner1 GET /horses (không query) | 200, chỉ ngựa của owner1, `meta.total` khớp |
| 6 | owner1 GET /horses?ownerId=<owner2> | 200 nhưng vẫn chỉ ngựa owner1 (bị ép) |
| 7 | owner2 GET /horses/:id (ngựa của owner1) | 403 |
| 8 | owner1 GET /horses/:id (ngựa mình) | 200 |
| 9 | MANAGER PATCH status=RESTING | 200, `status=RESTING` |
| 10 | MANAGER POST /horses/:id/photo (png buffer) | 200, `photoPath` set, `photoUrl` set |
| 11 | owner1 GET photoUrl | 200, `content-type: image/png` |
| 12 | owner2 GET photoUrl | 403 |
| 13 | GET /files/horse-photos/evil..%2f | 400/404 (regex chặn) |
| 14 | MANAGER DELETE /horses/:id | 200; GET lại → 404 |
| 15 | GET /horses/:id không tồn tại | 404 |

Dọn dẹp `afterAll`: xoá ngựa test + 2 owner + file ảnh tạo ra.

## 10. Định nghĩa "xong"

- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (gồm health + auth + horses)
- [ ] Smoke: tạo ngựa qua Swagger, upload ảnh, tải lại ảnh
- [ ] `docs/`: cập nhật spec này (§11), STATE, PLAN, DECISIONS, API.md

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-08)

Khớp đặc tả, một vài điều chỉnh nhỏ:

- **Không cần migration** (Horse table đã có từ `init`) — đúng dự đoán §2.
- Object `Horse` trả về **có giữ `deletedAt`** (luôn `null` với ngựa chưa xoá) —
  bỏ ý định strip field cho gọn code; không ảnh hưởng client.
- `POST /horses/:id/photo` trả **201** (mặc định POST của Nest), không phải 200
  như ghi ở §3.6 — test đã chỉnh theo.
- Thêm xử lý `MulterError` (vd `LIMIT_FILE_SIZE`) trong `AllExceptionsFilter`
  → map về `VALIDATION_ERROR` 400.
- `FilesController` đặt trong `HorsesModule` (không phải `FilesModule`) để tránh
  phụ thuộc vòng: `FilesModule` chỉ chứa `FileStorageService` (thuần fs) +
  `MulterModule`, không biết gì về domain.

**File tạo mới:**
```
src/common/guards/horse-ownership.guard.ts
src/horses/{horses.module,horses.controller,horses.service}.ts
src/horses/dto/horses.dto.ts
src/files/{files.module,files.controller,file-storage.service,upload}.ts
test/horses.e2e-spec.ts
apps/api/uploads/.gitkeep
```
**Sửa:** `app.module.ts` (+HorsesModule), `common/filters/all-exceptions.filter.ts`
(+MulterError), `prisma/seed.ts` (+2 OWNER +3 ngựa).

**Kiểm chứng:**
- `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **25/25** (health 1 + auth 9 + horses 15) ✅
- Smoke qua `node dist/main.js` + curl: tạo ngựa · OWNER list bị scope ·
  upload ảnh → `photoUrl` · GET ảnh (owner) `200 image/png` · GET ảnh
  không token `401` · path traversal `404`.

Định nghĩa "xong" §10: tất cả ☑.
