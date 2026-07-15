"""Tests for the config module."""

import json
from pathlib import Path

from convo_ai.config import Config


def test_default_config() -> None:
    cfg = Config()
    assert cfg.model == "llama3:latest"
    assert cfg.host == "0.0.0.0"
    assert cfg.port == 8000
    assert cfg.model_settings.temperature == 0.7
    assert cfg.conversation_settings.accent == "british"


def test_config_from_file(tmp_path: Path) -> None:
    data = {
        "model": "mistral",
        "port": 9000,
        "model_settings": {"temperature": 0.5, "top_p": 0.8},
        "conversation_settings": {"personality": "witty"},
        "tts_settings": {"noise_scale": 0.5},
    }
    cfg_file = tmp_path / "config.json"
    cfg_file.write_text(json.dumps(data))
    cfg = Config.from_file(cfg_file)
    assert cfg.model == "mistral"
    assert cfg.port == 9000
    assert cfg.model_settings.temperature == 0.5
    assert cfg.model_settings.top_p == 0.8
    assert cfg.conversation_settings.personality == "witty"
    assert cfg.tts_settings.noise_scale == 0.5


def test_config_from_missing_file() -> None:
    cfg = Config.from_file("/nonexistent/path/config.json")
    assert cfg.model == "llama3:latest"


def test_config_to_dict_roundtrip() -> None:
    cfg = Config(model="test-model")
    d = cfg.to_dict()
    assert d["model"] == "test-model"
    assert "model_settings" in d
    assert "conversation_settings" in d
    assert "tts_settings" in d
