"""Tests for the Ollama service."""

from unittest.mock import MagicMock, patch

from convo_ai.config import Config
from convo_ai.services.ollama import OllamaService


def test_build_prompt() -> None:
    svc = OllamaService(Config())
    prompt = svc.build_prompt("Hello")
    assert "Jarvis" in prompt
    assert "Hello" in prompt


def test_generate_with_mock() -> None:
    svc = OllamaService(Config())
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "  Hello Sir.  "}
    mock_response.raise_for_status = MagicMock()

    with patch("convo_ai.services.ollama.requests.post", return_value=mock_response):
        result = svc.generate("test prompt")
        assert result == "Hello Sir."


def test_generate_empty_response() -> None:
    svc = OllamaService(Config())
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": ""}
    mock_response.raise_for_status = MagicMock()

    with patch("convo_ai.services.ollama.requests.post", return_value=mock_response):
        result = svc.generate("test")
        assert "apologize" in result.lower()
