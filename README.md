# 🗣️ Convo-AI 🤖  
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white&style=for-the-badge)](https://www.python.org/)  
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?logo=fastapi&logoColor=white&style=for-the-badge)](https://fastapi.tiangolo.com/)  
[![Ollama](https://img.shields.io/badge/LLM-Ollama-blueviolet?style=for-the-badge)](https://ollama.ai/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)  

> A conversational AI system with **voice + text input**, powered by **Ollama (local LLM)**, **Whisper speech-to-text**, and **XTTS v2 text-to-speech**.  

---

## ⚙️ Prerequisites

- 🐍 Python 3.8+  
- 🎵 FFmpeg (for audio processing)  
- 🦙 Ollama (for local LLM serving)  
- 🎤 A working microphone (for voice input)  

---

## 📥 Installation

1. **Clone the repo**
```bash
git clone <repository-url>
cd Convo-Ai
```

2. **Create a virtual environment**
```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
.env\Scriptsctivate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Install FFmpeg**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg
```

5. **Install & start Ollama**
```bash
# Download: https://ollama.ai/download
ollama serve
```

---

## ▶ Usage

1. **Start the server**
```bash
source venv/bin/activate   # or .\venv\Scripts\activate on Windows
python server.py
```

2. **Run the client**
```bash
source venv/bin/activate
python talk.py
```

3. **Choose input mode**
- 🎤 Voice → Press `r` to start/stop recording  
- ⌨ Text → Type and press Enter  

---

## ✨ Core Features

- 🎤 Voice and text input modes  
- 🤖 Natural language processing with Ollama  
- 🔊 Text-to-speech output (XTTS v2)  
- 📝 Conversation history & session logging  
- 🎭 Mood analysis  
- 🌐 Optional web interface (FastAPI + WebSocket)  
- 🔒 Privacy-first: all processing runs locally  

---

## ⚙️ Configuration

Edit **`config.json`** to adjust:  
- Voice model  
- Speed & pitch  
- WebSocket URL  
- LLM settings  

---

## 🛠️ Tech Stack

- **Backend** → Python, FastAPI  
- **Speech-to-Text** → OpenAI Whisper  
- **LLM** → Ollama (local)  
- **TTS** → XTTS v2  
- **Frontend** → HTML + JavaScript  
- **Realtime** → WebSocket  

---

## 📁 Project Structure

```bash
convo-ai-isolated/
├── src/
│   ├── server.py
│   └── talk.py
├── templates/
│   └── index.html
├── static/
├── logs/
├── tts_cache/
├── config.json
├── requirements.txt
├── README.md
└── HOWTO.md
```

---

## 🛠️ Troubleshooting

- ✅ Virtual environment activated?  
- ✅ Dependencies installed?  
- ✅ FFmpeg installed?  
- ✅ Ollama running?  
- ✅ Microphone permissions granted?  

---

## 🤝 Contributing

1. Fork the repository  
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)  
3. Commit (`git commit -m 'Add some AmazingFeature'`)  
4. Push (`git push origin feature/AmazingFeature`)  
5. Open a Pull Request  

---

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) — Local LLM  
- [Whisper](https://github.com/openai/whisper) — Speech-to-text  
- [XTTS](https://github.com/coqui-ai/TTS) — Text-to-speech  
- [FastAPI](https://fastapi.tiangolo.com/) — Web framework  

---

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=BradleyMatera&style=flat-square&color=blue" alt="Profile views" />
</p>
