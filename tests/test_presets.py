from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.backend.presets import PresetStore


@pytest.fixture()
def store(tmp_path: Path) -> PresetStore:
    return PresetStore(tmp_path / "presets.json")


def test_list_all_includes_builtins(store):
    all_p = store.list_all()
    built_in = [p for p in all_p if p.built_in]
    assert len(built_in) == 4  # one per pipeline
    ids = {p.id for p in built_in}
    assert "builtin:x5-reel" in ids
    assert "builtin:a6-yt" in ids


def test_create_and_retrieve(store):
    p = store.create(name="Sharp Reel", pipeline="x5-reel", params={"x265_crf": 18})
    assert not p.built_in
    retrieved = store.get(p.id)
    assert retrieved is not None
    assert retrieved.name == "Sharp Reel"
    assert retrieved.params["x265_crf"] == 18


def test_create_persists_to_disk(tmp_path):
    path = tmp_path / "presets.json"
    s1 = PresetStore(path)
    s1.create(name="Persisted", pipeline="a6-reel", params={"x265_crf": 20})
    # Re-load from same file
    s2 = PresetStore(path)
    names = [p.name for p in s2.list_all()]
    assert "Persisted" in names


def test_update_name_and_params(store):
    p = store.create("Original", "a6-yt", {"av1_crf": 20})
    updated = store.update(p.id, name="Updated", params={"av1_crf": 16})
    assert updated.name == "Updated"
    assert updated.params["av1_crf"] == 16


def test_duplicate(store):
    p = store.create("Source", "x5-yt", {"av1_crf": 22})
    dup = store.duplicate(p.id, new_name="Source copy")
    assert dup.id != p.id
    assert dup.name == "Source copy"
    assert dup.params["av1_crf"] == 22
    assert dup.pipeline == "x5-yt"


def test_duplicate_builtin(store):
    dup = store.duplicate("builtin:x5-reel", new_name="My X5 Reel")
    assert not dup.built_in
    assert dup.pipeline == "x5-reel"


def test_delete(store):
    p = store.create("ToDelete", "a6-reel", {})
    store.delete(p.id)
    assert store.get(p.id) is None


def test_delete_builtin_raises(store):
    with pytest.raises(PermissionError):
        store.delete("builtin:x5-reel")


def test_list_order_user_after_builtins(store):
    store.create("Z", "a6-reel", {})
    all_p = store.list_all()
    built_idx = [i for i, p in enumerate(all_p) if p.built_in]
    user_idx = [i for i, p in enumerate(all_p) if not p.built_in]
    assert max(built_idx) < min(user_idx)
