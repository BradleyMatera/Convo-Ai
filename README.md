# Convo-AI

A conversational AI system with voice and text input capabilities, featuring natural language processing and text-to-speech functionality.

## Prerequisites

- Python 3.8 or higher
- FFmpeg (for audio processing)
- Ollama (for local LLM)
- A working microphone (for voice input)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Convo-Ai
```

2. Create and activate a virtual environment:
```bash
# On macOS/Linux
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
.\venv\Scripts\activate
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

4. Install FFmpeg:
```bash
# On macOS (using Homebrew)
brew install ffmpeg

# On Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg

# On Windows (using Chocolatey)
choco install ffmpeg
```

5. Install and start Ollama:
```bash
# Follow the installation instructions at https://ollama.ai/download
# Then start the Ollama service
ollama serve
```

## Usage

1. Start the server:
```bash
# Make sure you're in the virtual environment
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
python server.py
```

2. In a new terminal, start the client:
```bash
# Make sure you're in the virtual environment
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
python talk.py
```

3. Choose your input mode:
   - Voice input: Press 'r' to start/stop recording
   - Text input: Type your message and press Enter

## Features

- Voice and text input modes
- Natural language processing
- Text-to-speech output
- Conversation history
- Mood analysis
- Session logging

## Configuration

Edit `config.json` to customize:
- Voice model
- Voice speed and pitch
- WebSocket URL
- Model settings

## Troubleshooting

If you encounter issues:
1. Ensure the virtual environment is activated
2. Check that all dependencies are installed
3. Verify FFmpeg is installed and accessible
4. Confirm Ollama is running
5. Check microphone permissions

## License

This project is licensed under the MIT License - see the LICENSE file for details.

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

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) for the local LLM
- [OpenAI Whisper](https://github.com/openai/whisper) for speech recognition
- [XTTS](https://github.com/coqui-ai/TTS) for text-to-speech
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework 