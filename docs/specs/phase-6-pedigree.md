# Đặc tả — Phase 6: Pedigree & thành tích thi đấu (Hồ sơ ngựa)

> Viết trước khi code (2026-09-14). Nguồn: [../DECISIONS.md](../DECISIONS.md)
> mục "2026-09-12 — Mở rộng data model theo 3 activity diagram + ERD",
> [../DATA_MODEL.md](../DATA_MODEL.md) §"bản đầy đủ" (nhóm lõi + nhóm thi đấu
> & pedigree). Đây là **luồng thứ 1/3** của việc mở rộng sau-MVP (2 luồng còn
> lại: Training Plan + Lock, Health & Injury — làm ở phase riêng, sau phase này).
> Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

Luồng demo **"Hồ sơ & Pedigree"**: MANAGER gán ngựa bố/mẹ (sire/dam) + điểm thể
trạng cho ngựa, ghi nhận ngựa tham gia giải đua + thứ hạng; mọi role xem được
cây phả hệ + lịch sử thi đấu của 1 con ngựa (OWNER chỉ ngựa của mình).

**Trong phạm vi:**
- Thêm `sireId` / `damId` (tự tham chiếu tới `Horse`) + `fitnessScore` vào
  `Horse`. Sửa qua `PATCH /horses/:id` (đã có, không thêm route mới).
- `GET /horses/:id/pedigree` — cây phả hệ 3 đời (ngựa → bố/mẹ → ông/bà).
- Model mới `Race` (giải đua) + `RaceEntry` (1 ngựa tham gia 1 giải, có
  thứ hạng/thời gian).
- `POST/GET/PATCH /races`, `POST /races/:id/entries`,
  `GET /horses/:id/race-entries`, `PATCH /race-entries/:id`.
- Seed: 2 cặp bố/mẹ (cho 1-2 ngựa có pedigree), `fitnessScore` cho vài ngựa,
  1 giải đua + 2-3 entry có kết quả.
- e2e phủ happy path + 403/400/404 cho route mới + field mới trên horses.

**Ngoài phạm vi (để phase sau hoặc không làm):**
- `locked` / Training Lock (thuộc luồng Training Plan — phase kế).
- `incident_reports`, `notifications` (thuộc luồng Health & Injury — phase sau).
- Sửa/xoá `Race` sau khi đã bắt đầu, xoá `RaceEntry`, phát hiện vòng lặp phả hệ
  (sire/dam trỏ ngược thành tổ tiên của chính nó) — chỉ chặn tự-làm-cha-mẹ mình
  ở mức nông (xem §5.3), không dò toàn bộ cây.
- UI vẽ cây phả hệ dạng đồ hoạ — frontend Phase 6b (sau khi API xong) chỉ cần
  hiển thị dạng list/nested đơn giản, không nằm trong spec này (ưu tiên API
  trước, FE làm sau nếu còn thời gian — xem §10).

## 2. Data model

### 2.1 Sửa `Horse` (migration mới, cột nullable — không phá dữ liệu cũ)

```prisma
model Horse {
  // ...existing fields...
  sireId       String?
  sire         Horse?      @relation("HorsePedigree_Sire", fields: [sireId], references: [id])
  damId        String?
  dam          Horse?      @relation("HorsePedigree_Dam", fields: [damId], references: [id])
  fitnessScore Int?        // 0..100, nullable — chưa đánh giá

  siredFoals   Horse[]     @relation("HorsePedigree_Sire")
  damFoals     Horse[]     @relation("HorsePedigree_Dam")
  raceEntries  RaceEntry[]

  @@index([sireId])
  @@index([damId])
}
```

### 2.2 Model mới `Race` / `RaceEntry`

```prisma
model Race {
  id        String      @id @default(uuid())
  name      String
  date      DateTime
  venue     String?
  distance  Int?        // mét
  surface   String?     // "turf" | "dirt" | ... (free text, không enum)
  prizePool Float?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  entries   RaceEntry[]

  @@index([date])
}

model RaceEntry {
  id       String @id @default(uuid())
  raceId   String
  race     Race   @relation(fields: [raceId], references: [id])
  horseId  String
  horse    Horse  @relation(fields: [horseId], references: [id])
  position Int?   // null = chưa có kết quả / không hoàn thành
  time     String? // free text, vd "1:23.45" — không chuẩn hoá đơn vị
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([raceId, horseId])
  @@index([horseId])
}
```

- `RaceEntry` **không soft-delete, không có deletedAt** — giống `HealthRecord`.
- `Race` cũng không soft-delete (sửa được qua PATCH, không xoá ở phase này).
- Migration: `npx prisma migrate dev --name phase6_pedigree_races`.

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.
List: `{ data: [...], meta: { page, limit, total } }`.

### 3.1 `PATCH /horses/:id` — mở rộng (MANAGER, đã có route)

Thêm field optional vào `UpdateHorseDto`:
```jsonc
{
  "sireId": "uuid | null",         // null để xoá
  "damId": "uuid | null",
  "fitnessScore": 0                 // 0..100, null để xoá
}
```
Validate:
- `sireId` / `damId` (nếu không null) phải trỏ tới `Horse` tồn tại,
  `deletedAt: null`, và **khác chính `id` đang sửa** → sai `VALIDATION_ERROR`.
- `sireId === damId` (cả hai cùng khác null) → `VALIDATION_ERROR` (bố mẹ
  không được là cùng 1 con).
- `fitnessScore` ngoài `[0,100]` → `VALIDATION_ERROR` (class-validator `@Min/@Max`).
- Không dò cây tổ tiên sâu hơn — chỉ chặn tự tham chiếu trực tiếp (xem §Ngoài
  phạm vi).

Response: `HorseView` như cũ, cộng `sireId`, `damId`, `fitnessScore` (giá trị
thô, không join — join nằm ở `/pedigree`).

### 3.2 `GET /horses/:id/pedigree` — (auth, `HorseOwnershipGuard`)

Trả cây phả hệ 3 đời (chính nó + cha/mẹ + ông/bà nội ngoại), dừng ở độ sâu 3
hoặc khi gặp `null`/vòng lặp (horse đã xuất hiện ở đời trên → cắt, đề phòng dữ
liệu lỗi).

Response `200`:
```jsonc
{
  "id": "uuid",
  "name": "Thunderbolt",
  "fitnessScore": 78,
  "sire": {
    "id": "uuid", "name": "Northern Star", "fitnessScore": null,
    "sire": { "id": "uuid", "name": "...", "fitnessScore": null, "sire": null, "dam": null },
    "dam": null
  },
  "dam": null
}
```
Node = `{ id, name, fitnessScore, sire, dam }`, đệ quy tới đời thứ 3 rồi luôn
`null` cho `sire`/`dam` dù còn dữ liệu (giới hạn cứng, tránh tải nặng).
Lỗi: `NOT_FOUND` (horse), `FORBIDDEN` (OWNER xem ngựa người khác).

### 3.3 `POST /races` — (MANAGER)
```jsonc
{ "name": "Spring Derby", "date": "2026-10-01T00:00:00.000Z",
  "venue": "Đà Lạt Racecourse", "distance": 1600, "surface": "turf",
  "prizePool": 50000000 }
```
`name`, `date` bắt buộc; còn lại optional. `date` không giới hạn quá
khứ/tương lai (đua sắp tới hoặc nhập lại kết quả đua đã xong).
Response `201`: `Race`. Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`.

### 3.4 `GET /races?from=&to=&page=&limit=` — (auth, mọi role, không ownership)

Giải đua là dữ liệu chung của câu lạc bộ — không lọc theo owner. Sắp xếp
`date desc`. Lỗi: không có (auth only).

### 3.5 `GET /races/:id` — (auth)
Response `200`: `Race` kèm `entries` (join `horse: {id,name,ownerId}`), sắp
xếp `position asc nulls last`. Lỗi: `NOT_FOUND`.

### 3.6 `PATCH /races/:id` — (MANAGER)
Body: mọi field ở §3.3 đều optional (cần ≥1). Response `200`: `Race`.
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`.

### 3.7 `POST /races/:id/entries` — (MANAGER)
```jsonc
{ "horseId": "uuid", "position": 2, "time": "1:38.20" }
```
`horseId` bắt buộc (ngựa tồn tại, `deletedAt:null`); `position`/`time`
optional (đăng ký trước, điền kết quả sau qua PATCH entry). 1 ngựa không được
đăng ký 2 lần cùng 1 giải (`@@unique([raceId, horseId])`) → trùng thì
`CONFLICT`.
Response `201`: `RaceEntry` (kèm `horse: {id,name}`).
Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND` (race hoặc horse), `CONFLICT`.

### 3.8 `GET /horses/:id/race-entries` — (auth, `HorseOwnershipGuard`)
Query `page=1&limit=20`. Response: list `RaceEntry` (kèm `race: {id,name,date,venue}`),
sắp xếp theo `race.date desc`. Lỗi: `NOT_FOUND` (horse), `FORBIDDEN` (OWNER
ngựa người khác).

### 3.9 `PATCH /race-entries/:id` — (MANAGER)
Body: `{ position?, time? }` (≥1 field, `null` xoá). Không sửa được
`raceId`/`horseId` (huỷ đăng ký thì để phase sau, không có DELETE).
Response `200`: `RaceEntry`. Lỗi: `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`.

## 4. RBAC & ownership

| Route | Role | Ownership |
|---|---|---|
| PATCH /horses/:id (sire/dam/fitness) | MANAGER | — (đã là route sẵn có, không ownership) |
| GET /horses/:id/pedigree | mọi role | `HorseOwnershipGuard` |
| POST/PATCH /races, /races/:id | MANAGER | — (dữ liệu chung, không gắn ngựa cụ thể) |
| GET /races, /races/:id | mọi role | — (không ownership, dữ liệu công khai nội bộ CLB) |
| POST /races/:id/entries | MANAGER | — |
| GET /horses/:id/race-entries | mọi role | `HorseOwnershipGuard` |
| PATCH /race-entries/:id | MANAGER | — |

Service luôn nhận `currentUser` ở route có ownership.

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **`sireId`/`damId` sửa qua `PATCH /horses/:id` sẵn có**, không thêm
   endpoint `POST /horses/:id/pedigree` riêng — MANAGER đã là người duy nhất
   sửa hồ sơ ngựa, không cần tách.
2. **`fitnessScore` là số MANAGER tự nhập tay** (0-100), không tự tính từ
   training/health — chưa có công thức nào được chốt; để phase sau nếu cần.
3. **`GET /horses/:id/pedigree` giới hạn cứng 3 đời** (ngựa → cha/mẹ →
   ông/bà) — đủ cho demo, tránh đệ quy không giới hạn / vòng lặp dữ liệu lỗi.
4. **Không dò vòng lặp phả hệ đầy đủ** — chỉ chặn `sireId === id`,
   `damId === id`, `sireId === damId` ở tầng validate. Một con ngựa lý
   thuyết vẫn có thể bị gán là tổ tiên của chính nó ở đời xa hơn (dữ liệu
   demo tự nhập, rủi ro thấp, không đáng effort dò cây cho MVP mở rộng này).
5. **`Race` không gắn `ownerId`/không ownership** — 1 giải có nhiều ngựa
   nhiều chủ tham gia, không thuộc về ai; danh sách giải mở cho mọi role đã
   đăng nhập (kể cả OWNER xem giải mà ngựa mình không tham gia — không rò rỉ
   thông tin nhạy cảm, giải đua công khai trong CLB).
6. **`GET /horses/:id/race-entries` mới có ownership** (qua
   `HorseOwnershipGuard`) — vì đây là dữ liệu gắn với 1 ngựa cụ thể, OWNER chỉ
   xem lịch sử ngựa mình, giống Training/Health.
7. **Không có DELETE** cho `Race`/`RaceEntry` ở phase này — giống pattern
   `HealthRecord` (Phase 4): nhập sai thì PATCH lại. Huỷ đăng ký = để `position`
   null và bỏ qua (không tính là chạy giải), hoặc thêm DELETE ở phase sau nếu
   cần.
8. **1 ngựa / 1 giải chỉ 1 entry** (`@@unique`) — không hỗ trợ ngựa chạy nhiều
   heat trong cùng giải (ngoài phạm vi MVP mở rộng).
9. **Migration tên `phase6_pedigree_races`**, chỉ thêm cột nullable + bảng
   mới — không migration dữ liệu, không phá vỡ Phase 0-5.

## 6. Cấu trúc code

```
prisma/schema.prisma          # + sireId/damId/fitnessScore trên Horse, model Race/RaceEntry
prisma/migrations/<ts>_phase6_pedigree_races/

src/horses/
  dto/horses.dto.ts           # UpdateHorseDto + sireId/damId/fitnessScore
  horses.service.ts           # validate pedigree, pedigree() method (đệ quy 3 đời)
  horses.controller.ts        # + GET :id/pedigree

src/races/                    # module mới
  races.module.ts
  races.controller.ts         # RacesController (races/…) + HorseRaceEntriesController (horses/:id/race-entries)
  races.service.ts
  dto/races.dto.ts            # CreateRaceDto, UpdateRaceDto, ListRacesQueryDto,
                              # CreateRaceEntryDto, UpdateRaceEntryDto

prisma/seed.ts                 # + pedigree cho 1-2 ngựa, fitnessScore, 1 race + entries
test/pedigree.e2e-spec.ts      # PATCH horses pedigree fields + GET pedigree
test/races.e2e-spec.ts         # CRUD race + entries + ownership
src/app.module.ts              # + RacesModule
```

`RacesModule` tự `providers: [RacesService, HorseOwnershipGuard]` (giống
`TrainingModule`) — `HorseOwnershipGuard` chỉ cần `PrismaService` global nên
instantiate lại được ở module khác không sao (đã làm vậy từ Phase 3/4).

## 7. Env

Không thêm biến mới.

## 8. Seed (bổ sung, idempotent)

- Gán pedigree: `Thunderbolt.sireId` = ngựa mới `"Northern Star"` (seed thêm,
  không owner cụ thể → gán `owner1`, `status=RETIRED`, không hiển thị nổi bật
  trong list nhưng vẫn là Horse hợp lệ), `Thunderbolt.damId` = ngựa mới
  `"Silver Mist"` (owner1, RETIRED). `fitnessScore`: Thunderbolt=78,
  Midnight=65.
- 1 `Race`: "Spring Derby 2026", date +20 ngày, venue "Đà Lạt Racecourse",
  distance 1600, surface "turf".
- 2 `RaceEntry`: Thunderbolt (position null — chưa đua, chỉ đăng ký),
  Midnight (position null).
- In thêm dòng log seed cho race + pedigree.

## 9. Kế hoạch test

`test/pedigree.e2e-spec.ts` (đăng nhập manager, trainer, owner1, owner2; tạo
3 ngựa test: `child`, `sire`, `dam` — owner1; cleanup `afterAll`):

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | MANAGER PATCH `sireId`+`damId` hợp lệ | 200, field set đúng |
| 2 | PATCH `sireId = child.id` (tự làm cha mình) | 400 |
| 3 | PATCH `sireId === damId` (cùng 1 con) | 400 |
| 4 | PATCH `sireId` = uuid ngựa không tồn tại | 400 |
| 5 | PATCH `fitnessScore = 150` | 400 |
| 6 | TRAINER PATCH horse | 403 (RolesGuard, không đổi so với hiện tại) |
| 7 | owner1 GET `/horses/child/pedigree` | 200, có `sire`/`dam` join tên đúng |
| 8 | owner2 GET pedigree ngựa owner1 | 403 |
| 9 | GET pedigree ngựa có ông/bà (3 đời) | đúng độ sâu, đời 4 (nếu seed có) bị cắt |

`test/races.e2e-spec.ts` (đăng nhập manager, owner1, owner2; 1 ngựa test
owner1; cleanup `afterAll`):

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | MANAGER POST /races hợp lệ | 201 |
| 2 | POST /races thiếu `name` | 400 |
| 3 | OWNER POST /races | 403 |
| 4 | GET /races (mọi role đăng nhập) | 200, thấy race vừa tạo |
| 5 | GET /races/:id | 200, `entries: []` |
| 6 | MANAGER PATCH /races/:id | 200 |
| 7 | MANAGER POST /races/:id/entries hợp lệ | 201 |
| 8 | POST entry trùng `horseId` cùng race | 409 `CONFLICT` |
| 9 | POST entry `horseId` không tồn tại | 404 |
| 10 | OWNER POST entry | 403 |
| 11 | owner1 GET `/horses/:id/race-entries` (ngựa mình) | 200, thấy entry |
| 12 | owner2 GET race-entries ngựa owner1 | 403 |
| 13 | MANAGER PATCH `/race-entries/:id` set `position`+`time` | 200 |
| 14 | TRAINER PATCH race-entry | 403 |

## 10. Định nghĩa "xong"

- [ ] `npx prisma migrate dev` chạy sạch, không mất dữ liệu cũ
- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (55 test cũ + test mới)
- [ ] Seed chạy lại idempotent, in đủ log
- [ ] `docs/`: cập nhật spec §11, STATE.md, PLAN.md, DECISIONS.md, DATA_MODEL.md
      (chuyển pedigree/races từ "bản đầy đủ" lên ERD MVP đang chạy), API.md,
      specs/README.md
- [ ] Frontend (`apps/web`) hiển thị pedigree + race history — **không bắt
      buộc để tính "xong" phase này**; làm ở lượt sau nếu người dùng muốn (API
      trước, theo đúng thứ tự người dùng đã chọn: từng luồng, spec trước).

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-14)

Khớp đặc tả. Điểm cần ghi nhớ:

- Migration `phase6_pedigree_races` áp dụng sạch, không mất dữ liệu cũ (chỉ
  thêm cột nullable trên `Horse` + 2 bảng mới).
- `pedigree()`/`pedigreeNode()` trong `horses.service.ts` dùng `Set<string>`
  để cắt sớm nếu gặp lại 1 horseId đã duyệt (phòng dữ liệu lỗi tạo vòng lặp),
  không chỉ dựa vào giới hạn độ sâu.
- `RacesModule` tự khai báo lại `HorseOwnershipGuard` làm provider (giống
  `TrainingModule`/`HealthRecordsModule`) — guard chỉ cần `PrismaService`
  global nên không xung đột khi nhiều module cùng provide.
- `GET /races/:id` join `entries.horse` (chỉ `id,name,ownerId`) — không lộ
  thông tin nhạy cảm của chủ ngựa khác khi 1 role không phải OWNER xem race.

**File tạo mới:**
```
src/races/races.{module,controller,service}.ts
src/races/dto/races.dto.ts
test/pedigree.e2e-spec.ts
test/races.e2e-spec.ts
prisma/migrations/20260914104850_phase6_pedigree_races/
```
**Sửa:** `prisma/schema.prisma` (+sireId/damId/fitnessScore trên Horse,
+model Race/RaceEntry) · `src/horses/dto/horses.dto.ts` (+3 field trên
`UpdateHorseDto`) · `src/horses/horses.service.ts` (+`assertPedigree`,
+`pedigree`/`pedigreeNode`) · `src/horses/horses.controller.ts`
(+`GET :id/pedigree`) · `src/app.module.ts` (+RacesModule) · `prisma/seed.ts`
(+2 ngựa tổ tiên, fitnessScore, 1 race + 2 entry).

**Kiểm chứng:**
- `npx prisma migrate dev` ✅ · `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **77/77** (55 cũ + pedigree 9 + races 13) ✅
- `npm run db:seed` chạy lại idempotent, in đủ log pedigree + race.

Định nghĩa "xong" §10: build/lint/e2e/seed/docs ☑. Frontend pedigree/race
history: **chưa làm**, để lượt sau (không chặn "xong" của phase này theo §10).
