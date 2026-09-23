# Workflow — phân vai khi làm việc

Dự án dùng **hai công cụ AI song song**. Chúng KHÔNG tự đồng bộ với nhau —
người dùng là cầu nối, truyền context qua các file trong `docs/`.

## Phân vai

### 🖥️ Claude Code (chạy trong terminal / IDE)
**Làm phần "tay chân" trên repo thật:**
- Dựng project, scaffold Core API + frontend
- Viết schema Prisma, migration, seed data
- Code endpoint, middleware auth/RBAC, service, test
- Chạy lệnh (npm, prisma, test), sửa lỗi build/runtime
- Cập nhật các file trong `docs/` khi thiết kế thay đổi trong lúc code
- Refactor, review code, tách web con

**KHÔNG dùng cho:** viết báo cáo dài, làm slide, brainstorm mở.

### 💬 Claude chat (claude.ai — web/desktop)
**Làm phần "tư duy & giấy tờ":**
- Brainstorm ý tưởng, phân tích yêu cầu, so sánh phương án
- Viết báo cáo môn học, tài liệu thuyết trình, slide
- Giải thích khái niệm cho các thành viên nhóm
- Review thiết kế ở mức cao ("kiến trúc này có vấn đề gì?")
- Soạn nội dung tiếng Anh / song ngữ nếu cần nộp

**KHÔNG dùng cho:** sửa file trong repo, chạy lệnh (không có quyền).

## Cách truyền context

1. **Nguồn sự thật = thư mục `docs/`.** Mọi quyết định phải nằm ở đây.
2. Khi hỏi Claude chat: copy file `docs/OVERVIEW.md` + file liên quan, dán vào chat.
3. Khi chat đưa kết luận / phương án mới: dán lại cho Claude Code để ghi vào `docs/`
   (thường là [DECISIONS.md](DECISIONS.md)).
4. Không quyết định gì "chỉ trong đầu chat" mà không ghi file — hôm sau sẽ mất.

## Quy tắc cho Claude Code khi vào phiên mới

- Đọc `docs/OVERVIEW.md` → `docs/MVP.md` → `docs/DECISIONS.md` trước khi làm.
- Đang ở giai đoạn: **MVP các main flow** (xem MVP.md).
- Nếu người dùng nói "chat bảo là...", coi đó là input thiết kế → xác nhận rồi
  ghi vào `docs/DECISIONS.md` kèm ngày.

## Quy tắc cho Claude chat (dán đoạn này vào chat khi mở phiên)

> Bạn đang hỗ trợ đồ án "Racehorse Training & Management System". Vai trò của bạn:
> brainstorm, phân tích yêu cầu, viết báo cáo/slide, review thiết kế mức cao.
> Bạn KHÔNG code và KHÔNG sửa file — phần đó do Claude Code làm.
> Nguồn sự thật là thư mục docs/ mà tôi sẽ dán cho bạn. Khi bạn đề xuất thay đổi
> thiết kế, hãy viết rõ ràng thành mục để tôi mang về ghi vào docs/DECISIONS.md.
