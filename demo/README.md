# demo/ — bản demo trình bày

Có **2 file**, cùng 1 giao diện, khác cách lấy dữ liệu:

| File | Dữ liệu | Cần chạy gì | Dùng khi |
|---|---|---|---|
| `racehorse-demo.html` | Mock — state JS trong bộ nhớ trình duyệt | Không cần gì, mở là chạy | Demo an toàn, offline, không lo lỗi mạng/server lúc trình bày |
| `racehorse-demo-live.html` | **Thật** — gọi `fetch()` tới `apps/api` | `apps/api` + PostgreSQL đang chạy | Muốn cho cô thấy dữ liệu đi vào database thật, không phải giả lập |

Cả hai đều **không phải `apps/web`** (frontend React chính thức của đồ án,
vẫn còn thiếu UI cho Pedigree/Races/Training Plan/Lock/Incidents —
xem [../docs/STATE.md](../docs/STATE.md) §4). Đây là bản demo phụ, viết
riêng để trình bày nhanh, gọn.

## 1. `racehorse-demo.html` — bản offline (mock)

Mở trực tiếp bằng trình duyệt (double-click), kể cả không có mạng. Mọi thao
tác (tạo ngựa, báo cáo sự cố, khoá/mở khoá, duyệt tài khoản...) chỉ thay đổi
biến `state` trong bộ nhớ trình duyệt — **không gọi API, không đụng
Postgres**. Dữ liệu mẫu trùng với `apps/api/prisma/seed.ts` (Thunderbolt,
Sea Breeze, Midnight, các tài khoản demo...), có thêm vài bản ghi cho đỡ trống.

## 2. `racehorse-demo-live.html` — bản gắn API thật

Y hệt giao diện trên, nhưng **mọi hành động là 1 lệnh `fetch()` thật** tới
`apps/api` (`docs/API.md`) — không có logic nghiệp vụ nào chạy ở phía
trình duyệt, tất cả do API thật xử lý (khoá tự động khi sự cố `HIGH`, mở
khoá khi xử lý xong, validate phả hệ, RBAC theo role...).

**Chuẩn bị trước khi mở file này:**
```powershell
powershell -File scripts/pg-start.ps1     # 1. bật PostgreSQL
cd apps/api
npm run start:dev                          # 2. chạy API (giữ terminal này mở)
# (nếu chưa seed) npm run db:seed
```
Rồi mở `demo/racehorse-demo-live.html` bằng trình duyệt. Trang tự đăng nhập
bằng các tài khoản seed thật khi bạn đổi vai trò ở góc phải header (cùng
email/mật khẩu như bảng trong README gốc).

**Nếu trang báo "Không kết nối được tới API":** bấm nút "⚙ Cài đặt kết nối
API" để đổi địa chỉ (mặc định `http://localhost:3000/api/v1`), hoặc kiểm tra
lại 2 bước ở trên. Mọi lỗi API thật (validate sai, quyền sai...) hiện ra
đúng message gốc từ server (tiếng Anh) qua toast góc dưới phải — không dịch,
để giữ đúng những gì API thật trả về.

**Lưu ý khi chạy trong trình duyệt:** nếu mở file này qua 1 đường link
`https://...` (ví dụ artifact đã publish) thay vì mở file cục bộ, trình
duyệt có thể chặn gọi tới `http://localhost` (mixed content / private
network access). An toàn nhất là **mở trực tiếp file trên máy** (double-click
hoặc kéo vào trình duyệt) trong lúc `apps/api` cũng đang chạy trên máy đó.

## Vì sao dữ liệu/luật giống hệt hệ thống thật

Model, role, trạng thái, và luật nghiệp vụ (khoá/mở khoá tự động khi có sự
cố `HIGH`, phả hệ giới hạn 3 đời, GROOM chỉ báo cáo còn VET mới xử lý sự
cố, OWNER chỉ thấy ngựa của mình...) khớp đúng những gì đã code ở
`apps/api` (Phase 0-8). Bản mock chép lại luật này bằng tay trong JS; bản
live không cần chép gì cả — luật đó chính là API thật đang chạy.

## Dùng thế nào khi demo (cả 2 bản)

Góc phải header có nút đổi vai trò — chọn MANAGER/TRAINER/VET/GROOM/OWNER
để thấy đúng quyền & thao tác của vai trò đó. Gợi ý trình tự demo theo đúng
3 luồng mở rộng đã làm:

1. **GROOM** báo cáo sự cố mức **Nặng** cho 1 ngựa → thấy ngựa tự động bị
   khoá + có thông báo mới.
2. **VET** vào tab *Sức khoẻ* của ngựa đó → cập nhật sự cố sang
   **Đã xử lý** → ngựa tự động mở khoá.
3. **MANAGER** gán phả hệ (cha/mẹ) cho 1 ngựa → xem tab *Phả hệ* dựng cây
   3 đời.
4. **TRAINER** tạo kế hoạch tập + buổi tập cho ngựa không bị khoá; thử tạo
   buổi tập cho ngựa đang khoá để thấy bị chặn.
5. **MANAGER** tạo giải đua, đăng ký ngựa tham gia, nhập kết quả.
6. **OWNER** đăng nhập → chỉ thấy ngựa của mình ở mọi trang.

## File

Không sửa tay nếu không cần thiết. Nếu API thật thay đổi field/luật ở phase
sau: bản mock cần sửa lại `state` seed + logic tương ứng trong
`racehorse-demo.html`; bản live thường **không cần sửa gì** trừ khi đổi hẳn
hợp đồng route (`docs/API.md`) — vì nó chỉ gọi thẳng API, không chép luật.
