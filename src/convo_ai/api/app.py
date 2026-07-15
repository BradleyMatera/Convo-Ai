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
from ..services.memory import MemoryService
from ..services.ollama import OllamaService
from ..services.prompt import DEFAULT_SYSTEM_PROMPT, PromptService
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

    app = FastAPI(
        title="Convo-AI",
        version="0.3.0",
        description="Local-first voice AI with RAG memory",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    state: dict[str, Any] = {"config": config}

    @app.on_event("startup")
    async def _startup() -> None:
        try:
            state["db"] = Database(config)
            state["ollama"] = OllamaService(config)
            state["stt"] = STTService(config)
            state["tts"] = TTSService(config)
            state["memory"] = MemoryService(config)
            state["prompt"] = PromptService(config)
            logger.info("All services initialized (including memory + prompt).")
        except Exception as exc:
            logger.error("Failed to initialize one or more services: %s", exc)

    # ─── Basic endpoints ──────────────────────────────────────────────

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
                    "memory": "memory" in state,
                    "prompt": "prompt" in state,
                },
            }
        )

    # ─── Model management ─────────────────────────────────────────────

    @app.get("/api/models")
    async def list_models() -> JSONResponse:
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
            return JSONResponse({"models": [], "current": config.model, "error": str(exc)})

    @app.put("/api/config")
    async def update_config(payload: dict[str, Any]) -> dict[str, Any]:
        old_model = config.model
        if "model" in payload:
            config.model = payload["model"]
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
            "num_predict": config.model_settings.num_predict,
            "model_changed": old_model != config.model,
        }

    @app.get("/api/config")
    async def get_config() -> dict[str, Any]:
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

    # ─── Memory endpoints ─────────────────────────────────────────────

    @app.get("/api/memory")
    async def get_memories() -> list[dict[str, Any]]:
        mem: MemoryService | None = state.get("memory")
        if mem is None:
            return []
        return mem.get_all_memories()

    @app.post("/api/memory")
    async def add_memory(payload: dict[str, Any]) -> dict[str, Any]:
        mem: MemoryService | None = state.get("memory")
        if mem is None:
            return {"error": "memory service not initialized"}
        content = (payload.get("content") or "").strip()
        if not content:
            return {"error": "empty content"}
        category = payload.get("category", "general")
        importance = int(payload.get("importance", 5))
        entry = mem.add_memory(content, category=category, importance=importance)
        return entry

    @app.delete("/api/memory/{memory_id}")
    async def delete_memory(memory_id: int) -> dict[str, str]:
        mem: MemoryService | None = state.get("memory")
        if mem is None:
            return {"status": "no memory service"}
        deleted = mem.delete_memory(memory_id)
        return {"status": "deleted" if deleted else "not found"}

    @app.delete("/api/memory")
    async def clear_memories() -> dict[str, Any]:
        mem: MemoryService | None = state.get("memory")
        if mem is None:
            return {"status": "no memory service"}
        count = mem.clear_all()
        return {"status": "cleared", "count": count}

    @app.put("/api/memory/{memory_id}")
    async def update_memory(memory_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        mem: MemoryService | None = state.get("memory")
        if mem is None:
            return {"error": "memory service not initialized"}
        content = (payload.get("content") or "").strip()
        if not content:
            return {"error": "empty content"}
        result = mem.update_memory(memory_id, content)
        if result is None:
            return {"error": "memory not found"}
        return result

    # ─── System prompt endpoints ──────────────────────────────────────

    @app.get("/api/prompt")
    async def get_prompt() -> dict[str, Any]:
        prompt_svc: PromptService | None = state.get("prompt")
        if prompt_svc is None:
            return {"prompt": DEFAULT_SYSTEM_PROMPT, "default": DEFAULT_SYSTEM_PROMPT}
        return {"prompt": prompt_svc.get_prompt(), "default": DEFAULT_SYSTEM_PROMPT}

    @app.put("/api/prompt")
    async def update_prompt(payload: dict[str, Any]) -> dict[str, Any]:
        prompt_svc: PromptService | None = state.get("prompt")
        if prompt_svc is None:
            return {"error": "prompt service not initialized"}
        content = (payload.get("prompt") or "").strip()
        if not content:
            return {"error": "empty prompt"}
        updated = prompt_svc.set_prompt(content)
        return {"status": "ok", "prompt": updated}

    @app.post("/api/prompt/reset")
    async def reset_prompt() -> dict[str, Any]:
        prompt_svc: PromptService | None = state.get("prompt")
        if prompt_svc is None:
            return {"error": "prompt service not initialized"}
        reset = prompt_svc.reset_prompt()
        return {"status": "ok", "prompt": reset}

    # ─── History endpoints ────────────────────────────────────────────

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

    # ─── Chat (REST) ──────────────────────────────────────────────────

    @app.post("/api/chat")
    async def chat(payload: dict[str, Any]) -> dict[str, Any]:
        prompt = (payload.get("text") or "").strip()
        if not prompt:
            return {"error": "empty prompt"}

        ollama: OllamaService | None = state.get("ollama")
        if ollama is None:
            return {"error": "ollama service not initialized"}

        # Retrieve relevant memories (RAG)
        memory_svc: MemoryService | None = state.get("memory")
        prompt_svc: PromptService | None = state.get("prompt")
        memories_used: list[dict[str, Any]] = []
        memory_context = ""
        if memory_svc is not None:
            memories_used = memory_svc.search_relevant(prompt, k=5)
            memory_context = memory_svc.build_context_block(prompt, k=5)

        # Build the full prompt with system prompt + memory + user input
        if prompt_svc is not None:
            full_prompt = prompt_svc.build_prompt(prompt, memory_context)
        else:
            full_prompt = ollama.build_prompt(prompt)

        raw = ollama.generate(full_prompt)
        response_text = naturalize_response(raw)
        mood = analyze_mood(prompt)

        # Extract and store new facts
        new_facts: list[dict[str, Any]] = []
        if memory_svc is not None:
            facts = memory_svc.extract_facts(prompt, response_text)
            for category, content in facts:
                entry = memory_svc.add_memory(content, category=category)
                new_facts.append(entry)

        # Persist conversation
        db: Database | None = state.get("db")
        if db is not None:
            db.add_entry(user_text=prompt, assistant_text=response_text, mood=mood)

        return {
            "text": prompt,
            "response": response_text,
            "mood": mood,
            "model": config.model,
            "memories_used": len(memories_used),
            "new_facts": len(new_facts),
        }

    # ─── Chat (WebSocket) ─────────────────────────────────────────────

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

            # RAG: retrieve relevant memories
            memory_svc: MemoryService | None = state.get("memory")
            prompt_svc: PromptService | None = state.get("prompt")
            memories_used: list[dict[str, Any]] = []
            memory_context = ""
            if memory_svc is not None:
                memories_used = memory_svc.search_relevant(prompt, k=5)
                memory_context = memory_svc.build_context_block(prompt, k=5)

            # Build full prompt
            if prompt_svc is not None:
                full_prompt = prompt_svc.build_prompt(prompt, memory_context)
            else:
                full_prompt = ollama.build_prompt(prompt)

            raw = ollama.generate(full_prompt)
            response_text = naturalize_response(raw)
            mood = analyze_mood(prompt)

            # Extract and store new facts
            new_facts: list[dict[str, Any]] = []
            if memory_svc is not None:
                facts = memory_svc.extract_facts(prompt, response_text)
                for category, content in facts:
                    entry = memory_svc.add_memory(content, category=category)
                    new_facts.append(entry)

            # TTS
            tts: TTSService | None = state.get("tts")
            audio_b64 = ""
            if tts is not None:
                wav_bytes = tts.synthesize(response_text)
                audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")

            # Persist conversation
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
                        "memories_used": len(memories_used),
                        "new_facts": len(new_facts),
                        "new_fact_details": new_facts,
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
