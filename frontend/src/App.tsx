import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  mood?: string;
  audio?: string;
  model?: string;
  memoriesUsed?: number;
  newFacts?: number;
  timestamp: string;
}

interface ConversationEntry {
  id: number;
  user_text: string;
  assistant_text: string;
  mood: string;
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

interface Memory {
  id: number;
  content: string;
  category: string;
  importance: number;
  timestamp: string;
  times_retrieved: number;
  relevance_score?: number;
}

type ConnState = "connecting" | "connected" | "disconnected";
type OrbState = "idle" | "thinking" | "recording";
type SidebarTab = "chat" | "memory" | "personality";

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
  "My name is Bradley, please remember that",
  "I prefer short, concise answers",
  "What can you do, Jarvis?",
  "Tell me a joke",
  "Write a haiku about AI",
];

const CATEGORY_COLORS: Record<string, string> = {
  name: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  preference: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  fact: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  instruction: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  goal: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  const gb = bytes / 1_073_741_824;
  const mb = bytes / 1_048_576;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Main App ────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [history, setHistory] = useState<ConversationEntry[]>([]);
  const [viewingHistory, setViewingHistory] = useState<ConversationEntry | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string>("");
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // Memory state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState("general");

  // Prompt state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [promptEdited, setPromptEdited] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextId = () => ++msgIdRef.current;
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);
  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // ─── WebSocket with auto-reconnect ─────────────────────────────────

  const wsReconnectRef = useRef<number>(0);
  const wsShouldReconnect = useRef(true);

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnState("connected");
      wsReconnectRef.current = 0;
    };
    ws.onclose = () => {
      setConnState("disconnected");
      setOrbState("idle");
      if (wsShouldReconnect.current) {
        wsReconnectRef.current += 1;
        const delay = Math.min(1000 * wsReconnectRef.current, 5000);
        setTimeout(() => connectWs(), delay);
      }
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
          setMessages((p) => [...p, { id: nextId(), role: "assistant", text: `⚠️ ${data.error}`, timestamp: new Date().toISOString() }]);
          return;
        }
        setError("");
        setMessages((p) => [...p, {
          id: nextId(), role: "assistant", text: data.response || "", mood: data.mood,
          audio: data.audio, model: data.model,
          memoriesUsed: data.memories_used, newFacts: data.new_facts,
          timestamp: new Date().toISOString(),
        }]);
        if (data.audio) new Audio(`data:audio/wav;base64,${data.audio}`).play().catch(() => {});
        if (data.new_facts > 0) refreshMemories();
      } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    wsShouldReconnect.current = true;
    connectWs();
    return () => { wsShouldReconnect.current = false; wsRef.current?.close(); };
  }, [connectWs]);

  // ─── Load initial data ──────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(d => { setModels(d.models || []); setCurrentModel(d.current || ""); }).catch(() => {});
    fetch("/api/config").then(r => r.json()).then(setConfig).catch(() => {});
    fetch("/api/history?limit=50").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setHistory(d);
    }).catch(() => {});
    refreshMemories();
    fetch("/api/prompt").then(r => r.json()).then(d => { setSystemPrompt(d.prompt || ""); setDefaultPrompt(d.default || ""); }).catch(() => {});
  }, []);

  const refreshMemories = () => {
    fetch("/api/memory").then(r => r.json()).then(setMemories).catch(() => {});
  };

  // ─── Actions ────────────────────────────────────────────────────────

  const sendText = (overrideText?: string) => {
    const trimmed = (overrideText ?? text).trim();
    if (!trimmed) return;
    setViewingHistory(null);
    setMessages((p) => [...p, { id: nextId(), role: "user", text: trimmed, timestamp: new Date().toISOString() }]);
    setText("");
    setOrbState("thinking");
    setShowQuickPrompts(false);

    // Try WebSocket first, fall back to REST API
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: trimmed }));
    } else {
      // REST fallback — still gets RAG memory + fact extraction
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      })
        .then((r) => r.json())
        .then((data) => {
          setOrbState("idle");
          if (data.error) {
            setError(data.error);
            setMessages((p) => [...p, { id: nextId(), role: "assistant", text: `⚠️ ${data.error}`, timestamp: new Date().toISOString() }]);
            return;
          }
          setError("");
          setMessages((p) => [...p, {
            id: nextId(), role: "assistant", text: data.response || "", mood: data.mood,
            model: data.model, memoriesUsed: data.memories_used, newFacts: data.new_facts,
            timestamp: new Date().toISOString(),
          }]);
          if (data.new_facts > 0) refreshMemories();
        })
        .catch((err) => {
          setOrbState("idle");
          setError(`Request failed: ${err.message}`);
        });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        blob.arrayBuffer().then((buf) => { if (wsRef.current && connState === "connected") { wsRef.current.send(buf); setOrbState("thinking"); setShowQuickPrompts(false); } });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setOrbState("recording");
    } catch (err) { console.error(err); setError("Microphone access denied."); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); setOrbState("idle"); };

  const switchModel = (model: string) => {
    fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }) })
      .then(r => r.json()).then(d => { if (d.status === "ok") { setCurrentModel(d.model); setConfig(p => p ? { ...p, model: d.model } : p); } }).catch(() => {});
  };

  const updateSetting = (key: string, value: string | number) => {
    fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) })
      .then(r => r.json()).then(d => { if (d.status === "ok") setConfig(p => p ? { ...p, model: d.model, temperature: d.temperature, voice_speaker: d.voice_speaker, voice_speed: d.voice_speed, num_predict: d.num_predict } : p); }).catch(() => {});
  };

  const addMemory = () => {
    if (!newMemoryText.trim()) return;
    fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newMemoryText, category: newMemoryCategory }) })
      .then(r => r.json()).then(() => { setNewMemoryText(""); refreshMemories(); }).catch(() => {});
  };

  const deleteMemory = (id: number) => {
    fetch(`/api/memory/${id}`, { method: "DELETE" }).then(() => refreshMemories()).catch(() => {});
  };

  const savePrompt = () => {
    fetch("/api/prompt", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: systemPrompt }) })
      .then(r => r.json()).then(() => { setPromptEdited(false); }).catch(() => {});
  };

  const resetPrompt = () => {
    fetch("/api/prompt/reset", { method: "POST" }).then(r => r.json()).then(d => { setSystemPrompt(d.prompt); setPromptEdited(false); }).catch(() => {});
  };

  const clearHistory = () => {
    if (!confirm("Clear all conversation history? This cannot be undone.")) return;
    fetch("/api/history", { method: "DELETE" }).then(() => { setHistory([]); setMessages([]); setViewingHistory(null); }).catch(() => {});
    setMenuOpen(false);
  };

  const clearCurrentChat = () => {
    setMessages([]);
    setViewingHistory(null);
    setShowQuickPrompts(true);
    setMenuOpen(false);
  };

  const clearMemories = () => {
    if (!confirm("Delete all memories? Jarvis will forget everything it learned about you.")) return;
    fetch("/api/memory", { method: "DELETE" }).then(() => refreshMemories()).catch(() => {});
    setMenuOpen(false);
  };

  const resetPersonality = () => {
    if (!confirm("Reset personality to default Jarvis? Your custom prompt will be lost.")) return;
    fetch("/api/prompt/reset", { method: "POST" }).then(r => r.json()).then(d => { setSystemPrompt(d.prompt); setPromptEdited(false); }).catch(() => {});
    setMenuOpen(false);
  };

  const resetAll = () => {
    if (!confirm("Reset EVERYTHING? This wipes all conversations, memories, and resets the personality. This cannot be undone.")) return;
    fetch("/api/reset", { method: "POST" }).then(() => {
      setMessages([]); setHistory([]); setViewingHistory(null); setShowQuickPrompts(true);
      refreshMemories();
      fetch("/api/prompt").then(r => r.json()).then(d => { setSystemPrompt(d.prompt || ""); setPromptEdited(false); }).catch(() => {});
    }).catch(() => {});
    setMenuOpen(false);
  };

  const loadConversation = (entry: ConversationEntry) => {
    setViewingHistory(entry);
  };

  const newChat = () => {
    setViewingHistory(null);
    setMessages([]);
    setShowQuickPrompts(true);
  };

  // ─── Derived ────────────────────────────────────────────────────────

  const connColor = connState === "connected" ? "bg-emerald-500" : connState === "connecting" ? "bg-amber-500" : "bg-red-500";
  const connLabel = connState === "connected" ? "Connected" : connState === "connecting" ? "Connecting…" : "Disconnected";
  const orbClass = orbState === "thinking" ? "orb-thinking" : orbState === "recording" ? "orb-recording" : "orb-idle";
  const orbColor = orbState === "thinking" ? "from-purple-500 to-indigo-600" : orbState === "recording" ? "from-red-500 to-orange-600" : "from-blue-500 to-cyan-600";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ─── Sidebar ───────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="flex w-80 flex-col border-r border-slate-800/60 bg-slate-900/40">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-slate-800/60 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-lg font-bold shadow-lg shadow-blue-500/20">J</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Convo-AI</h1>
              <p className="text-xs text-slate-500">Learns. Remembers. Evolves.</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-slate-800/60">
            {(["chat", "memory", "personality"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                  sidebarTab === tab ? "border-b-2 border-blue-500 text-blue-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab === "memory" && memories.length > 0 && (
                  <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400">{memories.length}</span>
                )}
                {tab}
              </button>
            ))}
          </div>

          {/* ── Chat tab: model + history ── */}
          {sidebarTab === "chat" && (
            <>
              {/* New Chat button */}
              <div className="border-b border-slate-800/60 px-3 py-3">
                <button onClick={newChat}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:bg-slate-800 hover:text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Chat
                </button>
              </div>

              {/* Model selector */}
              <div className="border-b border-slate-800/60 px-5 py-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Active Model</label>
                <select value={currentModel} onChange={(e) => switchModel(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-200 focus:border-blue-500 focus:outline-none">
                  {models.length === 0 && <option>{currentModel || "No models found"}</option>}
                  {models.map((m) => <option key={m.name} value={m.name}>{m.name} ({fmtSize(m.size)})</option>)}
                </select>
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="mb-2 flex items-center justify-between px-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversations</span>
                  {(history.length > 0 || messages.length > 0) && <button onClick={clearHistory} className="text-xs text-slate-600 hover:text-red-400">Clear</button>}
                </div>
                {history.length === 0 && messages.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-slate-600">No conversations yet.</p>
                ) : (
                  <div className="space-y-1">
                    {/* Current session exchanges */}
                    {messages.length > 0 && (
                      <>
                        <div className="mb-1 px-2 text-xs font-medium text-blue-400">This session</div>
                        {messages.filter((m) => m.role === "user").slice(-10).reverse().map((m, i) => {
                          const assistant = messages.filter((m2) => m2.role === "assistant")[messages.filter((m3) => m3.role === "assistant").length - 1 - i];
                          return (
                            <button key={m.id}
                              onClick={() => assistant && loadConversation({ id: m.id, user_text: m.text, assistant_text: assistant.text, mood: assistant.mood || "neutral", timestamp: m.timestamp })}
                              className={`block w-full rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-800/60 hover:text-slate-200 ${viewingHistory?.id === m.id ? "bg-blue-500/10 text-blue-300" : "text-slate-400"}`}>
                              <span className="block truncate" title={m.text}>{m.text.slice(0, 45)}…</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                    {/* Previous sessions from DB */}
                    {history.length > 0 && (
                      <>
                        <div className="mb-1 mt-3 px-2 text-xs font-medium text-slate-400">Previous</div>
                        {history.slice(0, 20).map((entry) => (
                          <button key={`h-${entry.id}`}
                            onClick={() => loadConversation(entry)}
                            className={`block w-full rounded-lg px-2 py-2 text-left transition hover:bg-slate-800/60 hover:text-slate-300 ${viewingHistory?.id === entry.id ? "bg-blue-500/10 text-blue-300" : "text-slate-500"}`}>
                            <span className="block truncate text-sm" title={entry.user_text}>
                              {entry.user_text.slice(0, 45)}…
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-600">
                              {fmtTime(entry.timestamp)}
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Memory tab ── */}
          {sidebarTab === "memory" && (
            <>
              <div className="border-b border-slate-800/60 px-4 py-3">
                <p className="mb-3 text-xs text-slate-500">
                  Jarvis learns from your conversations and stores facts here. These are retrieved via RAG to personalize responses.
                </p>
                {/* Add memory */}
                <div className="space-y-2">
                  <input type="text" value={newMemoryText} onChange={(e) => setNewMemoryText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMemory()}
                    placeholder="Add a fact manually…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                  <div className="flex gap-2">
                    <select value={newMemoryCategory} onChange={(e) => setNewMemoryCategory(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs focus:border-blue-500 focus:outline-none">
                      {["general", "name", "preference", "fact", "instruction", "goal"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={addMemory} disabled={!newMemoryText.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">Add</button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="mb-2 flex items-center justify-between px-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{memories.length} memor{memories.length !== 1 ? "ies" : "y"}</span>
                  {memories.length > 0 && <button onClick={clearMemories} className="text-xs text-slate-600 hover:text-red-400">Clear all</button>}
                </div>
                {memories.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-slate-600">No memories yet.</p>
                    <p className="mt-1 text-xs text-slate-700">Tell Jarvis about yourself and it will remember.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memories.map((m) => (
                      <div key={m.id} className="group rounded-lg border border-slate-800 bg-slate-800/30 p-3 hover:border-slate-700">
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.general}`}>{m.category}</span>
                          <button onClick={() => deleteMemory(m.id)} className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <p className="text-sm text-slate-300">{m.content}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-600">
                          <span>{fmtTime(m.timestamp)}</span>
                          {m.times_retrieved > 0 && <span>↻ used {m.times_retrieved}x</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Personality tab ── */}
          {sidebarTab === "personality" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-slate-800/60 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Edit Jarvis's personality, name, and behavior. This is the system prompt sent before every message.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <textarea
                  value={systemPrompt}
                  onChange={(e) => { setSystemPrompt(e.target.value); setPromptEdited(true); }}
                  className="h-full min-h-[300px] w-full resize-none rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm leading-relaxed text-slate-200 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter system prompt…"
                />
              </div>
              <div className="flex gap-2 border-t border-slate-800/60 p-3">
                <button onClick={savePrompt} disabled={!promptEdited}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                  {promptEdited ? "Save" : "Saved ✓"}
                </button>
                <button onClick={resetPrompt} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200">Reset</button>
              </div>
            </div>
          )}

          {/* Settings button (always visible) */}
          <div className="border-t border-slate-800/60 p-3">
            <button onClick={() => setSettingsOpen(!settingsOpen)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Settings
            </button>
          </div>
        </aside>
      )}

      {/* ─── Settings modal ─────────────────────────────────────────── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSettingsOpen(false)}>
          <div className="glass w-full max-w-md rounded-2xl border border-slate-700/60 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {config && (
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Temperature: {config.temperature.toFixed(1)}</label>
                  <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={(e) => updateSetting("temperature", parseFloat(e.target.value))} className="w-full accent-blue-500" />
                  <div className="flex justify-between text-xs text-slate-600"><span>Precise</span><span>Creative</span></div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Voice</label>
                  <select value={config.voice_speaker} onChange={(e) => updateSetting("voice_speaker", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                    {VOICE_SPEAKERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Voice Speed: {config.voice_speed.toFixed(1)}x</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={config.voice_speed} onChange={(e) => updateSetting("voice_speed", parseFloat(e.target.value))} className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Max Response: {config.num_predict} tokens</label>
                  <input type="range" min="50" max="1000" step="50" value={config.num_predict} onChange={(e) => updateSetting("max_predict", parseInt(e.target.value))} className="w-full accent-blue-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Main chat area ─────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${connColor} ${connState === "connected" ? "animate-pulse" : ""}`} />
              <span className="text-sm font-medium text-slate-400">{connLabel}</span>
              {currentModel && <span className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">{currentModel}</span>}
              {memories.length > 0 && <span className="ml-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">🧠 {memories.length}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">⚠ {error}</span>}
            {/* Options dropdown */}
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Options">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
              {menuOpen && (
                <>
                  {/* Click-away overlay */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  {/* Dropdown */}
                  <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-700/60 bg-slate-900 py-2 shadow-2xl">
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</div>
                    <button onClick={clearCurrentChat} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800">
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Clear current chat
                    </button>
                    <button onClick={clearHistory} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800">
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Clear all history
                    </button>
                    <div className="my-1 border-t border-slate-800" />
                    <button onClick={clearMemories} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800">
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Clear all memories
                    </button>
                    <button onClick={resetPersonality} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800">
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Reset personality
                    </button>
                    <div className="my-1 border-t border-slate-800" />
                    <button onClick={resetAll} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10">
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Reset everything
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* ── History view: showing a past conversation ── */}
            {viewingHistory && (
              <>
                <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2.5">
                  <span className="text-xs text-slate-500">Viewing past conversation · {fmtTime(viewingHistory.timestamp)}</span>
                  <button onClick={newChat} className="text-xs font-medium text-blue-400 hover:text-blue-300">
                    ← Back to chat
                  </button>
                </div>
                {/* User message */}
                <div className="flex justify-end msg-enter">
                  <div className="flex max-w-[80%] flex-row-reverse gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">U</div>
                    <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-white">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{viewingHistory.user_text}</p>
                      <div className="mt-2 text-xs text-blue-300">{fmtTime(viewingHistory.timestamp)}</div>
                    </div>
                  </div>
                </div>
                {/* Assistant message */}
                <div className="flex justify-start msg-enter">
                  <div className="flex max-w-[80%] gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-sm font-bold text-white">J</div>
                    <div className="rounded-2xl rounded-tl-sm border border-slate-700/50 bg-slate-800/60 px-4 py-3 text-slate-100">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{viewingHistory.assistant_text}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>{fmtTime(viewingHistory.timestamp)}</span>
                        {viewingHistory.mood && viewingHistory.mood !== "neutral" && (
                          <span className={viewingHistory.mood === "positive" ? "text-emerald-400" : viewingHistory.mood === "negative" ? "text-red-400" : "text-slate-500"}>{viewingHistory.mood}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Live chat: empty state ── */}
            {!viewingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className={`mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${orbColor} ${orbClass}`}>
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-950/40"><span className="text-3xl font-bold gradient-text">J</span></div>
                </div>
                <h2 className="mb-2 text-2xl font-bold">{orbState === "thinking" ? "Thinking…" : orbState === "recording" ? "Listening…" : "At your service."}</h2>
                <p className="mb-8 text-slate-500">{connState === "connected" ? "Type a message or click the mic to speak." : "Connecting to server…"}</p>
                {showQuickPrompts && connState === "connected" && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_PROMPTS.map((p) => (
                      <button key={p} onClick={() => sendText(p)} className="rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-500 hover:bg-slate-800 hover:text-white">{p}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!viewingHistory && messages.map((m) => (
              <div key={m.id} className={`flex msg-enter ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[80%] gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${m.role === "user" ? "bg-slate-700 text-slate-300" : "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"}`}>{m.role === "user" ? "U" : "J"}</div>
                  <div className={`rounded-2xl px-4 py-3 ${m.role === "user" ? "rounded-tr-sm bg-blue-600 text-white" : "rounded-tl-sm border border-slate-700/50 bg-slate-800/60 text-slate-100"}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                    {/* Memory indicators */}
                    {m.role === "assistant" && (m.memoriesUsed || m.newFacts) && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        {m.memoriesUsed ? <span className="text-blue-400">🧠 {m.memoriesUsed} memories used</span> : null}
                        {m.newFacts ? <span className="text-emerald-400">✨ Learned {m.newFacts} new fact{m.newFacts !== 1 ? "s" : ""}</span> : null}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>{fmtTime(m.timestamp)}</span>
                      {m.mood && m.mood !== "neutral" && <span className={m.mood === "positive" ? "text-emerald-400" : m.mood === "negative" ? "text-red-400" : "text-slate-500"}>{m.mood}</span>}
                      {m.model && <span className="text-slate-600">{m.model}</span>}
                    </div>
                    {m.audio && <audio controls src={`data:audio/wav;base64,${m.audio}`} className="mt-3 h-8 w-full" style={{ filter: "invert(0.8)" }} />}
                  </div>
                </div>
              </div>
            ))}

            {!viewingHistory && orbState === "thinking" && messages.length > 0 && (
              <div className="flex justify-start msg-enter">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-bold text-white">J</div>
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
          {viewingHistory ? (
            <div className="mx-auto max-w-3xl text-center">
              <button onClick={newChat} className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:bg-slate-800 hover:text-white">
                ← Start a new conversation
              </button>
            </div>
          ) : (
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <button onClick={isRecording ? stopRecording : startRecording} disabled={connState !== "connected"}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-slate-800 hover:bg-slate-700"}`}
              title={isRecording ? "Stop recording" : "Start voice input"}>
              {isRecording ? (
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              ) : (
                <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              )}
            </button>
            <div className="relative flex-1">
              <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
                placeholder={isRecording ? "Listening…" : "Message Jarvis…"} disabled={isRecording}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50" />
              {isRecording && (
                <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-end gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => <span key={i} className="wave-bar w-1 rounded-full bg-red-400" style={{ animationDelay: `${i * 0.1}s` }} />)}
                </div>
              )}
            </div>
            <button onClick={() => sendText()} disabled={!text.trim() || connState !== "connected" || isRecording}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white transition hover:from-blue-600 hover:to-cyan-700 disabled:opacity-40" title="Send">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
          )}
          <div className="mx-auto mt-2 max-w-3xl text-center">
            <p className="text-xs text-slate-600">
              {viewingHistory ? "Viewing a saved conversation" : isRecording ? "Recording — click stop when done" : connState === "connected" ? "Press Enter to send · Click mic for voice · Jarvis learns from every conversation" : "Waiting for server…"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
