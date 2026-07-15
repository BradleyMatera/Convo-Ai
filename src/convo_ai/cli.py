"""Entry points for Convo-AI server and CLI."""

from __future__ import annotations

import logging

import uvicorn

from .client.cli import ConvoClient
from .config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def run_server() -> None:
    """Start the FastAPI/Uvicorn server."""
    config = Config.from_file()
    logger.info("Starting Convo-AI server on %s:%s", config.host, config.port)
    uvicorn.run("convo_ai.api.app:create_app", host=config.host, port=config.port, factory=True)


def run_client() -> None:
    """Start the interactive CLI client."""
    config = Config.from_file()
    client = ConvoClient(config)
    import asyncio

    asyncio.run(client.run())


if __name__ == "__main__":
    run_server()
