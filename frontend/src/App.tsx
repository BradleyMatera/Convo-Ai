import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  mood?: string;
  audio?: string;
  timestamp: string;
}

type InputMode = "text" | "voice";
type ConnState = "connecting" | "connected" | "disconnected";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);

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

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnState("connected");
    ws.onclose = () => setConnState("disconnected");
    ws.onerror = () => setConnState("disconnected");

    ws.onmessage = (event) => {
      setIsThinking(false);
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: `Error: ${data.error}`,
              timestamp: new Date().toISOString(),
            },
          ]);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: data.response || "",
            mood: data.mood,
            audio: data.audio,
            timestamp: new Date().toISOString(),
          },
        ]);
        if (data.audio) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
          audio.play().catch(() => {});
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => ws.close();
  }, []);

  // Load history on mount
  useEffect(() => {
    fetch("/api/history?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(
            data.map((e: any) => ({
              id: e.id,
              role: "assistant",
              text: `You: ${e.user_text}\nJarvis: ${e.assistant_text}`,
              mood: e.mood,
              timestamp: e.timestamp,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed || !wsRef.current || connState !== "connected") return;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: trimmed, timestamp: new Date().toISOString() },
    ]);
    wsRef.current.send(JSON.stringify({ text: trimmed }));
    setText("");
    setIsThinking(true);
  };

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
            setIsThinking(true);
          }
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access is required for voice input.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const connColor =
    connState === "connected"
      ? "bg-green-500"
      : connState === "connecting"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-jarvis-600 text-lg font-bold">
            J
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Convo-AI</h1>
            <p className="text-xs text-gray-400">Just A Rather Very Intelligent System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${connColor} animate-pulse`} />
          <span className="text-sm text-gray-400">{connState}</span>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        {history.length > 0 && (
          <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-500">Previous session</p>
            {history.map((m) => (
              <div key={`h-${m.id}`} className="mb-1 whitespace-pre-wrap text-sm text-gray-400">
                {m.text}
              </div>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-4 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-jarvis-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.mood && (
                <span className="mt-1 inline-block text-xs text-gray-400">mood: {m.mood}</span>
              )}
              {m.audio && (
                <audio
                  controls
                  src={`data:audio/wav;base64,${m.audio}`}
                  className="mt-2 h-8 w-full"
                />
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl bg-gray-800 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-6 py-4">
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setInputMode("text")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === "text"
                ? "bg-jarvis-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setInputMode("voice")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === "voice"
                ? "bg-jarvis-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Voice
          </button>
        </div>

        {inputMode === "text" ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder="Type your message..."
              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-jarvis-500 focus:outline-none"
            />
            <button
              onClick={sendText}
              disabled={!text.trim() || connState !== "connected"}
              className="rounded-lg bg-jarvis-600 px-6 py-3 font-medium text-white transition hover:bg-jarvis-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={connState !== "connected"}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                isRecording
                  ? "bg-red-600 animate-pulse"
                  : "bg-jarvis-600 hover:bg-jarvis-700"
              } disabled:opacity-50`}
            >
              {isRecording ? "⏹" : "🎤"}
            </button>
            <span className="text-sm text-gray-400">
              {isRecording ? "Recording... click to stop" : "Click to start recording"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
