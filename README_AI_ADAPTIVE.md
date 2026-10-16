# Study App Maze — AI điều chỉnh lộ trình học tập

## Tính năng được thêm
- `POST /api/adapt-learning-path/`: tạo đề xuất bằng DeepInfra dựa trên nhiệm vụ chưa hoàn thành, số phút học mỗi ngày, khó khăn do người học nhập và số ngày đã trôi qua kể từ khi tạo lộ trình. API chỉ tạo bản xem trước, không ghi vào cơ sở dữ liệu.
- `POST /api/apply-adapted-learning-path/`: lưu đề xuất sau khi người học xác nhận. API kiểm tra quyền sở hữu và trạng thái nhiệm vụ; từ chối áp dụng nếu danh sách nhiệm vụ đã thay đổi kể từ lúc xem trước.
- Trang `src/pages/Roadmap.jsx`: hiển thị bản xem trước, nội dung cũ/mới và tuần/ngày dự kiến; sau khi xác nhận, phát sự kiện `plan-updated` để đồng bộ trang Lịch học.
- Không thêm model hay migration. Nhiệm vụ đã hoàn thành được giữ nguyên; các nhiệm vụ đang chờ được sắp xếp lại bắt đầu từ ngày hiện tại ước tính của lộ trình hoặc sau nhiệm vụ đã hoàn thành gần nhất.
- API key không được đưa ra frontend; bản cập nhật cũng loại bỏ log một phần API key.

## Triển khai
1. Đảm bảo biến môi trường `DEEPINFRA_API_KEY` được đặt ở backend. Backend dùng model `openchat/openchat_3.5` giống luồng tạo lộ trình hiện tại.
2. Deploy backend Django với hai route mới trong `api/urls.py`. Không cần chạy migration cho thay đổi này.
3. Deploy lại frontend React. `src/api.js` vẫn dùng cấu hình URL backend hiện có.
4. Đăng nhập, mở Lộ trình → **AI điều chỉnh lộ trình** → nhập thời gian học và khó khăn (nếu có) → tạo đề xuất → xác nhận nếu đồng ý.

## Ghi chú
ZIP chứa mã nguồn, không kèm `node_modules`, `build`, `myenv`, `.git` hay cache để giảm dung lượng.
