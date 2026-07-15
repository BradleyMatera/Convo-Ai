import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Mic, Brain, Volume2, Database, Lock, Zap, Github, ArrowRight,
  Terminal, Copy, Check, ChevronDown, Sparkles, Cpu, MessageSquare,
  Eye, Ear, Wand2, RefreshCw, Settings, Trash2, ChevronRight, Star,
  Layers, Activity, GitBranch, Package, Server, Globe,
} from "lucide-react";

const REPO_URL = "https://github.com/BradleyMatera/Convo-Ai";

// ─── Data ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Mic, title: "Voice & Text Input", desc: "Speak naturally or type. Cross-platform audio via sounddevice or browser MediaRecorder.", color: "from-blue-500 to-cyan-500", tag: "STT" },
  { icon: Brain, title: "RAG Memory Engine", desc: "Learns from every conversation. Extracts facts, embeds them, and retrieves via cosine similarity.", color: "from-purple-500 to-indigo-500", tag: "Memory" },
  { icon: Volume2, title: "Neural TTS", desc: "Coqui VITS with 8 British voices. Cached for instant replay. Adjustable speed and pitch.", color: "from-emerald-500 to-teal-500", tag: "TTS" },
  { icon: Ear, title: "Whisper Transcription", desc: "faster-whisper small model with int8 quantization. Fast, accurate, offline.", color: "from-amber-500 to-orange-500", tag: "STT" },
  { icon: Lock, title: "100% Private", desc: "No cloud API keys. No telemetry. No data leaving your machine. Ever.", color: "from-rose-500 to-pink-500", tag: "Privacy" },
  { icon: Wand2, title: "Editable Personality", desc: "Switch from Jarvis to Friday to anything. Edit the system prompt live from the UI.", color: "from-violet-500 to-fuchsia-500", tag: "Custom" },
  { icon: Cpu, title: "Model Hot-Swap", desc: "Switch between any local Ollama model instantly. No restart needed.", color: "from-sky-500 to-blue-500", tag: "Models" },
  { icon: Database, title: "SQLite Persistence", desc: "Conversations, memories, and personality all stored locally in SQLite.", color: "from-slate-400 to-slate-600", tag: "Storage" },
];

const PIPELINE = [
  { icon: Ear, label: "You Speak", sub: "Browser mic or CLI", color: "bg-blue-500" },
  { icon: MessageSquare, label: "Whisper STT", sub: "faster-whisper int8", color: "bg-cyan-500" },
  { icon: Brain, label: "RAG Retrieval", sub: "nomic-embed-text + cosine", color: "bg-purple-500" },
  { icon: Cpu, label: "Ollama LLM", sub: "mistral / llama3 / any", color: "bg-indigo-500" },
  { icon: Sparkles, label: "Fact Extraction", sub: "Auto-learn new memories", color: "bg-violet-500" },
  { icon: Volume2, label: "Coqui TTS", sub: "VITS British voice", color: "bg-emerald-500" },
  { icon: Ear, label: "You Hear", sub: "Audio playback", color: "bg-teal-500" },
];

const INSTALL_STEPS = [
  { cmd: "git clone https://github.com/BradleyMatera/Convo-Ai.git", label: "Clone the repository" },
  { cmd: "cd Convo-Ai && pip install -e \".[dev]\"", label: "Install Python dependencies" },
  { cmd: "ollama pull mistral:latest && ollama pull nomic-embed-text", label: "Pull LLM + embedding models" },
  { cmd: "convo-ai-server", label: "Start the FastAPI server" },
  { cmd: "convo-ai-cli", label: "Launch the CLI client" },
];

const STATS = [
  { value: "100%", label: "Local & Private" },
  { value: "8+", label: "Ollama Models" },
  { value: "768-dim", label: "RAG Embeddings" },
  { value: "0", label: "Cloud API Keys" },
];

const TECH_STACK = [
  { name: "Python", role: "Runtime" },
  { name: "FastAPI", role: "API Server" },
  { name: "Ollama", role: "LLM Inference" },
  { name: "faster-whisper", role: "Speech-to-Text" },
  { name: "Coqui TTS", role: "Text-to-Speech" },
  { name: "nomic-embed-text", role: "Embeddings" },
  { name: "React + Vite", role: "Web UI" },
  { name: "Tailwind CSS", role: "Styling" },
  { name: "SQLite + SQLModel", role: "Persistence" },
  { name: "Docker", role: "Containerization" },
  { name: "GitHub Actions", role: "CI/CD" },
  { name: "Playwright", role: "Testing" },
];

// ─── Hooks ────────────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function useCopyToClipboard() {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }, []);
  return { copied, copy };
}

// ─── Components ────────────────────────────────────────────────────────

function AnimatedOrb({ size = 200 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-3xl animate-glow-pulse" />
      {/* Rotating rings */}
      <div className="orb-ring absolute inset-0 rounded-full border border-blue-500/20" />
      <div className="orb-ring-reverse absolute inset-4 rounded-full border border-purple-500/20" />
      <div className="orb-ring absolute inset-8 rounded-full border border-cyan-500/20" />
      {/* Core */}
      <div className="orb-core absolute inset-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 glow-blue" />
      {/* Inner glow */}
      <div className="absolute inset-16 flex items-center justify-center rounded-full bg-slate-950/60">
        <span className="text-2xl font-black gradient-text">J</span>
      </div>
    </div>
  );
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animationId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${p.opacity})`;
        ctx.fill();
        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${(1 - dist / 120) * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animationId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

function ChatDemo() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const demoScript = [
    { role: "user" as const, text: "My name is Bradley and I love playing guitar" },
    { role: "ai" as const, text: "Good day, Bradley! A pleasure to meet you. I've noted your passion for the guitar." },
    { role: "user" as const, text: "What's my name and what do I like?" },
    { role: "ai" as const, text: "Your name is Bradley, Sir. And you have a delightful passion for playing the guitar." },
  ];
  useEffect(() => {
    let step = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const runStep = () => {
      if (step >= demoScript.length) {
        timeout = setTimeout(() => { setMessages([]); step = 0; runStep(); }, 4000);
        return;
      }
      const msg = demoScript[step];
      if (msg.role === "user") {
        setMessages((p) => [...p, msg]);
        step++;
        timeout = setTimeout(runStep, 1500);
      } else {
        setTyping(true);
        timeout = setTimeout(() => {
          setTyping(false);
          setMessages((p) => [...p, msg]);
          step++;
          timeout = setTimeout(runStep, 2500);
        }, 2000);
      }
    };
    timeout = setTimeout(runStep, 1000);
    return () => clearTimeout(timeout);
  }, []);
  return (
    <div className="glass-strong rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
      {/* Window chrome */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500/80" />
        <div className="h-3 w-3 rounded-full bg-amber-500/80" />
        <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
        <span className="ml-2 text-xs text-slate-500">Convo-AI — Live Demo</span>
      </div>
      {/* Messages */}
      <div className="h-72 space-y-4 overflow-y-auto">
        {messages.length === 0 && !typing && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <AnimatedOrb size={80} />
              <p className="mt-4 text-sm text-slate-500">At your service…</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex max-w-[85%] gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${m.role === "user" ? "bg-slate-700 text-slate-300" : "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"}`}>
                {m.role === "user" ? "U" : "J"}
              </div>
              <div className={`rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "border border-slate-700/50 bg-slate-800/60 text-slate-200"}`}>
                {m.text}
                {m.role === "ai" && (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="text-blue-400">🧠 5 memories used</span>
                    {i === 1 && <span className="text-emerald-400">✨ 2 facts learned</span>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">J</div>
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 px-3 py-3">
                <div className="flex gap-1">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0s" }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.2s" }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const { ref, visible } = useScrollReveal();
  const Icon = feature.icon;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-2xl glass p-6 transition-all hover:border-blue-500/30"
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${feature.color} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20`} />
      <div className="relative">
        <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{feature.tag}</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">{feature.desc}</p>
      </div>
    </motion.div>
  );
}

function PipelineStep({ step, index, visible }: { step: typeof PIPELINE[0]; index: number; visible: boolean }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={visible ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="flex flex-col items-center"
    >
      <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${step.color} shadow-lg`}>
        <Icon className="h-7 w-7 text-white" />
        <div className={`absolute inset-0 rounded-2xl ${step.color} blur-xl opacity-40`} />
      </div>
      <span className="mt-3 text-sm font-semibold text-white">{step.label}</span>
      <span className="text-xs text-slate-500">{step.sub}</span>
    </motion.div>
  );
}

function InstallStep({ step, index }: { step: typeof INSTALL_STEPS[0]; index: number }) {
  const { copied, copy } = useCopyToClipboard();
  const { ref, visible } = useScrollReveal();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={visible ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group flex items-start gap-4 rounded-xl glass p-4 transition hover:border-blue-500/30"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-sm font-bold text-white">
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="mb-1.5 text-sm text-slate-400">{step.label}</p>
        <div className="flex items-center gap-2 rounded-lg bg-slate-950/80 px-4 py-3 font-mono text-sm text-blue-300">
          <span className="text-slate-600">$</span>
          <span className="flex-1 overflow-x-auto whitespace-nowrap">{step.cmd}</span>
          <button onClick={() => copy(step.cmd, index)} className="flex-shrink-0 text-slate-500 transition hover:text-white">
            {copied === index ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────

export default function App() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const sections = ["hero", "features", "demo", "pipeline", "install", "stack"];
      for (const s of sections) {
        const el = document.getElementById(s);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) { setActiveSection(s); break; }
        }
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { id: "features", label: "Features" },
    { id: "demo", label: "Demo" },
    { id: "pipeline", label: "Pipeline" },
    { id: "install", label: "Install" },
    { id: "stack", label: "Stack" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white noise">
      {/* ─── Nav ──────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled ? "glass-strong border-b border-white/5" : "bg-transparent"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#hero" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-lg font-black shadow-lg shadow-blue-500/20">J</div>
            <span className="text-lg font-bold tracking-tight">Convo-AI</span>
          </a>
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <a key={item.id} href={`#${item.id}`}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${activeSection === item.id ? "text-blue-400" : "text-slate-400 hover:text-white"}`}>
                {item.label}
              </a>
            ))}
          </div>
          <a href={REPO_URL} target="_blank" rel="noopener"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-blue-500/40">
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">Star on GitHub</span>
          </a>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section id="hero" className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <ParticleField />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950" />
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-sm text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            v0.3.0 — Now with RAG memory & editable personality
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="mb-10 flex justify-center">
            <AnimatedOrb size={160} />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-6 text-5xl font-black tracking-tight md:text-7xl">
            Your AI that <span className="gradient-text">learns</span>,<br />
            <span className="text-slate-400">remembers, and evolves.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto mb-10 max-w-2xl text-lg text-slate-400">
            A voice-first AI assistant that runs entirely on your machine. It listens with Whisper,
            thinks with Ollama, remembers with RAG, and speaks with neural TTS. No cloud. No API keys. No limits.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="#install" className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-4 text-lg font-semibold shadow-lg shadow-blue-500/20 transition hover:shadow-blue-500/40">
              Get Started
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener"
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-lg font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white">
              <Github className="h-5 w-5" />
              View Source
            </a>
          </motion.div>
          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}
            className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <div className="text-2xl font-black gradient-text">{s.value}</div>
                <div className="mt-1 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
        {/* Scroll indicator */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-600">
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────── */}
      <section id="features" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-4 text-4xl font-black md:text-5xl">Everything you need</motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-slate-400">A complete local voice AI stack — with memory that grows.</motion.p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>
      </section>

      {/* ─── Live Demo ────────────────────────────────────────────── */}
      <section id="demo" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-3 py-1 text-sm text-purple-300">
                <Eye className="h-3.5 w-3.5" /> Live Demo
              </span>
              <h2 className="mb-6 text-4xl font-black md:text-5xl">Watch it <span className="gradient-text">remember</span></h2>
              <p className="mb-6 text-lg text-slate-400">
                Tell Jarvis your name. Next time you ask, it knows. Every conversation extracts facts,
                embeds them with nomic-embed-text, and retrieves them via cosine similarity before responding.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Brain, text: "RAG retrieval: top-5 memories injected into every prompt" },
                  { icon: Sparkles, text: "Auto fact extraction: name, preferences, goals, instructions" },
                  { icon: Wand2, text: "Editable personality: Jarvis → Friday → anything, live" },
                  { icon: Cpu, text: "Model hot-swap: switch Ollama models without restart" },
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="flex items-center gap-3 text-slate-300">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60">
                      <item.icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-sm">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <ChatDemo />
          </motion.div>
        </div>
      </section>

      {/* ─── Pipeline ─────────────────────────────────────────────── */}
      <section id="pipeline" className="relative mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-4 text-4xl font-black md:text-5xl">The <span className="gradient-text">pipeline</span></motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-slate-400">From your voice to Jarvis's voice — 7 steps, all local.</motion.p>
        </div>
        <PipelineDiagram />
      </section>

      {/* ─── Install ──────────────────────────────────────────────── */}
      <section id="install" className="relative mx-auto max-w-3xl px-6 py-24">
        <div className="mb-16 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-4 text-4xl font-black md:text-5xl">Up in <span className="gradient-text">minutes</span></motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-slate-400">
            Prerequisites: Python 3.10+, ffmpeg, and <a href="https://ollama.com" className="text-blue-400 underline" target="_blank" rel="noopener">Ollama</a>.
          </motion.p>
        </div>
        <div className="space-y-3">
          {INSTALL_STEPS.map((s, i) => <InstallStep key={i} step={s} index={i} />)}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
          className="mt-8 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Zap className="h-5 w-5 flex-shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200/80">
            Tip: Run <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-amber-300">docker compose up</code> for the full stack including Ollama.
          </p>
        </motion.div>
      </section>

      {/* ─── Tech Stack ───────────────────────────────────────────── */}
      <section id="stack" className="relative mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-4 text-4xl font-black md:text-5xl">Built with <span className="gradient-text">best-in-class</span> tools</motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-slate-400">Open source. No vendor lock-in. No hidden dependencies.</motion.p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {TECH_STACK.map((tech, i) => (
            <motion.div key={tech.name}
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group flex items-center gap-3 rounded-xl glass p-4 transition hover:border-blue-500/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-bold text-slate-300 group-hover:from-blue-600 group-hover:to-cyan-600 group-hover:text-white">
                {tech.name[0]}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{tech.name}</div>
                <div className="text-xs text-slate-500">{tech.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-4xl px-6 py-24 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl glass-strong p-12">
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="relative">
            <h2 className="mb-4 text-4xl font-black md:text-5xl">Ready to talk to your computer?</h2>
            <p className="mb-8 text-lg text-slate-400">Join the local AI revolution. No cloud. No subscriptions. Just you and your machine.</p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href={REPO_URL} target="_blank" rel="noopener"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-4 text-lg font-semibold shadow-lg shadow-blue-500/20 transition hover:shadow-blue-500/40">
                <Star className="h-5 w-5" />
                Star on GitHub
              </a>
              <a href="#install"
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-lg font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white">
                <Terminal className="h-5 w-5" />
                Install Now
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-sm font-black">J</div>
              <span className="font-bold">Convo-AI</span>
              <span className="text-sm text-slate-600">· v0.3.0 · MIT Licensed</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href={REPO_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 hover:text-white">
                <Github className="h-4 w-4" /> GitHub
              </a>
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#install" className="hover:text-white">Install</a>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-600">
            Built with Ollama, faster-whisper, Coqui TTS, nomic-embed-text, FastAPI, React & Tailwind CSS.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Pipeline Diagram Component ────────────────────────────────────────

function PipelineDiagram() {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col items-center gap-2">
        {PIPELINE.map((step, i) => (
          <div key={i} className="flex flex-col items-center">
            <PipelineStep step={step} index={i} visible={visible} />
            {i < PIPELINE.length - 1 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={visible ? { height: 32, opacity: 1 } : {}}
                transition={{ duration: 0.3, delay: i * 0.1 + 0.2 }} className="flex flex-col items-center">
                <div className="h-full w-px bg-gradient-to-b from-blue-500/40 to-transparent" />
                <ChevronDown className="-mt-1 h-4 w-4 text-blue-500/40" />
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
