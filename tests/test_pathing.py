from __future__ import annotations

from pathlib import Path

import pytest

from app.backend import config as cfg
from app.backend.jobs import JobManager
from app.backend.pathing import output_url_for_path, resolve_input_path, resolve_requested_output_path


@pytest.fixture()
def app_config(tmp_path: Path) -> cfg.Config:
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    lut_dir = tmp_path / "luts"
    input_dir.mkdir()
    output_dir.mkdir()
    lut_dir.mkdir()

    x5_lut = lut_dir / "X5_I-Log_To_Rec.709_V1.0.cube"
    dji_lut = lut_dir / "DJI OSMO Action 6 D-LogM to Rec.709 LUT-11.17.cube"
    x5_lut.write_text("x5", encoding="utf-8")
    dji_lut.write_text("dji", encoding="utf-8")

    return cfg.Config(
        repo_root=tmp_path,
        input_dir=input_dir,
        output_dir=output_dir,
        lut_dir=lut_dir,
        x5_lut=x5_lut,
        dji_lut=dji_lut,
        ffmpeg="ffmpeg",
        ffprobe="ffprobe",
        gyroflow=None,
    )


def test_resolve_input_path_accepts_explicit_absolute_path(app_config: cfg.Config, tmp_path: Path):
    external = tmp_path / "clip.mov"
    external.write_text("video", encoding="utf-8")

    resolved = resolve_input_path(app_config, input_path=str(external), strict=True)

    assert resolved == external.resolve()


def test_resolve_input_path_rejects_legacy_traversal(app_config: cfg.Config):
    outside = app_config.repo_root / "outside.mp4"
    outside.write_text("escape", encoding="utf-8")

    with pytest.raises(FileNotFoundError):
        resolve_input_path(
            app_config,
            file_name=str(Path("..") / outside.name),
            strict=True,
        )


def test_resolve_requested_output_path_uses_directory_hint(app_config: cfg.Config):
    inp = app_config.input_dir / "sunset.mp4"
    inp.touch()
    target_dir = app_config.repo_root / "exports"

    resolved = resolve_requested_output_path(
        app_config,
        pipeline="a6-reel",
        input_path=inp,
        output_path=target_dir.as_posix() + "/",
    )

    assert resolved == (target_dir / "sunset__a6-reel.mp4").resolve()


def test_resolve_requested_output_path_preserves_explicit_filename(app_config: cfg.Config):
    inp = app_config.input_dir / "sunset.mp4"
    inp.touch()
    custom = app_config.repo_root / "exports" / "summer-cut.mp4"

    resolved = resolve_requested_output_path(
        app_config,
        pipeline="x5-yt",
        input_path=inp,
        output_path=str(custom),
        create_parent=True,
    )

    assert resolved == custom.resolve()
    assert custom.parent.exists()


def test_output_url_for_managed_output_quotes_spaces(app_config: cfg.Config):
    managed = app_config.output_dir / "social cuts" / "clip final.mp4"

    assert output_url_for_path(app_config, managed) == "/output/social%20cuts/clip%20final.mp4"


def test_job_manager_submit_supports_explicit_output_path(app_config: cfg.Config):
    inp = app_config.repo_root / "source.mov"
    inp.touch()
    manager = JobManager(app_config)
    custom = app_config.repo_root / "exports" / "final.mp4"

    job = manager.submit(inp, "x5-reel", {"x265_crf": 21}, output_path=custom)

    assert job.input_path == inp.resolve()
    assert job.output_path == custom.resolve()
    assert job.output_url is None
    assert custom.parent.exists()


def test_job_manager_submit_sets_output_url_for_managed_output(app_config: cfg.Config):
    inp = app_config.input_dir / "clip.mp4"
    inp.touch()
    manager = JobManager(app_config)

    job = manager.submit(inp, "a6-reel", None)

    assert job.output_path.parent == app_config.output_dir.resolve()
    assert job.output_url == f"/output/{job.output_path.name}"