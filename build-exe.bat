@echo off
chcp 65001 > nul
title Đóng gói ứng dụng ClSend Windows (.exe)
color 0A

echo ======================================================================
echo           CLSEND - CÔNG CỤ ĐÓNG GÓI ỨNG DỤNG WINDOWS (.EXE)
echo ======================================================================
echo.
echo [1/4] Đang kiểm tra môi trường Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu: https://nodejs.org/ (Phien ban LTS)
    echo Sau khi cai dat xong, hay chay lai file nay.
    echo.
    pause
    exit /b 1
)

echo [OK] Da tim thay Node.js.
echo.

echo [2/4] Đang cài đặt thư viện cần thiết (nếu có thư viện mới)...
call npm install
if %errorlevel% neq 0 (
    echo [LOI] Co loi xay ra khi cai dat dependencies.
    pause
    exit /b 1
)

echo [3/4] Đang biên dịch giao diện Web (Vite Build)...
call npm run build
if %errorlevel% neq 0 (
    echo [LOI] Bien dich Web that bai.
    pause
    exit /b 1
)

echo [4/4] Đang đóng gói ứng dụng thành file ClSend Setup (.exe)...
call npx electron-builder --win nsis portable
if %errorlevel% neq 0 (
    echo [LOI] Dong goi Electron that bai.
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo    THANH CONG! TỆP CÀI ĐẶT .EXE ĐÃ ĐƯỢC TẠO HOÀN TẤT!
echo ======================================================================
echo.
echo Tệp .exe của bạn nằm tại thư mục:
echo      release\ClSend Setup 1.0.0.exe
echo      release\ClSend 1.0.0.exe (Bản Portable chạy ngay)
echo.
echo Đang mở thư mục release...
start "" "%~dp0release"
echo.
pause
