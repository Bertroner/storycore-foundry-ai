@echo off
setlocal
title StoryCore Fire Bolt Discovery

cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Install Node.js or add npm to PATH.
  echo.
  pause
  exit /b 1
)

echo Starting StoryCore Fire Bolt read-only discovery...
echo Close the normal StoryCore UI first because port 3210 is shared.
echo Foundry must remain running with an active combat.
echo.

call npm.cmd run fire-bolt:discover
set "STORYCORE_EXIT=%ERRORLEVEL%"

if not "%STORYCORE_EXIT%"=="0" (
  echo.
  echo Fire Bolt discovery stopped with exit code %STORYCORE_EXIT%.
  pause
)

exit /b %STORYCORE_EXIT%
