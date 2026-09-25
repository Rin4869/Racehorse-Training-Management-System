# Decisions — quyết định kỹ thuật & lý do

Ghi mọi quyết định thiết kế ở đây, kèm ngày và nguồn (Claude Code / Claude chat /
nhóm). Mới nhất lên đầu.

---

## 2026-09-25 — Chốt hạ tầng deploy: Render + Neon + Vercel (free, cho demo)

**Nguồn:** người dùng (mục đích deploy = demo/nộp bài, không phải vận hành
lâu dài) + Claude Code.
**Quyết định:** API deploy trên **Render.com** (Web Service free tier),
Postgres trên **Neon.tech** (free, không hết hạn — khác free Postgres của
Render tự xoá sau 30 ngày), frontend trên **Vercel** (free). Hướng dẫn từng
bước: [DEPLOY.md](DEPLOY.md).
**Lý do:** cả 3 miễn phí vĩnh viễn ở mức dùng 1 đồ án, không cần thẻ tín
dụng, tự deploy khi push GitHub — phù hợp nhu cầu "chỉ cần demo", không
đáng đầu tư công sức tự quản lý VM (Oracle Free Tier) hay trả phí cho ổ đĩa
bền lúc này.
**Đánh đổi đã chấp nhận:** `apps/api` lưu file upload (ảnh ngựa, đính kèm
khám, ảnh sự cố) thẳng vào ổ đĩa server — Render free tier có ổ đĩa **tạm
thời**, file mất sau mỗi lần server ngủ/deploy lại (dữ liệu Postgres không
mất). Free Web Service cũng **ngủ sau ~15 phút** không ai gọi (cold start
~30-60s lần gọi đầu). Chấp nhận được cho demo; nếu sau này cần chạy ổn định
lâu dài, cần bàn lại (disk bền trả phí, hoặc đổi sang cloud storage cho
file — xem cuối DEPLOY.md).

## 2026-09-25 — Phase 10 (Health & Injury extensions) hoàn thành — Sprint 3 xong

**Nguồn:** [specs/phase-10-health-injury-extensions.md](specs/phase-10-health-injury-extensions.md)
+ Claude Code. Hoàn tất phần "chưa làm" còn lại của mục "Đối chiếu
`CLAUDE_CODE_BACKEND_FULL.md`" (2026-09-24) — UC-14, 16, 18, 19, 20 (UC-15
mở rộng nhẹ; UC-17 đã xong từ Phase 7/8, không đụng lại).
**Quyết định:**
- **Không tách `Horse.status` thành `careerStatus`** — chỉ thêm
  `healthStatus` mới (`FIT|MONITORING|QUARANTINED|INJURED`, default `FIT`)
  bên cạnh `status` hiện có. Đổi tên field cũ sẽ phải sửa hàng trăm chỗ
  tham chiếu chỉ để đổi tên — rủi ro cao, lợi ích thấp.
- **`healthStatus` chỉ ghi qua `POST /horses/:id/health-records`**
  (`healthStatus?` optional trên DTO) — không có `PATCH /horses/:id` riêng
  cho field này, tránh 2 nơi ghi cùng 1 field.
- **`InjuryLocation` có 2 FK nullable** (`incidentReportId`,
  `healthRecordId`), ràng buộc "đúng 1 trong 2" ở tầng service (route nào
  gọi thì set đúng FK đó), không ở tầng DB.
- **Chỉ VET tạo injury-location/vaccination/treatment-plan/medication** —
  nhất quán với health-records/incidents PATCH đã có.
- **`GET /vaccinations` (view toàn CLB) chặn OWNER hẳn (403)** thay vì lọc
  theo ngựa sở hữu — OWNER dùng `GET /horses/:id/vaccinations` (đã có
  ownership) cho ngựa của mình.
- **Ảnh sự cố (UC-19) dùng route riêng `POST /incidents/:id/photo`**, không
  gộp vào `POST /horses/:id/incidents` — nhất quán với ảnh ngựa (Phase 2) và
  đính kèm hồ sơ khám (Phase 4), tái dùng nguyên hạ tầng
  `FileStorageService`/`upload.ts` đã có, không thêm dependency mới (trả
  lời OPEN QUESTION #4 từ mục 2026-09-24: dùng local disk, không phải S3).
- **Không tự động đổi `healthStatus` khi có incident/lock đổi** — Training
  Lock (trục "tập được không") và `healthStatus` (trục "tình trạng sức
  khoẻ") giữ độc lập, không tự động hoá chéo.
- **Không có DELETE** cho 4 bảng mới — giữ đúng pattern các phase trước.
- Migration `phase10_health_injury_extensions`: 1 lần cho cả 4 bảng + 1
  field + 2 enum, không tách nhỏ.
**Trạng thái:** ✅ build/lint/e2e (140/140: 125 cũ + 15 mới) xanh.
**Sprint 3 (Health & Injury) theo `CLAUDE_CODE_BACKEND_FULL.md` nay đã đầy đủ.**

## 2026-09-24 — Phase 9 (Training safety rules) hoàn thành

**Nguồn:** [specs/phase-9-training-safety.md](specs/phase-9-training-safety.md)
+ Claude Code. Trả lời phần "chưa làm" của mục "Đối chiếu
`CLAUDE_CODE_BACKEND_FULL.md`" ngay bên dưới (Sprint 2 remainder: EX-01 +
UC-12).
**Quyết định:**
- **EX-01 — cửa sổ trùng lịch cố định 60 phút**, không thêm field
  `duration` cho `TrainingSession`. Chỉ check lúc **tạo mới**
  (`POST /horses/:id/sessions`), không check khi sửa giờ qua `PATCH`.
- **UC-12 — chỉ đánh giá 1 metric cố định `heart_rate_max`**, ngưỡng cố
  định `> 195` (đúng ví dụ minh hoạ trong task list gốc) — `resultMetric`
  là free text, không suy luận được ý nghĩa các giá trị khác.
- **"GROOM liên quan" = mọi user role GROOM đang ACTIVE** — schema không
  gán 1 GROOM riêng cho từng ngựa/session, nên không lọc hẹp hơn được;
  thêm `NotificationsService.groomIds()` song song `managerIds()`.
- **Thêm `NotificationType.FITNESS_WARNING`** — migration chỉ thêm 1 giá
  trị enum, không đổi bảng nào khác.
- Sửa 2 test cũ (`training.e2e-spec.ts`, `training-plan.e2e-spec.ts`) vì
  chúng tạo nhiều session "now" cho cùng 1 ngựa — nay va vào rule EX-01
  mới; dời giờ lệch +2 tiếng, không đổi hành vi được test.
**Trạng thái:** ✅ build/lint/e2e (125/125: 117 cũ + 8 mới) xanh.

## 2026-09-24 — Đối chiếu `CLAUDE_CODE_BACKEND_FULL.md` với code thật — mâu thuẫn + câu hỏi mở

**Nguồn:** người dùng dán file `CLAUDE_CODE_BACKEND_FULL.md` (task list backend
đầy đủ, phạm vi của Bình, xác nhận với nhóm 2026-09-24) + Claude Code audit lại
code thật trong `apps/api`.

**Bối cảnh:** file task này viết ra như thể một số phần "đã có sẵn" trong
`docs/`, nhưng đối chiếu code thì vài giả định đó sai. Theo đúng chỉ dẫn của
chính file đó ("nếu mâu thuẫn với `docs/` thì `docs/` thắng, nhưng phải flag
lại thay vì tự chọn") — ghi lại đây, **chưa tự sửa gì**, chờ nhóm xác nhận.

### Mâu thuẫn đã phát hiện (docs/code hiện tại thắng, file task sai)

| File task giả định | Thực tế trong code |
|---|---|
| Auth chỉ có access token, **không có refresh token** | Sai — đã có refresh token + rotation từ Phase 1 (xem mục 2026-09-08 Phase 1 dưới đây) |
| UC-02: chưa có `POST /auth/register` công khai, chỉ MANAGER tạo qua `POST /users` | Sai — `POST /auth/register` đã có từ Phase 1 (đăng ký công khai → `PENDING` → MANAGER duyệt) |
| UC-07: `POST /races/:id/entries` do MANAGER hoặc TRAINER | Thực tế chỉ **MANAGER** (chốt ở Phase 6) |
| UC-09: route là `POST /training-plans` | Thực tế là `POST /horses/:id/training-plans` (gắn theo ngựa, chốt ở Phase 7) |
| `incident_reports.status`: `OPEN \| IN_REVIEW \| RESOLVED` | Thực tế enum `OPEN \| IN_PROGRESS \| RESOLVED` (chốt ở Phase 8) |
| STEP 0: `vaccinations`/`medications` là bảng "đã có sẵn" trong DATA_MODEL.md | Sai — 2 bảng đó **chỉ là tầm nhìn** trong DATA_MODEL.md §"bản đầy đủ", chưa vào code (ghi rõ trong chính file đó) |

### Phần đã làm khớp với file task (không cần làm lại)

STEP 0: `sireId`/`damId`/`locked`/`fitnessScore` trên `Horse`, bảng
`Race`/`RaceEntry`, bảng `IncidentReport` (thiếu `photoUrl`, enum tên khác —
xem trên), bảng `Notification`. SPRINT 0: SETUP-01→04, UC-01. SPRINT 1: UC-03,
UC-04, UC-05 (pedigree, đúng y hệt — `PATCH` + `GET /horses/:id/pedigree` 3
đời), UC-06 (dùng chung `PATCH /horses/:id`, đúng default file đề xuất),
UC-08. SPRINT 2: UC-10, UC-11 (đúng y hệt: TRAINER mọi field khi PLANNED,
GROOM chỉ status+result, enforce ở service), UC-13 (dạng list, không phải
aggregate — xem OPEN QUESTIONS), EX-02 (khoá ngựa + thông báo cross-role).
SPRINT 3: UC-15 (không ghi `health_status` vì field đó chưa tồn tại), UC-17
(khoá khẩn từ VET **kèm `lockReason`** — đã có sẵn, còn tự động hoá thêm ở
Phase 8 khi sự cố `HIGH`), UC-19 (có endpoint báo sự cố, **không có** upload
ảnh). PROJECT COMPLETION: TEST-01 (117 e2e, cover RBAC 403 + ownership +
lock chặn session — tương đương EX-02/UC-17; **không có** test cho EX-01 vì
chưa build), DOC-01 (Swagger `/api/docs` đã có).

### Chưa làm — hoàn toàn mới so với mọi phase trước

- Tách `Horse.status` thành `careerStatus` (ACTIVE/RESTING/RETIRED, giữ
  nguyên) + `healthStatus` (FIT/MONITORING/QUARANTINED/INJURED, mới).
- Bảng `injury_locations` (UC-16).
- Bảng `treatment_plans` + liên kết `medications` (UC-20) — bản thân bảng
  `medications` cũng chưa hề tồn tại.
- Bảng `vaccinations` (UC-18).
- Cảnh báo ngưỡng thể lực (UC-12) — chưa có rule/threshold, chưa có
  notification loại này.
- Chặn trùng lịch buổi tập (EX-01) — tạo 2 session cùng giờ cho 1 ngựa hiện
  vẫn được, không có validate 409 nào.
- Upload ảnh cho `incident_reports` (UC-19, `photoUrl`).

### OPEN QUESTIONS từ file task — chưa trả lời, chờ nhóm/người dùng chốt

1. UC-02 "Register" — giữ nguyên `POST /auth/register` công khai đã có
   (đăng ký tự do → PENDING), hay đổi hướng khác? *(Claude Code đề xuất: giữ
   nguyên, vì đã hoạt động + có test — nhưng để nhóm xác nhận vì file task
   ngầm định "chưa có endpoint này".)*
2. UC-06 — dùng chung `PATCH /horses/:id` (đã làm vậy) hay tách endpoint
   riêng cho "gán chủ sở hữu"? *(Đã làm theo default file đề xuất — coi như
   xác nhận trừ khi nhóm nói khác.)*
3. UC-17's lock — đã có `lockReason` (text) riêng biệt với boolean `locked`
   từ Phase 7, tên field `lockReason` không phải `lock_reason` (naming
   convention camelCase toàn bộ API, không phải snake_case như file task
   dùng — xem thêm quy ước Prisma/TS hiện có).
4. UC-19 upload ảnh — chưa quyết định lưu ở đâu. Dự án đã có sẵn hạ tầng
   `FileStorageService` (lưu đĩa local `apps/api/uploads/`, dùng cho ảnh
   ngựa + đính kèm hồ sơ khám từ Phase 2/4) — đề xuất tái dùng đúng hạ tầng
   đó cho `incident_reports.photoUrl` thay vì thêm dependency mới (S3...).
   Chờ xác nhận.
5. Sheet gốc của nhóm có DOC-02 trùng nội dung UC-20 — nghi copy-paste lỗi,
   chưa xác nhận nội dung thật của DOC-02.

**Trạng thái:** ⏳ Chỉ mới ghi nhận — **chưa code gì** cho phần "chưa làm" ở
trên. Việc kế tiếp: người dùng xác nhận 5 câu hỏi mở (đặc biệt #4, ảnh hưởng
hạ tầng), rồi viết spec theo đúng thứ tự Sprint 0 (schema) → Sprint 3
(UC-14..20) như file task yêu cầu.

## 2026-09-14 — Phase 8 (Health & Injury) hoàn thành — 3/3 luồng mở rộng XONG

**Nguồn:** [specs/phase-8-health-injury.md](specs/phase-8-health-injury.md) + Claude Code.
**Quyết định:**
- **Luồng 3/3 (cuối) của việc mở rộng "2026-09-12"** — hoàn tất cả 3 luồng
  activity diagram đã chốt (Pedigree & Races, Training Plan & Lock, Health & Injury).
- **Chỉ `severity=HIGH` tự khoá khi tạo sự cố** — `LOW`/`MEDIUM` chỉ ghi
  nhận + thông báo, không ảnh hưởng lịch tập.
- **`HorsesService.lock()` là nơi DUY NHẤT gửi thông báo khoá/mở khoá** —
  dùng chung cho lời gọi tay (Phase 7) và tự động (sự cố Phase 8), chỉ gửi
  khi giá trị `locked` thực sự đổi (idempotent, không spam).
- **Không có `NotificationType` riêng cho "sự cố đã xử lý xong"** — thông
  báo `TRAINING_UNLOCKED` đã đủ ngữ cảnh khi sự cố `RESOLVED` mở khoá ngựa.
- **`INCIDENT_REPORTED` gửi cho mọi severity**, không chỉ `HIGH`.
- **Người nhận thông báo cố định: chủ ngựa + mọi MANAGER** — không có bảng
  phân công trainer/vet theo ngựa nên không nhắm chính xác hơn.
- **`status` sự cố chỉ tiến, cho phép nhảy bước** (`OPEN→RESOLVED` thẳng).
- **`healthRecordId` optional** — sự cố nhẹ có thể đóng mà không cần hồ sơ khám riêng.
- **`PATCH /incidents/:id` không có ownership guard** — chỉ VET tới được
  (giống pattern health-records/training-plans).
- **`GET /notifications` luôn tự lọc theo người gọi** — không có khái niệm
  xem hộ người khác kể cả MANAGER.
- **Không xoá `IncidentReport`/`Notification`** — giống các model MVP mở
  rộng khác. Không đẩy thông báo real-time, không gửi email.
- Migration `phase8_incidents_notifications`: chỉ thêm 2 bảng mới + 3 enum,
  không đổi cột hiện có.
**Trạng thái:** ✅ build/lint/e2e (117/117: 96 cũ + 21 mới) xanh · seed idempotent.

## 2026-09-14 — Phase 7 (Training Plan & Training Lock) hoàn thành

**Nguồn:** [specs/phase-7-training-plan-lock.md](specs/phase-7-training-plan-lock.md) + Claude Code.
**Quyết định:**
- **Luồng 2/3 của việc mở rộng "2026-09-12"** — Pedigree/Races (luồng 1) xong
  trước; Health & Injury (luồng 3) để phase sau.
- **VET là người duy nhất khoá/mở khoá** (`PATCH /horses/:id/lock`), không
  phải MANAGER — đúng chốt "Training Lock do Vet ban hành".
- **Chưa làm `incident_reports`** — khoá là hành động tay của VET ở phase
  này, chưa gắn với 1 hồ sơ sự cố cụ thể (bảng đó thuộc Phase 8, có thể gọi
  lại `lock()` service này thay vì tạo API riêng).
- **`lockReason` bị xoá khi mở khoá** — không có bảng lịch sử khoá ở MVP mở
  rộng này.
- **Chỉ chặn TẠO buổi tập mới khi khoá**, không chặn PATCH buổi tập đã có —
  giữ đơn giản, buổi `PLANNED` từ trước vẫn sửa được (thường để `CANCELLED`).
- **Lập kế hoạch (`training-plans`) không bị chặn bởi `locked`** — kế hoạch
  là dự định tương lai, hợp lý ngay cả khi ngựa đang nghỉ.
- **`planId` trên session optional**, không bắt buộc buổi tập phải thuộc 1
  kế hoạch — giữ tương thích ngược Phase 3.
- **`PATCH /training-plans/:id` không có ownership guard** — chỉ TRAINER tới
  được, TRAINER xem/sửa mọi kế hoạch (giống VET với health-records Phase 4).
- **Không có DELETE** cho `TrainingPlan` — giống pattern `HealthRecord`/`Race`.
- **Tách relation Prisma `"PlanTrainer"` khỏi `"SessionTrainer"`** trên `User`.
- Migration `phase7_training_plan_lock`: chỉ thêm cột default/nullable trên
  `Horse`/`TrainingSession` + bảng mới `TrainingPlan` — không đổi dữ liệu cũ.
**Trạng thái:** ✅ build/lint/e2e (96/96: 77 cũ + 19 mới) xanh · seed idempotent.

## 2026-09-14 — Phase 6 (Pedigree & Races) hoàn thành

**Nguồn:** [specs/phase-6-pedigree.md](specs/phase-6-pedigree.md) + Claude Code.
**Quyết định:**
- **Luồng 1/3 của việc mở rộng "2026-09-12"** — chỉ làm Pedigree/Races ở phase
  này; Training Plan+Lock và Health & Injury để phase sau (đã chốt làm từng
  luồng một, viết spec trước khi code).
- **`sireId`/`damId`/`fitnessScore` sửa qua `PATCH /horses/:id` sẵn có** —
  không thêm endpoint riêng.
- **`fitnessScore` MANAGER nhập tay** (0-100), không tự tính từ dữ liệu
  training/health — chưa có công thức được chốt.
- **`GET /horses/:id/pedigree` giới hạn cứng 3 đời**, không dò cây tổ tiên
  đầy đủ — chỉ chặn tự tham chiếu trực tiếp (`sireId/damId === id`, hoặc
  `sireId === damId`) ở tầng validate.
- **`Race` không có ownership/`ownerId`** — dữ liệu chung CLB, mọi role đăng
  nhập xem được; chỉ `GET /horses/:id/race-entries` (gắn 1 ngựa cụ thể) mới
  qua `HorseOwnershipGuard`.
- **Không có DELETE** cho `Race`/`RaceEntry` ở phase này — giống pattern
  `HealthRecord`: nhập sai thì PATCH lại.
- **1 ngựa/1 giải chỉ 1 entry** (`@@unique([raceId, horseId])`) → trùng = `CONFLICT`.
- Migration `phase6_pedigree_races`: chỉ thêm cột nullable trên `Horse` + 2
  bảng mới — không đổi dữ liệu cũ.
**Trạng thái:** ✅ build/lint/e2e (77/77: 55 cũ + 22 mới) xanh · seed idempotent.

## 2026-09-12 — Mở rộng data model theo 3 activity diagram + ERD

**Nguồn:** người dùng + Claude chat (activity diagram, ERD).
**Quyết định:** thêm bảng `races`, `race_entries`, `incident_reports`,
`notifications`; thêm cột `sire_id`, `dam_id`, `locked`,
`fitness_score` vào `horses`, để khớp 3 activity diagram (Hồ sơ &
Pedigree / Training Plan / Health & Injury) đã chốt làm 3 main flow
demo.
**Lý do:** các flow yêu cầu pedigree, thành tích thi đấu, Training
Lock đồng bộ giữa Training và Health, và hệ thống thông báo dùng
chung — không có trong scope MVP gốc nhưng cần cho bản demo 3 flow.

## 2026-09-08 — Quy trình: đặc tả theo phase trong `docs/specs/`

**Nguồn:** người dùng ("lên kế hoạch thiết kế rồi đi code theo đó... mọi thứ đều
phải ghi doc đặc tả").
**Quyết định:** từ Phase 2, mỗi phase có 1 file `docs/specs/phase-N-*.md` viết
**trước khi code**: phạm vi, data model, hợp đồng API (request/response/lỗi),
RBAC & ownership, quyết định thiết kế, kế hoạch test, định nghĩa "xong". Sau khi
code + test xong, cập nhật mục "Trạng thái thực hiện" ở cuối spec. Index: `specs/README.md`.
**Lý do:** làm việc như một coder thật — thiết kế trước, có tài liệu đặc tả để đối chiếu,
dễ review và bàn giao.

## 2026-09-09 — Phase 5 (Hoàn thiện MVP + frontend) hoàn thành

**Nguồn:** [specs/phase-5-mvp.md](specs/phase-5-mvp.md) + Claude Code.
**Quyết định:**
- **1 app React đổi UI theo role** (không tách web con) — đúng định hướng giai
  đoạn MVP. Tách web con để sau.
- **Không thêm dependency frontend** — CSS thuần (không UI kit), state bằng React
  Context (không Redux/Zustand). Giữ bundle nhỏ, dễ chấm.
- **Token trong `localStorage`** (`racehorse.accessToken` / `.refreshToken`) —
  đúng chốt Phase 1 (refresh qua body). Chấp nhận rủi ro XSS cho đồ án nội bộ.
- **Response interceptor refresh 1 lần** (dedupe bằng 1 promise dùng chung),
  không hàng đợi request song song; bỏ qua `/auth/*` để tránh vòng lặp; hỏng →
  xoá token + về `/login`.
- **`GET /auth/me` khi khởi động** để phục hồi `user` (JWT chỉ mang `sub`).
- **Serve file đính kèm: tải blob qua axios rồi `window.open`** — link `<a href>`
  thuần không gắn được Bearer.
- **MANAGER "tạo user" = duyệt PENDING** (không có `POST /users`): đăng ký công
  khai `/register` → seed sẵn 1 user PENDING (đã verify email) → MANAGER gán role
  + `status=ACTIVE`.
- **ERD đặt trong `DATA_MODEL.md`** (mục Mermaid `erDiagram` ở đầu, 6 model thật),
  không tạo file mới — gom tài liệu data về 1 chỗ.
- **Không i18n hoá dữ liệu động** (tên ngựa, diagnosis…) — chỉ nhãn UI.
- Chấp nhận 4 **warning** oxlint `react(set-state-in-effect)` ở các trang fetch
  danh sách (rule over-eager với data-fetch); `npm run lint` vẫn exit 0.
- Không có test tự động cho frontend ở phase này (đã có 55 e2e API phủ mọi
  endpoint FE gọi).
**Trạng thái:** ✅ web build/lint · api build/lint/e2e (55/55) · seed lại OK ·
2 server boot. Click-through 4 luồng MVP để người dùng demo.

## 2026-09-09 — Phase 4 (Health records) hoàn thành

**Nguồn:** [specs/phase-4-health.md](specs/phase-4-health.md) + Claude Code.
**Quyết định:**
- **Không tạo `RecordOwnershipGuard`.** `/health-records/:id` mang recordId → check
  ownership trong service (load record kèm `horse` một lần). `/horses/:id/health-records*`
  vẫn dùng `HorseOwnershipGuard`. (Giống Phase 3 với `/sessions/:id`.)
- **`vetId` = người gọi**, không nhận từ body. Chỉ VET tạo/sửa/đính kèm được
  (MANAGER cũng không) — đúng bảng quyền MVP.
- **`examDate` không được ở tương lai** → `VALIDATION_ERROR`. Khác `scheduledAt`
  của session (cho phép tương lai vì là lịch hẹn); health record là ghi nhận việc đã khám.
- **`PATCH /health-records/:id` không gắn ownership guard** — chỉ VET tới được,
  mà VET xem/sửa mọi ngựa. Không phân biệt "vet nào tạo thì vet đó sửa" (1 CLB, ít vet).
- **List sắp xếp `examDate desc`** (xem khám gần nhất trước), khác Training `scheduledAt asc`.
- **Không soft-delete, không endpoint DELETE** — `HealthRecord` không có `deletedAt`;
  sửa nhầm thì PATCH lại. Model cũng không có `updatedAt`.
- **Attachment cho phép PDF** ngoài ảnh (kết quả xét nghiệm hay là PDF). Cần multer
  option riêng: `buildAttachmentMulterOptions()` đọc `process.env` (không cần
  `ConfigService` lúc decorate), dùng inline trong `FileInterceptor`. Ảnh ngựa vẫn
  dùng `MulterModule` global. 1 file/record, ghi đè.
- **Module đặt tên `health-records.*`** (`HealthRecordsModule` / `HealthRecordsService`)
  để không đụng `HealthController` (health-check `GET /api/v1/health`) có từ Phase 0.
  `HealthFilesController` (`@Controller('files')`, route `health-attachments/:filename`)
  nằm trong `HealthRecordsModule` — tránh phụ thuộc vòng với `FilesController` của
  Phase 2 (trong `HorsesModule`). Hai controller cùng prefix `files` là hợp lệ.
- **Không cần migration** — `HealthRecord` có từ `init`.
**Trạng thái:** ✅ build / lint / e2e (55/55) xanh.

## 2026-09-08 — Phase 3 (Training sessions) hoàn thành

**Nguồn:** [specs/phase-3-training.md](specs/phase-3-training.md) + Claude Code.
**Quyết định:**
- **Không tạo `SessionOwnershipGuard`.** `/sessions/:id` mang sessionId, không phải
  horseId → check ownership trong service (load session kèm `horse` một lần).
  `/horses/:id/sessions*` vẫn dùng `HorseOwnershipGuard`.
- **`trainerId` = người gọi**, không nhận từ body. Chỉ TRAINER tạo được session
  (MANAGER cũng không) — đúng bảng quyền MVP.
- **State machine tối giản:** chỉ `PLANNED → DONE` và `PLANNED → CANCELLED`.
  `DONE`/`CANCELLED` là trạng thái cuối — PATCH tiếp lên nó → `VALIDATION_ERROR`.
  `scheduledAt/type/notes` chỉ sửa được khi đang `PLANNED`.
- **Chuyển `DONE` ⇒ bắt buộc `resultMetric` + `resultValue`** (lấy từ payload hoặc
  giá trị đã có). `CANCELLED` không cần result.
- **GROOM chỉ được đụng `status` + `resultMetric` + `resultValue`** — kiểm ở
  service bằng whitelist key, vượt → `FORBIDDEN`. GROOM đặt được cả `DONE` lẫn
  `CANCELLED`.
- **Lọc key dto theo `value !== undefined`** trước khi kiểm whitelist — vì
  class-transformer/ValidationPipe hay tạo field optional chưa gửi thành `undefined`.
- **Session không soft-delete** (không endpoint DELETE); hủy = `CANCELLED`.
- **List sắp xếp `scheduledAt asc`** (xem lịch theo thời gian), khác Horses
  (`createdAt desc`).
- **`scheduledAt` không ràng buộc quá khứ/tương lai** (cho ghi hồi tố).
- Seed VET luôn ở Phase 3 (dùng ở Phase 4) cho gọn.
- Không cần migration — `TrainingSession` có từ `init`.
**Trạng thái:** ✅ build / lint / e2e (39/39) xanh + smoke curl trọn luồng MVP #2.

## 2026-09-08 — Phase 2 (Horses) hoàn thành

**Nguồn:** [specs/phase-2-horses.md](specs/phase-2-horses.md) + Claude Code.
**Quyết định:**
- **`ownerId` phải trỏ tới user `role = OWNER`, `deletedAt: null`.** Sai →
  `VALIDATION_ERROR` (lỗi dữ liệu form), không phải 404.
- **OWNER truy cập ngựa không thuộc mình → 403 `FORBIDDEN`** (không phải 404).
  Đánh đổi: lộ sự tồn tại của id. Chấp nhận cho hệ nội bộ 1 CLB.
- **`GET /horses`: OWNER luôn bị ép `ownerId = self`** ở tầng service (bỏ qua query
  client gửi). Role khác dùng filter tự do.
- **Ảnh ngựa: 1 ảnh/ngựa, ghi đè** (không gallery). Lưu `photoPath` tương đối
  (`horse-photos/<horseId>-<rand8>.<ext>`) trong DB; file trên ổ đĩa
  `apps/api/uploads/horse-photos/`. Xoá ngựa **không** xoá file (ghi nợ).
- **Serve ảnh qua controller Nest** (`GET /files/horse-photos/:filename`), không mở
  static folder — để ép qua `JwtAuthGuard` + kiểm tra ownership. Filename validate
  regex `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$` chống path traversal.
- **Multer `diskStorage`** trực tiếp (không memory), `fileFilter` theo mime
  (jpeg/png/webp), `limits.fileSize = UPLOAD_MAX_MB`. `MulterError` map về
  `VALIDATION_ERROR` 400 trong exception filter.
- Object `Horse` trả về kèm `photoUrl` (service tính từ `photoPath`); giữ nguyên
  `deletedAt` trong payload (luôn null với ngựa sống).
- `HorseOwnershipGuard` tách riêng, gắn `req.horse`, tái sử dụng cho Phase 3/4.
- `FilesModule` chỉ chứa `FileStorageService` (thuần fs) + `MulterModule`;
  `FilesController` nằm trong `HorsesModule` → tránh phụ thuộc vòng.
- **Không cần migration** — bảng `Horse` đã tạo ở migration `init`.
**Trạng thái:** ✅ build / lint / e2e (25/25) xanh + smoke curl OK.

## 2026-09-08 — Phase 1 (Auth & Users) hoàn thành

**Nguồn:** người dùng chốt + Claude Code.
**Quyết định:**
- **Refresh token trả qua body JSON** (không dùng cookie). Frontend tự lưu & tự
  gắn vào `POST /auth/refresh`. Lý do: dễ test qua Swagger, không phải cấu hình
  CORS credentials / cookie-parser cho đồ án.
- Không thêm captcha / rate-limit cho `register` ở giai đoạn này.
- Access JWT payload chỉ chứa `sub` (userId); guard **luôn load user từ DB** mỗi
  request để kiểm tra `status` + soft-delete (không tin role trong token).
- Refresh token & auth token (verify/reset) **chỉ lưu hash SHA-256**, không lưu
  plaintext. Refresh dùng **rotation**: mỗi lần refresh revoke token cũ, phát token mới.
- Reset password + xoá user ⇒ revoke toàn bộ refresh token của user đó.
- `PATCH /users/:id` set `status=ACTIVE` bắt buộc user phải có `role` (tự set hoặc
  đã có) — đây là hành động "duyệt PENDING".
- MANAGER không tự xoá được chính mình.
- `MailService` fallback: thiếu `SMTP_USER/PASS` ⇒ log email ra console thay vì gửi
  (giữ e2e chạy được không cần SMTP thật).
- `@nestjs/swagger` plugin bật trong `nest-cli.json` để tự sinh schema DTO.
**Trạng thái:** ✅ build / lint / e2e (9 test, trọn vòng đời tài khoản) đều xanh.

## 2026-09-08 — Chốt stack & phạm vi Core API (Q&A với người dùng)

**Nguồn:** người dùng trả lời Q&A + Claude Code.
**Quyết định:**
- Stack API: **NestJS + TypeScript**, ORM **Prisma**, DB **PostgreSQL** (mỗi người tự cài lên Windows).
- Auth **đầy đủ**: đăng ký tự do → tài khoản `PENDING`, MANAGER duyệt & gán role;
  có email verify + forgot/reset password + refresh token (rotation).
- Email: **Gmail + App Password** qua nodemailer, cấu hình trong `.env`.
- **Có upload file**, lưu **ổ đĩa local** (`apps/api/uploads/`).
- Repo: **monorepo** `apps/api` + `apps/web` (không dùng Nx/Turbo).
- **Một câu lạc bộ duy nhất** — không có bảng `clubs`, không multi-tenant.
- Deploy: chưa xác định, chỉ chạy local khi demo; vẫn thêm Dockerfile + docker-compose.
- Frontend MVP: **song ngữ i18n** (vi/en) ở client; API trả `code` lỗi ổn định.
- Timeline: **cả học kỳ (> 8 tuần)**.
- Phạm vi Claude Code build: **Core API + 1 frontend React/Vite MVP demo**.
- Git host: **GitHub** (nhóm truy cập được).
**Lý do:** nhóm quen NestJS/TS; scale nhỏ nên 1 API + 1 Postgres là đủ; ưu tiên
chất lượng kiến trúc/tài liệu để chấm điểm. Chi tiết đầy đủ: [PLAN.md](PLAN.md).
**Trạng thái:** ✅ Người dùng DUYỆT 2026-09-08. Bắt đầu Phase 0 (scaffold `apps/api` +
`apps/web`). Bổ sung chốt: cài Postgres giúp người dùng (chưa có trên máy);
`apps/web` làm skeleton ngay ở Phase 0.

---

## 2026-09-08 — Chọn phạm vi MVP theo main flow

**Nguồn:** người dùng + Claude Code.
**Quyết định:** dựng MVP trước, chỉ 4 bảng (`users`, `horses`, `training_sessions`,
`health_records`), gộp kết quả tập thẳng vào `training_sessions`. Bỏ tạm stalls,
plans, vaccinations, medications, care_logs, facility_tasks, audit_logs, reports.
**Lý do:** chứng minh luồng `đặt lịch → thực hiện → ghi kết quả` chạy end-to-end
với ít rủi ro data nhất. Chi tiết: [MVP.md](MVP.md).

## 2026-09-08 — Kiến trúc Core API + nhiều web con

**Nguồn:** người dùng.
**Quyết định:** một Core API duy nhất (1 service, 1 DB) + nhiều frontend độc lập
theo role (1 dashboard admin + các web con). Web con chỉ giao tiếp qua API,
không share DB, không gọi lẫn nhau. KHÔNG microservice.
**Lý do:** vừa sức đồ án, dễ chia việc nhóm, data tập trung dễ quản lý.
Giai đoạn MVP tạm dùng 1 app React đổi UI theo role, tách web con sau.

## 2026-09-08 — Stack (ĐỀ XUẤT — ĐÃ THAY BẰNG quyết định phía trên)

~~Đề xuất ban đầu: NestJS + Prisma + PostgreSQL, chỉ JWT access token.~~
Đã chốt chính thức ở mục "Chốt stack & phạm vi Core API" phía trên (có refresh token).

## 2026-09-08 — Ghim Prisma ở 6.19.3 (không lên v7/v8)

**Nguồn:** Claude Code (phát sinh khi scaffold).
**Quyết định:** `prisma` và `@prisma/client` ghim đúng **6.19.3**.
**Lý do:** Prisma 7+ bỏ `url` trong `datasource`, bắt buộc `prisma.config.ts` +
driver adapter truyền vào `PrismaClient` — phức tạp không cần thiết cho đồ án.
npm dist-tag `latest` của prisma hiện trỏ vào bản RC 8.x nên phải ghim tường minh.

## 2026-09-08 — PostgreSQL: bản portable + autostart qua Startup folder

**Nguồn:** Claude Code (phát sinh khi cài môi trường).
**Quyết định:** dùng bản **portable ZIP** giải nén `C:\Users\Lenovo\pgsql`
(data `C:\Users\Lenovo\pgdata`, port 5432). Autostart bằng
`scripts/pg-autostart.vbs` đặt trong Startup folder của user.
**Lý do:** winget tải installer bị treo (mạng); đăng ký Windows service và
scheduled task đều bị trình phân quyền chặn. Startup-folder VBS là cách không cần
admin, đã test chạy được.

## 2026-09-08 — Phase 0 (scaffold) hoàn thành

**Nguồn:** Claude Code.
**Trạng thái:** ✅ `apps/api` + `apps/web` đã dựng, build/lint/e2e xanh,
DB migrate + seed xong. Chi tiết: [STATE.md](STATE.md) §3.
Tiếp theo: Phase 1 (Auth & Users) — còn chờ chốt cách trả refresh token
(body vs cookie), xem [STATE.md](STATE.md) §4.

---

## Mẫu ghi quyết định mới

```
## YYYY-MM-DD — <tiêu đề ngắn>

**Nguồn:** <ai>
**Quyết định:** <nội dung>
**Lý do:** <tại sao>
```
