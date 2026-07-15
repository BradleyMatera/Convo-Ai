"""Ollama LLM service."""

from __future__ import annotations

import logging
from typing import Any

import requests

from ..config import Config, ModelSettings

logger = logging.getLogger(__name__)


class OllamaService:
    """Wraps calls to a local Ollama /api/generate endpoint."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.api_url = config.ollama_api_url

    def generate(self, prompt: str) -> str:
        """Send a prompt to Ollama and return the response text."""
        settings: ModelSettings = self.config.model_settings
        payload: dict[str, Any] = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": settings.temperature,
                "top_p": settings.top_p,
                "top_k": settings.top_k,
                "num_predict": settings.num_predict,
                "repeat_penalty": settings.repeat_penalty,
                "presence_penalty": settings.presence_penalty,
                "frequency_penalty": settings.frequency_penalty,
                "num_ctx": settings.num_ctx,
            },
        }
        logger.debug("Calling Ollama model=%s", self.config.model)
        response = requests.post(self.api_url, json=payload, timeout=60)
        response.raise_for_status()
        text = response.json().get("response", "").strip()
        if not text:
            text = "I do apologize, I didn't quite catch that. Could you please repeat?"
        return text

    def build_prompt(self, user_input: str) -> str:
        """Wrap user input with the Jarvis persona."""
        return (
            "You are Jarvis, a sophisticated AI assistant. You are helpful, professional, "
            "and slightly formal. You address the user as 'Sir' or 'Madam'. You have a British "
            f"accent and speak in a clear, concise manner. Respond to this: {user_input}"
        )
