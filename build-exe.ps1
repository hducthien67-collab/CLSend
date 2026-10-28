Write-Host "======================================================" -ForegroundColor Green
Write-Host "     CLSEND - DONG GOI UNG DUNG WINDOWS (.EXE)        " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green

Write-Host "[1/4] Kiem tra Node.js..." -ForegroundColor Cyan
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[LOI] Khong tim thay Node.js! Vui long cai dat tai https://nodejs.org/" -ForegroundColor Red
    Pause
    exit
}

Write-Host "[2/4] Dang cai dat thu vien (npm install)..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] npm install that bai." -ForegroundColor Red
    Pause
    exit
}

Write-Host "[3/4] Dang bien dich giao dien Web (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] npm run build that bai." -ForegroundColor Red
    Pause
    exit
}

Write-Host "[4/4] Dang dong goi file .exe (electron-builder)..." -ForegroundColor Cyan
npx electron-builder --win nsis portable
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] electron-builder that bai." -ForegroundColor Red
    Pause
    exit
}

Write-Host "======================================================" -ForegroundColor Green
Write-Host " THANH CONG! MO THU MUC release DE LAY FILE .EXE!     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Start-Process "release"
Pause
