@echo off
REM Klik dua kali untuk menjalankan Kasir Warkop di komputer ini.
REM Simpan berkas ini dengan akhir baris CRLF dan huruf ASCII saja.
setlocal
title Kasir Warkop - jangan tutup jendela ini
cd /d "%~dp0"

echo.
echo   ============================================
echo     KASIR WARKOP
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js belum terpasang di komputer ini.
  echo   Unduh dan pasang dulu dari:  https://nodejs.org
  echo   Pilih versi LTS, lalu jalankan berkas ini lagi.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1,2 delims=." %%a in ('node -p "process.versions.node"') do (
  set MAJOR=%%a
  set MINOR=%%b
)
if %MAJOR% LSS 22 goto versi_lama
if %MAJOR% EQU 22 if %MINOR% LSS 13 goto versi_lama
goto versi_ok
:versi_lama
echo   Versi Node.js terlalu lama. Butuh 22.13 atau lebih baru.
echo   Unduh versi LTS terbaru dari:  https://nodejs.org
echo.
pause
exit /b 1
:versi_ok

if not exist "node_modules\express\package.json" (
  echo   Memasang komponen aplikasi. Butuh internet, cukup sekali.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Pemasangan gagal. Periksa koneksi internet lalu coba lagi.
    echo.
    pause
    exit /b 1
  )
  echo.
)

if not exist "data\warkop.db" (
  echo   Pertama kali dijalankan: mengisi data contoh supaya bisa langsung dicoba.
  echo   Hapus folder "data" kalau nanti ingin mulai dari kosong.
  echo.
  call npm run seed
  echo.
)

echo   Buka di browser:  http://localhost:3300
echo   Pemilik:          pemilik / pemilik123
echo   Kasir contoh:     kasir / kasir123
echo.
echo   HP pelanggan dan kasir lain di Wi-Fi yang sama bisa membuka
echo   alamat komputer ini, mis. http://192.168.1.10:3300 (lihat ipconfig).
echo.
echo   Biarkan jendela ini terbuka. Tutup jendela untuk mematikan aplikasi.
echo.
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3300/login"
call npm start
pause
