@echo off
setlocal
cd /d "%~dp0"
start "" http://127.0.0.1:8000
uv run uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
