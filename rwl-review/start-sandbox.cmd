@echo off
rem Starts the RWL Review sandbox on http://127.0.0.1:8787/ (passcode: sandbox)
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages, one-off...
  call npm install
)
if not exist .dev.vars copy .dev.vars.example .dev.vars >nul
if not exist "%LOCALAPPDATA%\rwl-review-state" mkdir "%LOCALAPPDATA%\rwl-review-state"
echo.
echo Sign in at http://127.0.0.1:8787/ with any name and the passcode: sandbox
echo Test letter: test\fixture-rwl.docx   (press Ctrl+C here to stop)
echo.
call npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to "%LOCALAPPDATA%\rwl-review-state"
