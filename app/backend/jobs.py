"""Sequential FFmpeg job queue with live progress broadcasting."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from . import config as cfg
from .pathing import output_url_for_path
from .pipelines import (
    BuildContext,
    PIPELINE_IDS,
    PipelineParams,
    build,
    get_defaults,
    resolve_output_path,
)
from .progress import ProgressParser


log = logging.getLogger(__name__)

STDERR_TAIL = 250


class Status(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass
class Job:
    id: str
    input_path: Path
    output_path: Path
    output_url: str | None
    pipeline: str
    params: dict[str, Any]
    argv_override: list[str] | None = None
    argv: list[str] = field(default_factory=list)
    status: Status = Status.QUEUED
    percent: float | None = None
    frame: int | None = None
    fps: float | None = None
    speed: str | None = None
    duration_s: float | None = None
    total_frames: int | None = None
    error: str | None = None
    stderr_tail: list[str] = field(default_factory=list)
    # Test-render window — when set, the encoder seeks to start_s and caps
    # output to test_duration_s. Independent from `duration_s` (which is the
    # probed source duration used for percent-progress math).
    start_s: float | None = None
    test_duration_s: float | None = None
    # Multi-input jobs (concat/join) carry the full ordered list here;
    # `input_path` is the first entry for display compatibility.
    input_paths: list[Path] | None = None
    # Files to remove after the worker finishes (e.g. concat list files).
    cleanup_paths: list[Path] = field(default_factory=list)

    def serialize(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "input": self.input_path.name,
            "input_path": str(self.input_path),
            "input_paths": [str(p) for p in self.input_paths] if self.input_paths else None,
            "output": self.output_path.name,
            "output_path": str(self.output_path),
            "output_url": self.output_url,
            "pipeline": self.pipeline,
            "params": self.params,
            "argv_override": self.argv_override,
            "status": self.status.value,
            "percent": self.percent,
            "frame": self.frame,
            "fps": self.fps,
            "speed": self.speed,
            "duration_s": self.duration_s,
            "error": self.error,
            "start_s": self.start_s,
            "test_duration_s": self.test_duration_s,
        }


class _JobState:
    def __init__(self, job: Job) -> None:
        self.job = job
        self.subs: list[asyncio.Queue[dict[str, Any]]] = []
        self.proc: asyncio.subprocess.Process | None = None
        self.cancel_requested = False

    def publish(self, event: dict[str, Any]) -> None:
        for q in list(self.subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # subscriber is lagging — drop oldest to keep latest flowing
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        self.subs.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        try:
            self.subs.remove(q)
        except ValueError:
            pass


class JobManager:
    def __init__(self, config: cfg.Config) -> None:
        self.config = config
        self.states: dict[str, _JobState] = {}
        self.order: list[str] = []
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

    # -- lifecycle -----------------------------------------------------------

    def start(self) -> None:
        if self._worker_task is None:
            self._worker_task = asyncio.create_task(self._worker())

    async def stop(self) -> None:
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except (asyncio.CancelledError, Exception):
                pass
            self._worker_task = None

    # -- submission ----------------------------------------------------------

    def submit(
        self,
        input_path: Path | list[Path],
        pipeline: str,
        params: dict[str, Any] | None = None,
        argv_override: list[str] | None = None,
        *,
        output_path: Path | None = None,
        start_s: float | None = None,
        test_duration_s: float | None = None,
        cleanup_paths: list[Path] | None = None,
    ) -> Job:
        """Submit a job. Accepts a single input or an ordered list (concat).
        For known pipeline ids, params overlay the pipeline defaults and the
        argv is built lazily by the worker; for non-pipeline kinds (e.g.
        "join", "rotate") an argv_override and explicit output_path are
        required."""
        if isinstance(input_path, list):
            if not input_path:
                raise ValueError("input_path list must not be empty")
            resolved = [p.expanduser().resolve() for p in input_path]
        else:
            resolved = [input_path.expanduser().resolve()]
        for p in resolved:
            if not p.exists() or not p.is_file():
                raise FileNotFoundError(str(p))
        primary = resolved[0]

        is_pipeline = pipeline in PIPELINE_IDS
        if output_path is not None:
            output_path = output_path.expanduser().resolve()
        elif is_pipeline:
            output_path = resolve_output_path(
                self.config.output_dir, primary, pipeline,  # type: ignore[arg-type]
            ).resolve()
        else:
            raise ValueError(f"output_path is required for non-pipeline jobs ({pipeline})")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if is_pipeline:
            merged = get_defaults(pipeline).merge(params).to_dict()  # type: ignore[arg-type]
        else:
            if not argv_override:
                raise ValueError(f"argv_override is required for non-pipeline jobs ({pipeline})")
            merged = dict(params) if params else {}

        job = Job(
            id=uuid.uuid4().hex[:12],
            input_path=primary,
            output_path=output_path,
            output_url=output_url_for_path(self.config, output_path),
            pipeline=pipeline,
            params=merged,
            argv_override=list(argv_override) if argv_override else None,
            input_paths=resolved if len(resolved) > 1 else None,
            cleanup_paths=list(cleanup_paths) if cleanup_paths else [],
            start_s=start_s,
            test_duration_s=test_duration_s,
        )
        state = _JobState(job)
        self.states[job.id] = state
        self.order.append(job.id)
        self.queue.put_nowait(job.id)
        return job

    def get(self, job_id: str) -> _JobState | None:
        return self.states.get(job_id)

    def list_jobs(self) -> list[Job]:
        return [self.states[jid].job for jid in self.order if jid in self.states]

    # -- cancel --------------------------------------------------------------

    async def cancel(self, job_id: str) -> bool:
        state = self.states.get(job_id)
        if state is None:
            return False
        state.cancel_requested = True
        job = state.job
        if job.status == Status.QUEUED:
            job.status = Status.CANCELED
            state.publish({"type": "status", "job": job.serialize()})
            return True
        if job.status == Status.RUNNING and state.proc and state.proc.returncode is None:
            try:
                state.proc.terminate()
            except ProcessLookupError:
                pass
            return True
        return False

    # -- worker --------------------------------------------------------------

    async def _worker(self) -> None:
        while True:
            try:
                job_id = await self.queue.get()
            except asyncio.CancelledError:
                break
            state = self.states.get(job_id)
            if state is None:
                self.queue.task_done()
                continue
            if state.cancel_requested:
                self.queue.task_done()
                continue
            try:
                await self._run_job(state)
            except Exception:
                log.exception("worker crashed on job %s", job_id)
                state.job.status = Status.FAILED
                if not state.job.error:
                    state.job.error = "worker exception (see server log)"
                state.publish({"type": "status", "job": state.job.serialize()})
            finally:
                self.queue.task_done()

    async def _probe_duration(self, path: Path) -> float | None:
        try:
            proc = await asyncio.create_subprocess_exec(
                self.config.ffprobe,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=nokey=1:noprint_wrappers=1",
                str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            return None
        out, _err = await proc.communicate()
        try:
            return float(out.decode().strip())
        except (ValueError, UnicodeDecodeError):
            return None

    async def _probe_total_frames(self, path: Path, duration_s: float | None) -> int | None:
        try:
            proc = await asyncio.create_subprocess_exec(
                self.config.ffprobe,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=nb_frames,avg_frame_rate",
                "-of", "json",
                str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            return None
        out, _err = await proc.communicate()
        try:
            payload = json.loads(out.decode())
        except (ValueError, UnicodeDecodeError):
            return None

        streams = payload.get("streams") or []
        if not streams:
            return None
        stream = streams[0]

        nb_frames = stream.get("nb_frames")
        if isinstance(nb_frames, str) and nb_frames.isdigit():
            value = int(nb_frames)
            if value > 0:
                return value

        avg_frame_rate = stream.get("avg_frame_rate")
        fps = _parse_ratio(avg_frame_rate) if isinstance(avg_frame_rate, str) else None
        if duration_s and fps and fps > 0:
            return max(1, round(duration_s * fps))
        return None

    async def _run_gyroflow(
        self, state: _JobState, input_path: Path, smoothness: float
    ) -> Path | None:
        """Run Gyroflow stabilization; returns temp output path or None on failure."""
        gf = self.config.gyroflow
        if not gf:
            state.publish({"type": "log", "line": "[gyroflow] not installed — skipping stabilization"})
            return None

        job = state.job
        tmp_suffix = f"_gftmp_{job.id[:8]}"
        tmp_path = input_path.parent / f"{input_path.stem}{tmp_suffix}{input_path.suffix}"
        _safe_unlink(tmp_path)

        gf_argv = [gf, str(input_path), "-t", tmp_suffix, "-f",
                   "-p", f"{{'smoothness': {smoothness}, 'codec': 'H.265/HEVC', 'use_gpu': true, 'bitrate': 300}}"]
        state.publish({"type": "log", "line": f"[gyroflow] stabilizing (smoothness={smoothness})…"})

        try:
            proc = await asyncio.create_subprocess_exec(
                *gf_argv,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            state.proc = proc
            _out, err = await proc.communicate()
            for line in err.decode("utf-8", errors="replace").splitlines():
                if line.strip():
                    state.publish({"type": "log", "line": f"[gyroflow] {line}"})
            if proc.returncode != 0 or not tmp_path.exists():
                state.publish({"type": "log", "line": "[gyroflow] failed — encoding original file"})
                _safe_unlink(tmp_path)
                return None
            state.publish({"type": "log", "line": f"[gyroflow] done → {tmp_path.name}"})
            return tmp_path
        except FileNotFoundError:
            state.publish({"type": "log", "line": "[gyroflow] binary not found — skipping"})
            return None

    async def _run_job(self, state: _JobState) -> None:
        job = state.job
        if job.input_paths and len(job.input_paths) > 1:
            # For multi-input jobs (concat), sum component durations so the
            # progress percent reflects the joined output's runtime.
            durations = [await self._probe_duration(p) for p in job.input_paths]
            if all(d is not None for d in durations):
                job.duration_s = sum(durations)  # type: ignore[arg-type]
            job.total_frames = None
        else:
            job.duration_s = await self._probe_duration(job.input_path)
            job.total_frames = await self._probe_total_frames(job.input_path, job.duration_s)

        gyroflow_tmp: Path | None = None
        ffmpeg_input = job.input_path

        if not job.argv_override:
            params = PipelineParams.from_dict(job.params)

            if params.gyroflow_enabled and job.pipeline.startswith("a6"):
                job.status = Status.RUNNING
                state.publish({"type": "status", "job": job.serialize()})
                gyroflow_tmp = await self._run_gyroflow(state, job.input_path, params.gyroflow_smoothness)
                if gyroflow_tmp:
                    ffmpeg_input = gyroflow_tmp
                    job.duration_s = await self._probe_duration(ffmpeg_input) or job.duration_s
                    job.total_frames = await self._probe_total_frames(ffmpeg_input, job.duration_s) or job.total_frames

            ctx = BuildContext(
                input_path=ffmpeg_input,
                output_path=job.output_path,
                x5_lut=self.config.x5_lut,
                dji_lut=self.config.dji_lut,
                ffmpeg=self.config.ffmpeg,
                start_s=job.start_s,
                duration_s=job.test_duration_s,
            )
            job.argv = build(job.pipeline, params, ctx)
            if job.test_duration_s is not None:
                # Progress math should match the windowed encode, not the source clip.
                job.duration_s = job.test_duration_s
                job.total_frames = None
        else:
            job.argv = list(job.argv_override)

        job.status = Status.RUNNING
        state.publish({"type": "status", "job": job.serialize()})

        proc = await asyncio.create_subprocess_exec(
            *job.argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        state.proc = proc

        stdout_task = asyncio.create_task(self._pump_stdout(state))
        stderr_task = asyncio.create_task(self._pump_stderr(state))

        rc = await proc.wait()
        await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)

        if gyroflow_tmp:
            _safe_unlink(gyroflow_tmp)
        for tmp in job.cleanup_paths:
            _safe_unlink(tmp)

        if state.cancel_requested:
            job.status = Status.CANCELED
            _safe_unlink(job.output_path)
        elif rc == 0:
            job.status = Status.DONE
            job.percent = 100.0
        else:
            job.status = Status.FAILED
            job.error = f"ffmpeg exited with code {rc}"
            _safe_unlink(job.output_path)

        state.publish({"type": "status", "job": job.serialize()})

    async def _pump_stdout(self, state: _JobState) -> None:
        job = state.job
        assert state.proc and state.proc.stdout
        parser = ProgressParser()
        async for raw in state.proc.stdout:
            line = raw.decode("utf-8", errors="replace")
            event = parser.feed(line)
            if event is None:
                continue
            if event.frame is not None:
                job.frame = event.frame
            pct = event.percent(job.duration_s, job.total_frames)
            if pct is not None:
                job.percent = pct
            if event.fps is not None:
                job.fps = event.fps
            if event.speed is not None:
                job.speed = event.speed
            state.publish({
                "type": "progress",
                "percent": job.percent,
                "frame": job.frame,
                "fps": job.fps,
                "speed": job.speed,
            })

    async def _pump_stderr(self, state: _JobState) -> None:
        job = state.job
        assert state.proc and state.proc.stderr
        async for raw in state.proc.stderr:
            text = raw.decode("utf-8", errors="replace").rstrip()
            if not text:
                continue
            job.stderr_tail.append(text)
            if len(job.stderr_tail) > STDERR_TAIL:
                del job.stderr_tail[: len(job.stderr_tail) - STDERR_TAIL]
            state.publish({"type": "log", "line": text})


def _safe_unlink(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except OSError:
        pass


def _parse_ratio(value: str) -> float | None:
    try:
        num_s, den_s = value.split("/", 1)
        num = float(num_s)
        den = float(den_s)
    except (AttributeError, ValueError):
        return None
    if den == 0:
        return None
    return num / den
