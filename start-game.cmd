@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12+ or 24+ is required.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:5178/ in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
call npm.cmd run dev
