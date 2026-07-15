"""Configurable system prompt / personality service.

The system prompt is stored in SQLite and can be edited from the UI.
This lets the user customize Jarvis's personality, name, speaking style,
and behavior without touching code.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlmodel import Field, Session, SQLModel, create_engine

from ..config import Config

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = (
    "You are Jarvis, a sophisticated AI assistant inspired by Iron Man's JARVIS.\n"
    'You are helpful, professional, and slightly formal. '
    'You address the user as "Sir" or "Madam".\n'
    "You have a British accent and speak in a clear, concise manner.\n"
    "You are intelligent, witty, and always ready to help.\n"
    "You remember details about the user and use them naturally.\n"
    "Keep responses concise unless asked for detail."
)


class SystemPromptEntry(SQLModel, table=True):
    """Singleton row storing the active system prompt."""

    id: int | None = Field(default=1, primary_key=True)
    content: str = Field(default=DEFAULT_SYSTEM_PROMPT)
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PromptService:
    """Manages the configurable system prompt."""

    def __init__(self, config: Config) -> None:
        self.config = config
        db_path = config.database_url.replace("sqlite:///", "").replace(".db", "_prompt.db")
        self.engine = create_engine(f"sqlite:///{db_path}", echo=False)
        SQLModel.metadata.create_all(self.engine)
        # Seed default if empty
        with Session(self.engine) as session:
            existing = session.get(SystemPromptEntry, 1)
            if existing is None:
                session.add(SystemPromptEntry(id=1, content=DEFAULT_SYSTEM_PROMPT))
                session.commit()
        logger.info("Prompt service initialized.")

    def get_prompt(self) -> str:
        """Return the current system prompt."""
        with Session(self.engine) as session:
            entry = session.get(SystemPromptEntry, 1)
            if entry is None:
                return DEFAULT_SYSTEM_PROMPT
            return entry.content

    def set_prompt(self, content: str) -> str:
        """Update the system prompt."""
        with Session(self.engine) as session:
            entry = session.get(SystemPromptEntry, 1)
            if entry is None:
                entry = SystemPromptEntry(id=1, content=content)
            else:
                entry.content = content
                entry.updated_at = datetime.now(timezone.utc).isoformat()
            session.add(entry)
            session.commit()
            logger.info("System prompt updated (%d chars)", len(content))
            return entry.content

    def reset_prompt(self) -> str:
        """Reset to the default system prompt."""
        return self.set_prompt(DEFAULT_SYSTEM_PROMPT)

    def build_prompt(self, user_input: str, memory_context: str = "") -> str:
        """Build the full prompt: system prompt + memory context + user input."""
        parts = [self.get_prompt()]
        if memory_context:
            parts.append(f"\n--- Memory ---\n{memory_context}")
        parts.append(f"\nRespond to this: {user_input}")
        return "\n".join(parts)
