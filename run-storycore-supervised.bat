@echo off
setlocal
cd /d "%~dp0"
if exist "StoryCoreFoundryAI.exe" (
  start "StoryCore Foundry AI" "StoryCoreFoundryAI.exe"
  exit /b 0
)
if exist "release\StoryCoreFoundryAI-win32-x64\StoryCoreFoundryAI.exe" (
  start "StoryCore Foundry AI" "release\StoryCoreFoundryAI-win32-x64\StoryCoreFoundryAI.exe"
  exit /b 0
)
echo StoryCoreFoundryAI.exe was not found next to this launcher.
echo Extract the complete ZIP before running this file.
pause
exit /b 1
