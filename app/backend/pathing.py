from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from . import config as cfg
from .pipelines import PipelineId, resolve_output_path


PLACEHOLDER_INPUT_NAME = "INPUT_FILENAME.mp4"


def resolve_input_path(
    c: cfg.Config,
    *,
    file_name: str | None = None,
    input_path: str | Path | None = None,
    strict: bool = False,
) -> Path:
    raw_input = _clean_text(input_path)
    if raw_input:
        candidate = _normalize_user_path(c, raw_input)
        if strict:
            _ensure_existing_file(candidate, raw_input)
        return candidate

    raw_file = _clean_text(file_name)
    if raw_file:
        candidate = (c.input_dir / raw_file).resolve()
        if strict:
            _ensure_existing_file(candidate, raw_file)
            _ensure_within(candidate, c.input_dir.resolve(), raw_file)
        return candidate

    return (c.input_dir / PLACEHOLDER_INPUT_NAME).resolve()


def resolve_requested_output_path(
    c: cfg.Config,
    *,
    pipeline: PipelineId,
    input_path: Path,
    output_path: str | Path | None = None,
    create_parent: bool = False,
) -> Path:
    raw_output = _clean_text(output_path)
    if not raw_output:
        candidate = resolve_output_path(c.output_dir, input_path, pipeline).resolve()
    else:
        requested = _normalize_user_path(c, raw_output)
        if _treat_as_directory(raw_output, requested):
            candidate = resolve_output_path(requested, input_path, pipeline).resolve()
        else:
            candidate = requested

    if create_parent:
        candidate.parent.mkdir(parents=True, exist_ok=True)
    return candidate


def output_url_for_path(c: cfg.Config, output_path: Path) -> str | None:
    try:
        rel = output_path.resolve().relative_to(c.output_dir.resolve())
    except ValueError:
        return None
    return f"/output/{quote(rel.as_posix())}"


def _normalize_user_path(c: cfg.Config, raw: str) -> Path:
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = c.repo_root / candidate
    return candidate.resolve()


def _treat_as_directory(raw: str, path: Path) -> bool:
    return raw.endswith(("/", "\\")) or (path.exists() and path.is_dir())


def _ensure_existing_file(path: Path, label: str) -> None:
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(label)


def _ensure_within(path: Path, root: Path, label: str) -> None:
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise FileNotFoundError(label) from exc


def _clean_text(value: str | Path | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None