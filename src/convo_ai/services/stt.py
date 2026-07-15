"""Speech-to-text service using faster-whisper."""

from __future__ import annotations

import logging
from pathlib import Path

from faster_whisper import WhisperModel

from ..config import Config

logger = logging.getLogger(__name__)


class STTService:
    """Transcribes audio files using a local Whisper model."""

    def __init__(self, config: Config) -> None:
        self.config = config
        logger.info("Loading Whisper model '%s'...", config.whisper_model_size)
        self.model = WhisperModel(
            config.whisper_model_size,
            compute_type=config.whisper_compute_type,
            local_files_only=False,
        )
        logger.info("Whisper model loaded.")

    def transcribe(self, audio_path: str | Path) -> str:
        """Transcribe an audio file and return the joined text."""
        segments, _ = self.model.transcribe(str(audio_path))
        return " ".join(segment.text for segment in segments).strip()
