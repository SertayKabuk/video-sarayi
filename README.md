# Video Sarayi

Video Sarayi is a local web UI for converting action-cam footage into social-media-ready master files with FFmpeg.

It is built for two capture sources:

- Insta360 X5
- DJI Osmo Action 6

And it currently ships with four output workflows:

- Insta360 X5 → Instagram Reel
- Insta360 X5 → YouTube 4K
- DJI Osmo Action 6 → Instagram Reel
- DJI Osmo Action 6 → YouTube 4K

The app runs entirely on your machine with a FastAPI backend and a lightweight single-page frontend.

## Highlights

- Local-first workflow: no uploads, no cloud dependency
- Research-based default pipelines for Instagram Reel and YouTube 4K exports
- Live FFmpeg command preview before you start a job
- Optional raw command override for one-token-per-line FFmpeg editing
- Sequential job queue with live progress, FPS, speed, and log streaming
- Built-in presets plus user presets stored in `presets.json`
- Startup health checks for FFmpeg, LUT files, and required folders

## Supported pipelines

| Pipeline ID | Source | Target | Encoder |
| --- | --- | --- | --- |
| `x5-reel` | Insta360 X5 | Instagram Reel | `libx265` |
| `x5-yt` | Insta360 X5 | YouTube 4K | `libsvtav1` |
| `a6-reel` | DJI Osmo Action 6 | Instagram Reel | `libx265` |
| `a6-yt` | DJI Osmo Action 6 | YouTube 4K | `libsvtav1` |

## Requirements

- Python `>= 3.14`
- FFmpeg and FFprobe available either:
  - in `ffmpeg/bin/`, or
  - on your system `PATH`, or
  - through the `FFMPEG` and `FFPROBE` environment variables
- FFmpeg build with these encoders available:
  - `libx265`
  - `libsvtav1`
  - `libopus`
- LUT files present in `lut/`

Expected LUT files:

- `lut/X5_I-Log_To_Rec.709_V1.0.cube`
- `lut/DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube`

## Quick start

### Using `uv` (recommended)

```text
uv sync --extra dev
uv run uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000
```

On Windows, you can also use `run.bat`, which opens the browser and starts the same server.

### Using a virtual environment and `pip`

Create and activate a virtual environment, then install the project in editable mode:

```text
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e .[dev]
python -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
```

If you are on macOS or Linux, activate the environment with:

```text
source .venv/bin/activate
```

## How to use

1. Drop source media into `input/`.
2. Start the server and open the app in your browser.
3. Select a file from the **Inputs** pane.
4. Choose the camera and target platform.
5. Pick a preset.
   - Built-in presets are the research defaults.
   - Additional starter presets are seeded into `presets.json` on first run.
6. Adjust parameters in the form if needed.
7. Optionally enable **Edit ffmpeg command directly** to override the generated argv.
8. Click **Convert**.
9. Monitor the job in the **Jobs** pane and download the completed file from `output/`.

## What the app does for you

At startup, the backend runs a preflight pass that:

- checks that FFmpeg is runnable
- verifies the required encoders are available
- verifies both LUT files exist
- repairs a known DJI LUT header tab/space issue if necessary
- creates `input/` and `output/` if they do not already exist

During conversion, jobs are queued and processed sequentially. Progress is calculated from FFmpeg `-progress pipe:1` output, using `ffprobe` duration and frame metadata when available.

## Presets

Presets are stored in `presets.json` at the repository root.

There are two kinds of presets:

- **Built-in presets**: synthesized from the pipeline defaults; these cannot be edited or deleted
- **User presets**: saved, duplicated, updated, and deleted through the UI

The app also seeds a handful of user-editable preset variants the first time `presets.json` is created.

## Output naming

Generated files are written to `output/` using this pattern:

```text
<input-stem>__<pipeline>.mp4
```

If the filename already exists, the app appends `_1`, `_2`, and so on.

## Project layout

```text
app/
  backend/   FastAPI app, pipeline builders, preset store, jobs, progress parser
  frontend/  Single-page UI (HTML, CSS, vanilla JS)
docs/        Research notes and encoding references
ffmpeg/      Optional bundled FFmpeg distribution
input/       Source files watched by the UI
lut/         LUT files used by the pipelines
output/      Rendered exports
tests/       Unit tests for pipelines, presets, and progress parsing
presets.json User presets persisted on disk
```

## Useful environment variables

- `VIDEO_SARAYI_ROOT` — override the repository root used to resolve `input/`, `output/`, `lut/`, and `presets.json`
- `FFMPEG` — override the FFmpeg binary path
- `FFPROBE` — override the FFprobe binary path

## Development

Run the test suite:

```text
python -m pytest -q
```

The backend entry point is:

- `app.backend.main:app`

The frontend is served from:

- `app/frontend/`

## Troubleshooting

If the health indicators show a failure at startup:

- make sure `ffmpeg` and `ffprobe` are installed or bundled in `ffmpeg/bin/`
- make sure your FFmpeg build includes `libx265`, `libsvtav1`, and `libopus`
- make sure both LUT files exist in `lut/`
- set `FFMPEG` and `FFPROBE` if your binaries live somewhere custom
- set `VIDEO_SARAYI_ROOT` if you run the app from an unusual working directory

If files do not appear in the UI, check that they are placed directly inside `input/` and are not hidden dotfiles.
