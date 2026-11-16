"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getToken,
  askJournal,
  ChatMessage,
  ChatSource,
} from "@/lib/api";

const STARTER_PROMPTS = [
  "What bug did I fix in the sprint and what was the root cause?",
  "How far did I run in my evening workout and what is my sleep target?",
  "What chunk size did we choose for our RAG pipeline and why?",
  "What did we learn about pgvector distance operators?",
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Authentication Guard
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    // Initial greeting
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "👋 Hi! I am your Daily-Productive AI assistant. I have direct access to your personal journal entries through pgvector semantic retrieval. Ask me anything about your sprint notes, bug fixes, workouts, or learning goals!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [router]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const query = (questionText || input).trim();
    if (!query || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: "u_" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await askJournal(query);
      const assistantMsg: ChatMessage = {
        id: "a_" + Date.now(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to get an answer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Productivity AI Assistant
            </h1>
          </div>
          <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-medium hidden sm:inline-block">
            RAG Powered by pgvector + Gemini
          </span>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                id: "welcome-reset",
                role: "assistant",
                content: "Chat cleared! What else would you like to know about your journal entries?",
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
            setError(null);
          }}
          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition"
        >
          Clear Chat
        </button>
      </header>

      {/* Chat Messages Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col gap-5 overflow-y-auto">
        {/* Quick Starter Prompts */}
        {messages.length <= 1 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              💡 Suggested Questions from Your Journal:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-left text-xs bg-slate-800/70 hover:bg-indigo-950/40 hover:border-indigo-500/40 border border-slate-700/60 text-slate-300 hover:text-indigo-200 p-3 rounded-xl transition flex items-start gap-2"
                >
                  <span className="text-indigo-400 shrink-0">💬</span>
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
              <span>{msg.role === "user" ? "You" : "🤖 Assistant"}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Source Citations */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs">
                  <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <span>📚</span> Retrieved Sources ({msg.sources.length}):
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {msg.sources.map((src, i) => (
                      <div
                        key={i}
                        className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-2 text-slate-300"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                          <span className="font-medium text-indigo-300">
                            {src.title || "Untitled Entry"}
                          </span>
                          {src.similarity !== undefined && (
                            <span className="bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800/50 text-[10px]">
                              {Math.round(src.similarity * 100)}% match
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] italic line-clamp-2">
                          "{src.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
              <span>🤖 Assistant</span>
              <span>•</span>
              <span>Retrieving & Thinking...</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
              <span className="text-xs">Searching pgvector vectors and generating answer...</span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-950/50 border border-rose-800/60 rounded-xl p-3 text-xs text-rose-300 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Sticky Bottom Input Bar */}
      <footer className="border-t border-slate-800 bg-slate-900/90 backdrop-blur px-4 py-3 sticky bottom-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your sprint, workouts, bugs, or goals... (Press Enter to send)"
            disabled={loading}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-sm px-5 py-3 rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm shadow-indigo-600/30"
          >
            <span>Ask</span>
            <span>→</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
