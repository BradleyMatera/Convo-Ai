const REPO_URL = "https://github.com/BradleyMatera/Convo-Ai";

const features = [
  {
    icon: "🎤",
    title: "Voice & Text Input",
    desc: "Speak naturally or type — Convo-AI handles both via CLI and web UI.",
  },
  {
    icon: "🧠",
    title: "Local LLM",
    desc: "Powered by Ollama. Your conversations never leave your machine.",
  },
  {
    icon: "🔊",
    title: "Neural TTS",
    desc: "Coqui TTS with a British Jarvis persona. Cached for instant replay.",
  },
  {
    icon: "📝",
    title: "Whisper STT",
    desc: "faster-whisper transcribes your voice with int8 efficiency.",
  },
  {
    icon: "💾",
    title: "SQLite History",
    desc: "Every conversation is persisted and queryable through a REST API.",
  },
  {
    icon: "🔒",
    title: "Privacy-First",
    desc: "No cloud API keys. No telemetry. No data leaving your box.",
  },
];

const steps = [
  { cmd: "git clone https://github.com/BradleyMatera/Convo-Ai.git", label: "Clone the repo" },
  { cmd: "cd Convo-Ai && pip install -e \".[dev]\"", label: "Install dependencies" },
  { cmd: "ollama pull llama3:latest", label: "Pull the default model" },
  { cmd: "convo-ai-server", label: "Start the server" },
  { cmd: "convo-ai-cli", label: "Launch the CLI client" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-jarvis-600 text-sm font-bold">
              J
            </div>
            <span className="font-bold">Convo-AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#install" className="hover:text-white">Install</a>
            <a href="#architecture" className="hover:text-white">Architecture</a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener"
              className="rounded-lg bg-jarvis-600 px-4 py-2 font-medium text-white hover:bg-jarvis-700"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-jarvis-900/20 via-gray-950 to-gray-950" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, #1b5cf5 0%, transparent 50%), radial-gradient(circle at 80% 80%, #1546e1 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            v0.2.0 — Now with SQLite persistence & cross-platform audio
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">
            Your <span className="text-jarvis-500">voice-first</span> AI assistant.
            <br />
            <span className="text-gray-400">100% local.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400">
            Convo-AI is a conversational AI that listens, thinks with a local Ollama LLM,
            and speaks back — all on your machine. No cloud. No API keys. No compromises.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#install"
              className="rounded-xl bg-jarvis-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-jarvis-700"
            >
              Get Started
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener"
              className="rounded-xl border border-gray-700 px-8 py-4 text-lg font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-4 text-center text-4xl font-bold">Everything you need</h2>
        <p className="mb-16 text-center text-gray-400">A complete local voice AI stack in one package.</p>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 transition hover:border-jarvis-700 hover:bg-gray-900"
            >
              <div className="mb-4 text-4xl">{f.icon}</div>
              <h3 className="mb-2 text-xl font-semibold">{f.title}</h3>
              <p className="text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install */}
      <section id="install" className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="mb-4 text-center text-4xl font-bold">Up and running in minutes</h2>
        <p className="mb-12 text-center text-gray-400">
          Prerequisites: Python 3.10+, ffmpeg, and <a href="https://ollama.com" className="text-jarvis-400 underline">Ollama</a>.
        </p>
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-jarvis-600 text-sm font-bold">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="mb-1 text-sm text-gray-400">{s.label}</p>
                <code className="block rounded-lg bg-gray-950 px-4 py-3 text-sm text-jarvis-300">
                  $ {s.cmd}
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="mb-4 text-center text-4xl font-bold">How it works</h2>
        <p className="mb-12 text-center text-gray-400">A simple, local-first pipeline.</p>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <ArchBox label="CLI / Web UI" sub="talk.py or React frontend" />
            <ArchArrow />
            <ArchBox label="FastAPI Server" sub="WebSocket + REST" highlight />
            <ArchArrow />
            <div className="flex flex-wrap justify-center gap-4">
              <ArchBox label="Whisper STT" sub="faster-whisper int8" small />
              <ArchBox label="Ollama LLM" sub="llama3:latest" small />
              <ArchBox label="Coqui TTS" sub="VITS p225" small />
            </div>
            <ArchArrow />
            <ArchBox label="SQLite" sub="Conversation history" small />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="mb-6 text-4xl font-bold">Ready to talk to your computer?</h2>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener"
          className="inline-block rounded-xl bg-jarvis-600 px-10 py-5 text-xl font-semibold text-white transition hover:bg-jarvis-700"
        >
          Star on GitHub
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="mx-auto max-w-6xl px-6 text-center text-gray-500">
          <p className="mb-2">Convo-AI — Built with Ollama, Whisper, Coqui TTS, FastAPI & React.</p>
          <p className="text-sm">
            MIT Licensed · <a href={REPO_URL} className="underline hover:text-gray-300">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function ArchBox({ label, sub, highlight, small }: { label: string; sub: string; highlight?: boolean; small?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-6 py-4 ${
        highlight
          ? "border-jarvis-500 bg-jarvis-600/20"
          : "border-gray-700 bg-gray-900"
      } ${small ? "min-w-[140px]" : "min-w-[200px]"}`}
    >
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function ArchArrow() {
  return <div className="text-2xl text-gray-600">↓</div>;
}
