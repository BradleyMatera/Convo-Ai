"""Configuration management for Convo-AI."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ModelSettings:
    """Ollama generation parameters."""

    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 40
    num_predict: int = 300
    repeat_penalty: float = 1.1
    presence_penalty: float = 0.1
    frequency_penalty: float = 0.1
    num_ctx: int = 2048


@dataclass
class ConversationSettings:
    """Conversation behavior settings."""

    max_history: int = 10
    response_length: str = "medium"
    personality: str = "professional_friendly"
    humor_level: str = "subtle"
    accent: str = "british"
    persist_history: bool = True


@dataclass
class TTSSettings:
    """TTS generation parameters."""

    temperature: float = 0.7
    length_scale: float = 1.0
    noise_scale: float = 0.667
    noise_scale_w: float = 0.8


@dataclass
class Config:
    """Top-level application configuration."""

    model: str = "llama3:latest"
    continuous: bool = True
    input_mode: str = "voice"
    ws_url: str = "ws://localhost:8000/ws"
    host: str = "0.0.0.0"
    port: int = 8000
    voice_model: str = "tts_models/en/vctk/vits"
    voice_speed: float = 1.0
    voice_pitch: float = 1.0
    voice_speaker: str = "p225"
    whisper_model_size: str = "small"
    whisper_compute_type: str = "int8"
    ollama_api_url: str = "http://localhost:11434/api/generate"
    tts_cache_dir: str = "tts_cache"
    logs_dir: str = "logs"
    database_url: str = "sqlite:///convo_ai.db"
    model_settings: ModelSettings = field(default_factory=ModelSettings)
    conversation_settings: ConversationSettings = field(default_factory=ConversationSettings)
    tts_settings: TTSSettings = field(default_factory=TTSSettings)

    @classmethod
    def from_file(cls, path: str | Path = "config.json") -> Config:
        """Load configuration from a JSON file, falling back to defaults."""
        p = Path(path)
        if not p.exists():
            return cls()
        data: dict[str, Any] = json.loads(p.read_text())
        model_settings = ModelSettings(**data.pop("model_settings", {}))
        conversation_settings = ConversationSettings(**data.pop("conversation_settings", {}))
        tts_settings = TTSSettings(**data.pop("tts_settings", {}))
        return cls(
            model_settings=model_settings,
            conversation_settings=conversation_settings,
            tts_settings=tts_settings,
            **data,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize configuration back to a dict."""
        return {
            "model": self.model,
            "continuous": self.continuous,
            "input_mode": self.input_mode,
            "ws_url": self.ws_url,
            "host": self.host,
            "port": self.port,
            "voice_model": self.voice_model,
            "voice_speed": self.voice_speed,
            "voice_pitch": self.voice_pitch,
            "voice_speaker": self.voice_speaker,
            "whisper_model_size": self.whisper_model_size,
            "whisper_compute_type": self.whisper_compute_type,
            "ollama_api_url": self.ollama_api_url,
            "tts_cache_dir": self.tts_cache_dir,
            "logs_dir": self.logs_dir,
            "database_url": self.database_url,
            "model_settings": self.model_settings.__dict__,
            "conversation_settings": self.conversation_settings.__dict__,
            "tts_settings": self.tts_settings.__dict__,
        }


# Jarvis personality constants
JARVIS_PERSONALITY: dict[str, Any] = {
    "name": "Jarvis",
    "greetings": [
        "How may I assist you today?",
        "At your service.",
        "How can I help you?",
        "What can I do for you?",
    ],
    "acknowledgments": [
        "Understood.",
        "I'll take care of that.",
        "Processing your request.",
        "Right away.",
    ],
    "error_responses": [
        "I apologize, but I'm having trouble processing that request.",
        "I'm afraid I can't assist with that at the moment.",
        "I'm experiencing some difficulties. Could you please rephrase that?",
    ],
}

JARVIS_SETTINGS: dict[str, list[str]] = {
    "greetings": [
        "Good day, Sir. How may I assist you?",
        "At your service, Sir.",
        "How can I be of assistance today?",
        "I'm here to help, Sir.",
    ],
    "farewells": [
        "Until next time, Sir.",
        "Goodbye, Sir.",
        "Have a pleasant day, Sir.",
        "I'll be here if you need anything else.",
    ],
    "thinking": [
        "Processing your request, Sir.",
        "One moment, please.",
        "Analyzing the situation.",
        "Let me think about that.",
    ],
}
