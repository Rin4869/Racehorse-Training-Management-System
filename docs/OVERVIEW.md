# Racehorse Training & Management System

Đồ án môn **Software Development Project**. Dự án số 1 (NhanDT35) — bắt buộc.

## Mục tiêu

Hệ thống quản lý huấn luyện và chăm sóc ngựa đua: lập lịch tập, theo dõi sức khỏe,
vận hành cơ sở vật chất. Nhiều actor cùng làm việc trên cùng dữ liệu.

## Actor / Role

| Role | Vai trò |
|---|---|
| `MANAGER` | Club Manager — quản trị hệ thống, người dùng, cơ sở vật chất, báo cáo |
| `TRAINER` | Head Trainer — lập kế hoạch & lịch tập, ghi kết quả tập |
| `VET` | Veterinarian — khám, hồ sơ y tế, tiêm phòng, thuốc |
| `GROOM` | Groom / Stable Hand — chăm sóc hàng ngày, cập nhật trạng thái, việc cơ sở |
| `OWNER` | Horse Owner — xem ngựa của mình, lịch, hồ sơ y tế, hóa đơn |

## Kiến trúc tổng thể

```
                     ┌──────────────────┐
                     │     Core API     │  1 codebase, 1 DB (PostgreSQL)
                     │  Auth (JWT+RBAC) │  Swagger / OpenAPI
                     └────────┬─────────┘
     ┌───────────┬────────────┼────────────┬─────────────┐
 Club Manager  Head Trainer   Vet        Groom        Horse Owner
 Dashboard     web con        web con    web con      web con
```

- **Core API**: một service duy nhất, một database. Chia module theo domain
  (KHÔNG microservice).
- **Auth tập trung**: JWT + RBAC, role nằm trong token.
- **Các web con chạy song song**: độc lập, chỉ giao tiếp qua API — không share DB,
  không gọi lẫn nhau. Đây là điểm để chia việc nhóm.
- API versioning `/api/v1`, tài liệu Swagger ngay từ đầu.

## Trạng thái hiện tại

Xem chi tiết ở [STATE.md](STATE.md).

- [x] Phase 0 — scaffold `apps/api` + `apps/web`, DB, CI cơ bản
- [x] Phase 1 — Auth & Users
- [x] Phase 2 — Horses
- [x] Phase 3 — Training sessions
- [x] Phase 4 — Health records
- [x] Phase 5 — hoàn thiện MVP + frontend  ← **MVP DONE (2026-09-09)**
- [ ] (sau MVP) Tách web con theo role, module mở rộng, CI, Docker

## Tài liệu

- **[STATE.md](STATE.md) — điểm vào mỗi phiên: tiến độ, môi trường, việc tiếp theo**
- [PLAN.md](PLAN.md) — kế hoạch chi tiết theo phase, data model, endpoint
- [MVP.md](MVP.md) — phạm vi MVP, data model rút gọn
- [DATA_MODEL.md](DATA_MODEL.md) — data model đầy đủ (bản mở rộng sau MVP)
- [API.md](API.md) — danh sách endpoint đầy đủ
- [DECISIONS.md](DECISIONS.md) — nhật ký quyết định kỹ thuật & lý do
- [WORKFLOW.md](WORKFLOW.md) — phân vai Claude Code vs Claude chat

## Stack (đã chốt)

- Core API: **NestJS + TypeScript + Prisma 6.19.3 + PostgreSQL**
- Frontend: **React + Vite** (một app, đổi UI theo role trong giai đoạn MVP), i18n vi/en
- Auth: **JWT access token + refresh token (rotation)** + email verify + reset password
