# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (recommended)
uv sync --extra dev

# Run server
uv run uvicorn app.backend.main:app --host 127.0.0.1 --port 8000

# Run all tests
python -m pytest -q

# Run a single test file
python -m pytest tests/test_pipelines.py -q

# Run a single test
python -m pytest tests/test_pipelines.py::test_x5_reel_defaults -q
```

Windows shortcut: `run.bat` (starts server and opens browser).

## Architecture

**Video Sarayi** is a local-first FastAPI web app that wraps FFmpeg for converting action camera footage (Insta360 X5, DJI Osmo Action 6) into social-media formats (Instagram Reels HEVC, YouTube 4K AV1). No cloud, no build step for the frontend.

### Four pipelines

| ID | Source | Target | Encoder |
|----|--------|--------|---------|
| `x5-reel` | Insta360 X5 | Instagram Reel 1080×1920 | libx265 |
| `x5-yt` | Insta360 X5 | YouTube 4K 3840×2160 | libsvtav1 |
| `a6-reel` | DJI Osmo Action 6 | Instagram Reel 1080×1920 | libx265 |
| `a6-yt` | DJI Osmo Action 6 | YouTube 4K (native res) | libsvtav1 |

Each pipeline is a pure function in `app/backend/pipelines.py` that builds an FFmpeg argv list from a `PipelineParams` dataclass (30+ knobs: v360 reframe, crop, lut3d, scale, x265/AV1 encoder settings, audio, color metadata). `PipelineParams.merge()` overlays user overrides onto defaults.

### Request flow

1. `GET /api/pipelines` — list pipelines + their defaults and traits
2. `POST /api/preview` — build FFmpeg argv without executing (for UI preview)
3. `POST /api/jobs` — enqueue job; returns job ID immediately
4. `WS /api/jobs/{id}/events` — live-stream progress, logs, status

### Job queue (`app/backend/jobs.py`)

Single async worker processes jobs sequentially (one FFmpeg process at a time). States: `QUEUED → RUNNING → DONE | FAILED | CANCELED`. FFmpeg is run with `-progress pipe:1`; stdout is parsed incrementally by `ProgressParser` in `app/backend/progress.py`. Stderr tail (250 lines) captured for debugging.

### Presets (`app/backend/presets.py`)

Two layers: **built-in** presets synthesized from `PipelineParams` defaults (immutable, always present), and **user** presets persisted to `presets.json`. Eight seed presets are written to `presets.json` on first run. IDs follow the scheme `builtin:x5-reel`, `seed:00:x5-reel`, or a 12-char UUID for user presets. File writes are atomic (temp + replace) under an RLock.

### Configuration (`app/backend/config.py`)

FFmpeg/FFprobe resolved in order: `FFMPEG`/`FFPROBE` env vars → bundled `ffmpeg/bin/` → system PATH. `VIDEO_SARAYI_ROOT` env var overrides repo root (used in tests). LUT filenames are hardcoded; both `.cube` files must exist in `luts/`.

### Preflight (`app/backend/preflight.py`)

Runs at startup (FastAPI lifespan): checks FFmpeg runnable, required encoders present (libx265, libsvtav1, libopus), LUT files exist, auto-repairs the DJI LUT tab→space bug, creates `input/` and `output/` dirs.

### Frontend (`app/frontend/app.js`)

Vanilla JS (no framework), ~700 lines. Single global `S` object holds all state. `PARAM_GROUPS` schema drives the parameter form with conditional fieldset visibility per pipeline. Pattern: `load*()` fetches data into `S`, `render*()` rebuilds DOM from `S`. Preview requests are debounced 180 ms. WebSocket reconnects automatically for in-progress jobs on page load.

## Requirements

- Python 3.14+
- FFmpeg with libx265, libsvtav1, libopus encoders
- LUT files in `luts/`: `X5_I-Log_To_Rec.709_V1.0.cube` and `DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube`
- `uv` package manager (or plain pip with `pip install -e .[dev]`)
- FFmpeg and GyroFlow in in `libs/` folder