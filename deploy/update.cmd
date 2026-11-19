@echo off
rem Pull latest code, install deps and rebuild. The running server reads from
rem dist/ on every request, so no restart is needed - just refresh the browser.
setlocal
cd /d "%~dp0.."

echo [1/3] git pull
git pull --ff-only
if errorlevel 1 (
  echo       direct connection failed, retrying via local proxy 127.0.0.1:7897
  git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 pull --ff-only
  if errorlevel 1 (
    echo       pull failed, aborting
    exit /b 1
  )
)

echo [2/3] npm install
call npm install --no-audit --no-fund
if errorlevel 1 exit /b 1

echo [3/3] npm run build
call npm run build
if errorlevel 1 exit /b 1

echo.
echo Done. Refresh http://127.0.0.1:8080 (Ctrl+F5 if the old shell is cached).
