#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
(sleep 1 && open "http://127.0.0.1:8000") &
exec uv run uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
