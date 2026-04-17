"""Startup checks: ffmpeg encoders, LUT files, DJI .cube tab/space fix.

The DJI tab-vs-space LUT header bug is documented at lines 58–60 of the
research doc. We auto-repair it in place the first time we see it.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import config as cfg


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""


REQUIRED_ENCODERS = ("libx265", "libsvtav1", "libopus")


def check_ffmpeg_encoders(ffmpeg: str) -> Check:
    try:
        result = subprocess.run(
            [ffmpeg, "-hide_banner", "-encoders"],
            capture_output=True, text=True, timeout=15,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return Check("ffmpeg binary", False, f"not runnable: {e!r}")
    if result.returncode != 0:
        return Check("ffmpeg binary", False, result.stderr[:400])
    missing = [e for e in REQUIRED_ENCODERS if e not in result.stdout]
    if missing:
        return Check(
            "ffmpeg encoders",
            False,
            f"missing required encoders: {', '.join(missing)}",
        )
    return Check("ffmpeg encoders", True, f"found {', '.join(REQUIRED_ENCODERS)}")


def check_lut_exists(path: Path, label: str) -> Check:
    return Check(f"LUT: {label}", path.exists(), str(path))


def repair_dji_lut_tabs(path: Path) -> Check:
    """Rewrite `LUT_3D_SIZE\\t` to `LUT_3D_SIZE ` if found. Idempotent."""
    if not path.exists():
        return Check(f"LUT tab-fix: {path.name}", False, "file missing")
    try:
        data = path.read_bytes()
    except OSError as e:
        return Check(f"LUT tab-fix: {path.name}", False, f"read failed: {e!r}")
    needle = b"LUT_3D_SIZE\t"
    if needle not in data:
        return Check(f"LUT tab-fix: {path.name}", True, "header already space-delimited")
    fixed = data.replace(needle, b"LUT_3D_SIZE ")
    path.write_bytes(fixed)
    return Check(f"LUT tab-fix: {path.name}", True, "repaired tab→space")


def ensure_dirs(c: cfg.Config) -> Check:
    c.input_dir.mkdir(parents=True, exist_ok=True)
    c.output_dir.mkdir(parents=True, exist_ok=True)
    return Check(
        "input/output dirs",
        True,
        f"{c.input_dir} ; {c.output_dir}",
    )


def check_gyroflow(binary: str | None) -> Check:
    if not binary:
        return Check("gyroflow", True, "not found — DJI stabilization disabled")
    try:
        result = subprocess.run([binary, "--version"], capture_output=True, text=True, timeout=10)
        ver = (result.stdout + result.stderr).strip().splitlines()[0][:80]
        return Check("gyroflow", True, ver or "found")
    except (FileNotFoundError, subprocess.TimeoutExpired, IndexError):
        return Check("gyroflow", True, "found (version unknown)")


def run_all(c: cfg.Config | None = None) -> list[Check]:
    c = c or cfg.load()
    return [
        check_ffmpeg_encoders(c.ffmpeg),
        check_lut_exists(c.x5_lut, "Insta360 X5 I-Log -> Rec.709"),
        check_lut_exists(c.dji_lut, "DJI Action 6 D-LogM -> Rec.709"),
        repair_dji_lut_tabs(c.dji_lut),
        ensure_dirs(c),
        check_gyroflow(c.gyroflow),
    ]


if __name__ == "__main__":
    checks = run_all()
    width = max(len(c.name) for c in checks)
    any_fail = False
    for ch in checks:
        status = "OK  " if ch.ok else "FAIL"
        print(f"[{status}] {ch.name.ljust(width)}  {ch.detail}")
        any_fail = any_fail or not ch.ok
    raise SystemExit(1 if any_fail else 0)
