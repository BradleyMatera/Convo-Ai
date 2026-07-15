"""Tests for the database service."""

import os
from pathlib import Path

from convo_ai.config import Config
from convo_ai.services.database import Database


def test_database_crud(tmp_path: Path) -> None:
    db_path = tmp_path / "test.db"
    cfg = Config(database_url=f"sqlite:///{db_path}")
    db = Database(cfg)

    # Add entries
    db.add_entry("Hello", "Hi there", "positive")
    db.add_entry("Goodbye", "See you", "neutral")

    # Read
    history = db.get_history(limit=10)
    assert len(history) == 2
    # Most recent first
    assert history[0].user_text == "Goodbye"
    assert history[1].user_text == "Hello"

    # Clear
    db.clear_history()
    assert len(db.get_history()) == 0

    if db_path.exists():
        os.unlink(db_path)
