@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp001_FETCH_REFERENCES.ps1"
echo.
pause
