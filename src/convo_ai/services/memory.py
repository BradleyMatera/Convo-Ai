"""Memory service: SQLite-backed fact storage with Ollama embedding RAG retrieval.

The memory system lets Convo-AI learn about the user over time. Facts are
extracted from conversations, embedded via Ollama, and stored in SQLite.
On each new message, relevant memories are retrieved via cosine similarity
and injected into the LLM prompt as context.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from typing import Any

import requests
from sqlmodel import Field, Session, SQLModel, create_engine, select

from ..config import Config

logger = logging.getLogger(__name__)


class MemoryEntry(SQLModel, table=True):
    """A single stored memory / fact about the user."""

    id: int | None = Field(default=None, primary_key=True)
    content: str = ""
    category: str = "general"  # general, preference, fact, instruction
    importance: int = Field(default=5)  # 1-10
    embedding: str = Field(default="")  # JSON list of floats
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    times_retrieved: int = Field(default=0)


class MemoryService:
    """Manages long-term memory with embedding-based RAG retrieval."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.embed_model = "nomic-embed-text"
        self.embed_url = config.ollama_api_url.replace("/api/generate", "/api/embeddings")
        # Use a separate database file for memories
        db_path = config.database_url.replace("sqlite:///", "").replace(".db", "_memory.db")
        self.engine = create_engine(f"sqlite:///{db_path}", echo=False)
        SQLModel.metadata.create_all(self.engine)
        logger.info("Memory service initialized with embeddings model=%s", self.embed_model)

    def _embed(self, text: str) -> list[float]:
        """Generate an embedding vector via Ollama."""
        try:
            resp = requests.post(
                self.embed_url,
                json={"model": self.embed_model, "prompt": text},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json().get("embedding", [])
        except Exception as exc:
            logger.warning("Embedding failed: %s — using empty vector", exc)
            return []

    def add_memory(
        self,
        content: str,
        category: str = "general",
        importance: int = 5,
    ) -> MemoryEntry:
        """Store a new memory with its embedding."""
        embedding = self._embed(content)
        entry = MemoryEntry(
            content=content,
            category=category,
            importance=importance,
            embedding=json.dumps(embedding),
        )
        with Session(self.engine) as session:
            session.add(entry)
            session.commit()
            session.refresh(entry)
        logger.info("Memory stored [%s]: %s", category, content[:80])
        return entry

    def search_relevant(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        """Find the top-k most relevant memories for a query using cosine similarity."""
        query_embedding = self._embed(query)
        if not query_embedding:
            # Fallback: return recent important memories
            with Session(self.engine) as session:
                stmt = (
                    select(MemoryEntry)
                    .order_by(MemoryEntry.importance.desc(), MemoryEntry.timestamp.desc())
                    .limit(k)
                )
                return [self._entry_to_dict(e) for e in session.exec(stmt).all()]

        with Session(self.engine) as session:
            all_memories = list(session.exec(select(MemoryEntry)).all())
            if not all_memories:
                return []

            scored: list[tuple[float, MemoryEntry]] = []
            for mem in all_memories:
                if not mem.embedding:
                    continue
                mem_emb = json.loads(mem.embedding)
                sim = _cosine_similarity(query_embedding, mem_emb)
                # Boost by importance
                score = sim + (mem.importance / 20.0)
                scored.append((score, mem))

            scored.sort(key=lambda x: x[0], reverse=True)
            results = []
            for score, mem in scored[:k]:
                mem.times_retrieved += 1
                results.append(self._entry_to_dict(mem, score=score))
            session.commit()
            return results

    def get_all_memories(self) -> list[dict[str, Any]]:
        """List all stored memories."""
        with Session(self.engine) as session:
            entries = list(
                session.exec(
                    select(MemoryEntry).order_by(MemoryEntry.timestamp.desc())
                ).all()
            )
            return [self._entry_to_dict(e) for e in entries]

    def delete_memory(self, memory_id: int) -> bool:
        """Delete a single memory by ID."""
        with Session(self.engine) as session:
            entry = session.get(MemoryEntry, memory_id)
            if entry is None:
                return False
            session.delete(entry)
            session.commit()
            return True

    def clear_all(self) -> int:
        """Wipe all memories. Returns count deleted."""
        with Session(self.engine) as session:
            entries = list(session.exec(select(MemoryEntry)).all())
            count = len(entries)
            for e in entries:
                session.delete(e)
            session.commit()
            return count

    def update_memory(self, memory_id: int, content: str) -> dict[str, Any] | None:
        """Update a memory's content and re-embed it."""
        with Session(self.engine) as session:
            entry = session.get(MemoryEntry, memory_id)
            if entry is None:
                return None
            entry.content = content
            entry.embedding = json.dumps(self._embed(content))
            session.add(entry)
            session.commit()
            session.refresh(entry)
            return self._entry_to_dict(entry)

    def _entry_to_dict(self, entry: MemoryEntry, score: float = 0.0) -> dict[str, Any]:
        return {
            "id": entry.id,
            "content": entry.content,
            "category": entry.category,
            "importance": entry.importance,
            "timestamp": entry.timestamp,
            "times_retrieved": entry.times_retrieved,
            "relevance_score": round(score, 4),
        }

    def build_context_block(self, query: str, k: int = 5) -> str:
        """Build a context string from relevant memories to inject into the LLM prompt."""
        memories = self.search_relevant(query, k=k)
        if not memories:
            return ""
        lines = ["Here is what you remember about the user:"]
        for m in memories:
            lines.append(f"- [{m['category']}] {m['content']}")
        lines.append(
            "Use this information naturally in your response. "
            "Do not explicitly say 'I remember'."
        )
        return "\n".join(lines)

    def extract_facts(self, user_input: str, assistant_response: str) -> list[str]:
        """Use the LLM to extract memorable facts from a conversation exchange."""
        extract_prompt = (
            "You are a memory extraction system. Analyze this conversation and extract "
            "any facts worth remembering about the user for future conversations. "
            "Focus on: personal preferences, name, habits, interests, goals, important dates, "
            "instructions, or corrections. Ignore generic chatter.\n\n"
            f"User said: {user_input}\n"
            f"Assistant replied: {assistant_response}\n\n"
            "Output one fact per line, prefixed with a category in brackets. "
            "Categories: [name], [preference], [fact], [instruction], [goal].\n"
            "If nothing worth remembering, output exactly: NONE\n"
            "Examples:\n"
            "[name] The user's name is Bradley\n"
            "[preference] The user prefers concise answers\n"
            "[instruction] Always address the user as Sir"
        )
        try:
            resp = requests.post(
                self.config.ollama_api_url,
                json={
                    "model": self.config.model,
                    "prompt": extract_prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 200},
                },
                timeout=30,
            )
            resp.raise_for_status()
            text = resp.json().get("response", "").strip()
            if text.upper() == "NONE" or not text:
                return []
            facts = []
            for line in text.split("\n"):
                line = line.strip()
                if not line or line.upper() == "NONE":
                    continue
                # Parse "[category] content"
                if line.startswith("["):
                    bracket_end = line.find("]")
                    if bracket_end > 0:
                        category = line[1:bracket_end].lower()
                        content = line[bracket_end + 1 :].strip()
                        if content:
                            facts.append((category, content))
                else:
                    facts.append(("general", line))
            return facts
        except Exception as exc:
            logger.warning("Fact extraction failed: %s", exc)
            return []


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)
