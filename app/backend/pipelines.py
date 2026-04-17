"""FFmpeg argv builders with fully parameterized pipelines.

Every knob from the research doc is exposed via `PipelineParams`. Each
pipeline has a sensible default (returned by `get_defaults`) that matches
the research; callers can override any subset.

References: `docs/YouTube, Instagram 10-Bit Video Settings.txt`.
- X5 → Instagram Reel: lines 102–143
- Action 6 → Instagram Reel: lines 177–202
- YouTube AV1 guidance: lines 70–78
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields, replace
from pathlib import Path
from typing import Any, Literal


PipelineId = Literal["x5-reel", "x5-yt", "a6-reel", "a6-yt"]

PIPELINE_IDS: tuple[PipelineId, ...] = ("x5-reel", "x5-yt", "a6-reel", "a6-yt")

PIPELINES: dict[PipelineId, str] = {
    "x5-reel": "Insta360 X5 -> Instagram Reel (vertical SDR HEVC)",
    "x5-yt": "Insta360 X5 -> YouTube 4K (SDR AV1, reframed 16:9)",
    "a6-reel": "DJI Osmo Action 6 -> Instagram Reel (vertical SDR HEVC)",
    "a6-yt": "DJI Osmo Action 6 -> YouTube 4K (SDR AV1 10-bit)",
}


# -- pipeline family helpers -------------------------------------------------

def encoder_family(pipeline: PipelineId) -> Literal["x265", "av1"]:
    return "x265" if pipeline in ("x5-reel", "a6-reel") else "av1"


def uses_v360(pipeline: PipelineId) -> bool:
    return pipeline.startswith("x5")


def uses_crop(pipeline: PipelineId) -> bool:
    return pipeline == "a6-reel"


def uses_x5_lut(pipeline: PipelineId) -> bool:
    return pipeline.startswith("x5")


# -- parameter model ---------------------------------------------------------

@dataclass
class PipelineParams:
    # --- v360 (X5) ---
    yaw: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0
    h_fov: float = 70.0
    v_fov: float = 115.0
    v360_interp: str = "lanczos"

    # --- Gyroflow stabilization (a6 pipelines only) ---
    gyroflow_enabled: bool = False
    gyroflow_smoothness: float = 0.5

    # --- crop (a6 pipelines) ---
    # crop_enabled=True applies the filter; crop_expr controls the geometry.
    # a6-reel default: "ih*(9/16):ih"  — vertical 9:16 from any input
    # a6-yt  default: "iw:iw*(9/16)"  — horizontal 16:9 from square sensor
    crop_enabled: bool = False
    crop_expr: str = "ih*(9/16):ih"

    # --- lut3d ---
    lut_interp: str = "tetrahedral"

    # --- scale (set width/height to 0 to skip scale filter) ---
    scale_width: int = 1080
    scale_height: int = 1920
    scale_flags: str = "lanczos"

    # --- pixel format (applied before AND after lut3d) ---
    pix_fmt: str = "yuv420p10le"

    # --- x265 (Instagram pipelines) ---
    x265_preset: str = "slow"
    x265_profile: str = "main10"
    x265_crf: int = 23
    x265_vbv_maxrate: int = 14000
    x265_vbv_bufsize: int = 28000
    x265_aq_mode: int = 3
    x265_aq_strength: float = 1.0
    x265_psy_rd: float = 1.0
    x265_psy_rdoq: float = 1.0
    x265_extra: str = ""  # appended to -x265-params (colon-delimited)

    # --- SVT-AV1 (YouTube pipelines) ---
    av1_preset: int = 4
    av1_crf: int = 20
    av1_tune: int = 0
    av1_extra: str = ""  # appended to -svtav1-params (colon-delimited)

    # --- audio ---
    audio_codec: str = "aac"
    audio_bitrate: str = "256k"
    audio_rate: int = 48000

    # --- color metadata ---
    color_primaries: str = "bt709"
    color_trc: str = "bt709"
    colorspace: str = "bt709"

    # --- container ---
    faststart: bool = True

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "PipelineParams":
        valid = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in d.items() if k in valid})

    def merge(self, overrides: dict[str, Any] | None) -> "PipelineParams":
        if not overrides:
            return self
        valid = {f.name for f in fields(self)}
        clean: dict[str, Any] = {}
        for k, v in overrides.items():
            if k not in valid or v is None:
                continue
            clean[k] = v
        return replace(self, **clean)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def get_defaults(pipeline: PipelineId) -> PipelineParams:
    if pipeline == "x5-reel":
        # v360 handles the 9:16 reframe — no crop filter needed.
        return PipelineParams(crop_enabled=False, crop_expr="ih*(9/16):ih")
    if pipeline == "x5-yt":
        # v360 handles the 16:9 reframe — no separate crop needed.
        return PipelineParams(
            crop_enabled=False,
            h_fov=95.0, v_fov=60.0,
            scale_width=3840, scale_height=2160,
            av1_preset=4, av1_crf=22, av1_tune=0,
            audio_codec="libopus", audio_bitrate="384k",
        )
    if pipeline == "a6-reel":
        # Always crop landscape/square footage to vertical 9:16.
        return PipelineParams(crop_enabled=True, crop_expr="ih*(9/16):ih")
    if pipeline == "a6-yt":
        # Landscape 16:9 footage: no crop. Square-sensor footage: enable crop.
        return PipelineParams(
            crop_enabled=False,
            crop_expr="iw:iw*(9/16)",   # ready to use when user enables it
            scale_width=0, scale_height=0,
            av1_preset=4, av1_crf=20, av1_tune=0,
            audio_codec="libopus", audio_bitrate="384k",
        )
    raise ValueError(f"unknown pipeline: {pipeline}")


# -- build context -----------------------------------------------------------

@dataclass
class BuildContext:
    input_path: Path
    output_path: Path
    x5_lut: Path
    dji_lut: Path
    ffmpeg: str = "ffmpeg"
    extra_global: list[str] = field(default_factory=lambda: ["-hide_banner", "-y"])


# -- filter quoting ----------------------------------------------------------

def _lut_path_for_filter(p: Path) -> str:
    """Quote a LUT path for inclusion in an FFmpeg filtergraph.

    FFmpeg applies quoting/escaping in multiple parsing stages. On Windows the
    drive-letter colon must still be escaped for the filter-option parser even
    when the whole path is single-quoted. Normalize to forward slashes, escape
    colons, and preserve embedded single quotes with FFmpeg's close/escape/
    reopen pattern.
    """
    escaped = str(p).replace("\\", "/")
    escaped = escaped.replace(":", r"\:")
    escaped = escaped.replace("'", r"'\''")
    return f"'{escaped}'"


def _v360(p: PipelineParams) -> str:
    return (
        f"v360=input=e:output=rectilinear"
        f":h_fov={p.h_fov}:v_fov={p.v_fov}"
        f":yaw={p.yaw}:pitch={p.pitch}:roll={p.roll}"
        f":interp={p.v360_interp}"
    )


# -- core builder ------------------------------------------------------------

def build(pipeline: PipelineId, params: PipelineParams, ctx: BuildContext) -> list[str]:
    vf_parts: list[str] = []
    if uses_v360(pipeline):
        vf_parts.append(_v360(params))
    vf_parts.append(f"format={params.pix_fmt}")
    if params.crop_enabled:
        vf_parts.append(f"crop={params.crop_expr}")
    lut = ctx.x5_lut if uses_x5_lut(pipeline) else ctx.dji_lut
    vf_parts.append(f"lut3d=file={_lut_path_for_filter(lut)}:interp={params.lut_interp}")
    if params.scale_width and params.scale_height:
        vf_parts.append(f"scale={params.scale_width}:{params.scale_height}:flags={params.scale_flags}")
    vf_parts.append(f"format={params.pix_fmt}")
    filter_args = ["-vf", ", ".join(vf_parts)]

    argv: list[str] = [
        ctx.ffmpeg, *ctx.extra_global,
        "-i", str(ctx.input_path),
        *filter_args,
    ]

    if encoder_family(pipeline) == "x265":
        x265_parts = [
            f"crf={params.x265_crf}",
            f"vbv-maxrate={params.x265_vbv_maxrate}",
            f"vbv-bufsize={params.x265_vbv_bufsize}",
            f"aq-mode={params.x265_aq_mode}",
            f"aq-strength={params.x265_aq_strength}",
            f"psy-rd={params.x265_psy_rd}",
            f"psy-rdoq={params.x265_psy_rdoq}",
        ]
        if params.x265_extra.strip():
            x265_parts.append(params.x265_extra.strip())
        argv += [
            "-c:v", "libx265",
            "-preset", params.x265_preset,
            "-profile:v", params.x265_profile,
            "-pix_fmt", params.pix_fmt,
            "-x265-params", ":".join(x265_parts),
        ]
    else:
        av1_parts = [f"tune={params.av1_tune}"]
        if params.av1_extra.strip():
            av1_parts.append(params.av1_extra.strip())
        argv += [
            "-c:v", "libsvtav1",
            "-preset", str(params.av1_preset),
            "-crf", str(params.av1_crf),
            "-pix_fmt", params.pix_fmt,
            "-svtav1-params", ":".join(av1_parts),
        ]

    argv += [
        "-color_primaries", params.color_primaries,
        "-color_trc", params.color_trc,
        "-colorspace", params.colorspace,
        "-c:a", params.audio_codec,
        "-b:a", params.audio_bitrate,
        "-ar", str(params.audio_rate),
    ]
    if params.faststart:
        argv += ["-movflags", "+faststart"]
    argv += ["-progress", "pipe:1", "-nostats", str(ctx.output_path)]
    return argv


def resolve_output_path(output_dir: Path, input_path: Path, pipeline: PipelineId) -> Path:
    """`<stem>__<pipeline>.mp4`, disambiguated with `_1`, `_2`, ... if taken."""
    base = f"{input_path.stem}__{pipeline}"
    candidate = output_dir / f"{base}.mp4"
    i = 1
    while candidate.exists():
        candidate = output_dir / f"{base}_{i}.mp4"
        i += 1
    return candidate
