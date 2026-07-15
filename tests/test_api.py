"""Tests for the API app endpoints."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from convo_ai.api.app import analyze_mood, create_app, naturalize_response
from convo_ai.config import Config


def test_naturalize_response() -> None:
    assert "Sir." in naturalize_response("hello world.")
    # No terminal punctuation → no "Sir." suffix
    assert naturalize_response("Assistant: hello") == "Hello"
    assert naturalize_response("AI: done.") == "Done. Sir."


def test_analyze_mood() -> None:
    assert analyze_mood("I am happy") == "positive"
    assert analyze_mood("I am angry") == "negative"
    assert analyze_mood("It is raining") == "neutral"
    assert analyze_mood("") == "unknown"


def test_root_endpoint() -> None:
    app = create_app(Config())
    with TestClient(app) as client:
        resp = client.get("/")
        assert resp.status_code == 200
        assert "Convo-AI" in resp.text


def test_health_endpoint() -> None:
    app = create_app(Config())
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["model"] == "llama3:latest"


def test_chat_endpoint_empty() -> None:
    app = create_app(Config())
    with TestClient(app) as client:
        resp = client.post("/api/chat", json={"text": ""})
        assert resp.status_code == 200
        assert resp.json()["error"] == "empty prompt"


def test_chat_endpoint_with_mock() -> None:
    app = create_app(Config())
    with TestClient(app) as client, patch.object(app.router, "routes", app.router.routes):
        # TestClient triggers startup; services may fail to init (no models)
        # We test the empty-prompt path which doesn't need ollama
        resp = client.post("/api/chat", json={"text": "  "})
        assert resp.json()["error"] == "empty prompt"


def test_history_endpoints() -> None:
    app = create_app(Config(database_url="sqlite:///test_convo.db"))
    with TestClient(app) as client:
        # GET history (may be empty if db didn't init)
        resp = client.get("/api/history")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

        # DELETE history
        resp = client.delete("/api/history")
        assert resp.status_code == 200
