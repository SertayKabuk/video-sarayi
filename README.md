# Video Sarayi

Video Sarayi is a local web UI for converting action-cam footage into social-media-ready master files with FFmpeg.

Supported cameras:

- Insta360 X5
- DJI Osmo Action 6

Output targets:

- Instagram Reel (1080×1920, HEVC / libx265)
- YouTube 4K (3840×2160, AV1 / libsvtav1)

The app runs entirely on your machine — no uploads, no cloud dependency.

## Workflow overview

### Before using this app

Do your creative work in the proprietary tools first, then drop the export here for final encoding.

**Insta360 X5 → Insta360 Studio**

1. Reframe the 360° footage: set perspective, yaw/pitch/FOV. This is only possible in Studio.
2. Enable FlowState stabilization.
3. Export with **I-Log color profile preserved** — do not apply the LUT or choose "Standard/Vivid". Video Sarayi applies the LUT during encoding; baking it twice destroys highlights.
4. Export codec: ProRes 422 HQ (Mac) or the Studio "High" H.264/H.265 export at maximum bitrate. Avoid social-media presets.
5. Export at the native stitched resolution (5.7K or 4K).

**DJI Osmo Action 6 → DaVinci Resolve**

1. Edit your timeline: cuts, sync to music, trimming.
2. Keep **D-LogM color profile** — do not apply the D-LogM → Rec.709 LUT in Resolve. Video Sarayi applies it. Applying it twice destroys contrast.
3. No color grading yet — leave the timeline in log.
4. Export codec depends on whether you use Gyroflow:
   - **Not using Gyroflow**: DNxHR HQ or ProRes 422 HQ — the file goes straight into FFmpeg with no intermediate re-encode, so lossless-ish quality matters.
   - **Using Gyroflow**: H.265 at the highest bitrate DaVinci allows (200 Mbps+). Gyroflow re-encodes the file anyway so ProRes is wasted — high-bitrate H.265 is just as clean after the intermediate step.
5. Export at native 4K, original frame rate.
6. Stabilization: use DaVinci's built-in stabilizer in Resolve, or leave it and enable Gyroflow in Video Sarayi — it uses embedded IMU data for smoother results.

### In this app

1. Paste an input file path into the UI, or click **Browse…** to pick one with a native file dialog.
2. Open `http://127.0.0.1:8000`.
3. Optionally set an explicit output file path, or leave it blank to auto-name inside `output/`.
4. Camera is detected automatically from the input filename (`DJI_*` → DJI Action 6, anything else → Insta360 X5).
5. Choose the target platform (Reel or YouTube).
6. Pick a preset, adjust parameters if needed.
7. Optionally enable **Edit ffmpeg command directly** to tweak the generated argv.
8. Click **Convert** and monitor the job in the Jobs pane.
9. Managed outputs saved inside `output/` can still be downloaded in-browser; custom output paths are shown directly in the Jobs pane.

## Pipelines

| Pipeline ID | Source | Target | Resolution | Encoder |
|-------------|--------|--------|------------|---------|
| `x5-reel` | Insta360 X5 | Instagram Reel | 1080×1920 | libx265 |
| `x5-yt` | Insta360 X5 | YouTube 4K | 3840×2160 | libsvtav1 |
| `a6-reel` | DJI Osmo Action 6 | Instagram Reel | 1080×1920 | libx265 |
| `a6-yt` | DJI Osmo Action 6 | YouTube 4K | native 4K | libsvtav1 |

## Requirements

- Python `>= 3.14`
- FFmpeg build with `libx265`, `libsvtav1`, `libopus` in `libs/`
- LUT files in `luts/`
- Gyroflow (optional — DJI stabilization only) in `libs/`

## Project layout

```
app/
  backend/               FastAPI app, pipeline builders, presets, job queue, progress parser
  frontend/              Single-page UI (HTML, CSS, vanilla JS)
input/                   Default local input folder (still available if you want to keep files near the repo)
libs/
  ffmpeg/                Bundled FFmpeg (bin/ffmpeg.exe, bin/ffprobe.exe)
  Gyroflow-windows64/    Bundled Gyroflow (Gyroflow.exe)
luts/                     LUT files used by the pipelines
output/                  Rendered exports land here
tests/                   Unit tests
presets.json             User presets (auto-created on first run)
run.bat                  Windows shortcut: starts server and opens browser
```

### LUT files

Both files must be present in `luts/` before starting the server:

```
luts/X5_I-Log_To_Rec.709_V1.0.cube
luts/DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube
```

## Quick start

### Using `uv` (recommended)

```
uv sync --extra dev
uv run uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
```

On Windows you can also run `run.bat`, which starts the server and opens the browser.

### Using pip

```
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux
pip install -e .[dev]
uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
```

## Binary resolution order

**FFmpeg / FFprobe** — checked in this order:

1. `FFMPEG` / `FFPROBE` environment variables
2. `libs/ffmpeg/bin/ffmpeg.exe` (bundled)
4. System `PATH`

**Gyroflow** — checked in this order:

1. `GYROFLOW` environment variable
2. `libs/Gyroflow-windows64/Gyroflow.exe` (bundled)
3. System `PATH`

If Gyroflow is not found, DJI stabilization is silently disabled — encoding still works.

## Startup health checks

At startup the backend checks:

- FFmpeg is runnable and has `libx265`, `libsvtav1`, `libopus`
- Both LUT files exist
- DJI LUT header tab/space bug is auto-repaired if present
- `input/` and `output/` directories exist (created if missing)
- Gyroflow binary is found (warning only if missing)

Health status is shown as pills in the top-right corner of the UI.

## Presets

Two kinds:

- **Built-in** — synthesized from pipeline defaults; read-only
- **User** — saved, duplicated, renamed, deleted through the UI; persisted in `presets.json`

A set of starter presets is seeded into `presets.json` on first run.

## Output naming

```
output/<input-stem>__<pipeline-id>.mp4
```

If the output path is left blank, Video Sarayi uses the pattern above. If the file already exists, `_1`, `_2`, etc. are appended.

## Development

```
uv run python -m pytest -q
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Health pill shows FFmpeg FAIL | Check `libs/ffmpeg/bin/` exists or set `FFMPEG` env var |
| Missing encoder error | Use a full FFmpeg build with libx265, libsvtav1, libopus |
| LUT check fails | Place both `.cube` files in `luts/` |
| Gyroflow not running | Place `Gyroflow.exe` in `libs/Gyroflow-windows64/` or set `GYROFLOW` env var |
| Native Browse dialog fails | Paste the full input/output path manually; file dialogs depend on the local Python GUI stack |
