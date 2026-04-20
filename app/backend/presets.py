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
    description: str = ""
    built_in: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_BUILTIN_NAMES: dict[str, str] = {
    "x5-reel": "Research defaults (slow, CRF 23, VBV 14 Mbps)",
    "x5-yt":   "Research defaults (preset 4, CRF 22)",
    "a6-reel": "Research defaults (slow, CRF 23, VBV 14 Mbps)",
    "a6-yt":   "Research defaults (preset 4, CRF 20)",
}

_BUILTIN_DESCRIPTIONS: dict[str, str] = {
    "x5-reel": "Research-doc defaults for 360→9:16 Reel. v360 reframe, I-Log→Rec.709 LUT, x265 main10, VBV 14 Mbps cap. Safe starting point.",
    "x5-yt":   "Research-doc defaults for 360→4K YouTube. v360 reframe, I-Log→Rec.709 LUT, SVT-AV1 preset 4, CRF 22. Safe starting point.",
    "a6-reel": "Research-doc defaults for Action 6 → 9:16 Reel. Center-crop 9:16, D-LogM→Rec.709 LUT, x265 main10, VBV 14 Mbps cap.",
    "a6-yt":   "Research-doc defaults for Action 6 → 4K YouTube. Native resolution passthrough, D-LogM→Rec.709 LUT, SVT-AV1 preset 4, CRF 20.",
}


def _builtins() -> list[Preset]:
    out: list[Preset] = []
    for pid in PIPELINE_IDS:
        out.append(Preset(
            id=f"builtin:{pid}",
            name=_BUILTIN_NAMES.get(pid, "Research defaults"),
            pipeline=pid,
            params=get_defaults(pid).to_dict(),
            description=_BUILTIN_DESCRIPTIONS.get(pid, ""),
            built_in=True,
        ))
    return out


# ---------------------------------------------------------------------------
# Seed presets — written to presets.json once on first run.
# Each entry is (name, pipeline_id, overrides, description).
# ---------------------------------------------------------------------------
_SEED: list[tuple[str, PipelineId, dict, str]] = [
    # ── X5 → Instagram Reel ──────────────────────────────────────────────
    ("X5 Reel · Fast preview (ultrafast, CRF 28)",  "x5-reel", {"x265_preset": "ultrafast", "x265_crf": 28},
     "Quick preview render. x265 ultrafast + CRF 28 = seconds-per-minute speed, lower quality. Use to check framing/LUT before committing to a slow encode."),
    ("X5 Reel · High quality (slower, CRF 20)",     "x5-reel", {"x265_preset": "slower",    "x265_crf": 20},
     "Higher quality than research default. Slower preset packs more detail per bit within the 14 Mbps VBV cap. ~2× encode time vs default."),
    # ── X5 → YouTube 4K ─────────────────────────────────────────────────
    ("X5 YouTube · Fast preview (preset 8, CRF 28)", "x5-yt",  {"av1_preset": 8, "av1_crf": 28},
     "Quick preview of 360→4K reframe + grade. SVT-AV1 preset 8 is much faster but noticeably softer. Not for upload."),
    ("X5 YouTube · High quality (preset 2, CRF 18)", "x5-yt",  {"av1_preset": 2, "av1_crf": 18},
     "Very-high-quality master. SVT-AV1 preset 2 is near-optimal compression, CPU-intensive. For final deliverables."),
    # ── Action 6 → Instagram Reel ────────────────────────────────────────
    ("A6 Reel · Fast preview (ultrafast, CRF 28)",   "a6-reel", {"x265_preset": "ultrafast", "x265_crf": 28},
     "Quick preview for Action 6 vertical Reel. x265 ultrafast + CRF 28 for checking crop + LUT. Not for upload."),
    ("A6 Reel · High quality (slower, CRF 20)",      "a6-reel", {"x265_preset": "slower",    "x265_crf": 20},
     "Higher quality than research default. x265 slower preset + CRF 20 within 14 Mbps VBV cap. Good for day-to-day uploads."),
    # ── Action 6 → YouTube 4K ────────────────────────────────────────────
    ("A6 YouTube · Fast preview (preset 8, CRF 28)", "a6-yt",   {"av1_preset": 8, "av1_crf": 28},
     "Quick AV1 preview for Action 6. SVT-AV1 preset 8, CRF 28. Scrub for colour/framing then switch to a slow preset for delivery."),
    ("A6 YouTube · High quality (preset 2, CRF 16)", "a6-yt",   {"av1_preset": 2, "av1_crf": 16},
     "Near-lossless 4K master. SVT-AV1 preset 2 + CRF 16 = huge file, minimal compression artefacts. For archival or editing."),
    # Square-sensor mode: crop 3840×3840 → 16:9 before encode.
    ("A6 YouTube · Square sensor (crop to 16:9)",     "a6-yt",   {"crop_enabled": True, "crop_expr": "iw:iw*(9/16)"},
     "For footage shot in Action 6's 3840×3840 square mode. Crops iw:iw*(9/16) to extract centered 16:9 landscape."),
    # ── Best-quality YouTube presets per target resolution ──────────────
    # Preset 4 (slow, near-master) + CRF 18 (generous bits) per research doc §70–78.
    # Below 1440p YouTube routes to legacy AVC, so we stop at 1440p (doc §73–74).
    ("X5 YouTube · Best 1440p (preset 4, CRF 18)",   "x5-yt",  {"av1_preset": 4, "av1_crf": 18, "scale_width": 2560, "scale_height": 1440, "av1_extra": "film-grain=8"},
     "1440p target. AV1 preset 4 + CRF 18 + film-grain=8 (natural texture). 1440p is the minimum res that triggers YouTube's premium AV1/VP9 encode tier."),
    ("X5 YouTube · Best 4K (preset 4, CRF 18)",      "x5-yt",  {"av1_preset": 4, "av1_crf": 18, "scale_width": 3840, "scale_height": 2160, "av1_extra": "film-grain=8"},
     "4K target. AV1 preset 4 + CRF 18 + film-grain=8. Best overall quality for a reframed X5 upload; YouTube reserves its best bitrate tier for 4K."),
    ("A6 YouTube · Best 1440p (preset 4, CRF 18)",   "a6-yt",  {"av1_preset": 4, "av1_crf": 18, "scale_width": 2560, "scale_height": 1440, "av1_extra": "film-grain=8"},
     "1440p target for Action 6. AV1 preset 4 + CRF 18 + film-grain=8. Smaller file than 4K; still in YouTube's premium encoder tier."),
    ("A6 YouTube · Best 4K (preset 4, CRF 18)",      "a6-yt",  {"av1_preset": 4, "av1_crf": 18, "scale_width": 3840, "scale_height": 2160, "av1_extra": "film-grain=8"},
     "4K target for Action 6. AV1 preset 4 + CRF 18 + film-grain=8. Best default for YouTube uploads with this camera."),
    # ── Best-quality Instagram Reels presets ─────────────────────────────
    # Doc §87–99: Reels cap at 1080×1920 + ~14 Mbps. Max quality within those
    # constraints = veryslow x265 + lower CRF; 10-bit main10 stays on; VBV
    # ceiling unchanged (bypassing it triggers Meta's destructive recompress).
    ("X5 Reel · Best quality (veryslow, CRF 18)",     "x5-reel", {"x265_preset": "veryslow", "x265_crf": 18},
     "Maximum quality Reel within Instagram's 14 Mbps VBV ceiling. x265 veryslow squeezes every bit; CRF 18 lets the encoder use the cap. Long encode times."),
    ("A6 Reel · Best quality (veryslow, CRF 18)",     "a6-reel", {"x265_preset": "veryslow", "x265_crf": 18},
     "Maximum quality Reel for Action 6 within Instagram's 14 Mbps cap. x265 veryslow + CRF 18. Best default for Reels uploads."),
    # ── TikTok (same constraints as Reels: 1080×1920, ~14 Mbps, SDR, AAC) ─
    ("X5 TikTok · Best quality (veryslow, CRF 18)",   "x5-reel", {"x265_preset": "veryslow", "x265_crf": 18},
     "Mirrors the Reel Best preset. TikTok's ingest constraints match Instagram's (1080×1920, ~14 Mbps, SDR, AAC). Label for intent only — identical settings."),
    ("A6 TikTok · Best quality (veryslow, CRF 18)",   "a6-reel", {"x265_preset": "veryslow", "x265_crf": 18},
     "TikTok preset for Action 6. Same settings as Reel Best — TikTok + Instagram use the same practical constraints."),
    # ── Experimental / A-B presets ───────────────────────────────────────
    ("X5 Reel · Sharp detail (no-sao, no-rect)",      "x5-reel", {"x265_preset": "veryslow", "x265_crf": 18, "x265_extra": "no-sao=1:no-rect=1"},
     "Experimental. Disables SAO deblock smoothing + rectangular partitions for sharper edges. Good for architecture/text; may increase edge noise on organic content."),
    ("A6 Reel · Sharp detail (no-sao, no-rect)",      "a6-reel", {"x265_preset": "veryslow", "x265_crf": 18, "x265_extra": "no-sao=1:no-rect=1"},
     "Experimental. Same sharp-detail x265 tweaks for Action 6. A/B against Reel Best — the winner depends on source content."),
    ("X5 Reel · Grain retention (tune=grain)",        "x5-reel", {"x265_preset": "veryslow", "x265_crf": 18, "x265_extra": "tune=grain"},
     "Experimental. x265 tune=grain preserves fine noise instead of smoothing it into blocky patches. For low-light / high-ISO / handheld sources."),
    ("A6 Reel · Grain retention (tune=grain)",        "a6-reel", {"x265_preset": "veryslow", "x265_crf": 18, "x265_extra": "tune=grain"},
     "Experimental. x265 tune=grain for Action 6. Use when the noise/grain is part of the intended look."),
    ("X5 YouTube · Noisy source (film-grain=16)",     "x5-yt",  {"av1_preset": 4, "av1_crf": 18, "scale_width": 3840, "scale_height": 2160, "av1_extra": "film-grain=16"},
     "Experimental. Stronger AV1 film-grain synthesis (16 vs default 8). For handheld / low-light / ISO-heavy sources where default grain looks too clean."),
    ("A6 YouTube · Noisy source (film-grain=16)",     "a6-yt",  {"av1_preset": 4, "av1_crf": 18, "scale_width": 3840, "scale_height": 2160, "av1_extra": "film-grain=16"},
     "Experimental. Stronger AV1 film-grain synthesis for noisy Action 6 sources. A/B against the standard Best 4K preset."),
    ("X5 YouTube · 8K 360 passthrough (CRF 18)",      "x5-yt",  {"v360_enabled": False, "scale_width": 0, "scale_height": 0, "av1_preset": 5, "av1_crf": 18, "av1_extra": "film-grain=8"},
     "Experimental. Keeps X5 output as full 7680×3840 equirectangular 360. Reframe OFF. SVT-AV1 preset 5 (min allowed at 8K+). YouTube will render it as a 360 video."),
]


def _make_seed_presets() -> list[Preset]:
    out: list[Preset] = []
    for i, (name, pid, overrides, desc) in enumerate(_SEED):
        params = get_defaults(pid).merge(overrides).to_dict()
        # Use a stable deterministic ID so re-seeding is idempotent.
        out.append(Preset(
            id=f"seed:{i:02d}:{pid}",
            name=name,
            pipeline=pid,
            params=params,
            description=desc,
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
                    description=str(item.get("description", "")),
                    built_in=False,
                )
            except (KeyError, TypeError, ValueError):
                continue
            if p.pipeline not in PIPELINE_IDS:
                continue
            self._user[p.id] = p
            self._order.append(p.id)
        # Reconcile against the current seed manifest:
        # - refresh existing seeds' name/params/description from the manifest
        #   (seeds are templates; users who want persistence should Duplicate)
        # - add any newly-introduced seeds
        # - drop any `seed:*` IDs no longer in the manifest (retired seeds)
        # User presets (UUID IDs) are untouched.
        dirty = False
        seeds = _make_seed_presets()
        valid_seed_ids = {s.id for s in seeds}
        for seed in seeds:
            existing = self._user.get(seed.id)
            if existing is None:
                self._user[seed.id] = seed
                self._order.append(seed.id)
                dirty = True
            elif (
                existing.params != seed.params
                or existing.name != seed.name
                or existing.description != seed.description
            ):
                self._user[seed.id] = seed
                dirty = True
        orphans = [pid for pid in list(self._user) if pid.startswith("seed:") and pid not in valid_seed_ids]
        for pid in orphans:
            del self._user[pid]
            dirty = True
        if orphans:
            self._order = [pid for pid in self._order if pid in self._user]
        if dirty:
            self._save()

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

    def create(self, name: str, pipeline: PipelineId, params: dict[str, Any], description: str = "") -> Preset:
        if pipeline not in PIPELINE_IDS:
            raise ValueError(f"unknown pipeline: {pipeline}")
        preset = Preset(
            id=uuid.uuid4().hex[:12],
            name=name.strip() or "Untitled",
            pipeline=pipeline,
            params=dict(params),
            description=description.strip(),
            built_in=False,
        )
        with self._lock:
            self._user[preset.id] = preset
            self._order.append(preset.id)
            self._save()
        return preset

    def update(
        self,
        preset_id: str,
        *,
        name: str | None = None,
        params: dict[str, Any] | None = None,
        description: str | None = None,
    ) -> Preset:
        with self._lock:
            existing = self._user.get(preset_id)
            if not existing:
                raise KeyError(preset_id)
            updated = Preset(
                id=existing.id,
                name=(name.strip() if name else existing.name) or existing.name,
                pipeline=existing.pipeline,
                params=dict(params) if params is not None else existing.params,
                description=description.strip() if description is not None else existing.description,
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
        return self.create(name=name, pipeline=src.pipeline, params=src.params, description=src.description)

    def delete(self, preset_id: str) -> None:
        with self._lock:
            if preset_id.startswith("builtin:"):
                raise PermissionError("cannot delete built-in preset")
            if preset_id not in self._user:
                raise KeyError(preset_id)
            del self._user[preset_id]
            self._order = [pid for pid in self._order if pid != preset_id]
            self._save()
