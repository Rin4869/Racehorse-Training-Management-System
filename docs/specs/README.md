# specs/ — đặc tả thiết kế theo phase

Mỗi phase có 1 file đặc tả viết **trước khi code**, mô tả: phạm vi, data model,
hợp đồng API (request/response/lỗi), luật RBAC & ownership, quyết định thiết kế,
và kế hoạch test. Sau khi code xong, phần "Trạng thái thực hiện" ở cuối file được
cập nhật cho khớp thực tế.

Thứ tự đọc khi vào phiên mới: [../STATE.md](../STATE.md) → [../PLAN.md](../PLAN.md)
→ [../DECISIONS.md](../DECISIONS.md) → spec của phase đang làm.

| Phase | Spec | Trạng thái |
|---|---|---|
| 1 | (đặc tả gộp trong PLAN.md §4 + STATE.md §3b) | ✅ xong |
| 2 | [phase-2-horses.md](phase-2-horses.md) | ✅ xong |
| 3 | [phase-3-training.md](phase-3-training.md) | ✅ xong |
| 4 | [phase-4-health.md](phase-4-health.md) | ✅ xong |
| 5 | [phase-5-mvp.md](phase-5-mvp.md) | ✅ xong |
| 6 | [phase-6-pedigree.md](phase-6-pedigree.md) | ✅ xong |
| 7 | [phase-7-training-plan-lock.md](phase-7-training-plan-lock.md) | ✅ xong |
| 8 | [phase-8-health-injury.md](phase-8-health-injury.md) | ✅ xong |
