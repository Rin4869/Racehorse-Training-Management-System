# Đặc tả — Phase 10: Health & Injury extensions (Sprint 3 remainder)

> Viết trước khi code (2026-09-24). Nguồn: `CLAUDE_CODE_BACKEND_FULL.md`
> (Sprint 3) + [../DECISIONS.md](../DECISIONS.md) mục "2026-09-24 — Đối
> chiếu CLAUDE_CODE_BACKEND_FULL.md với code thật". Đây là phần **hoàn
> toàn mới** của Sprint 3 — UC-14, UC-16, UC-18, UC-19, UC-20 (UC-15 mở
> rộng nhẹ; UC-17 **đã xong** từ Phase 7/8, không đụng lại).
> Mục "Trạng thái thực hiện" (§11) cập nhật sau khi code + test.

## 1. Mục tiêu & phạm vi

**Trong phạm vi:**
- `Horse.healthStatus` (mới, enum `FIT|MONITORING|QUARANTINED|INJURED`,
  default `FIT`) — **thêm bên cạnh** `status` hiện có, không đổi tên/xoá
  field cũ (xem quyết định #1).
- UC-14: `GET /horses?healthStatus=` — lọc thêm theo field mới.
- UC-15 mở rộng: `POST /horses/:id/health-records` nhận thêm
  `healthStatus?` — nếu VET gửi, cập nhật luôn `Horse.healthStatus`.
- UC-16: model `InjuryLocation` (gắn vào `IncidentReport` **hoặc**
  `HealthRecord`) + 2 cặp route tạo/xem theo từng nguồn gốc.
- UC-18: model `Vaccination` + tạo/xem theo ngựa + `GET /vaccinations?upcoming=`
  xem toàn CLB.
- UC-19: `POST /incidents/:id/photo` (GROOM, multipart) — tái dùng hạ tầng
  upload đã có (`FileStorageService`/`upload.ts`), theo đúng pattern ảnh
  ngựa (Phase 2) / đính kèm hồ sơ khám (Phase 4): **route riêng sau khi
  tạo**, không gộp vào body tạo sự cố.
- UC-20: model `TreatmentPlan` + `Medication` (có `treatmentPlanId` optional
  trên `Medication`, đúng yêu cầu STEP 0 mục 6) + route tạo/xem.

**Ngoài phạm vi:**
- UC-17 — **đã có từ Phase 7/8**, không code lại (xem DECISIONS.md).
- Không có `PATCH` trực tiếp cho `Horse.healthStatus` ngoài luồng tạo hồ
  sơ khám — tránh 2 đường ghi cùng 1 field gây lệch dữ liệu (xem quyết
  định #2).
- Không tự động đổi `healthStatus` khi tạo/giải quyết `IncidentReport` —
  `IncidentReport` vẫn chỉ đụng `Horse.locked` (Training Lock), không đụng
  `healthStatus`, giữ 2 khái niệm tách biệt đúng như STEP 0 mô tả (career
  vs health, lock vs health status là 2 trục khác nhau).
- Không có `DELETE` cho bất kỳ bảng mới nào — giữ đúng pattern các phase
  trước (sửa nhầm thì PATCH/tạo bản ghi mới).
- Không giới hạn ai đọc injury-location/treatment-plan/medication ngoài
  ownership chuẩn (mọi role trừ OWNER-ngoài-phạm-vi).

## 2. Data model

```prisma
enum HealthStatus {
  FIT
  MONITORING
  QUARANTINED
  INJURED
}

enum TreatmentPlanStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

// Horse: + healthStatus HealthStatus @default(FIT)
//        + vaccinations Vaccination[]

// IncidentReport: + photoPath String?
//                  + injuryLocations InjuryLocation[]

// HealthRecord: + injuryLocations InjuryLocation[]
//               + treatmentPlans TreatmentPlan[]
//               + medications Medication[]

model InjuryLocation {
  id               String          @id @default(uuid())
  incidentReportId String?
  incidentReport   IncidentReport? @relation(fields: [incidentReportId], references: [id])
  healthRecordId   String?
  healthRecord     HealthRecord?   @relation(fields: [healthRecordId], references: [id])
  bodyRegion       String
  side             String?
  notes            String?
  createdAt        DateTime        @default(now())

  @@index([incidentReportId])
  @@index([healthRecordId])
}

model TreatmentPlan {
  id             String               @id @default(uuid())
  healthRecordId String
  healthRecord   HealthRecord         @relation(fields: [healthRecordId], references: [id])
  description    String
  startDate      DateTime
  endDate        DateTime?
  status         TreatmentPlanStatus  @default(ACTIVE)
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  medications Medication[]

  @@index([healthRecordId])
}

model Medication {
  id              String         @id @default(uuid())
  healthRecordId  String
  healthRecord    HealthRecord   @relation(fields: [healthRecordId], references: [id])
  treatmentPlanId String?
  treatmentPlan   TreatmentPlan? @relation(fields: [treatmentPlanId], references: [id])
  name            String
  dosage          String?
  startDate       DateTime?
  endDate         DateTime?
  createdAt       DateTime       @default(now())

  @@index([healthRecordId])
  @@index([treatmentPlanId])
}

model Vaccination {
  id          String    @id @default(uuid())
  horseId     String
  horse       Horse     @relation(fields: [horseId], references: [id])
  vaccineName String
  date        DateTime
  nextDueDate DateTime?
  createdAt   DateTime  @default(now())

  @@index([horseId])
  @@index([nextDueDate])
}
```

Migration: `npx prisma migrate dev --name phase10_health_injury_extensions`.
`healthStatus` có `@default(FIT)` nên áp cho ngựa cũ không lỗi (khác cột
`locked` ở Phase 7 cũng dùng pattern default an toàn tương tự).

## 3. Hợp đồng API

Base `/api/v1`. Envelope lỗi `{ error: { code, message, details? } }`.

### 3.1 UC-14 — `GET /horses` mở rộng
Thêm query `healthStatus?` (enum) vào `ListHorsesQueryDto` — lọc thêm,
không đổi response shape. `HorseView` tự động có `healthStatus` (field mới
trên `Horse`).

### 3.2 UC-15 — `POST /horses/:id/health-records` mở rộng (VET)
Thêm field optional `healthStatus?` vào `CreateHealthRecordDto`. Nếu gửi,
sau khi tạo record, cập nhật luôn `Horse.healthStatus`. Response
`HealthRecordView` không đổi shape (không trả healthStatus trong body
record — xem lại qua `GET /horses/:id`).

### 3.3 UC-16 — Injury locations
```
POST /incidents/:id/injury-locations       (VET)  {bodyRegion, side?, notes?}
GET  /incidents/:id/injury-locations       (mọi role, ownership qua incident→horse)
POST /health-records/:id/injury-locations  (VET)  {bodyRegion, side?, notes?}
GET  /health-records/:id/injury-locations  (mọi role, ownership qua record→horse)
```
Không có route `GET` gộp — luôn theo đúng nguồn gốc (khớp UC-16 "whichever
the record originates from"). Response: `InjuryLocation[]` (list), object
đơn khi tạo.

### 3.4 UC-18 — Vaccinations
```
POST /horses/:id/vaccinations              (VET)  {vaccineName, date, nextDueDate?}
GET  /horses/:id/vaccinations?page=&limit= (mọi role, ownership)
GET  /vaccinations?upcoming=&page=&limit=  (MANAGER/TRAINER/VET/GROOM — không OWNER)
```
`upcoming=true`: lọc `nextDueDate` trong khoảng `[hôm nay, hôm nay+30 ngày]`
(không null). Không có `upcoming` → trả tất cả. `GET /vaccinations` không
ownership theo ngựa (nhìn toàn CLB) nên **chặn OWNER hẳn** (403) thay vì
lọc — vì lọc theo ngựa sở hữu sẽ cần join phức tạp cho 1 view ít giá trị
với OWNER; OWNER dùng `GET /horses/:id/vaccinations` cho ngựa của mình.

### 3.5 UC-19 — Ảnh sự cố
```
POST /incidents/:id/photo   (GROOM, multipart field "file", jpg/png/webp ≤UPLOAD_MAX_MB)
```
Giống hệt pattern ảnh ngựa (Phase 2): 1 ảnh/sự cố, ghi đè, xoá ảnh cũ
best-effort. Response: `IncidentReport` (đã có `photoUrl` tính từ
`photoPath`, giống `photoUrl`/`attachmentUrl` các model khác). Serve qua
`GET /files/incident-photos/:filename` (auth + ownership qua incident→horse).

### 3.6 UC-20 — Treatment plans + medications
```
POST /health-records/:id/treatment-plans           (VET)  {description, startDate, endDate?}
GET  /health-records/:id/treatment-plans            (mọi role, ownership qua record→horse)
POST /treatment-plans/:id/medications               (VET)  {name, dosage?, startDate?, endDate?}
GET  /treatment-plans/:id/medications                (mọi role, ownership qua plan→record→horse)
```

## 4. RBAC & ownership

| Route | Role tạo | Ownership đọc |
|---|---|---|
| `POST .../injury-locations` (cả 2 nguồn) | VET | qua incident/record → horse |
| `GET .../injury-locations` (cả 2 nguồn) | mọi role | qua incident/record → horse |
| `POST /horses/:id/vaccinations` | VET | `HorseOwnershipGuard` |
| `GET /horses/:id/vaccinations` | mọi role | `HorseOwnershipGuard` |
| `GET /vaccinations` | MANAGER/TRAINER/VET/GROOM | — (OWNER bị chặn 403 thẳng) |
| `POST /incidents/:id/photo` | GROOM | qua incident→horse (đã có từ `IncidentsService`) |
| `POST .../treatment-plans` | VET | qua record → horse |
| `GET .../treatment-plans` | mọi role | qua record → horse |
| `POST .../medications` | VET | qua plan→record→horse |
| `GET .../medications` | mọi role | qua plan→record→horse |

## 5. Quyết định thiết kế (ghi cả vào DECISIONS.md)

1. **Không tách `status` thành `careerStatus`** — chỉ **thêm**
   `healthStatus` mới bên cạnh `status` (giữ nguyên tên/ý nghĩa). Đổi tên
   field `status` sẽ phải sửa hàng trăm chỗ tham chiếu (`HORSE_STATUS`
   trong mock demo, mọi DTO/test/seed từ Phase 2) chỉ để đổi tên — rủi ro
   cao, lợi ích thấp cho MVP mở rộng.
2. **`healthStatus` chỉ ghi qua `POST /horses/:id/health-records`**, không
   có `PATCH /horses/:id` riêng cho field này — tránh 2 nơi ghi cùng field
   (khác `fitnessScore`/`sireId` vốn chỉ MANAGER sửa qua 1 chỗ).
3. **`InjuryLocation` có 2 FK nullable** (`incidentReportId`,
   `healthRecordId`), không ràng buộc "đúng 1 trong 2" ở tầng DB (Prisma
   không hỗ trợ CHECK constraint kiểu XOR gọn) — ràng buộc ở tầng service:
   route nào gọi thì set đúng FK đó, FK còn lại luôn `null`.
4. **Chỉ VET tạo injury-location/vaccination/treatment-plan/medication** —
   đều là dữ liệu y tế, nhất quán với `health-records`/`incidents` PATCH
   (VET-only) đã có.
5. **`GET /vaccinations` chặn OWNER hẳn (403)** thay vì lọc theo ngựa sở
   hữu — đây là view toàn CLB (không có `horseId` filter trong contract
   UC-18 gốc); OWNER dùng route per-horse đã có ownership sẵn.
6. **Ảnh sự cố dùng route riêng `POST /incidents/:id/photo`**, không gộp
   vào `POST /horses/:id/incidents` — nhất quán với ảnh ngựa (Phase 2) và
   đính kèm hồ sơ khám (Phase 4), tránh multipart+JSON lẫn lộn trong 1 body.
7. **Không đổi `IncidentReport`/Training Lock khi có injury-location hay
   healthStatus đổi** — 2 trục độc lập (lock = có tập được không; health
   status = tình trạng sức khoẻ hiện tại), không tự động hoá chéo để giữ
   logic dễ hiểu, đúng tinh thần STEP 0 tách 2 field.
8. **Migration 1 lần cho cả 4 bảng + 1 field + 2 enum** — không tách
   thành nhiều migration nhỏ vì cùng 1 nhóm tính năng (Sprint 3 remainder),
   giảm số lần chạy `prisma migrate dev`.

## 6. Cấu trúc code

```
prisma/schema.prisma      # + healthStatus, model InjuryLocation/TreatmentPlan/Medication/Vaccination
prisma/migrations/<ts>_phase10_health_injury_extensions/

src/horses/dto/horses.dto.ts        # + healthStatus? trong ListHorsesQueryDto
src/health/dto/health.dto.ts        # + healthStatus? trong CreateHealthRecordDto
src/health/health-records.service.ts # create() ghi thêm horse.healthStatus nếu gửi

src/injuries/                       # module mới
  injuries.module.ts
  injuries.controller.ts            # IncidentInjuryLocationsController + HealthRecordInjuryLocationsController
  injuries.service.ts
  dto/injuries.dto.ts

src/vaccinations/                   # module mới
  vaccinations.module.ts
  vaccinations.controller.ts        # HorseVaccinationsController + VaccinationsController (global)
  vaccinations.service.ts
  dto/vaccinations.dto.ts

src/health/treatment-plans.controller.ts  # trong HealthRecordsModule
src/health/treatment-plans.service.ts
src/health/dto/treatment-plans.dto.ts

src/incidents/incidents.controller.ts     # + POST :id/photo, GET files/incident-photos/:filename
src/incidents/incidents.service.ts        # + setPhoto()
src/files/upload.ts                       # + INCIDENT_PHOTO_KIND, buildIncidentPhotoMulterOptions()
src/files/file-storage.service.ts         # onModuleInit thêm INCIDENT_PHOTO_KIND

prisma/seed.ts             # +healthStatus ví dụ, +1 vaccination, +1 injury-location, +1 treatment-plan+medication
test/health-injury-ext.e2e-spec.ts  # mới
src/app.module.ts          # + InjuriesModule + VaccinationsModule
```

## 7. Env

Không thêm biến mới — tái dùng `UPLOAD_DIR`/`UPLOAD_MAX_MB` cho ảnh sự cố.

## 8. Seed

- Gán `healthStatus=MONITORING` cho Sea Breeze (đã khoá sẵn từ Phase 7),
  `healthStatus=INJURED` cho Midnight (đã có incident HIGH từ Phase 8) —
  minh hoạ hợp lý, không đổi field khác của 2 ngựa này.
- 1 `Vaccination` cho Thunderbolt (`vaccineName="Tetanus"`, `nextDueDate`
  trong 20 ngày tới — rơi vào `upcoming=true`).
- 1 `InjuryLocation` gắn vào incident `HIGH` đã seed của Midnight
  (`bodyRegion="Right hind leg"`).
- 1 `TreatmentPlan` + 1 `Medication` gắn vào health record "Mild colic"
  của Midnight đã seed.

## 9. Kế hoạch test — `test/health-injury-ext.e2e-spec.ts`

Đăng nhập đủ 5 role; 1 ngựa test (owner1); cleanup `afterAll`.

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | `GET /horses?healthStatus=FIT` | 200, chỉ trả ngựa `FIT` |
| 2 | VET tạo health record kèm `healthStatus=INJURED` | 201; `GET /horses/:id` sau đó thấy `healthStatus=INJURED` |
| 3 | VET tạo injury-location từ incident | 201 |
| 4 | GROOM tạo injury-location | 403 |
| 5 | owner1 xem injury-location ngựa mình / owner2 bị 403 | đúng ownership |
| 6 | VET tạo vaccination cho ngựa | 201 |
| 7 | OWNER gọi `GET /vaccinations` | 403 |
| 8 | MANAGER `GET /vaccinations?upcoming=true` | 200, thấy vaccination sắp tới, không thấy vaccination xa |
| 9 | GROOM upload ảnh sự cố | 201, `photoUrl` set |
| 10 | owner khác tải ảnh sự cố | 403 |
| 11 | VET tạo treatment-plan cho health record | 201 |
| 12 | VET tạo medication gắn treatment-plan | 201, `treatmentPlanId` đúng |
| 13 | TRAINER tạo bất kỳ resource y tế nào ở trên | 403 |

## 10. Định nghĩa "xong"

- [ ] `npx prisma migrate dev` chạy sạch
- [ ] `npm run build` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test:e2e` xanh (125 test cũ + test mới)
- [ ] `docs/`: cập nhật spec §11, STATE.md, PLAN.md, DECISIONS.md,
      DATA_MODEL.md (đưa 4 bảng mới + `healthStatus` vào ERD MVP đang
      chạy), API.md, specs/README.md

## 11. Trạng thái thực hiện — ✅ XONG (2026-09-25)

Khớp đặc tả. Điểm cần ghi nhớ:

- Migration `phase10_health_injury_extensions` áp dụng sạch — `healthStatus`
  có `@default(FIT)` nên ngựa cũ không lỗi, giống pattern `locked` ở Phase 7.
- `InjuriesService`/`TreatmentPlansService` mỗi cái tự có `assertHorseVisible()`
  riêng (không tái dùng chung 1 helper) — đúng convention đã có từ
  Training/Health/Incidents service (mỗi service tự copy 1 bản nhỏ, chấp
  nhận trùng lặp nhỏ để tránh phụ thuộc chéo giữa các module).
- `IncidentsService` trước đây trả thẳng `Prisma.IncidentReportGetPayload`,
  giờ thêm `toView()` (tính `photoUrl`) giống `HorsesService`/
  `HealthRecordsService` — đã cập nhật cả 4 method cũ (`create`,
  `listByHorse`, `get`, `update`) để đi qua `toView()`, không chỉ 2 method
  mới.
- `POST /incidents/:id/photo` dùng `@Roles(Role.GROOM)` ở method level
  (không phải class level) vì `IncidentsController` còn có `update()`
  VET-only trên cùng class — giữ đúng pattern đã có, không tách controller
  mới chỉ vì 1 route.
- Seed dùng raw prisma (không qua service) nên **không** tự động trigger
  notification nào từ các bản ghi Phase 10 mới (khác Phase 8/9 seed vốn có
  side-effect cần replicate tay) — `healthStatus`/`vaccination`/
  `injury-location`/`treatment-plan` không có side-effect nào để replicate.

**File tạo mới:**
```
prisma/migrations/20260925003525_phase10_health_injury_extensions/
src/injuries/injuries.{module,controller,service}.ts
src/injuries/dto/injuries.dto.ts
src/vaccinations/vaccinations.{module,controller,service}.ts
src/vaccinations/dto/vaccinations.dto.ts
src/health/treatment-plans.{controller,service}.ts
src/health/dto/treatment-plans.dto.ts
test/health-injury-ext.e2e-spec.ts
```
**Sửa:** `prisma/schema.prisma` (+healthStatus, +4 model, +2 enum) ·
`src/horses/dto/horses.dto.ts` (+healthStatus filter) ·
`src/horses/horses.service.ts` (+lọc healthStatus) ·
`src/health/dto/health.dto.ts` (+healthStatus trên CreateHealthRecordDto) ·
`src/health/health-records.service.ts` (+ghi healthStatus lên Horse) ·
`src/health/health-records.module.ts` (+TreatmentPlansService + 2 controller) ·
`src/incidents/incidents.service.ts` (+toView, +setPhoto, +findForPhoto) ·
`src/incidents/incidents.controller.ts` (+POST :id/photo, +IncidentFilesController) ·
`src/incidents/incidents.module.ts` (+FilesModule) ·
`src/files/upload.ts` (+INCIDENT_PHOTO_KIND, +buildIncidentPhotoMulterOptions) ·
`src/files/file-storage.service.ts` (+mkdir incident-photos) ·
`src/app.module.ts` (+InjuriesModule +VaccinationsModule) ·
`prisma/seed.ts` (+healthStatus 2 ngựa, +1 vaccination, +1 injury-location,
+1 treatment-plan+medication).

**Kiểm chứng:**
- `npx prisma migrate dev` ✅ · `npm run build` ✅ · `npm run lint` ✅
- `npm run test:e2e` → **140/140** (125 cũ + 15 mới) ✅
- `npm run db:seed` chạy lại idempotent, in đủ log.

Định nghĩa "xong" §10: build/lint/e2e/docs ☑. **Sprint 3 (Health & Injury)
nay đã đầy đủ theo `CLAUDE_CODE_BACKEND_FULL.md`** — UC-17 đã xong từ trước
(Phase 7/8), UC-14/15/16/18/19/20 xong ở Phase 10 này.
