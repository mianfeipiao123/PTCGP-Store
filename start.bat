@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

set PORT=8080
set URL=http://localhost:%PORT%/

echo Starting Pokemon TCG Pocket price viewer...
echo.

REM Start the Node server in a separate, named window so it's easy to close later.
start "PTCGP price server" /MIN cmd /k "node serve.js"

REM Give the server a moment to bind the port, then open the page.
timeout /t 2 /nobreak >nul
start "" "%URL%"

echo Server running on %URL%
echo To stop the server, close the "PTCGP price server" window.
echo.
pause
