# Đặc tả — Phase 4: Health records

> Viết trước khi code (2026-09-09). Nguồn: [../PLAN.md](../PLAN.md) §6 Phase 4,
> [../MVP.md](../MVP.md) §Main flow 3, [../API.md](../API.md).
> Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

Luồng chính MVP #3: **VET tạo hồ sơ khám cho ngựa → mọi role xem được, OWNER chỉ
ngựa của mình**. Kèm đính kèm 1 file (kết quả xét nghiệm / X-quang…).

**Trong phạm vi:**
- `POST /horses/:id/health-records` (VET) — tạo record.
- `GET /horses/:id/health-records` — list theo ngựa + filter `from`/`to` + phân trang.
- `GET /health-records/:id` — chi tiết 1 record (có ownership).
- `PATCH /health-records/:id` (VET) — sửa `examDate` / `diagnosis` / `treatment`.
- `POST /health-records/:id/attachment` (VET) multipart → `attachmentPath`,
  ghi đè file cũ.
- `GET /files/health-attachments/:filename` — serve file có auth + ownership.
- Seed: 1–2 record (Thunderbolt, Midnight).
- e2e phủ happy path + 403/400/404.

**Ngoài phạm vi:** `vaccinations`, `medications`, nhắc lịch tái khám, xoá record
(không có endpoint DELETE ở phase này), nhiều file/record.

## 2. Data model

`HealthRecord` **đã tồn tại** trong migration `20260908032635_init` →
**không cần migration mới**.

```prisma
model HealthRecord {
  id             String   @id @default(uuid())
  horseId        String
  horse          Horse    @relation(fields: [horseId], references: [id])
  vetId          String
  vet            User     @relation(fields: [vetId], references: [id])
  examDate       DateTime
  diagnosis      String
  treatment      String?
  attachmentPath String?
  createdAt      DateTime @default(now())
  @@index([horseId, examDate])
}
```

Khác `TrainingSession`: **không có `updatedAt`, không có `deletedAt`, không có
enum trạng thái**. Không soft-delete, không state machine.

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.
List: `{ data: [...], meta: { page, limit, total } }`.

### 3.1 `POST /horses/:id/health-records` — (VET)

`:id` = horseId. Guard: `HorseOwnershipGuard` (OWNER thiếu role nên không tới,
guard vẫn 404 nếu ngựa không tồn tại).

Request:
```jsonc
{
  "examDate": "2026-09-05T00:00:00.000Z",  // bắt buộc, ISO 8601; không được tương lai
  "diagnosis": "Mild lameness, left fore", // bắt buộc, 1..2000 ký tự
  "treatment": "Rest 7 days, NSAIDs"       // optional, <=2000
}
```
- `vetId` = **người gọi** (không nhận từ body).
- `examDate` **không được ở tương lai** (record là ghi nhận việc đã khám) →
  `VALIDATION_ERROR`. Quá khứ OK.

Response `201`: object `HealthRecord` (§3.6).
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN` (không phải VET), `NOT_FOUND` (ngựa).

### 3.2 `GET /horses/:id/health-records` — (mọi role, ownership)

Guard: `HorseOwnershipGuard`.
Query: `from?` / `to?` (ISO, lọc theo `examDate`, khoảng đóng),
`page=1`, `limit=20` (max 100).
Response `200`: danh sách `HealthRecord` + `meta`, sắp xếp **`examDate desc`**
(khám mới nhất lên đầu).
Lỗi: `NOT_FOUND` (ngựa), `FORBIDDEN` (OWNER xem ngựa người khác).

### 3.3 `GET /health-records/:id` — (mọi role, ownership qua record→horse)

Không có horseId trên URL → ownership check ở **service**: load record kèm
`horse`; nếu người gọi là OWNER và `horse.ownerId !== user.id` → `FORBIDDEN`.
Response `200`: `HealthRecord`. Lỗi: `NOT_FOUND`, `FORBIDDEN`.

### 3.4 `PATCH /health-records/:id` — (VET)

Body (mọi field optional, cần ít nhất 1): `examDate?`, `diagnosis?`, `treatment?`
(`treatment: null` để xoá). Không cho sửa `horseId` / `vetId` / `attachmentPath`.
`examDate` mới vẫn bị chặn tương lai.
Response `200`: `HealthRecord` sau cập nhật. Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`
(RolesGuard nếu không phải VET), `NOT_FOUND`.

### 3.5 `POST /health-records/:id/attachment` — (VET) multipart

Field `file`. Cho phép **jpg / jpeg / png / webp / pdf**, ≤ `UPLOAD_MAX_MB`.
Lưu `health-attachments/<recordId>-<rand8>.<ext>`, ghi vào `attachmentPath`,
xoá file cũ best-effort (giống ảnh ngựa).
Response `201`: `HealthRecord` (có `attachmentUrl`).
Lỗi: `VALIDATION_ERROR` (thiếu file / sai mime / quá lớn), `FORBIDDEN`, `NOT_FOUND`.

### 3.6 Hình dạng object `HealthRecord`
```jsonc
{
  "id": "uuid",
  "horseId": "uuid",
  "horse": { "id": "uuid", "name": "Thunderbolt", "ownerId": "uuid" },
  "vetId": "uuid",
  "vet": { "id": "uuid", "name": "Vet One", "email": "..." },
  "examDate": "ISO",
  "diagnosis": "…",
  "treatment": null,
  "attachmentPath": null,
  "attachmentUrl": null,          // = /api/v1/files/<attachmentPath> hoặc null
  "createdAt": "ISO"
}
```

### 3.7 `GET /files/health-attachments/:filename` — (auth, ownership)

Filename validate regex `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|pdf)$`.
Không khớp / không có record tương ứng / file không tồn tại → `404`.
OWNER không phải chủ ngựa của record → `403`.

## 4. RBAC & ownership

| Route | Role | Ownership |
|---|---|---|
| POST /horses/:id/health-records | VET | `HorseOwnershipGuard` (404 ngựa) |
| GET /horses/:id/health-records | mọi role | `HorseOwnershipGuard` |
| GET /health-records/:id | mọi role | service: record→horse, OWNER phải là chủ |
| PATCH /health-records/:id | VET | RolesGuard; (không cần ownership — chỉ VET) |
| POST /health-records/:id/attachment | VET | RolesGuard |
| GET /files/health-attachments/:filename | mọi role | service: record→horse, OWNER phải là chủ |

Service luôn nhận `currentUser`.

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **Không tạo `RecordOwnershipGuard`** — `/health-records/:id` mang recordId, không
   phải horseId → check ownership trong service (load record kèm `horse` một lần).
   Giống Phase 3 với `/sessions/:id`.
2. **`vetId` = người tạo**, không nhận từ body. Chỉ VET tạo/sửa được (MANAGER
   cũng không) — đúng bảng quyền MVP.
3. **`examDate` không được ở tương lai** — hồ sơ là ghi nhận việc đã khám. (Khác
   `scheduledAt` của session vốn cho phép tương lai vì đó là lịch hẹn.)
4. **`PATCH` không cần ownership guard** — chỉ VET tới được, mà VET xem/sửa mọi
   ngựa. Không lọc theo "vet nào tạo thì vet đó sửa" cho gọn (1 CLB, ít vet).
5. **List sắp xếp `examDate desc`** — hồ sơ y tế xem gần nhất trước (khác Training
   `scheduledAt asc`).
6. **Không soft-delete, không endpoint DELETE** — `HealthRecord` không có
   `deletedAt`; sửa nhầm thì PATCH lại.
7. **Attachment cho phép PDF** ngoài ảnh — kết quả xét nghiệm thường là PDF.
   Cần multer option riêng cho route này (khác ảnh ngựa chỉ nhận ảnh).
8. **1 file/record, ghi đè** — giống ảnh ngựa, không gallery.
9. **File route đặt trong `HealthModule`** (`FilesController` của Phase 2 nằm trong
   `HorsesModule` và phụ thuộc `HorsesService`) → thêm `HealthFilesController`
   `@Controller('files')` route `health-attachments/:filename` trong `HealthModule`,
   tránh phụ thuộc vòng. Hai controller cùng prefix `files` là hợp lệ.

## 6. Cấu trúc code

```
src/health/
  health.module.ts
  health.controller.ts        # HorseHealthRecordsController (horses/:id/health-records)
                              # + HealthRecordsController (health-records/:id ...)
  health-files.controller.ts  # GET /files/health-attachments/:filename
  health.service.ts
  dto/health.dto.ts           # CreateHealthRecordDto, UpdateHealthRecordDto, ListHealthRecordsQueryDto
src/files/upload.ts           # + HEALTH_ATTACHMENT_KIND, ATTACHMENT mime map,
                              #   SAFE_ATTACHMENT_FILENAME, buildAttachmentMulterOptions()
src/files/file-storage.service.ts  # mkdir health-attachments dir khi boot
prisma/seed.ts                # + 1–2 health record
test/health.e2e-spec.ts
```

`HealthModule`:
- providers: `HealthService`, `HorseOwnershipGuard` (chỉ cần `PrismaService` global),
  `FileStorageService` → import `FilesModule` để lấy `FileStorageService` (đã export).
- import `FilesModule`.
- import vào `AppModule`.

Attachment upload dùng `@UseInterceptors(FileInterceptor('file', buildAttachmentMulterOptions()))`
với options tĩnh đọc từ `process.env` (ConfigModule đã nạp `.env` vào `process.env`) —
không cần `ConfigService` lúc decorate. (Ảnh ngựa vẫn dùng `MulterModule` global.)

## 7. Env

Không thêm biến mới. Dùng lại `UPLOAD_DIR`, `UPLOAD_MAX_MB`.

## 8. Seed (bổ sung)

VET (`vet@racehorse.local` / `Vet123!`) đã seed từ Phase 3.

Health records (idempotent theo `horseId` + `examDate`):
- Thunderbolt (owner1): `examDate` −10 ngày, `diagnosis="Routine checkup — healthy"`,
  `treatment=null`.
- Midnight (owner2): `examDate` −3 ngày, `diagnosis="Mild colic"`,
  `treatment="Monitored 24h, recovered"`.

## 9. Kế hoạch test — `test/health.e2e-spec.ts`

Đăng nhập: manager, vet, trainer, owner1, owner2. Tạo 1 ngựa test (owner1),
cleanup ở `afterAll` (xoá health record + ngựa + file đính kèm).

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | VET POST record hợp lệ | 201, `vetId`=vet, `vet` join, `attachmentUrl` null |
| 2 | POST thiếu `diagnosis` | 400 |
| 3 | POST `examDate` tương lai | 400 `VALIDATION_ERROR` |
| 4 | TRAINER POST record | 403 |
| 5 | OWNER POST record | 403 |
| 6 | POST cho horseId lạ | 404 |
| 7 | owner1 GET /horses/:id/health-records (ngựa mình) | 200, có record vừa tạo |
| 8 | owner2 GET /horses/:id/health-records (ngựa owner1) | 403 |
| 9 | owner1 GET /health-records/:id | 200 |
| 10 | owner2 GET /health-records/:id | 403 |
| 11 | GET /health-records/<uuid lạ> | 404 |
| 12 | VET PATCH `treatment` | 200, `treatment` đổi |
| 13 | TRAINER PATCH record | 403 |
| 14 | VET POST attachment (pdf) | 201, `attachmentPath` `^health-attachments/`, `attachmentUrl` khớp |
| 15 | VET POST attachment sai mime (txt) | 400 |
| 16 | owner1 tải attachment | 200, content-type application/pdf |
| 17 | owner2 tải attachment | 403 |
| 18 | filename traversal `evil.exe` | 404 |
| 19 | GET list filter `from`/`to` | chỉ record trong khoảng |

## 10. Định nghĩa "xong"

- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (health-check + auth + horses + training + health-records)
- [ ] Smoke curl: VET tạo record → đính kèm PDF → OWNER xem + tải được; TRAINER tạo → 403
- [ ] `docs/`: cập nhật spec §11, STATE, PLAN, DECISIONS, API.md, specs/README

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-09)

Khớp đặc tả. Điểm cần ghi nhớ:

- **`src/health/` đã có `HealthController` (health-check `GET /api/v1/health`) từ
  Phase 0.** Module mới đặt tên tách bạch để không đụng: `health-records.module.ts`
  / `health-records.controller.ts` / `health-records.service.ts` (class
  `HealthRecordsModule` / `HealthRecordsService`). DTO: `dto/health.dto.ts`.
- **3 controller trong `HealthRecordsModule`:** `HorseHealthRecordsController`
  (`horses/:id/health-records`, gắn `HorseOwnershipGuard` ở class) +
  `HealthRecordsController` (`health-records/:id`, `:id/attachment`) +
  `HealthFilesController` (`@Controller('files')` route `health-attachments/:filename`).
  Cùng prefix `files` với `FilesController` của Phase 2 — Nest phân biệt theo path con.
- **Attachment multer:** `buildAttachmentMulterOptions()` trong `files/upload.ts`
  đọc `process.env` (không cần `ConfigService` lúc decorate), cho phép thêm
  `application/pdf`. Dùng inline: `FileInterceptor('file', buildAttachmentMulterOptions())`.
  Ảnh ngựa vẫn dùng `MulterModule` global.
- `FileStorageService.onModuleInit` giờ tạo cả 2 thư mục
  (`horse-photos`, `health-attachments`).
- Không cần migration — `HealthRecord` có từ `init`.

**File tạo mới:**
```
src/health/health-records.{module,controller,service}.ts
src/health/dto/health.dto.ts
test/health.e2e-spec.ts
```
**Sửa:** `app.module.ts` (+HealthRecordsModule) · `files/upload.ts`
(+health attachment kind/mime/regex/options) · `files/file-storage.service.ts`
(mkdir 2 kind) · `prisma/seed.ts` (+2 health record).

**Kiểm chứng:**
- `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **55/55** (health-check 1 + auth 9 + horses 15 +
  training 14 + health-records 16) ✅

Định nghĩa "xong" §10: build/lint/e2e/docs ☑ (smoke curl thay bằng e2e phủ trọn
luồng: VET tạo → đính kèm PDF → OWNER xem + tải, OWNER khác 403, TRAINER 403).
