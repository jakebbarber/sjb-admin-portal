@echo off
rem SJB Portal sandbox (Adviser portal + Admin portal). Runs the built worker.js locally with a local database.
rem Uses wrangler.sandbox.toml (the live config minus the Workers AI binding, so wrangler never needs Cloudflare).
rem First visit: http://127.0.0.1:8787/setup  (setup code: sandbox) to create the first login.
rem Then sign in at http://127.0.0.1:8787/, choose Admin portal, open RWL Review. Test letter: fixture-rwl.docx
set "SB=%LOCALAPPDATA%\sjb-admin-sandbox"
set "ST=%LOCALAPPDATA%\sjb-admin-sandbox-state"
if not exist "%SB%" mkdir "%SB%"
if not exist "%ST%" mkdir "%ST%"
copy /y "%~dp0worker.js" "%SB%\worker.js" >nul
copy /y "%~dp0wrangler.sandbox.toml" "%SB%\wrangler.toml" >nul
if not exist "%SB%\.dev.vars" copy /y "%~dp0.dev.vars.example" "%SB%\.dev.vars" >nul
cd /d "%SB%"
echo.
echo First time: http://127.0.0.1:8787/setup  (setup code: sandbox)
echo Then:       http://127.0.0.1:8787/        choose Admin portal, open RWL Review
echo Claude is mocked (MOCK_AI=1 in %SB%\.dev.vars). Press Ctrl+C here to stop.
echo.
rem The database state lives OUTSIDE the worker folder: wrangler watches that folder
rem for changes, and a database inside it makes the server reload in a loop.
call npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to "%ST%"
