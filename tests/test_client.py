"""Tests for the CLI client."""

from convo_ai.client.cli import ConvoClient
from convo_ai.config import Config


def test_mood_analysis() -> None:
    client = ConvoClient(Config())
    assert client.analyze_mood("I love this") == "positive"
    assert client.analyze_mood("I hate this") == "negative"
    assert client.analyze_mood("It is Tuesday") == "neutral"
    assert client.analyze_mood("") == "unknown"
    assert client.mood_state["positive"] == 1
    assert client.mood_state["negative"] == 1
    assert client.mood_state["neutral"] == 1


def test_session_log() -> None:
    client = ConvoClient(Config())
    client.session_log.append({"timestamp": "2024-01-01", "user": "hi", "assistant": "hello"})
    assert len(client.session_log) == 1
