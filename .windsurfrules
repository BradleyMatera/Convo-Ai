# Convo-AI Agent Rules

This file is the canonical source of truth for any AI agent working on this repository.

## Project identity

- Convo-AI is a **local-first, voice-enabled conversational AI assistant**.
- Python backend (FastAPI WebSocket server + CLI client) and React frontend.
- The assistant persona is a polite, British-English "Jarvis" style assistant.
- All AI processing is local: **Ollama** for the LLM, **faster-whisper** for STT, **Coqui TTS** for TTS.

## Architecture (v0.2.0)

- `src/convo_ai/` — Python package (installed via `pip install -e ".[dev]"`)
  - `api/app.py` — FastAPI app with WebSocket `/ws`, REST `/api/chat`, `/api/history`, `/health`
  - `services/ollama.py` — Ollama LLM service
  - `services/stt.py` — faster-whisper speech-to-text
  - `services/tts.py` — Coqui TTS with file caching
  - `services/database.py` — SQLite + SQLModel conversation persistence
  - `client/cli.py` — Cross-platform CLI client (sounddevice/soundfile)
  - `config.py` — Dataclass-based configuration from `config.json`
  - `cli.py` — Entry points: `convo-ai-server`, `convo-ai-cli`
- `frontend/` — React 18 + Vite 5 + Tailwind CSS 3 web UI
- `website/` — Marketing landing site deployed to GitHub Pages
- `tests/` — pytest test suite
- `Dockerfile` + `docker-compose.yml` — Containerized deployment

## Build and run

```bash
# Python setup
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Start server
convo-ai-server

# Start CLI (separate terminal)
convo-ai-cli

# Frontend dev
cd frontend && npm install && npm run dev

# Run tests
pytest tests/ -v

# Lint
ruff check src tests
black --check src tests
```

## Key configuration

- `config.json` — all runtime config (model, TTS, voice, ports, database)
- `pyproject.toml` — Python project, dependencies, ruff/black/mypy/pytest config
- `frontend/vite.config.ts` — Vite dev server with WebSocket/API proxy to :8000
- `website/vite.config.ts` — Base path `/Convo-Ai/` for GitHub Pages

## Code conventions

- Python 3.10+, use `from __future__ import annotations`
- Add deps to `pyproject.toml` with lower-bound versions
- Keep local-first — no cloud API keys unless explicitly requested
- React components are functional with hooks, Tailwind for styling
- Add tests in `tests/` for new functionality
- Run `ruff check` and `black --check` before committing

## Generated files (gitignored)

- `tts_cache/`, `logs/`, `*.wav`, `convo_ai.db`, `test_convo.db`
- `frontend/dist/`, `website/dist/`, `node_modules/`
- `.mypy_cache/`, `.pytest_cache/`, `.ruff_cache/`

## Common pitfalls

- `config.json` must be valid JSON and present in the repo root
- Ollama must be running and the configured model must be pulled
- First run downloads Whisper and TTS weights — slow startup expected
- Frontend must be built (`npm run build`) for the server to serve it at `/app`
- Tests use mocked Ollama — no real model needed for `pytest`
