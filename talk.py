import os
import asyncio
import websockets
import json
import time
import base64
import tempfile
from datetime import datetime
import sys
import tty
import termios
import threading
import shutil
import subprocess
import hashlib

import torch
from TTS.api import TTS as CoquiTTS
from TTS.tts.configs.vits_config import VitsConfig

# Allowlist for PyTorch model loading
torch.serialization.add_safe_globals({"VitsConfig": VitsConfig})

# Load configuration
with open("config.json") as f:
    config = json.load(f)
    WS_URL = config.get("ws_url", "ws://localhost:8000/ws")

INPUT_FILE = "input.wav"
RESPONSE_FILE = "response.wav"
VOICE_MODEL = config.get("voice_model", "tts_models/en/vctk/vits")
VOICE_SPEED = config.get("voice_speed", 0.9)
VOICE_PITCH = config.get("voice_pitch", 0.9)
CACHE_DIR = "tts_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

SESSION_LOG = []
MOOD_STATE = {"positive": 0, "neutral": 0, "negative": 0}
RECORDING = False
ffmpeg_proc = None


def record_audio_dynamic():
    global ffmpeg_proc
    print("🎤 Listening... press [r] again to stop.")
    try:
        # First, ensure the input file is empty
        with open(INPUT_FILE, 'wb') as f:
            f.write(b'')
            
        ffmpeg_proc = subprocess.Popen(
            [
                "ffmpeg",
                "-f", "avfoundation",
                "-i", ":0",  # Default microphone input
                "-ar", "16000",  # Sample rate
                "-ac", "1",      # Mono channel
                "-y",           # Overwrite output file
                "-t", "10",     # Maximum recording time (10 seconds)
                "-acodec", "pcm_s16le",  # Use 16-bit PCM
                "-f", "wav",    # Force WAV format
                "-loglevel", "error",  # Suppress ffmpeg output
                INPUT_FILE,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Check if the process started successfully
        if ffmpeg_proc.poll() is not None:
            print("❌ Failed to start audio recording. Please check your microphone permissions.")
            return False
        return True
    except Exception as e:
        print(f"❌ Error starting audio recording: {str(e)}")
        return False


def animate_mic():
    frames = [
        "[=     ]",
        "[==    ]",
        "[===   ]",
        "[ ===  ]",
        "[  === ]",
        "[   ===]",
        "[    ==]",
        "[     =]",
    ]
    i = 0
    while RECORDING:
        print(f"\r\033[1;31m🔴 Recording {frames[i % len(frames)]}\033[0m", end="")
        time.sleep(0.1)
        i += 1
    print("\r\033[1;34m🛑 Done recording.\033[0m      ")


def wait_for_r_toggle():
    global RECORDING, ffmpeg_proc
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        print("\n\033[1;32mPress [r] to start recording, press [r] again to stop.\033[0m")
        while True:
            ch = sys.stdin.read(1)
            if ch == "r":
                RECORDING = True
                threading.Thread(target=animate_mic).start()
                if not record_audio_dynamic():
                    RECORDING = False
                    break
                break
        while True:
            ch2 = sys.stdin.read(1)
            if ch2 == "r":
                RECORDING = False
                if ffmpeg_proc:
                    ffmpeg_proc.terminate()
                    ffmpeg_proc.wait()  # Wait for ffmpeg to finish
                break
        time.sleep(1)  # Give time for the file to be written
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


def start_recording_by_keypress():
    wait_for_r_toggle()


def analyze_mood(text):
    if not text:
        return "unknown"
    t = text.lower()
    if any(w in t for w in ["good", "great", "awesome", "love", "happy", "amazing"]):
        MOOD_STATE["positive"] += 1
        return "positive"
    elif any(w in t for w in ["bad", "sad", "hate", "angry", "upset", "frustrated"]):
        MOOD_STATE["negative"] += 1
        return "negative"
    else:
        MOOD_STATE["neutral"] += 1
        return "neutral"


def hash_audio_cache_key(text, model, speed, pitch):
    key = f"{text}-{model}-{speed}-{pitch}"
    return hashlib.md5(key.encode()).hexdigest()


async def send_and_receive(input_mode="voice"):
    try:
        async with websockets.connect(
            WS_URL, ping_timeout=30, max_size=8388608
        ) as websocket:  # 8MB max
            if input_mode == "voice":
                if not os.path.exists(INPUT_FILE) or os.path.getsize(INPUT_FILE) == 0:
                    print("❌ No audio file found or empty file. Please record first.")
                    return
                with open(INPUT_FILE, "rb") as f:
                    audio_data = f.read()
                    await websocket.send(audio_data)
                    print("📤 Audio data sent")
            else:  # text mode
                try:
                    with open("typed_input.json", "r") as f:
                        text_data = json.load(f)
                        # Send the text data in the correct format
                        await websocket.send(json.dumps({"text": text_data["text"]}))
                        print("📤 Text data sent")
                except Exception as e:
                    print(f"❌ Error processing text input: {str(e)}")
                    return

            print("⌛ Waiting for response...")
            response = await websocket.recv()
            data = json.loads(response)

            user_text = data.get("text", "")
            ai_text = data.get("response", "")

            if user_text:
                print(f"\n📝 You said: {user_text}")
            if ai_text:
                print(f"🤖 {ai_text}")

            SESSION_LOG.append(
                {
                    "timestamp": datetime.now().isoformat(),
                    "user": user_text,
                    "assistant": ai_text
                }
            )

            audio_b64 = data.get("audio")
            if audio_b64:
                cache_key = hash_audio_cache_key(
                    ai_text, VOICE_MODEL, VOICE_SPEED, VOICE_PITCH
                )
                cached_path = os.path.join(CACHE_DIR, f"{cache_key}.wav")
                if not os.path.exists(cached_path):
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_f:
                        temp_f.write(base64.b64decode(audio_b64))
                        temp_f.flush()
                        shutil.copy(temp_f.name, cached_path)
                        os.unlink(temp_f.name)
                if shutil.which("afplay"):
                    os.system(f"afplay {cached_path}")
                else:
                    print(f"🔈 Audio saved: {cached_path}")
    except Exception as e:
        print(f"❌ Error in communication: {str(e)}")
        if input_mode == "voice":
            print("Please try recording again.")
        else:
            print("Please try typing your message again.")


def print_memory():
    if not SESSION_LOG:
        print("\nNo conversation history available.")
        return
    for entry in SESSION_LOG:
        print(f"\n[{entry['timestamp']}]")
        print(f"You: {entry['user']}")
        print(f"AI : {entry['assistant']}")


def print_mood_summary():
    print("\n📈 Mood Summary:")
    for k, v in MOOD_STATE.items():
        print(f" - {k.title()}: {v}")


def save_session():
    os.makedirs("logs", exist_ok=True)
    filename = f"logs/convo-{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.json"
    with open(filename, "w") as f:
        json.dump(SESSION_LOG, f, indent=2)
    print(f"\n✅ Session saved to {filename}")


def load_session_history():
    global SESSION_LOG
    try:
        if os.path.exists("logs"):
            latest_log = max(
                [f for f in os.listdir("logs") if f.startswith("convo-")],
                key=lambda x: os.path.getctime(os.path.join("logs", x)),
                default=None
            )
            if latest_log:
                with open(os.path.join("logs", latest_log)) as f:
                    SESSION_LOG = json.load(f)
    except Exception as e:
        print(f"Could not load session history: {e}")


def main():
    # Load previous conversation history
    load_session_history()
    
    try:
        print("\n🎛️ JARVIS Interface")
        print("Press [r] to start recording, [t] for text input, [q] to quit")
        print("Press [h] to view conversation history")
        
        while True:
            print("\nSelect input mode:")
            print("1. Voice input (press 'r' to record)")
            print("2. Text input (press 't')")
            print("3. View history (press 'h')")
            print("4. Quit (press 'q')")
            
            choice = input("\nEnter your choice (1-4): ").strip().lower()
            
            if choice == '1' or choice == 'r':
                start_recording_by_keypress()
                if os.path.exists(INPUT_FILE) and os.path.getsize(INPUT_FILE) > 0:
                    asyncio.run(send_and_receive("voice"))
                    os.unlink(INPUT_FILE)
            elif choice == '2' or choice == 't':
                user_input = input("\n📝 Type your message: ").strip()
                if user_input:
                    try:
                        with open("typed_input.json", "w") as f:
                            json.dump({"text": user_input}, f)
                        asyncio.run(send_and_receive("text"))
                    finally:
                        if os.path.exists("typed_input.json"):
                            os.unlink("typed_input.json")
            elif choice == '3' or choice == 'h':
                print_memory()
            elif choice == '4' or choice == 'q':
                print("\n👋 Goodbye!")
                break
            else:
                print("\n❌ Invalid choice. Please try again.")
                
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
    finally:
        save_session()
        print_mood_summary()
        # Clean up any temporary files
        if os.path.exists(INPUT_FILE):
            os.unlink(INPUT_FILE)
        if os.path.exists("typed_input.json"):
            os.unlink("typed_input.json")


if __name__ == "__main__":
    main()
