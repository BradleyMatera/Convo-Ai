# Convo-AI Isolated

A local, isolated conversational AI system with voice and text input capabilities.

[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

## 🌟 Features

- 🎤 Voice input with real-time transcription
- 📝 Text input support
- 🤖 Local LLM integration with Ollama
- 🔊 Text-to-speech with XTTS v2
- 🌐 Web interface for easy interaction
- 📊 Conversation history and logging
- 🔒 Privacy-focused (all processing done locally)

## 🚀 Quick Start

See the [HOWTO.md](HOWTO.md) for detailed installation and usage instructions.

```bash
# Clone the repository
git clone https://github.com/yourusername/convo-ai-isolated.git
cd convo-ai-isolated

# Install dependencies
pip install -r requirements.txt

# Start the server
python server.py

# In a new terminal, start the client
python talk.py
```

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI
- **Speech-to-Text**: OpenAI's Whisper
- **LLM**: Ollama (local)
- **Text-to-Speech**: XTTS v2
- **Frontend**: HTML, JavaScript
- **Communication**: WebSocket

## 📁 Project Structure

```
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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) for the local LLM
- [OpenAI Whisper](https://github.com/openai/whisper) for speech recognition
- [XTTS](https://github.com/coqui-ai/TTS) for text-to-speech
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework 