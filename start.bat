@echo off
title M. Bajranglal Sons — Stock System
cd /d "%~dp0"
echo Starting stock management system...
echo.
echo Once you see "Server running", open your browser and go to:
echo   http://localhost:3100
echo.
echo Do NOT close this window while using the system.
echo To stop the server, press Ctrl+C or close this window.
echo.
node server.js
pause
