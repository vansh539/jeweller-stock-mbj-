@echo off
title M. Bajranglal Sons - System Updater
cd /d "%~dp0"

echo.
echo  ================================================
echo   M. Bajranglal Sons Stock System - Updater
echo   Powered by IntelliTech Solutions
echo  ================================================
echo.

echo  [1/4] Stopping the system...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 4 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [2/4] Backing up your data...
if not exist "backups" mkdir backups
set BACKUP_NAME=backups\backup_%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%%time:~3,2%.db
copy /Y "jeweller-stock.db" "%BACKUP_NAME%" >nul
echo      Backed up to: %BACKUP_NAME%

echo  [3/4] Downloading latest files...
set BASE=https://raw.githubusercontent.com/vansh539/jeweller-stock-mbj-/main

curl -s -L -o "server.js"                    "%BASE%/server.js"
curl -s -L -o "db.js"                        "%BASE%/db.js"
curl -s -L -o "zpl.js"                       "%BASE%/zpl.js"
curl -s -L -o "ecosystem.config.js"          "%BASE%/ecosystem.config.js"
curl -s -L -o "package.json"                 "%BASE%/package.json"
if not exist "public" mkdir public
curl -s -L -o "public\app.js"                "%BASE%/public/app.js"
curl -s -L -o "public\index.html"            "%BASE%/public/index.html"
curl -s -L -o "public\style.css"             "%BASE%/public/style.css"
curl -s -L -o "public\scan.html"             "%BASE%/public/scan.html"
curl -s -L -o "public\invoice-print.html"    "%BASE%/public/invoice-print.html"
curl -s -L -o "public\walkthrough.html"      "%BASE%/public/walkthrough.html"
curl -s -L -o "public\expired.html"          "%BASE%/public/expired.html"

if errorlevel 1 (
  echo.
  echo  [!] Download failed. Check internet connection and try again.
  pause
  exit /b 1
)

echo  [4/4] Restarting the system...
call npm install --omit=dev >nul 2>&1
start "M. Bajranglal Sons Stock" node server.js

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
