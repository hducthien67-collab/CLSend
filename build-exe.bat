@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Dong goi ung dung ClSend Windows (.exe)
color 0A

echo ======================================================================
echo           CLSEND - CONG CU DONG GOI UNG DUNG WINDOWS (.EXE)
echo ======================================================================
echo.

echo [1/4] Dang kiem tra moi truong Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=%PATH%;C:\Program Files\nodejs"
        echo [OK] Tu dong tim thay Node.js tai Program Files.
    ) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
        set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
        echo [OK] Tu dong tim thay Node.js tai Program Files (x86).
    ) else (
        echo.
        echo [LOI] KHONG TIM THAY NODE.JS TREN MAY TINH!
        echo Vui long cai dat Node.js tu trang chu: https://nodejs.org/
        echo Sau do chay lai file nay.
        echo.
        goto END
    )
)

echo [OK] Da xac nhan Node.js san sang.
echo.

echo [2/4] Dang cai dat thu vien can thiet (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Co loi khi chay npm install.
    goto END
)

echo.
echo [3/4] Dang bien dich giao dien Web (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Co loi khi bien dich web.
    goto END
)

echo.
echo [4/4] Dang dong goi ung dung thanh file .exe (electron-builder)...
call npx electron-builder --win nsis portable
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Co loi khi dong goi .exe.
    goto END
)

echo.
echo ======================================================================
echo    THANH CONG! TEP CAI DAT .EXE DA DUOC TAO HOAN TAT!
echo ======================================================================
echo.
echo Tep .exe cua ban nam tai thu muc: release\
echo Dang mo thu muc release...
start "" "%~dp0release"
echo.

:END
echo.
echo ======================================================================
echo Qua trinh da ket thuc. Bam phim bat ky de thoat...
echo ======================================================================
pause >nul
