@echo off
rem Start the local static server. Node is resolved in this order:
rem   1) node.exe on PATH
rem   2) newest WorkBuddy-managed node under %USERPROFILE%\.workbuddy\binaries\node\versions
rem   3) C:\Program Files\nodejs\node.exe
setlocal
set "HERE=%~dp0"
set "NODE_EXE="

for %%I in (node.exe) do if not "%%~$PATH:I"=="" set "NODE_EXE=%%~$PATH:I"

if not defined NODE_EXE (
  for /f "delims=" %%D in ('dir /b /ad /o-n "%USERPROFILE%\.workbuddy\binaries\node\versions" 2^>nul') do (
    if not defined NODE_EXE if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\%%D\node.exe" set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\%%D\node.exe"
  )
)

if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"

if not defined NODE_EXE (
  echo [%DATE% %TIME%] ERROR: node.exe not found>>"%HERE%server.log"
  exit /b 1
)

echo [%DATE% %TIME%] starting with "%NODE_EXE%">>"%HERE%server.log"
"%NODE_EXE%" "%HERE%serve.mjs">>"%HERE%server.log" 2>&1
echo [%DATE% %TIME%] server exited with code %ERRORLEVEL%>>"%HERE%server.log"
