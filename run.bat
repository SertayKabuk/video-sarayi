@echo off
setlocal
cd /d "%~dp0"
echo Building frontend...
call pnpm --dir app/frontend build
if errorlevel 1 (
    echo Frontend build failed.
    pause
    exit /b 1
)
start "" http://127.0.0.1:8000
uv run uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
