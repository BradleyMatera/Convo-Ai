"""FastAPI application for Convo-AI."""

from __future__ import annotations

import base64
import json
import logging
import re
import tempfile
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ..config import Config
from ..services.database import Database
from ..services.ollama import OllamaService
from ..services.stt import STTService
from ..services.tts import TTSService

logger = logging.getLogger(__name__)


def naturalize_response(text: str) -> str:
    """Make the response more natural and Jarvis-like."""
    text = re.sub(r"^(Assistant|AI):\s*", "", text)
    text = re.sub(r"([.!?])\s+", r"\1\n", text)
    text = text.strip().capitalize()
    if text.endswith((".", "!", "?")):
        text = f"{text} Sir."
    return text


def analyze_mood(text: str) -> str:
    """Very lightweight keyword-based mood analysis."""
    if not text:
        return "unknown"
    t = text.lower()
    if any(w in t for w in ["good", "great", "awesome", "love", "happy", "amazing"]):
        return "positive"
    if any(w in t for w in ["bad", "sad", "hate", "angry", "upset", "frustrated"]):
        return "negative"
    return "neutral"


def create_app(config: Config | None = None) -> FastAPI:
    """Build and return the FastAPI application."""
    if config is None:
        config = Config.from_file()

    app = FastAPI(title="Convo-AI", version="0.2.0", description="Local-first voice AI assistant")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Lazy-load heavy services so the app can start for tests without models
    state: dict[str, Any] = {"config": config}

    @app.on_event("startup")
    async def _startup() -> None:
        try:
            state["db"] = Database(config)
            state["ollama"] = OllamaService(config)
            state["stt"] = STTService(config)
            state["tts"] = TTSService(config)
            logger.info("All services initialized.")
        except Exception as exc:
            logger.error("Failed to initialize one or more services: %s", exc)

    @app.get("/")
    async def root() -> HTMLResponse:
        return HTMLResponse("<h1>Convo-AI Server is running</h1>")

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse(
            {
                "status": "ok",
                "model": config.model,
                "services": {
                    "ollama": "ollama" in state,
                    "stt": "stt" in state,
                    "tts": "tts" in state,
                    "db": "db" in state,
                },
            }
        )

    @app.get("/api/models")
    async def list_models() -> JSONResponse:
        """List available Ollama models from the local server."""
        try:
            resp = requests.get(
                config.ollama_api_url.replace("/api/generate", "/api/tags"),
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            models = [
                {
                    "name": m.get("name", ""),
                    "size": m.get("size", 0),
                    "modified": m.get("modified_at", ""),
                }
                for m in data.get("models", [])
            ]
            return JSONResponse({"models": models, "current": config.model})
        except Exception as exc:
            logger.error("Failed to list models: %s", exc)
            return JSONResponse(
                {"models": [], "current": config.model, "error": str(exc)},
                status_code=200,
            )

    @app.put("/api/config")
    async def update_config(payload: dict[str, Any]) -> dict[str, Any]:
        """Update runtime configuration (model, temperature, voice settings)."""
        old_model = config.model
        if "model" in payload:
            config.model = payload["model"]
            # Reinitialize ollama service with new model
            if "ollama" in state:
                state["ollama"] = OllamaService(config)
        if "temperature" in payload:
            config.model_settings.temperature = float(payload["temperature"])
        if "voice_speaker" in payload:
            config.voice_speaker = payload["voice_speaker"]
        if "voice_speed" in payload:
            config.voice_speed = float(payload["voice_speed"])
        if "max_predict" in payload:
            config.model_settings.num_predict = int(payload["max_predict"])
        return {
            "status": "ok",
            "model": config.model,
            "temperature": config.model_settings.temperature,
            "voice_speaker": config.voice_speaker,
            "voice_speed": config.voice_speed,
            "model_changed": old_model != config.model,
        }

    @app.get("/api/config")
    async def get_config() -> dict[str, Any]:
        """Return current runtime configuration."""
        return {
            "model": config.model,
            "temperature": config.model_settings.temperature,
            "top_p": config.model_settings.top_p,
            "top_k": config.model_settings.top_k,
            "num_predict": config.model_settings.num_predict,
            "voice_model": config.voice_model,
            "voice_speaker": config.voice_speaker,
            "voice_speed": config.voice_speed,
            "whisper_model_size": config.whisper_model_size,
        }

    @app.get("/api/history")
    async def get_history(limit: int = 50) -> list[dict[str, Any]]:
        db: Database | None = state.get("db")
        if db is None:
            return []
        entries = db.get_history(limit=limit)
        return [entry.model_dump() for entry in entries]

    @app.delete("/api/history")
    async def clear_history() -> dict[str, str]:
        db: Database | None = state.get("db")
        if db is None:
            return {"status": "no database"}
        db.clear_history()
        return {"status": "cleared"}

    @app.post("/api/chat")
    async def chat(payload: dict[str, Any]) -> dict[str, Any]:
        """REST endpoint for text-only chat (no audio)."""
        prompt = (payload.get("text") or "").strip()
        if not prompt:
            return {"error": "empty prompt"}
        ollama: OllamaService | None = state.get("ollama")
        if ollama is None:
            return {"error": "ollama service not initialized"}
        enhanced = ollama.build_prompt(prompt)
        raw = ollama.generate(enhanced)
        response_text = naturalize_response(raw)
        mood = analyze_mood(prompt)
        db: Database | None = state.get("db")
        if db is not None:
            db.add_entry(user_text=prompt, assistant_text=response_text, mood=mood)
        return {"text": prompt, "response": response_text, "mood": mood}

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            data = await websocket.receive()
            prompt = ""

            if "bytes" in data:
                audio_data = data["bytes"]
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:  # noqa: SIM115
                    f.write(audio_data)
                    temp_path = f.name
                stt: STTService | None = state.get("stt")
                if stt is None:
                    await websocket.send_text(json.dumps({"error": "stt not initialized"}))
                    return
                prompt = stt.transcribe(temp_path)
                Path(temp_path).unlink(missing_ok=True)
            elif "text" in data:
                try:
                    text_data = json.loads(data["text"])
                    prompt = text_data.get("text", "")
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({"error": "invalid json"}))
                    return
            else:
                await websocket.send_text(json.dumps({"error": "invalid data format"}))
                return

            if not prompt:
                await websocket.send_text(json.dumps({"error": "empty prompt"}))
                return

            ollama: OllamaService | None = state.get("ollama")
            if ollama is None:
                await websocket.send_text(json.dumps({"error": "ollama not initialized"}))
                return

            enhanced = ollama.build_prompt(prompt)
            raw = ollama.generate(enhanced)
            response_text = naturalize_response(raw)
            mood = analyze_mood(prompt)

            tts: TTSService | None = state.get("tts")
            audio_b64 = ""
            if tts is not None:
                wav_bytes = tts.synthesize(response_text)
                audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")

            db: Database | None = state.get("db")
            if db is not None:
                db.add_entry(user_text=prompt, assistant_text=response_text, mood=mood)

            await websocket.send_text(
                json.dumps(
                    {
                        "text": prompt,
                        "response": response_text,
                        "audio": audio_b64,
                        "mood": mood,
                        "model": config.model,
                    }
                )
            )
        except WebSocketDisconnect:
            logger.info("WebSocket client disconnected")
        except Exception as exc:
            logger.error("WebSocket error: %s", exc)
            await websocket.send_text(json.dumps({"error": str(exc)}))

    # Serve built frontend if it exists
    frontend_dist = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/app", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

    return app
