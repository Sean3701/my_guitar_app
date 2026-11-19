@echo off
rem Rebuild web assets and republish the desktop app, then reinstall it.
setlocal
cd /d "%~dp0.."

echo [1/3] npm run build
call npm run build
if errorlevel 1 exit /b 1

echo [2/3] dotnet publish
cd /d "%~dp0Shipu.Desktop"
dotnet publish -c Release -r win-x64 --self-contained false -o publish
if errorlevel 1 exit /b 1

echo [3/3] install
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 exit /b 1

echo.
echo Done. Launch "拾谱" from the desktop shortcut.
