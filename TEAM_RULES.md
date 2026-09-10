# QUY TẮC NHÓM — SWP391
### Topic: Racehorse Training & Management System

---

## 1. Vai trò & Trách nhiệm

| Thành viên | Vai trò chính | Trách nhiệm |
|---|---|---|
| Leader | Team Leader / BA | Quản lý tiến độ, phân công task, requirement, điều phối, integration và liên hệ GVHD. |
| Member A | Horse Management | Flow 1 — Quản lý Hồ sơ & Lý lịch Ngựa. |
| Member B | Training Management | Flow 2 — Lập & Thực hiện Giáo án Huấn luyện. |
| Member C | Medical Management | Flow 3 — Quản lý Y tế & Xử lý Chấn thương. |
| Member D | Frontend / QA | UI, validation, testing, integration và hỗ trợ các module. |

- Phân công trên xác định trách nhiệm chính; các thành viên có thể hỗ trợ lẫn nhau khi cần.

---

## 2. Quy tắc họp nhóm

- Họp nhóm 2 buổi/tuần, tối đa 45 phút/buổi.
- Nếu không thể tham gia, thành viên phải báo trước cho nhóm.
- Thành viên phải cập nhật tiến độ và các vấn đề đang gặp phải.
- Sau mỗi buổi họp phải ghi lại quyết định, task được giao và deadline.

---

## 3. Quy tắc giao tiếp

- Sử dụng một kênh giao tiếp chính cho công việc nhóm.
- Phản hồi tin nhắn liên quan đến project trong vòng 12 giờ.
- Thay đổi scope, deadline hoặc requirement phải được thông báo trong group.
- Báo sớm khi gặp vấn đề hoặc có nguy cơ trễ deadline.

---

## 4. Quy tắc Task & Deadline

- Mỗi task phải có người phụ trách, nội dung và deadline cụ thể.
- Quản lý task bằng Trello, Notion hoặc GitHub Projects.
- Deadline nội bộ phải sớm hơn deadline chính thức ít nhất 1–2 ngày.
- Không tự ý bỏ task hoặc thay đổi deadline mà không thông báo nhóm.

---

## 5. Quy tắc ưu tiên Requirement

**Must Have → Test → Integration → Nice to Have**

- Nhóm phải hoàn thành 3 Flow REQUIRED trước khi bắt đầu các Flow OPTIONAL.
- Flow REQUIRED chỉ được xem là hoàn thành khi đã phát triển, kiểm thử và integration thành công.
- Flow 4 và Flow 5 chỉ được thực hiện khi 3 Flow REQUIRED đã ổn định và còn đủ thời gian.
- Không ưu tiên feature mới khi REQUIRED flow còn lỗi nghiêm trọng.

---

## 6. Quy tắc Git & Version Control

- Sử dụng một repository GitHub chung.
- Không push trực tiếp lên main/develop.
- Mỗi feature/module sử dụng một branch riêng.
- Quy trình: Pull → Branch → Code → Test → Commit → Push → Pull Request → Review → Merge.
- Mỗi Pull Request phải có ít nhất 1 thành viên review trước khi merge.
- Không dồn integration đến cuối project; phải merge và kiểm tra thường xuyên.
- Không tự ý thay đổi Database, Model, DTO hoặc API dùng chung.

---

## 7. Quy tắc Code Quality & Testing

- Code phải build/compile thành công trước khi tạo Pull Request.
- Feature phải được test trước khi merge.
- Không merge code có lỗi nghiêm trọng ảnh hưởng module khác.
- Sau khi merge phải kiểm tra cả module và integration với hệ thống.
- Lỗi phát hiện trong quá trình test phải được ghi nhận và xử lý.

---

## 8. Quy tắc Database & Shared Components

- Các thành phần dùng chung như Horse, User, Training, Health Record và Treatment phải được thống nhất.
- Thay đổi database, field, relationship hoặc API phải được trao đổi với thành viên liên quan.
- Không tự ý xóa hoặc đổi tên thành phần dùng chung.

---

## 9. Quy tắc Giải quyết Mâu thuẫn

- Ưu tiên thảo luận dựa trên requirement và bằng chứng kỹ thuật.
- Tập trung giải quyết vấn đề, không công kích cá nhân.
- Nếu không thống nhất, Leader điều phối và đưa ra quyết định.
- Nếu vấn đề liên quan requirement và không thể giải quyết, hỏi GVHD.

---

## 10. Quy tắc Đóng góp & Trách nhiệm

- Mỗi thành viên phải có đóng góp rõ ràng và có thể kiểm chứng.
- Contribution có thể thể hiện qua code, Git, database, diagram, documentation, testing hoặc công việc liên quan.
- Thành viên chịu trách nhiệm với task đã nhận và chủ động yêu cầu hỗ trợ khi cần.

---

## 11. Nguyên tắc chung

- Ưu tiên chất lượng và tính ổn định hơn số lượng feature.
- Mọi thay đổi lớn về scope, database, architecture hoặc requirement phải được nhóm thống nhất.
- Quyết định đã thống nhất trong meeting phải được ghi nhận và thực hiện thống nhất.
- Các thành viên hỗ trợ nhau để đảm bảo tiến độ chung.

---

## NGUYÊN TẮC CỐT LÕI

**Hoàn thành → Kiểm thử → Integration 3 Flow REQUIRED → Sau đó mới thực hiện Flow OPTIONAL.**
