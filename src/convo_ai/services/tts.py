"""Text-to-speech service using Coqui TTS."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from TTS.api import TTS  # noqa: N811

from ..config import Config

logger = logging.getLogger(__name__)


class TTSService:
    """Generates and caches speech audio from text using Coqui TTS."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.cache_dir = Path(config.tts_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Loading TTS model '%s'...", config.voice_model)
        self.model = TTS(
            model_name=config.voice_model,
            gpu=False,
            progress_bar=False,
        )
        logger.info("TTS model loaded.")

    def synthesize(self, text: str) -> bytes:
        """Generate WAV audio bytes for the given text, using a file cache."""
        cache_key = hashlib.md5(text.encode()).hexdigest()
        audio_path = self.cache_dir / f"{cache_key}.wav"
        if not audio_path.exists():
            self.model.tts_to_file(
                text=text,
                file_path=str(audio_path),
                speaker=self.config.voice_speaker,
                speed=self.config.voice_speed,
            )
        return audio_path.read_bytes()
