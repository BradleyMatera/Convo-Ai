FROM python:3.11-slim AS base

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files
COPY pyproject.toml README.md LICENSE ./
COPY src/ ./src/
COPY config.json ./

# Install the package
RUN pip install --no-cache-dir -e ".[dev]"

# Build frontend (multi-stage)
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Final stage
FROM base AS final
COPY --from=frontend-builder /frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["convo-ai-server"]
