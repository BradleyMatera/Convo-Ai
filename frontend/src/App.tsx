import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  mood?: string;
  audio?: string;
  model?: string;
  timestamp: string;
}

interface OllamaModel {
  name: string;
  size: number;
  modified: string;
}

interface AppConfig {
  model: string;
  temperature: number;
  voice_speaker: string;
  voice_speed: number;
  num_predict: number;
}

type ConnState = "connecting" | "connected" | "disconnected";
type OrbState = "idle" | "thinking" | "recording";

// ─── Constants ───────────────────────────────────────────────────────────

const VOICE_SPEAKERS = [
  { id: "p225", label: "British Male (Jarvis)" },
  { id: "p226", label: "British Male 2" },
  { id: "p227", label: "British Female" },
  { id: "p228", label: "British Female 2" },
  { id: "p229", label: "Southern Male" },
  { id: "p230", label: "Southern Female" },
  { id: "p231", label: "Scottish Male" },
  { id: "p232", label: "Scottish Female" },
];

const QUICK_PROMPTS = [
  "What can you do, Jarvis?",
  "Tell me a joke",
  "What's the weather like?",
  "Write a haiku about AI",
  "Explain quantum computing simply",
];

// ─── Helper: format file size ────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  const gb = bytes / 1_073_741_824;
  const mb = bytes / 1_048_576;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Main App ────────────────────────────────────────────────────────────

export default function App() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string>("");
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const nextId = () => ++msgIdRef.current;

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // ─── WebSocket ──────────────────────────────────────────────────────

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnState("connected");
    ws.onclose = () => {
      setConnState("disconnected");
      setOrbState("idle");
    };
    ws.onerror = () => {
      setConnState("disconnected");
      setOrbState("idle");
    };

    ws.onmessage = (event) => {
      setOrbState("idle");
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: `⚠️ ${data.error}`,
              timestamp: new Date().toISOString(),
            },
          ]);
          return;
        }
        setError("");
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: data.response || "",
            mood: data.mood,
            audio: data.audio,
            model: data.model,
            timestamp: new Date().toISOString(),
          },
        ]);
        if (data.audio) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
          audio.play().catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  // ─── Load models, config, and history on mount ──────────────────────

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
        setCurrentModel(data.current || "");
      })
      .catch(() => {});

    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => {});

    fetch("/api/history?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHistory(
            data.map((e: any) => ({
              id: e.id,
              role: "assistant" as const,
              text: e.assistant_text,
              mood: e.mood,
              timestamp: e.timestamp,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // ─── Send text ──────────────────────────────────────────────────────

  const sendText = (overrideText?: string) => {
    const trimmed = (overrideText ?? text).trim();
    if (!trimmed || !wsRef.current || connState !== "connected") return;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: trimmed, timestamp: new Date().toISOString() },
    ]);
    wsRef.current.send(JSON.stringify({ text: trimmed }));
    setText("");
    setOrbState("thinking");
    setShowQuickPrompts(false);
  };

  // ─── Voice recording ────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        blob.arrayBuffer().then((buf) => {
          if (wsRef.current && connState === "connected") {
            wsRef.current.send(buf);
            setOrbState("thinking");
            setShowQuickPrompts(false);
          }
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setOrbState("recording");
    } catch (err) {
      console.error("Microphone access denied:", err);
      setError("Microphone access denied. Please allow it in your browser settings.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setOrbState("idle");
  };

  // ─── Model switching ────────────────────────────────────────────────

  const switchModel = (model: string) => {
    fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "ok") {
          setCurrentModel(data.model);
          setConfig((prev) => (prev ? { ...prev, model: data.model } : prev));
        }
      })
      .catch(() => {});
  };

  const updateSetting = (key: string, value: string | number) => {
    fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "ok") {
          setConfig((prev) => ({
            ...prev!,
            model: data.model,
            temperature: data.temperature,
            voice_speaker: data.voice_speaker,
            voice_speed: data.voice_speed,
            num_predict: data.num_predict,
          }));
        }
      })
      .catch(() => {});
  };

  const clearHistory = () => {
    fetch("/api/history", { method: "DELETE" }).then(() => {
      setHistory([]);
      setMessages([]);
    });
  };

  // ─── Derived ────────────────────────────────────────────────────────

  const connColor =
    connState === "connected" ? "bg-emerald-500" : connState === "connecting" ? "bg-amber-500" : "bg-red-500";
  const connLabel =
    connState === "connected" ? "Connected" : connState === "connecting" ? "Connecting…" : "Disconnected";

  const orbClass =
    orbState === "thinking" ? "orb-thinking" : orbState === "recording" ? "orb-recording" : "orb-idle";

  const orbColor =
    orbState === "thinking"
      ? "from-purple-500 to-indigo-600"
      : orbState === "recording"
      ? "from-red-500 to-orange-600"
      : "from-blue-500 to-cyan-600";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ─── Sidebar ───────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="flex w-72 flex-col border-r border-slate-800/60 bg-slate-900/40">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-slate-800/60 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-lg font-bold shadow-lg shadow-blue-500/20">
              J
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Convo-AI</h1>
              <p className="text-xs text-slate-500">Local Voice Assistant</p>
            </div>
          </div>

          {/* Model Selector */}
          <div className="border-b border-slate-800/60 px-5 py-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Model
            </label>
            <div className="relative">
              <select
                value={currentModel}
                onChange={(e) => switchModel(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {models.length === 0 && <option>{currentModel || "No models found"}</option>}
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({fmtSize(m.size)})
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {models.length} model{models.length !== 1 ? "s" : ""} available
            </p>
          </div>

          {/* History */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                History
              </span>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-slate-600 hover:text-red-400"
                  title="Clear history"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 && messages.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-600">No conversations yet.</p>
            ) : (
              <div className="space-y-1">
                {messages.length > 0 && (
                  <div className="mb-2 px-2 text-xs font-medium text-slate-400">This session</div>
                )}
                {messages
                  .filter((m) => m.role === "assistant")
                  .slice(-10)
                  .reverse()
                  .map((m) => (
                    <button
                      key={m.id}
                      className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      title={m.text}
                    >
                      {m.text.slice(0, 50)}…
                    </button>
                  ))}
                {history.length > 0 && (
                  <>
                    <div className="mb-1 mt-3 px-2 text-xs font-medium text-slate-400">Previous</div>
                    {history.slice(0, 10).map((m) => (
                      <button
                        key={`h-${m.id}`}
                        className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                        title={m.text}
                      >
                        {m.text.slice(0, 50)}…
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Settings button */}
          <div className="border-t border-slate-800/60 p-3">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>
        </aside>
      )}

      {/* ─── Settings Panel (overlay) ──────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="glass w-full max-w-md rounded-2xl border border-slate-700/60 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {config && (
              <div className="space-y-5">
                {/* Temperature */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Temperature: {config.temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => updateSetting("temperature", parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                {/* Voice speaker */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Voice</label>
                  <select
                    value={config.voice_speaker}
                    onChange={(e) => updateSetting("voice_speaker", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {VOICE_SPEAKERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice speed */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Voice Speed: {config.voice_speed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={config.voice_speed}
                    onChange={(e) => updateSetting("voice_speed", parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Max tokens */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Max Response Length: {config.num_predict} tokens
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={config.num_predict}
                    onChange={(e) => updateSetting("max_predict", parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Chat Area ────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${connColor} ${connState === "connected" ? "animate-pulse" : ""}`} />
              <span className="text-sm font-medium text-slate-400">{connLabel}</span>
              {currentModel && (
                <span className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
                  {currentModel}
                </span>
              )}
            </div>
          </div>
          {error && (
            <span className="text-xs text-red-400">⚠ {error}</span>
          )}
        </header>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Empty state with orb */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                {/* Animated Orb */}
                <div
                  className={`mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${orbColor} ${orbClass}`}
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-950/40">
                    <span className="text-3xl font-bold gradient-text">J</span>
                  </div>
                </div>

                <h2 className="mb-2 text-2xl font-bold">
                  {orbState === "thinking"
                    ? "Thinking…"
                    : orbState === "recording"
                    ? "Listening…"
                    : "At your service."}
                </h2>
                <p className="mb-8 text-slate-500">
                  {connState === "connected"
                    ? "Type a message or click the mic to speak."
                    : "Connecting to server…"}
                </p>

                {/* Quick prompts */}
                {showQuickPrompts && connState === "connected" && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => sendText(p)}
                        className="rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-500 hover:bg-slate-800 hover:text-white"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((m) => (
              <div key={m.id} className={`flex msg-enter ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[80%] gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      m.role === "user"
                        ? "bg-slate-700 text-slate-300"
                        : "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"
                    }`}
                  >
                    {m.role === "user" ? "U" : "J"}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      m.role === "user"
                        ? "rounded-tr-sm bg-blue-600 text-white"
                        : "rounded-tl-sm border border-slate-700/50 bg-slate-800/60 text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>

                    {/* Meta row */}
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>{fmtTime(m.timestamp)}</span>
                      {m.mood && m.mood !== "neutral" && (
                        <span className={
                          m.mood === "positive" ? "text-emerald-400" :
                          m.mood === "negative" ? "text-red-400" : "text-slate-500"
                        }>
                          {m.mood}
                        </span>
                      )}
                      {m.model && <span className="text-slate-600">{m.model}</span>}
                    </div>

                    {/* Audio player */}
                    {m.audio && (
                      <audio
                        controls
                        src={`data:audio/wav;base64,${m.audio}`}
                        className="mt-3 h-8 w-full"
                        style={{ filter: "invert(0.8)" }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {orbState === "thinking" && messages.length > 0 && (
              <div className="flex justify-start msg-enter">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-bold text-white">
                    J
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border border-slate-700/50 bg-slate-800/60 px-4 py-4">
                    <div className="flex gap-1.5">
                      <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: "0s" }} />
                      <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: "0.2s" }} />
                      <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-800/60 px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            {/* Mic button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={connState !== "connected"}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? (
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Text input */}
            <div className="relative flex-1">
              <input
                ref={textInputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendText();
                }}
                placeholder={isRecording ? "Listening…" : "Message Jarvis…"}
                disabled={isRecording}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              {/* Voice wave visualizer */}
              {isRecording && (
                <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-end gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="wave-bar w-1 rounded-full bg-red-400"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={() => sendText()}
              disabled={!text.trim() || connState !== "connected" || isRecording}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white transition hover:from-blue-600 hover:to-cyan-700 disabled:opacity-40"
              title="Send"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

          {/* Status hint */}
          <div className="mx-auto mt-2 max-w-3xl text-center">
            <p className="text-xs text-slate-600">
              {isRecording
                ? "Recording — click the stop button when done"
                : connState === "connected"
                ? "Press Enter to send · Click mic for voice"
                : "Waiting for server connection…"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
