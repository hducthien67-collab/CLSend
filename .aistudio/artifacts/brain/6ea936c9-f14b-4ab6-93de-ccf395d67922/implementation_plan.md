# Kế hoạch triển khai ứng dụng Desktop (.exe & PWA) cho ClSend

Tài liệu này mô tả chi tiết phương án và các bước triển khai để người dùng có thể tải, cài đặt và sử dụng ClSend như một ứng dụng máy tính (Windows Desktop App) với tệp `.exe` và chuẩn PWA.

---

## 1. Yêu cầu & Cân nhắc từ người dùng (User Review Required)

> [!IMPORTANT]
> - **Môi trường Cloud Web Sandbox**: Do môi trường AI Studio chạy trên máy chủ Linux container trên đám mây, việc trực tiếp build tệp `.exe` Windows native cần môi trường Windows hoặc Wine với thời gian biên dịch lớn.
> - **Giải pháp tối ưu kết hợp**:
>   1. **PWA Desktop 1-Click (Dùng được ngay lập tức)**: Thêm nút "Cài đặt ứng dụng Desktop" trực tiếp trên giao diện ClSend. Người dùng nhấn 1 nút là ứng dụng được cài đặt vào Windows với Icon trên Desktop, thanh Taskbar và cửa sổ ứng dụng độc lập (không viền trình duyệt).
>   2. **Bộ mã nguồn & Cấu hình Electron `.exe`**: Cung cấp đầy đủ mã nguồn `electron/main.cjs`, `electron/preload.cjs`, cấu hình `electron-builder` trong `package.json`, kèm tính năng **System Tray (khay hệ thống)** và **Desktop Notification**. Khi bạn clone hoặc tải mã nguồn về máy tính, chỉ cần chạy lệnh `npm run dist:win` là sinh ra ngay tệp `ClSend Setup.exe` để cài đặt.
>   3. **Modal Hướng dẫn & Tải về Desktop App**: Tạo giao diện "Trung tâm tải ứng dụng" (Desktop Download Center) trên website với nút cài PWA tức thì và hướng dẫn chi tiết từng bước xuất file `.exe`.

---

## 2. Các bước triển khai chi tiết (Proposed Changes)

### Bước 1: Xây dựng cấu hình Electron Desktop
- Tạo thư mục `electron/` chứa:
  - `electron/main.cjs`:
    - Khởi tạo cửa sổ `BrowserWindow` với kích thước chuẩn desktop, icon ClSend, bỏ thanh menu mặc định.
    - **Tính năng Khay hệ thống (System Tray)**: Tạo biểu tượng ở góc phải thanh taskbar Windows, menu chuột phải (Mở ứng dụng, Trạng thái, Thoát).
    - **Thu nhỏ xuống khay khi đóng (Minimize to Tray)**: Bắt sự kiện `close` để ẩn vào khay hệ thống thay vì tắt hẳn, đảm bảo không bỏ lỡ tin nhắn và tệp chuyển đến.
    - **Thông báo Desktop Native**: Xử lý gửi thông báo native qua IPC (`new Notification(...)`).
  - `electron/preload.cjs`:
    - Thiết lập IPC bridge an toàn `window.electronAPI` để giao tiếp giữa React app và tiến trình Electron.

### Bước 2: Bổ sung cấu hình `package.json` cho Electron & `electron-builder`
- Thêm scripts:
  - `"electron:dev"`: Chạy ứng dụng dưới dạng Electron Desktop trong quá trình phát triển.
  - `"electron:pack"`: Đóng gói nhanh thư mục app.
  - `"dist:win"`: Biên dịch ra tệp cài đặt Windows `ClSend Setup 1.0.0.exe` (NSIS Installer) kèm portable `.exe`.
- Cấu hình trường `"build"`:
  - `appId`: `com.clsend.desktop`
  - `productName`: `ClSend`
  - `win`: `target: ["nsis", "portable"]`, icon, cấu hình uninstaller sạch sẽ.

### Bước 3: Hoàn thiện tính năng Desktop Notifications trong Web & Electron
- Tạo hook `useDesktopIntegration.ts`:
  - Nhận diện môi trường đang chạy: Web thông thường, PWA Desktop Standalone, hoặc Electron Desktop.
  - Xin quyền và kích hoạt Notification native khi có tin nhắn mới (kết hợp với badge số lượng tin nhắn đã xây dựng).
  - Tích hợp thông báo nổi ở góc màn hình khi người dùng đang thu nhỏ hoặc ẩn cửa sổ.

### Bước 4: Tạo UI "Tải ứng dụng máy tính" (Desktop App Center Modal)
- Tạo component `src/components/DesktopInstallModal.tsx`:
  - **Tab 1: Cài đặt PWA 1-Click (Khuyên dùng - Cài ngay)**: Tự động bắt sự kiện `beforeinstallprompt`, hiển thị nút "Cài đặt ngay lên máy tính", hướng dẫn trên Chrome/Edge.
  - **Tab 2: Đóng gói tệp .exe (Electron Installer)**: Hiển thị hướng dẫn ngắn 2 lệnh để người dùng tạo tệp `.exe` trên máy tính (`npm install`, `npm run dist:win`), kèm script tự động đóng gói `build-exe.bat`.
  - Đặt nút truy cập "Desktop App" nổi bật trên Header/Menu để người dùng dễ dàng bấm vào bất cứ lúc nào.

---

## 3. Kế hoạch kiểm thử & Xác minh (Verification Plan)

### Kiểm tra tự động
- Chạy `npm run lint` để kiểm tra toàn bộ kiểu TypeScript và import.
- Chạy `compile_applet` để đảm bảo bản build Vite và frontend hoạt động hoàn hảo, không có lỗi cú pháp hay thiếu thư viện.

### Kiểm tra tính năng (Manual Verification)
1. **PWA Desktop**:
   - Kiểm tra Manifest PWA hợp lệ trong DevTools.
   - Thử nghiệm kích hoạt prompt cài đặt ứng dụng desktop từ giao diện nút "Tải ứng dụng".
2. **Cấu hình Electron**:
   - Kiểm tra cú pháp `electron/main.cjs`, `electron/preload.cjs` và các dependency trong `package.json`.
   - Kiểm tra tệp kịch bản `build-exe.bat` để đảm bảo người dùng chạy 1-click trên máy tính Windows.
3. **Thông báo & Khay hệ thống**:
   - Kiểm tra cơ chế gửi Notification khi có tin nhắn mới hoặc truyền tệp thành công.
