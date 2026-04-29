from __future__ import annotations

from pathlib import Path

import pytest

from app.backend.pipelines import (
    BuildContext,
    PipelineParams,
    build,
    get_defaults,
    resolve_output_path,
)


@pytest.fixture()
def ctx(tmp_path: Path) -> BuildContext:
    inp = tmp_path / "clip.mp4"
    inp.touch()
    return BuildContext(
        input_path=inp,
        output_path=tmp_path / "clip__out.mp4",
        x5_lut=Path("C:/tmp/X5_I-Log_To_Rec.709_V1.0.cube"),
        dji_lut=Path("C:/tmp/DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube"),
        ffmpeg="ffmpeg",
    )


def _flag(argv: list[str], flag: str) -> str:
    i = argv.index(flag)
    return argv[i + 1]


def _vf(argv: list[str]) -> str:
    return _flag(argv, "-vf")


# ── defaults match research values ─────────────────────────────────────────

def test_x5_reel_defaults():
    p = get_defaults("x5-reel")
    assert p.h_fov == 70
    assert p.v_fov == 115
    assert p.x265_vbv_maxrate == 14000
    assert p.x265_vbv_bufsize == 28000
    assert p.x265_crf == 23
    assert p.scale_width == 1080 and p.scale_height == 1920
    assert p.audio_codec == "aac"

def test_x5_yt_defaults():
    p = get_defaults("x5-yt")
    assert p.h_fov == 95 and p.v_fov == 60
    assert p.scale_width == 3840 and p.scale_height == 2160
    assert p.av1_crf == 22
    assert p.audio_codec == "libopus"

def test_a6_yt_defaults():
    p = get_defaults("a6-yt")
    assert p.scale_width == 0 and p.scale_height == 0
    assert p.av1_crf == 20
    assert p.audio_codec == "libopus"


# ── P1: X5 → Instagram Reel ────────────────────────────────────────────────

def test_x5_reel_filter_chain(ctx):
    argv = build("x5-reel", get_defaults("x5-reel"), ctx)
    vf = _vf(argv)
    assert "v360=input=e:output=rectilinear" in vf
    assert "h_fov=70" in vf and "v_fov=115" in vf
    assert "interp=lanczos" in vf
    assert vf.count("format=yuv420p10le") >= 2
    assert ":interp=tetrahedral" in vf
    assert "scale=1080:1920:flags=lanczos" in vf

def test_x5_reel_x265_params(ctx):
    argv = build("x5-reel", get_defaults("x5-reel"), ctx)
    assert "libx265" in argv
    assert _flag(argv, "-profile:v") == "main10"
    x265 = _flag(argv, "-x265-params")
    assert "vbv-maxrate=14000" in x265
    assert "vbv-bufsize=28000" in x265
    assert "crf=23" in x265
    assert "psy-rd=1.0" in x265

def test_x5_reel_metadata(ctx):
    argv = build("x5-reel", get_defaults("x5-reel"), ctx)
    assert _flag(argv, "-color_primaries") == "bt709"
    assert _flag(argv, "-c:a") == "aac"
    assert _flag(argv, "-b:a") == "256k"
    assert "+faststart" in argv


# ── P2: X5 → YouTube ───────────────────────────────────────────────────────

def test_x5_yt_av1_and_4k(ctx):
    argv = build("x5-yt", get_defaults("x5-yt"), ctx)
    vf = _vf(argv)
    assert "libsvtav1" in argv
    assert "scale=3840:2160:flags=lanczos" in vf
    assert "h_fov=95" in vf
    assert "tune=0" in _flag(argv, "-svtav1-params")
    assert _flag(argv, "-c:a") == "libopus"


# ── P3: Action 6 → Instagram Reel ──────────────────────────────────────────

def test_a6_reel_center_crop(ctx):
    argv = build("a6-reel", get_defaults("a6-reel"), ctx)
    vf = _vf(argv)
    assert "v360=" not in vf
    assert "crop=ih*(9/16):ih" in vf
    assert "scale=1080:1920:flags=lanczos" in vf
    assert "vbv-maxrate=14000" in _flag(argv, "-x265-params")

def test_a6_yt_no_crop_by_default(ctx):
    vf = _vf(build("a6-yt", get_defaults("a6-yt"), ctx))
    assert "crop=" not in vf

def test_a6_yt_square_sensor_crop(ctx):
    p = get_defaults("a6-yt").merge({"crop_enabled": True, "crop_expr": "iw:iw*(9/16)"})
    vf = _vf(build("a6-yt", p, ctx))
    assert "crop=iw:iw*(9/16)" in vf

def test_x5_reel_crop_disabled_by_default(ctx):
    # v360 reframes the sphere; adding crop on top would double-crop.
    assert get_defaults("x5-reel").crop_enabled is False
    vf = _vf(build("x5-reel", get_defaults("x5-reel"), ctx))
    assert "crop=" not in vf

def test_crop_disabled_suppresses_filter(ctx):
    p = get_defaults("a6-reel").merge({"crop_enabled": False})
    vf = _vf(build("a6-reel", p, ctx))
    assert "crop=" not in vf


# ── P4: Action 6 → YouTube ─────────────────────────────────────────────────

def test_a6_yt_no_scale(ctx):
    argv = build("a6-yt", get_defaults("a6-yt"), ctx)
    vf = _vf(argv)
    assert "v360=" not in vf
    assert "scale=" not in vf
    assert _flag(argv, "-crf") == "20"


# ── param overrides ─────────────────────────────────────────────────────────

def test_merge_overrides_yaw(ctx):
    p = get_defaults("x5-reel").merge({"yaw": 90, "h_fov": 80})
    argv = build("x5-reel", p, ctx)
    vf = _vf(argv)
    assert "yaw=90" in vf
    assert "h_fov=80" in vf

def test_merge_ignores_unknown_keys(ctx):
    p = get_defaults("x5-reel").merge({"no_such_key": 999})
    argv = build("x5-reel", p, ctx)
    assert "no_such_key" not in " ".join(argv)

def test_x265_extra_appended(ctx):
    p = get_defaults("x5-reel").merge({"x265_extra": "ref=4:me=umh"})
    x265 = _flag(build("x5-reel", p, ctx), "-x265-params")
    assert "ref=4:me=umh" in x265

def test_av1_extra_appended(ctx):
    p = get_defaults("a6-yt").merge({"av1_extra": "film-grain=8"})
    sv = _flag(build("a6-yt", p, ctx), "-svtav1-params")
    assert "film-grain=8" in sv

def test_skip_scale_when_zero(ctx):
    p = get_defaults("a6-yt")  # scale_width==0
    vf = _vf(build("a6-yt", p, ctx))
    assert "scale=" not in vf

def test_faststart_omitted_when_false(ctx):
    p = get_defaults("x5-reel").merge({"faststart": False})
    argv = build("x5-reel", p, ctx)
    assert "+faststart" not in argv


# ── rotate / flip ───────────────────────────────────────────────────────────

def test_rotate_default_omitted(ctx):
    vf = _vf(build("a6-reel", get_defaults("a6-reel"), ctx))
    assert "transpose=" not in vf
    assert ", hflip" not in vf and ", vflip" not in vf

def test_rotate_90cw(ctx):
    p = get_defaults("a6-reel").merge({"rotate": "90cw"})
    vf = _vf(build("a6-reel", p, ctx))
    assert "transpose=1" in vf

def test_rotate_90ccw(ctx):
    p = get_defaults("a6-reel").merge({"rotate": "90ccw"})
    vf = _vf(build("a6-reel", p, ctx))
    assert "transpose=2" in vf

def test_rotate_180(ctx):
    p = get_defaults("a6-reel").merge({"rotate": "180"})
    vf = _vf(build("a6-reel", p, ctx))
    assert "transpose=2,transpose=2" in vf

def test_rotate_applied_before_crop(ctx):
    p = get_defaults("a6-reel").merge({"rotate": "90cw"})
    vf = _vf(build("a6-reel", p, ctx))
    assert vf.index("transpose=1") < vf.index("crop=")

def test_rotate_unknown_value_ignored(ctx):
    p = get_defaults("a6-reel").merge({"rotate": "bogus"})
    vf = _vf(build("a6-reel", p, ctx))
    assert "transpose=" not in vf


# ── test-render windowing (-ss / -t) ────────────────────────────────────────

def test_no_windowing_by_default(ctx):
    argv = build("a6-reel", get_defaults("a6-reel"), ctx)
    assert "-ss" not in argv
    assert "-t" not in argv

def test_start_s_emits_ss_before_input(ctx):
    ctx.start_s = 12.5
    argv = build("a6-reel", get_defaults("a6-reel"), ctx)
    assert argv.index("-ss") < argv.index("-i")
    assert argv[argv.index("-ss") + 1] == "12.5"

def test_duration_s_emits_t_after_input(ctx):
    ctx.duration_s = 30.0
    argv = build("a6-reel", get_defaults("a6-reel"), ctx)
    assert argv.index("-i") < argv.index("-t")
    assert argv[argv.index("-t") + 1] == "30"

def test_windowing_combined(ctx):
    ctx.start_s = 0.0
    ctx.duration_s = 45.25
    argv = build("a6-yt", get_defaults("a6-yt"), ctx)
    assert argv[argv.index("-ss") + 1] == "0"
    assert argv[argv.index("-t") + 1] == "45.25"


# ── LUT path quoting ────────────────────────────────────────────────────────

def test_lut_path_single_quoted_and_drive_colon_escaped(ctx):
    vf = _vf(build("a6-reel", get_defaults("a6-reel"), ctx))
    assert "lut3d=file='C\\:/tmp/DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube':interp=tetrahedral" in vf

def test_lut_path_embedded_quote_is_preserved():
    ctx = BuildContext(
        input_path=Path("C:/tmp/clip.mp4"),
        output_path=Path("C:/tmp/clip__out.mp4"),
        x5_lut=Path("C:/tmp/X5_I-Log_To_Rec.709_V1.0.cube"),
        dji_lut=Path("C:/tmp/O'Brien LUT.cube"),
        ffmpeg="ffmpeg",
    )
    vf = _vf(build("a6-reel", get_defaults("a6-reel"), ctx))
    assert "lut3d=file='C\\:/tmp/O'\\''Brien LUT.cube':interp=tetrahedral" in vf


# ── output path disambiguation ──────────────────────────────────────────────

def test_resolve_output_disambiguates(tmp_path):
    inp = tmp_path / "sunset.mp4"
    inp.touch()
    p1 = resolve_output_path(tmp_path, inp, "a6-reel")
    assert p1.name == "sunset__a6-reel.mp4"
    p1.touch()
    p2 = resolve_output_path(tmp_path, inp, "a6-reel")
    assert p2.name == "sunset__a6-reel_1.mp4"
