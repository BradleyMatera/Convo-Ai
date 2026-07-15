"""Cross-platform CLI client for Convo-AI."""

from __future__ import annotations

import base64
import json
import logging
import os
import random
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

import websockets

from ..config import JARVIS_SETTINGS, Config

logger = logging.getLogger(__name__)


class ConvoClient:
    """Interactive CLI client with cross-platform audio recording and playback."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.ws_url = config.ws_url
        self.cache_dir = Path(config.tts_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.session_log: list[dict[str, str]] = []
        self.mood_state: dict[str, int] = {"positive": 0, "neutral": 0, "negative": 0}

    # ------------------------------------------------------------------
    # Audio recording (cross-platform via sounddevice)
    # ------------------------------------------------------------------

    def record_audio(self, duration: int = 10, sample_rate: int = 16000) -> bytes | None:
        """Record audio from the default microphone for up to `duration` seconds."""
        try:
            import sounddevice as sd
            import soundfile as sf
        except ImportError:
            print("sounddevice/soundfile not installed.")
            return None

        print(f"\n🎤 Recording for up to {duration}s... Press Enter to stop early.")
        recording: list = []

        def _callback(indata, frames, time_info, status):  # noqa: ANN001
            recording.append(indata.copy())

        try:
            with sd.InputStream(
                samplerate=sample_rate,
                channels=1,
                dtype="int16",
                callback=_callback,
            ):
                # Non-blocking: wait for Enter or timeout
                import threading

                stop_event = threading.Event()

                def _wait_enter() -> None:
                    input()
                    stop_event.set()

                t = threading.Thread(target=_wait_enter, daemon=True)
                t.start()
                stop_event.wait(timeout=duration)

            if not recording:
                return None
            import numpy as np

            audio = np.concatenate(recording, axis=0)
            buf = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")  # noqa: SIM115
            sf.write(buf.name, audio, sample_rate, format="WAV", subtype="PCM_16")
            data = Path(buf.name).read_bytes()
            Path(buf.name).unlink(missing_ok=True)
            return data
        except Exception as exc:
            print(f"❌ Recording error: {exc}")
            return None

    # ------------------------------------------------------------------
    # Audio playback (cross-platform)
    # ------------------------------------------------------------------

    def play_audio(self, wav_bytes: bytes) -> None:
        """Play WAV bytes using the best available system player."""
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")  # noqa: SIM115
        tmp.write(wav_bytes)
        tmp.close()
        path = tmp.name
        played = False
        for cmd in (
            ["afplay", path],
            ["aplay", path],
            ["paplay", path],
            ["ffplay", "-nodisp", "-autoexit", path],
        ):
            if shutil.which(cmd[0]):
                os.system(" ".join(cmd))
                played = True
                break
        if not played:
            print(f"🔈 Audio saved: {path}")
            return
        Path(path).unlink(missing_ok=True)

    # ------------------------------------------------------------------
    # Mood
    # ------------------------------------------------------------------

    def analyze_mood(self, text: str) -> str:
        if not text:
            return "unknown"
        t = text.lower()
        if any(w in t for w in ["good", "great", "awesome", "love", "happy", "amazing"]):
            self.mood_state["positive"] += 1
            return "positive"
        if any(w in t for w in ["bad", "sad", "hate", "angry", "upset", "frustrated"]):
            self.mood_state["negative"] += 1
            return "negative"
        self.mood_state["neutral"] += 1
        return "neutral"

    # ------------------------------------------------------------------
    # WebSocket communication
    # ------------------------------------------------------------------

    async def send_and_receive(
        self,
        audio_bytes: bytes | None = None,
        text: str | None = None,
    ) -> dict | None:
        try:
            async with websockets.connect(self.ws_url, ping_timeout=30, max_size=8388608) as ws:
                if audio_bytes is not None:
                    await ws.send(audio_bytes)
                elif text is not None:
                    await ws.send(json.dumps({"text": text}))
                else:
                    return None

                print(random.choice(JARVIS_SETTINGS["thinking"]))
                response = await ws.recv()
                data = json.loads(response)
                return data
        except Exception as exc:
            print(f"❌ Communication error: {exc}")
            return None

    # ------------------------------------------------------------------
    # Session helpers
    # ------------------------------------------------------------------

    def print_history(self) -> None:
        if not self.session_log:
            print("\nNo conversation history available.")
            return
        print("\n📜 Conversation History:")
        for entry in self.session_log:
            print(f"\n[{entry['timestamp']}]")
            print(f"  You: {entry['user']}")
            print(f"  Jarvis: {entry['assistant']}")

    def print_mood(self) -> None:
        print("\n📈 Mood Analysis:")
        for k, v in self.mood_state.items():
            print(f"  - {k.title()}: {v}")

    def save_session(self) -> None:
        logs_dir = Path(self.config.logs_dir)
        logs_dir.mkdir(parents=True, exist_ok=True)
        filename = logs_dir / f"convo-{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.json"
        filename.write_text(json.dumps(self.session_log, indent=2))
        print(f"\n✅ Session saved to {filename}")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        print("\n" + "=" * 50)
        print("J.A.R.V.I.S. - Just A Rather Very Intelligent System")
        print("=" * 50 + "\n")
        print(random.choice(JARVIS_SETTINGS["greetings"]))

        try:
            while True:
                print("\nOptions:")
                print("  1. Voice input")
                print("  2. Text input")
                print("  3. View conversation history")
                print("  4. View mood analysis")
                print("  5. Save and exit")
                choice = input("\nSelect an option (1-5): ").strip()

                if choice == "1":
                    audio = self.record_audio()
                    if audio is None:
                        continue
                    data = await self.send_and_receive(audio_bytes=audio)
                    self._handle_response(data)
                elif choice == "2":
                    text = input("\nEnter your message: ").strip()
                    if not text:
                        continue
                    data = await self.send_and_receive(text=text)
                    self._handle_response(data)
                elif choice == "3":
                    self.print_history()
                elif choice == "4":
                    self.print_mood()
                elif choice == "5":
                    self.save_session()
                    print(random.choice(JARVIS_SETTINGS["farewells"]))
                    print("\n" + "=" * 50)
                    print("J.A.R.V.I.S. Session Complete")
                    print("=" * 50 + "\n")
                    break
                else:
                    print("Invalid choice. Please try again.")
        except KeyboardInterrupt:
            self.save_session()
            print("\n" + random.choice(JARVIS_SETTINGS["farewells"]))

    def _handle_response(self, data: dict | None) -> None:
        if data is None:
            return
        user_text = data.get("text", "")
        ai_text = data.get("response", "")
        if user_text:
            print(f"\n📝 You said: {user_text}")
            self.analyze_mood(user_text)
        if ai_text:
            print(f"🤖 {ai_text}")
        self.session_log.append(
            {
                "timestamp": datetime.now().isoformat(),
                "user": user_text,
                "assistant": ai_text,
            }
        )
        audio_b64 = data.get("audio")
        if audio_b64:
            wav_bytes = base64.b64decode(audio_b64)
            self.play_audio(wav_bytes)
