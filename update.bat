@echo off
title M. Bajranglal Sons — System Updater
cd /d "%~dp0"

echo.
echo  ================================================
echo   M. Bajranglal Sons Stock System — Updater
echo   Powered by IntelliTech Solutions
echo  ================================================
echo.

echo  [1/4] Stopping the system...
pm2 stop jeweller-stock >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [2/4] Backing up your data...
if not exist "backups" mkdir backups
set BACKUP_NAME=backups\backup_%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%%time:~3,2%.db
copy /Y "jeweller-stock.db" "%BACKUP_NAME%" >nul
echo      Backed up to: %BACKUP_NAME%

echo  [3/4] Downloading latest files...
powershell -Command "& {
    $base = 'https://raw.githubusercontent.com/vansh539/jeweller-stock/main'
    $dest = Split-Path -Parent $MyInvocation.ScriptName
    if (-not $dest) { $dest = Get-Location }

    $files = @(
        'server.js',
        'db.js',
        'zpl.js',
        'ecosystem.config.js',
        'package.json',
        'public/app.js',
        'public/index.html',
        'public/style.css',
        'public/scan.html',
        'public/invoice-print.html',
        'public/walkthrough.html',
        'public/expired.html'
    )

    $failed = 0
    foreach ($f in $files) {
        try {
            $url = $base + '/' + $f
            $out = Join-Path $dest $f
            $dir = Split-Path $out
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
            Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
            Write-Host ('  Updated: ' + $f)
        } catch {
            Write-Host ('  FAILED:  ' + $f + ' — ' + $_.Exception.Message)
            $failed++
        }
    }
    if ($failed -gt 0) { exit 1 }
}"

if errorlevel 1 (
  echo.
  echo  [!] Some files failed to download. Your data is safe — system will restart as-is.
  echo      Check your internet connection or contact IntelliTech Solutions.
  pm2 start ecosystem.config.js >nul 2>&1
  pause
  exit /b 1
)

call npm install --omit=dev >nul 2>&1

echo  [4/4] Restarting the system...
pm2 start ecosystem.config.js >nul 2>&1

timeout /t 3 /nobreak >nul
echo.
echo  ================================================
echo   Update complete! System is running.
echo   Open your browser: http://localhost:3100
echo  ================================================
echo.
echo  Your data (jeweller-stock.db) was not affected.
echo.
pause
