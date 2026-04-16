"""JSON-backed named presets (pipeline + params bundle).

Built-in presets are synthesized from `pipelines.get_defaults` and can't be
edited or deleted; user presets live in `presets.json` at repo root.
"""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .pipelines import PIPELINES, PIPELINE_IDS, PipelineId, PipelineParams, get_defaults


@dataclass
class Preset:
    id: str
    name: str
    pipeline: PipelineId
    params: dict[str, Any]
    built_in: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_BUILTIN_NAMES: dict[str, str] = {
    "x5-reel": "Research defaults (slow, CRF 23, VBV 14 Mbps)",
    "x5-yt":   "Research defaults (preset 4, CRF 22)",
    "a6-reel": "Research defaults (slow, CRF 23, VBV 14 Mbps)",
    "a6-yt":   "Research defaults (preset 4, CRF 20)",
}


def _builtins() -> list[Preset]:
    out: list[Preset] = []
    for pid in PIPELINE_IDS:
        out.append(Preset(
            id=f"builtin:{pid}",
            name=_BUILTIN_NAMES.get(pid, "Research defaults"),
            pipeline=pid,
            params=get_defaults(pid).to_dict(),
            built_in=True,
        ))
    return out


# ---------------------------------------------------------------------------
# Seed presets — written to presets.json once on first run.
# Each entry is (name, pipeline_id, param overrides from the pipeline default).
# ---------------------------------------------------------------------------
_SEED: list[tuple[str, PipelineId, dict]] = [
    # Built-ins already cover the research defaults, so seeds are variants only.
    # ── X5 → Instagram Reel ──────────────────────────────────────────────
    ("X5 Reel · Fast preview (ultrafast, CRF 28)",  "x5-reel", {"x265_preset": "ultrafast", "x265_crf": 28}),
    ("X5 Reel · High quality (slower, CRF 20)",     "x5-reel", {"x265_preset": "slower",    "x265_crf": 20}),
    # ── X5 → YouTube 4K ─────────────────────────────────────────────────
    ("X5 YouTube · Fast preview (preset 8, CRF 28)", "x5-yt",  {"av1_preset": 8, "av1_crf": 28}),
    ("X5 YouTube · High quality (preset 2, CRF 18)", "x5-yt",  {"av1_preset": 2, "av1_crf": 18}),
    # ── Action 6 → Instagram Reel ────────────────────────────────────────
    ("A6 Reel · Fast preview (ultrafast, CRF 28)",   "a6-reel", {"x265_preset": "ultrafast", "x265_crf": 28}),
    ("A6 Reel · High quality (slower, CRF 20)",      "a6-reel", {"x265_preset": "slower",    "x265_crf": 20}),
    # ── Action 6 → YouTube 4K ────────────────────────────────────────────
    ("A6 YouTube · Fast preview (preset 8, CRF 28)", "a6-yt",   {"av1_preset": 8, "av1_crf": 28}),
    ("A6 YouTube · High quality (preset 2, CRF 16)", "a6-yt",   {"av1_preset": 2, "av1_crf": 16}),
    # Square-sensor mode: crop 3840×3840 → 16:9 before encode.
    ("A6 YouTube · Square sensor (crop to 16:9)",     "a6-yt",   {"crop_enabled": True, "crop_expr": "iw:iw*(9/16)"}),
]


def _make_seed_presets() -> list[Preset]:
    out: list[Preset] = []
    for i, (name, pid, overrides) in enumerate(_SEED):
        params = get_defaults(pid).merge(overrides).to_dict()
        # Use a stable deterministic ID so re-seeding is idempotent.
        out.append(Preset(
            id=f"seed:{i:02d}:{pid}",
            name=name,
            pipeline=pid,
            params=params,
            built_in=False,
        ))
    return out


class PresetStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.RLock()
        self._user: dict[str, Preset] = {}
        self._order: list[str] = []
        self._load()

    # -- persistence ---------------------------------------------------------

    def _load(self) -> None:
        if not self.path.exists():
            # First run: seed and persist.
            for p in _make_seed_presets():
                self._user[p.id] = p
                self._order.append(p.id)
            self._save()
            return
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        items = raw.get("presets", []) if isinstance(raw, dict) else []
        for item in items:
            try:
                p = Preset(
                    id=str(item["id"]),
                    name=str(item["name"]),
                    pipeline=item["pipeline"],
                    params=dict(item.get("params", {})),
                    built_in=False,
                )
            except (KeyError, TypeError, ValueError):
                continue
            if p.pipeline not in PIPELINE_IDS:
                continue
            self._user[p.id] = p
            self._order.append(p.id)

    def _save(self) -> None:
        data = {
            "version": 1,
            "presets": [self._user[pid].to_dict() for pid in self._order if pid in self._user],
        }
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    # -- public API ----------------------------------------------------------

    def list_all(self) -> list[Preset]:
        with self._lock:
            user = [self._user[pid] for pid in self._order if pid in self._user]
        return _builtins() + user

    def get(self, preset_id: str) -> Preset | None:
        if preset_id.startswith("builtin:"):
            for p in _builtins():
                if p.id == preset_id:
                    return p
            return None
        with self._lock:
            return self._user.get(preset_id)

    def create(self, name: str, pipeline: PipelineId, params: dict[str, Any]) -> Preset:
        if pipeline not in PIPELINE_IDS:
            raise ValueError(f"unknown pipeline: {pipeline}")
        preset = Preset(
            id=uuid.uuid4().hex[:12],
            name=name.strip() or "Untitled",
            pipeline=pipeline,
            params=dict(params),
            built_in=False,
        )
        with self._lock:
            self._user[preset.id] = preset
            self._order.append(preset.id)
            self._save()
        return preset

    def update(self, preset_id: str, *, name: str | None = None, params: dict[str, Any] | None = None) -> Preset:
        with self._lock:
            existing = self._user.get(preset_id)
            if not existing:
                raise KeyError(preset_id)
            updated = Preset(
                id=existing.id,
                name=(name.strip() if name else existing.name) or existing.name,
                pipeline=existing.pipeline,
                params=dict(params) if params is not None else existing.params,
                built_in=False,
            )
            self._user[preset_id] = updated
            self._save()
        return updated

    def duplicate(self, preset_id: str, new_name: str | None = None) -> Preset:
        src = self.get(preset_id)
        if not src:
            raise KeyError(preset_id)
        name = (new_name or f"{src.name} (copy)").strip() or "Untitled"
        return self.create(name=name, pipeline=src.pipeline, params=src.params)

    def delete(self, preset_id: str) -> None:
        with self._lock:
            if preset_id.startswith("builtin:"):
                raise PermissionError("cannot delete built-in preset")
            if preset_id not in self._user:
                raise KeyError(preset_id)
            del self._user[preset_id]
            self._order = [pid for pid in self._order if pid != preset_id]
            self._save()
