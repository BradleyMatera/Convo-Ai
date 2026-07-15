"""SQLite-backed conversation history using SQLModel."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Field, Session, SQLModel, create_engine, select

from ..config import Config

logger = logging.getLogger(__name__)


class ConversationEntry(SQLModel, table=True):
    """A single user/assistant exchange."""

    id: int | None = Field(default=None, primary_key=True)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_text: str = ""
    assistant_text: str = ""
    mood: str = "neutral"


class Database:
    """Thin wrapper around a SQLModel SQLite database."""

    def __init__(self, config: Config) -> None:
        self.config = config
        db_path = config.database_url.replace("sqlite:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(config.database_url, echo=False)
        SQLModel.metadata.create_all(self.engine)
        logger.info("Database initialized at %s", config.database_url)

    def add_entry(
        self,
        user_text: str,
        assistant_text: str,
        mood: str = "neutral",
    ) -> ConversationEntry:
        entry = ConversationEntry(
            user_text=user_text,
            assistant_text=assistant_text,
            mood=mood,
        )
        with Session(self.engine) as session:
            session.add(entry)
            session.commit()
            session.refresh(entry)
        return entry

    def get_history(self, limit: int = 50) -> list[ConversationEntry]:
        with Session(self.engine) as session:
            statement = select(ConversationEntry).order_by(ConversationEntry.id.desc()).limit(limit)
            return list(session.exec(statement).all())

    def clear_history(self) -> None:
        with Session(self.engine) as session:
            for entry in session.exec(select(ConversationEntry)).all():
                session.delete(entry)
            session.commit()
