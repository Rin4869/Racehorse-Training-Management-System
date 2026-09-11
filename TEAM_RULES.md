# QUY TẮC NHÓM — SWP391
### Topic: Racehorse Training & Management System

---

## 1. Vai trò & Trách nhiệm

| Thành viên | Vai trò chính | Trách nhiệm |
|---|---|---|
| Nguyễn Đình Nhất Định | Team Leader | Quản lý tiến độ, phân công task, requirement, điều phối, integration. |
| Phạm Thế Cường | Horse Management | Flow 1 — Quản lý Hồ sơ & Lý lịch Ngựa. |
| Đào Trọng Tấn | Training Management | Flow 2 — Lập & Thực hiện Giáo án Huấn luyện. |
| Lê Quang Hải | Medical Management | Flow 3 — Quản lý Y tế & Xử lý Chấn thương. |
| Huỳnh Quốc Bình | Frontend / BA | UI, validation, testing, integration và hỗ trợ các module. |

- Các thành viên có thể hỗ trợ lẫn nhau khi cần.

---

## 2. Quy tắc họp nhóm

- Họp nhóm 2 buổi/tuần.
- Nếu có việc bận hoặc không thể tham gia, thành viên phải báo trước cho leader.
- Thành viên phải cập nhật tiến độ và các vấn đề đang gặp phải.
- Sau mỗi buổi họp sẽ ghi lại quyết định, task được giao và deadline.

---

## 3. Quy tắc giao tiếp giữa các thành viên

- Google meet là kênh giao tiếp chính cho các công việc của nhóm.
- Phản hồi tin nhắn liên quan đến project trong ngày.
- Thay đổi scope, deadline hoặc requirement phải được thông báo trong group.
- Báo sớm khi gặp vấn đề hoặc có nguy cơ trễ deadline.

---

## 4. Task & Deadline

- Mỗi task sẽ phân công người phụ trách, nội dung và deadline cụ thể.
- Quản lí project bằng github.
- Deadline nội bộ phải sớm hơn deadline chính thức 1 ngày.
- Không tự ý bỏ task hoặc thay đổi deadline mà không thông báo.

---

## 5. Quy tắc ưu tiên Requirement

**Must Have → Test → Integration → Nice to Have**

- Nhóm phải hoàn thành 3 Flow REQUIRED trước khi bắt đầu các Flow OPTIONAL.
- Flow REQUIRED chỉ được xem là hoàn thành khi đã phát triển, kiểm thử và integration thành công.
- Flow 4 và Flow 5 chỉ được thực hiện khi 3 Flow REQUIRED đã ổn định và còn đủ thời gian.
- Không ưu tiên feature mới khi REQUIRED flow còn lỗi nghiêm trọng.

---

## 6. Git & Version Control

- Sử dụng một repository GitHub chung.
- Không push trực tiếp lên main.
- Mỗi feature/module sử dụng một branch riêng.
- Quy trình: Pull → Branch → Code → Test → Commit → Push → Pull Request → Review → Merge.
- Mỗi Pull Request nhóm sẽ họp trước khi merge.
- Không dồn integration đến cuối project; phải merge và kiểm tra thường xuyên.
- Không tự ý thay đổi dữ liệu dùng chung.

---

## 7. Code Quality & Testing

- Code phải build/compile thành công trước khi tạo Pull Request.
- Feature phải được test trước khi merge.
- Không merge code có lỗi nghiêm trọng ảnh hưởng module khác.
- Sau khi merge phải kiểm tra cả module và integration với hệ thống.
- Lỗi phát hiện trong quá trình test phải được ghi nhận và xử lý.

---

## 8. Database & Shared Components

- Các thành phần dùng chung như Horse, User, Training, Health Record và Treatment phải được thống nhất.
- Thay đổi database, field, relationship hoặc API phải được trao đổi với thành viên liên quan.
- Không tự ý xóa hoặc đổi tên thành phần dùng chung.

---

## 9. Conflicts

- Ưu tiên thảo luận dựa trên requirement và bằng chứng kỹ thuật.
- Tập trung giải quyết vấn đề, không công kích cá nhân.
- Nếu không thống nhất, Leader sẽ điều phối và đưa ra quyết định.

---

## 10. Đóng góp & Trách nhiệm

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


