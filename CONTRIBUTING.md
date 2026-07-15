# Contributing to Convo-AI

Thank you for your interest in contributing! This document covers the workflow and expectations.

## Quick start

```bash
git clone https://github.com/BradleyMatera/Convo-Ai.git
cd Convo-Ai
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
cd frontend && npm install && cd ..
```

## Development workflow

1. **Fork** the repository and create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the conventions below.

3. **Run tests** before opening a PR:

   ```bash
   pytest tests/ -v
   ```

4. **Lint and format**:

   ```bash
   ruff check src tests
   black src tests
   mypy src/convo_ai --ignore-missing-imports
   ```

5. **If you changed the frontend**, build it:

   ```bash
   cd frontend && npm run build && cd ..
   ```

6. **Commit** with clear, descriptive messages.

7. **Open a Pull Request** against `main`.

## Code conventions

- Python 3.10+ — use `from __future__ import annotations` for forward references.
- Follow existing patterns in `src/convo_ai/`.
- Add new dependencies to `pyproject.toml` with a lower-bound version.
- Keep the project local-first — no cloud API keys unless explicitly requested.
- Add tests for new functionality in `tests/`.
- Use `ruff` and `black` configurations defined in `pyproject.toml`.

## Frontend conventions

- React 18 + TypeScript + Tailwind CSS.
- Components are functional with hooks.
- Use the existing `jarvis` color palette in `tailwind.config.js`.
- No external UI libraries — keep it lean.

## Commit messages

No enforced convention, but keep messages clear and descriptive:

```
Add streaming WebSocket support for token-by-token responses
Fix audio playback fallback on Linux
Update README with Docker instructions
```

## Testing

- Unit tests: `tests/test_*.py`
- Integration tests: API endpoints via `TestClient`
- Run all: `pytest tests/ -v`
- Coverage report is generated automatically by `pytest-cov`

## Pull request checklist

- [ ] Tests pass (`pytest tests/ -v`)
- [ ] Lint passes (`ruff check src tests`)
- [ ] Format passes (`black --check src tests`)
- [ ] Frontend builds (if changed)
- [ ] README updated (if needed)
- [ ] No secrets or API keys committed

## Reporting bugs

Open a GitHub issue with:

1. OS and Python version
2. Steps to reproduce
3. Expected vs actual behavior
4. Relevant logs (with secrets redacted)

## Feature requests

Open a GitHub issue with the `enhancement` label. Describe the use case and proposed solution.
