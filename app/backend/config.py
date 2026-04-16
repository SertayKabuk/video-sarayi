from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Config:
    repo_root: Path
    input_dir: Path
    output_dir: Path
    lut_dir: Path
    x5_lut: Path
    dji_lut: Path
    ffmpeg: str
    ffprobe: str


def _resolve_binary(env: str, name: str, root: Path) -> str:
    """Prefer env override, then the bundled `ffmpeg/bin/` next to the repo,
    then whatever is on PATH."""
    override = os.environ.get(env)
    if override:
        return override
    bundled = root / "ffmpeg" / "bin" / f"{name}.exe"
    if bundled.exists():
        return str(bundled)
    bundled_nix = root / "ffmpeg" / "bin" / name
    if bundled_nix.exists():
        return str(bundled_nix)
    return shutil.which(name) or name


def load() -> Config:
    root = Path(os.environ.get("VIDEO_SARAYI_ROOT", REPO_ROOT))
    lut_dir = root / "lut"
    return Config(
        repo_root=root,
        input_dir=root / "input",
        output_dir=root / "output",
        lut_dir=lut_dir,
        x5_lut=lut_dir / "X5_I-Log_To_Rec.709_V1.0.cube",
        dji_lut=lut_dir / "DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube",
        ffmpeg=_resolve_binary("FFMPEG", "ffmpeg", root),
        ffprobe=_resolve_binary("FFPROBE", "ffprobe", root),
    )
