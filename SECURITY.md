# Security Policy

## Overview

Convo-AI is designed for **local, single-user use**. It does not include authentication, authorization, or transport encryption by default.

## Known limitations

- The FastAPI server binds to `0.0.0.0:8000`, making it accessible on your local network.
- WebSocket and REST endpoints have no authentication.
- No rate limiting is configured.
- No input validation or sanitization beyond basic JSON parsing.

## Recommendations

- **Do not expose Convo-AI to the public internet** without adding authentication and HTTPS.
- If you need remote access, use a reverse proxy (Nginx, Caddy) with auth and TLS.
- Run behind a firewall or bind to `127.0.0.1` by setting `"host": "127.0.0.1"` in `config.json`.
- Do not commit `config.json` with sensitive values to a public repository.

## Secrets

Convo-AI does not require API keys or credentials. All AI processing is local via Ollama, Whisper, and Coqui TTS.

If you add `.env` files for custom configuration:

- Add them to `.gitignore`
- Never commit real secrets
- Use `.env.example` for documentation only

## Reporting a vulnerability

If you discover a security issue:

1. **Do not** open a public GitHub issue.
2. Email the maintainer directly or open a private security advisory on GitHub.
3. Allow reasonable time for a response before public disclosure.

We appreciate responsible disclosure and will credit reporters.
