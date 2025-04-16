import os
import base64
import tempfile
import traceback
import hashlib
import shutil
import logging
import subprocess
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from faster_whisper import WhisperModel
from TTS.api import TTS as CoquiTTS
from TTS.tts.configs.vits_config import VitsConfig
from TTS.tts.models.vits import Vits
import torch
import uvicorn
import json
import requests
from pydub import AudioSegment
import re

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure torch settings
torch.backends.cuda.enable_unsafe_memory_access = True
torch.set_default_dtype(torch.float32)
torch.serialization.add_safe_globals([
    VitsConfig,
    Vits
])

# Initialize session log
SESSION_LOG = []

# Jarvis personality settings
JARVIS_PERSONALITY = {
    "name": "Jarvis",
    "voice": "p225",  # British male voice
    "speed": 1.0,
    "pitch": 1.0,
    "greetings": [
        "How may I assist you today?",
        "At your service.",
        "How can I help you?",
        "What can I do for you?"
    ],
    "acknowledgments": [
        "Understood.",
        "I'll take care of that.",
        "Processing your request.",
        "Right away."
    ],
    "error_responses": [
        "I apologize, but I'm having trouble processing that request.",
        "I'm afraid I can't assist with that at the moment.",
        "I'm experiencing some difficulties. Could you please rephrase that?"
    ]
}

def check_ollama_service():
    """Check if Ollama service is running and start it if not."""
    try:
        result = subprocess.run(
            ['ollama', 'list'], 
            capture_output=True, 
            text=True
        )
        if result.returncode != 0:
            logger.info("Ollama service not running. Starting it...")
            subprocess.Popen(['ollama', 'serve'])
            time.sleep(5)
    except FileNotFoundError:
        logger.error("Ollama not found. Please install Ollama first.")
        raise

def naturalize_response(text):
    """Make the response more natural and Jarvis-like."""
    # Remove any "Assistant:" or "AI:" prefixes
    text = re.sub(r'^(Assistant|AI):\s*', '', text)
    
    # Add natural pauses
    text = re.sub(r'([.!?])\s+', r'\1\n', text)
    
    # Ensure proper capitalization
    text = text.strip().capitalize()
    
    # Add Jarvis-like signature if it's a complete thought
    if text.endswith(('.', '!', '?')):
        text = f"{text} Sir."
    
    return text

try:
    check_ollama_service()
    
    logger.info("Loading configuration...")
    with open("config.json") as f:
        config = json.load(f)
    logger.info("Configuration loaded successfully")

    logger.info("Loading TTS model...")
    tts_model = CoquiTTS(
        model_name=config.get("voice_model", "tts_models/en/vctk/vits"),
        gpu=False,
        progress_bar=False
    )
    logger.info("TTS model loaded successfully")

    logger.info("Loading Whisper model...")
    whisper_model = WhisperModel(
        "small", 
        compute_type="int8", 
        local_files_only=False
    )
    logger.info("Whisper model loaded successfully")

except Exception as e:
    logger.error(f"Error during initialization: {str(e)}")
    logger.error(traceback.format_exc())
    raise

# Ollama API endpoint
OLLAMA_API_URL = "http://localhost:11434/api/generate"

# TTS cache directory
TTS_CACHE_DIR = "tts_cache"
os.makedirs(TTS_CACHE_DIR, exist_ok=True)

def hash_response(text):
    return hashlib.md5(text.encode()).hexdigest()

def compress_audio(input_path, output_path):
    audio = AudioSegment.from_wav(input_path)
    audio.export(
        output_path,
        format="wav",
        bitrate="16k",
        parameters=["-ac", "1", "-ar", "16000"],
    )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("New WebSocket connection attempt")
    try:
        await websocket.accept()
        logger.info("WebSocket connection accepted")
    except Exception as e:
        logger.error(f"Failed to accept WebSocket connection: {str(e)}")
        return

    try:
        logger.info("Waiting for data...")
        data = await websocket.receive()
        
        if "bytes" in data:
            # Handle voice input
            audio_data = data["bytes"]
            logger.info(f"Received {len(audio_data)} bytes of audio data")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_data)
                temp_audio_path = f.name
                logger.info(f"Saved audio to temporary file: {temp_audio_path}")

            print("Processing audio with faster-whisper...")
            segments, _ = whisper_model.transcribe(temp_audio_path)
            prompt = " ".join([segment.text for segment in segments])
            
        elif "text" in data:
            # Handle text input
            try:
                text_data = json.loads(data["text"])
                prompt = text_data.get("text", "")
                logger.info(f"Received text input: {prompt}")
            except json.JSONDecodeError:
                logger.error("Invalid JSON in text input")
                await websocket.close()
                return
            
        else:
            logger.error("Invalid data format received")
            await websocket.close()
            return

        if not prompt:
            logger.error("Empty prompt received")
            await websocket.close()
            return

        # Add context about being Jarvis
        enhanced_prompt = f"You are Jarvis, a sophisticated AI assistant. You are helpful, professional, and slightly formal. You address the user as 'Sir' or 'Madam'. You have a British accent and speak in a clear, concise manner. Respond to this: {prompt}"

        print(f"Calling llm model={config['model']}, prompt={enhanced_prompt}")
        response = requests.post(
            OLLAMA_API_URL,
            json={
                "model": config["model"],
                "prompt": enhanced_prompt,
                "stream": False,
                "options": {
                    "temperature": config.get("model_settings", {}).get("temperature", 0.7),
                    "top_p": config.get("model_settings", {}).get("top_p", 0.9),
                    "top_k": config.get("model_settings", {}).get("top_k", 40),
                    "num_predict": config.get("model_settings", {}).get("num_predict", 300),
                    "repeat_penalty": config.get("model_settings", {}).get("repeat_penalty", 1.1),
                    "presence_penalty": config.get("model_settings", {}).get("presence_penalty", 0.1),
                    "frequency_penalty": config.get("model_settings", {}).get("frequency_penalty", 0.1),
                    "num_ctx": config.get("model_settings", {}).get("num_ctx", 2048)
                },
            },
            timeout=30,
        )
        response.raise_for_status()
        response_text = response.json().get("response", "").strip()
        
        if not response_text:
            response_text = "I do apologize, I didn't quite catch that. Could you please repeat?"

        # Naturalize the response
        response_text = naturalize_response(response_text)
        
        # Generate TTS audio for the response
        audio_path = os.path.join(TTS_CACHE_DIR, f"{hash_response(response_text)}.wav")
        
        if not os.path.exists(audio_path):
            tts_model.tts_to_file(
                text=response_text,
                file_path=audio_path,
                speaker=JARVIS_PERSONALITY["voice"],
                speed=JARVIS_PERSONALITY["speed"]
            )
        
        with open(audio_path, "rb") as f:
            audio_data = f.read()
            audio_b64 = base64.b64encode(audio_data).decode('utf-8')

        response_data = {
            "text": prompt,
            "response": response_text,
            "audio": audio_b64
        }
        
        await websocket.send_text(json.dumps(response_data))
        
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket processing error: {str(e)}")
        traceback.print_exc()
        await websocket.send_text(json.dumps({"text": None, "response": None, "audio": None}))
    finally:
        if "temp_audio_path" in locals():
            try:
                os.unlink(temp_audio_path)
            except OSError as e:
                logger.error(f"Error removing temp file: {str(e)}")
        logger.info("connection closed")

@app.get("/")
def read_root():
    return HTMLResponse("<h1>Convo-AI Server is running</h1>")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000)
