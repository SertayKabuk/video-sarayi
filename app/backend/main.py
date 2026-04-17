"""FastAPI app wiring: routes, WebSocket, static frontend."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config as cfg
from . import preflight
from .jobs import JobManager, Status
from .pipelines import (
    BuildContext,
    PIPELINES,
    PIPELINE_IDS,
    PipelineId,
    PipelineParams,
    build,
    encoder_family,
    get_defaults,
    resolve_output_path,
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
    pipeline: str
    params: dict[str, Any] | None = None


class JobIn(BaseModel):
    file: str
    pipeline: str
    params: dict[str, Any] | None = None
    argv_override: list[str] | None = None


class PresetCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    pipeline: str
    params: dict[str, Any] = Field(default_factory=dict)


class PresetUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    params: dict[str, Any] | None = None


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


def _preview_argv(file: str | None, pipeline: PipelineId, params_in: dict[str, Any] | None) -> tuple[list[str], Path]:
    config: cfg.Config = app.state.config
    input_path = config.input_dir / (file or "INPUT_FILENAME.mp4")
    output_path = (
        resolve_output_path(config.output_dir, input_path, pipeline)
        if file
        else config.output_dir / f"INPUT_FILENAME__{pipeline}.mp4"
    )
    params = get_defaults(pipeline).merge(params_in)
    ctx = BuildContext(
        input_path=input_path,
        output_path=output_path,
        x5_lut=config.x5_lut,
        dji_lut=config.dji_lut,
        ffmpeg=config.ffmpeg,
    )
    argv = build(pipeline, params, ctx)
    return argv, output_path


@app.post("/api/preview")
async def preview(body: PreviewIn) -> dict:
    pid = _validate_pipeline(body.pipeline)
    argv, output_path = _preview_argv(body.file, pid, body.params)
    merged = get_defaults(pid).merge(body.params).to_dict()
    return {
        "argv": argv,
        "output": output_path.name,
        "output_path": str(output_path),
        "merged_params": merged,
    }


@app.post("/api/jobs")
async def create_job(body: JobIn) -> dict:
    pid = _validate_pipeline(body.pipeline)
    # When argv_override is set, params are ignored but must still be stored
    # for the job record (so the UI can show what was originally chosen).
    manager: JobManager = app.state.manager
    try:
        job = manager.submit(body.file, pid, body.params, body.argv_override)
    except FileNotFoundError:
        raise HTTPException(404, f"input file not found: {body.file}")
    return job.serialize()


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
    preset = store.create(name=body.name, pipeline=pid, params=body.params)
    return preset.to_dict()


@app.patch("/api/presets/{preset_id}")
async def presets_update(preset_id: str, body: PresetUpdateIn) -> dict:
    store: PresetStore = app.state.presets
    if preset_id.startswith("builtin:"):
        raise HTTPException(403, "cannot modify built-in preset")
    try:
        preset = store.update(preset_id, name=body.name, params=body.params)
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
