"""FastAPI app wiring: routes, WebSocket, static frontend."""

from __future__ import annotations

import asyncio
import logging
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config as cfg
from . import preflight
from .jobs import JobManager, Status
from .pathing import output_url_for_path, resolve_input_path, resolve_requested_output_path
from .pipelines import (
    BuildContext,
    PIPELINES,
    PIPELINE_IDS,
    PipelineId,
    PipelineParams,
    build,
    encoder_family,
    get_defaults,
    uses_crop,
    uses_v360,
    uses_x5_lut,
)
from .presets import PresetStore


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("video-sarayi")


FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "output"
PRESETS_PATH = Path(__file__).resolve().parents[2] / "presets.json"
VALID_PIPELINES = set(PIPELINES.keys())


class PreviewIn(BaseModel):
    file: str | None = None
    input_path: str | None = None
    output_path: str | None = None
    pipeline: str
    params: dict[str, Any] | None = None


class JobIn(BaseModel):
    file: str | None = None
    input_path: str | None = None
    output_path: str | None = None
    pipeline: str
    params: dict[str, Any] | None = None
    argv_override: list[str] | None = None


class OutputDialogIn(BaseModel):
    suggested_path: str | None = None


class PresetCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    pipeline: str
    params: dict[str, Any] = Field(default_factory=dict)
    description: str = Field(default="", max_length=500)


class PresetUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    params: dict[str, Any] | None = None
    description: str | None = Field(default=None, max_length=500)


class PresetDuplicateIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = cfg.load()
    checks = preflight.run_all(config)
    for ch in checks:
        (log.info if ch.ok else log.warning)(
            "preflight %s: %s -- %s",
            "OK" if ch.ok else "FAIL", ch.name, ch.detail,
        )
    manager = JobManager(config)
    manager.start()
    app.state.config = config
    app.state.manager = manager
    app.state.checks = checks
    app.state.presets = PresetStore(PRESETS_PATH)
    try:
        yield
    finally:
        await manager.stop()


app = FastAPI(title="Video Sarayi", lifespan=lifespan)

app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")



@app.get("/", include_in_schema=False)
async def root() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
async def health() -> dict:
    checks = app.state.checks
    return {
        "ok": all(c.ok for c in checks),
        "checks": [{"name": c.name, "ok": c.ok, "detail": c.detail} for c in checks],
    }


def _validate_pipeline(p: str) -> PipelineId:
    if p not in VALID_PIPELINES:
        raise HTTPException(400, f"unknown pipeline: {p}")
    return p  # type: ignore[return-value]


@app.get("/api/pipelines")
async def list_pipelines() -> dict:
    items = []
    for pid in PIPELINE_IDS:
        items.append({
            "id": pid,
            "label": PIPELINES[pid],
            "defaults": get_defaults(pid).to_dict(),
            "traits": {
                "encoder": encoder_family(pid),
                "uses_v360": uses_v360(pid),
                "uses_crop": uses_crop(pid),
                "lut": "x5" if uses_x5_lut(pid) else "dji",
            },
        })
    return {"pipelines": items}


@app.get("/api/inputs")
async def list_inputs() -> dict:
    config: cfg.Config = app.state.config
    files = []
    if config.input_dir.exists():
        for p in sorted(config.input_dir.iterdir(), key=lambda x: x.name.lower()):
            if p.is_file() and not p.name.startswith("."):
                files.append({"name": p.name, "size": p.stat().st_size})
    return {"files": files}


def _preview_argv(
    file: str | None,
    input_path: str | None,
    output_path: str | None,
    pipeline: PipelineId,
    params_in: dict[str, Any] | None,
) -> tuple[list[str], Path, Path]:
    config: cfg.Config = app.state.config
    resolved_input = resolve_input_path(
        config,
        file_name=file,
        input_path=input_path,
        strict=False,
    )
    resolved_output = resolve_requested_output_path(
        config,
        pipeline=pipeline,
        input_path=resolved_input,
        output_path=output_path,
        create_parent=False,
    )
    params = get_defaults(pipeline).merge(params_in)
    ctx = BuildContext(
        input_path=resolved_input,
        output_path=resolved_output,
        x5_lut=config.x5_lut,
        dji_lut=config.dji_lut,
        ffmpeg=config.ffmpeg,
    )
    argv = build(pipeline, params, ctx)
    return argv, resolved_input, resolved_output


def _nearest_existing_dir(path: Path | None) -> str | None:
    if path is None:
        return None
    candidate = path if path.exists() and path.is_dir() else path.parent
    while True:
        if candidate.exists() and candidate.is_dir():
            return str(candidate)
        if candidate == candidate.parent:
            return None
        candidate = candidate.parent


def _run_dialog_macos(kind: Literal["input", "output"], suggested_path: str | None, default_dir: Path) -> str | None:
    # macOS: Tk requires the main thread (Cocoa), which the server worker can't
    # provide. Shell out to AppleScript instead — it spawns its own process.
    suggested = Path(suggested_path) if suggested_path else None
    initialdir = _nearest_existing_dir(suggested) or str(default_dir)
    initialdir_esc = initialdir.replace("\\", "\\\\").replace('"', '\\"')

    if kind == "input":
        script = (
            f'set theFile to choose file with prompt "Select input video" '
            f'default location (POSIX file "{initialdir_esc}")\n'
            f'return POSIX path of theFile'
        )
    else:
        initialfile = ""
        if suggested and suggested.name and not (suggested.exists() and suggested.is_dir()):
            initialfile = suggested.name.replace("\\", "\\\\").replace('"', '\\"')
        name_clause = f' default name "{initialfile}"' if initialfile else ""
        script = (
            f'set theFile to choose file name with prompt "Choose output file"'
            f'{name_clause} default location (POSIX file "{initialdir_esc}")\n'
            f'return POSIX path of theFile'
        )

    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        # User cancel → osascript exits non-zero with "User canceled." (code -128).
        if "User canceled" in result.stderr or "-128" in result.stderr:
            return None
        raise RuntimeError(result.stderr.strip() or "file dialog failed")
    path = result.stdout.strip()
    return path or None


def _run_dialog(kind: Literal["input", "output"], suggested_path: str | None, default_dir: Path) -> str | None:
    if sys.platform == "darwin":
        return _run_dialog_macos(kind, suggested_path, default_dir)
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as exc:
        raise RuntimeError("native file dialogs are unavailable in this Python environment") from exc

    suggested = Path(suggested_path) if suggested_path else None
    initialdir = _nearest_existing_dir(suggested) or str(default_dir)
    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        try:
            root.attributes("-topmost", True)
        except Exception:
            pass
        try:
            root.update()
        except Exception:
            pass

        if kind == "input":
            return filedialog.askopenfilename(
                title="Select input video",
                initialdir=initialdir,
                filetypes=[
                    ("Video files", "*.mp4 *.mov *.mkv *.avi *.insv *.webm *.m4v *.ts *.mxf"),
                    ("All files", "*.*"),
                ],
            ) or None

        initialfile = None
        if suggested and suggested.name and not (suggested.exists() and suggested.is_dir()):
            initialfile = suggested.name
        return filedialog.asksaveasfilename(
            title="Choose output file",
            initialdir=initialdir,
            initialfile=initialfile,
            defaultextension=".mp4",
            filetypes=[
                ("MP4 video", "*.mp4"),
                ("MOV video", "*.mov"),
                ("Matroska video", "*.mkv"),
                ("All files", "*.*"),
            ],
        ) or None
    finally:
        if root is not None:
            try:
                root.destroy()
            except Exception:
                pass


@app.post("/api/preview")
async def preview(body: PreviewIn) -> dict:
    pid = _validate_pipeline(body.pipeline)
    config: cfg.Config = app.state.config
    argv, input_path, output_path = _preview_argv(
        body.file,
        body.input_path,
        body.output_path,
        pid,
        body.params,
    )
    merged = get_defaults(pid).merge(body.params).to_dict()
    return {
        "argv": argv,
        "output": output_path.name,
        "output_path": str(output_path),
        "output_url": output_url_for_path(config, output_path),
        "input_path": str(input_path),
        "merged_params": merged,
    }


@app.post("/api/jobs")
async def create_job(body: JobIn) -> dict:
    pid = _validate_pipeline(body.pipeline)
    config: cfg.Config = app.state.config
    if not (body.file and body.file.strip()) and not (body.input_path and body.input_path.strip()):
        raise HTTPException(400, "input file path is required")
    # When argv_override is set, params are ignored but must still be stored
    # for the job record (so the UI can show what was originally chosen).
    manager: JobManager = app.state.manager
    try:
        resolved_input = resolve_input_path(
            config,
            file_name=body.file,
            input_path=body.input_path,
            strict=True,
        )
        resolved_output = resolve_requested_output_path(
            config,
            pipeline=pid,
            input_path=resolved_input,
            output_path=body.output_path,
            create_parent=True,
        )
        job = manager.submit(
            resolved_input,
            pid,
            body.params,
            body.argv_override,
            output_path=resolved_output,
        )
    except FileNotFoundError:
        missing = body.input_path or body.file or "input file"
        raise HTTPException(404, f"input file not found: {missing}")
    except OSError as exc:
        raise HTTPException(400, f"output path is not usable: {exc}")
    return job.serialize()


@app.post("/api/dialogs/input")
async def pick_input_dialog() -> dict:
    config: cfg.Config = app.state.config
    try:
        path = await asyncio.to_thread(_run_dialog, "input", None, config.input_dir)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    return {"path": path}


@app.post("/api/dialogs/output")
async def pick_output_dialog(body: OutputDialogIn | None = None) -> dict:
    config: cfg.Config = app.state.config
    try:
        path = await asyncio.to_thread(
            _run_dialog,
            "output",
            body.suggested_path if body else None,
            config.output_dir,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    return {"path": path}


@app.get("/api/jobs")
async def list_jobs() -> dict:
    manager: JobManager = app.state.manager
    return {"jobs": [j.serialize() for j in manager.list_jobs()]}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    manager: JobManager = app.state.manager
    state = manager.get(job_id)
    if not state:
        raise HTTPException(404, "no such job")
    data = state.job.serialize()
    data["argv"] = state.job.argv
    data["stderr_tail"] = state.job.stderr_tail[-100:]
    return data


@app.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str) -> dict:
    manager: JobManager = app.state.manager
    ok = await manager.cancel(job_id)
    if not ok:
        raise HTTPException(409, "job is not cancelable in its current state")
    return {"ok": True}


@app.websocket("/api/jobs/{job_id}/events")
async def job_events(ws: WebSocket, job_id: str) -> None:
    manager: JobManager = app.state.manager
    state = manager.get(job_id)
    if state is None:
        await ws.close(code=4004)
        return
    await ws.accept()
    q = state.subscribe()
    try:
        await ws.send_json({"type": "status", "job": state.job.serialize()})
        if state.job.stderr_tail:
            for line in state.job.stderr_tail[-50:]:
                await ws.send_json({"type": "log", "line": line})
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=1.0)
                await ws.send_json(event)
            except asyncio.TimeoutError:
                if state.job.status in (Status.DONE, Status.FAILED, Status.CANCELED):
                    while not q.empty():
                        await ws.send_json(q.get_nowait())
                    break
    except WebSocketDisconnect:
        pass
    finally:
        state.unsubscribe(q)
        try:
            await ws.close()
        except Exception:
            pass


# -- presets -----------------------------------------------------------------

@app.get("/api/presets")
async def presets_list() -> dict:
    store: PresetStore = app.state.presets
    return {"presets": [p.to_dict() for p in store.list_all()]}


@app.post("/api/presets")
async def presets_create(body: PresetCreateIn) -> dict:
    pid = _validate_pipeline(body.pipeline)
    store: PresetStore = app.state.presets
    preset = store.create(
        name=body.name, pipeline=pid, params=body.params, description=body.description,
    )
    return preset.to_dict()


@app.patch("/api/presets/{preset_id}")
async def presets_update(preset_id: str, body: PresetUpdateIn) -> dict:
    store: PresetStore = app.state.presets
    if preset_id.startswith("builtin:"):
        raise HTTPException(403, "cannot modify built-in preset")
    try:
        preset = store.update(
            preset_id, name=body.name, params=body.params, description=body.description,
        )
    except KeyError:
        raise HTTPException(404, "no such preset")
    return preset.to_dict()


@app.post("/api/presets/{preset_id}/duplicate")
async def presets_duplicate(preset_id: str, body: PresetDuplicateIn | None = None) -> dict:
    store: PresetStore = app.state.presets
    try:
        preset = store.duplicate(preset_id, new_name=(body.name if body else None))
    except KeyError:
        raise HTTPException(404, "no such preset")
    return preset.to_dict()


@app.delete("/api/presets/{preset_id}")
async def presets_delete(preset_id: str) -> dict:
    store: PresetStore = app.state.presets
    try:
        store.delete(preset_id)
    except PermissionError:
        raise HTTPException(403, "cannot delete built-in preset")
    except KeyError:
        raise HTTPException(404, "no such preset")
    return {"ok": True}


@app.exception_handler(HTTPException)
async def _http_exc(request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
