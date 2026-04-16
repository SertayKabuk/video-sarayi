"""Parser for FFmpeg's `-progress pipe:1` key=value stream.

FFmpeg writes one `key=value` per line and terminates each block with
`progress=continue` or `progress=end`. This module turns that stream into
dicts and computes a percentage from `out_time_us` against a known total
duration (obtained via ffprobe).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Iterator


@dataclass
class ProgressEvent:
    frame: int | None
    fps: float | None
    bitrate: str | None
    out_time_us: int | None
    speed: str | None
    progress: str | None

    def percent(self, total_duration_s: float | None, total_frames: int | None = None) -> float | None:
        if self.out_time_us is not None and total_duration_s and total_duration_s > 0:
            pct = (self.out_time_us / 1_000_000.0) / total_duration_s * 100.0
            return max(0.0, min(100.0, pct))
        if self.frame is not None and total_frames and total_frames > 0:
            pct = self.frame / total_frames * 100.0
            return max(0.0, min(100.0, pct))
        return None


def _coerce_out_time_us(values: dict[str, str]) -> int | None:
    """Return FFmpeg progress time in microseconds.

    Newer FFmpeg builds usually emit both `out_time_us` and `out_time_ms`, and
    in practice both carry the same microsecond-style value. Prefer the clearly
    named key, but fall back to `out_time_ms` for compatibility.
    """
    primary = _coerce_int(values.get("out_time_us", ""))
    if primary is not None:
        return primary
    return _coerce_int(values.get("out_time_ms", ""))


def _coerce_int(v: str) -> int | None:
    try:
        return int(v)
    except ValueError:
        return None


def _coerce_float(v: str) -> float | None:
    try:
        return float(v)
    except ValueError:
        return None


@dataclass
class ProgressParser:
    """Incrementally parse FFmpeg `-progress` output across lines."""

    acc: dict[str, str] = field(default_factory=dict)

    def feed(self, raw: str) -> ProgressEvent | None:
        line = raw.strip()
        if not line or "=" not in line:
            return None
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        self.acc[key] = value
        if key != "progress":
            return None

        event = ProgressEvent(
            frame=_coerce_int(self.acc.get("frame", "")),
            fps=_coerce_float(self.acc.get("fps", "")),
            bitrate=self.acc.get("bitrate") or None,
            out_time_us=_coerce_out_time_us(self.acc),
            speed=self.acc.get("speed") or None,
            progress=self.acc.get("progress") or None,
        )
        self.acc.clear()
        return event


def iter_events(lines: Iterable[str]) -> Iterator[ProgressEvent]:
    """Yield a `ProgressEvent` for each terminator (`progress=...`) seen."""
    parser = ProgressParser()
    for raw in lines:
        event = parser.feed(raw)
        if event is not None:
            yield event
