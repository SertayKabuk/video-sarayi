from __future__ import annotations

from app.backend.progress import ProgressEvent, ProgressParser, iter_events


SAMPLE = """\
frame=120
fps=23.97
bitrate=5000kbits/s
out_time_us=5000000
speed=1.02x
progress=continue
frame=240
fps=24.00
bitrate=5100kbits/s
out_time_us=10000000
speed=1.03x
progress=end
"""


def test_iter_events_parses_two_blocks():
    events = list(iter_events(SAMPLE.splitlines()))
    assert len(events) == 2
    a, b = events
    assert a.frame == 120
    assert a.fps == 23.97
    assert a.out_time_us == 5_000_000
    assert a.speed == "1.02x"
    assert a.progress == "continue"
    assert b.progress == "end"
    assert b.frame == 240


def test_percent_bounded():
    e = ProgressEvent(frame=10, fps=24.0, bitrate=None, out_time_us=6_000_000, speed="1x", progress="continue")
    assert e.percent(10.0) == 60.0
    # clamps to 100
    assert e.percent(1.0) == 100.0
    assert e.percent(None) is None
    assert e.percent(0) is None


def test_percent_falls_back_to_frame_count():
    e = ProgressEvent(frame=120, fps=24.0, bitrate=None, out_time_us=None, speed="1x", progress="continue")
    assert e.percent(10.0, total_frames=240) == 50.0


def test_malformed_lines_are_skipped():
    noisy = [
        "",
        "garbage without equals",
        "frame=50",
        "progress=continue",
    ]
    events = list(iter_events(noisy))
    assert len(events) == 1
    assert events[0].frame == 50


def test_incremental_parser_preserves_prior_fields_until_progress_line():
    parser = ProgressParser()
    events = []
    for line in SAMPLE.splitlines():
        event = parser.feed(line)
        if event is not None:
            events.append(event)

    assert len(events) == 2
    assert events[0].frame == 120
    assert events[0].fps == 23.97
    assert events[0].out_time_us == 5_000_000
    assert events[1].frame == 240
    assert events[1].progress == "end"


def test_out_time_ms_fallback_used_when_out_time_us_missing():
    parser = ProgressParser()
    event = None
    for line in [
        "frame=12",
        "fps=10.87",
        "out_time_us=N/A",
        "out_time_ms=500000",
        "speed=0.453x",
        "progress=continue",
    ]:
        maybe = parser.feed(line)
        if maybe is not None:
            event = maybe

    assert event is not None
    assert event.out_time_us == 500_000
    assert event.percent(30.0) == 500_000 / 1_000_000 / 30.0 * 100.0
