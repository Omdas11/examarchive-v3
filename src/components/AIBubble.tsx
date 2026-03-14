"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface AIBubbleProps {
  /** Whether the current user is logged in. */
  isLoggedIn: boolean;
}

export default function AIBubble({ isLoggedIn }: AIBubbleProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0 && isLoggedIn) {
      setMessages([
        {
          role: "assistant",
          text: "👋 Hi! I'm ExamBot. I can help you navigate ExamArchive, find past papers, and answer academic questions. What can I help you with today?",
        },
      ]);
    }
  }, [open, messages.length, isLoggedIn]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", text: trimmed }];
    setMessages(newMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: newMessages.slice(-10).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* ── Floating bubble button ─────────────────────────────────────────── */}
      <button
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        onClick={() => {
          if (!isLoggedIn) {
            window.location.href = "/login?next=/";
            return;
          }
          setOpen((v) => !v);
        }}
        style={{
          position: "fixed",
          bottom: "5.5rem",
          right: "1.25rem",
          zIndex: 200,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          background: "linear-gradient(135deg, var(--brand-crimson), var(--nav-teal))",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        {open ? "✕" : "💭"}
      </button>

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      {open && isLoggedIn && (
        <div
          role="dialog"
          aria-label="AI assistant chat panel"
          style={{
            position: "fixed",
            bottom: "8.5rem",
            right: "1.25rem",
            zIndex: 199,
            width: "min(360px, calc(100vw - 2rem))",
            maxHeight: "min(520px, calc(100dvh - 10rem))",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--color-border)",
              background: "linear-gradient(135deg, var(--brand-crimson), var(--nav-teal))",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18 }}>💭</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>ExamBot</div>
              <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>AI Academic Assistant</div>
            </div>
            <button
              aria-label="Clear chat history"
              onClick={() => setMessages([])}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.7rem",
                opacity: 0.8,
                padding: "2px 6px",
              }}
              title="Clear history"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            {messages.length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "1rem" }}>
                Ask me anything about ExamArchive!
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background:
                      m.role === "user"
                        ? "var(--brand-crimson)"
                        : "var(--color-accent-soft)",
                    color: m.role === "user" ? "#fff" : "var(--color-text)",
                    fontSize: "0.8rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "12px 12px 12px 2px",
                    background: "var(--color-accent-soft)",
                    fontSize: "0.8rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  ExamBot is thinking…
                </div>
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: "0.4rem 0.6rem",
                  borderRadius: 6,
                  background: "#fce8eb",
                  color: "var(--brand-crimson)",
                  fontSize: "0.75rem",
                }}
              >
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              padding: "0.6rem",
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              gap: "0.4rem",
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask ExamBot…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={1000}
              disabled={loading}
              style={{
                flex: 1,
                padding: "0.45rem 0.65rem",
                fontSize: "0.8rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-input-bg)",
                color: "var(--color-text)",
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: "0.45rem 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                background: "var(--brand-crimson)",
                color: "#fff",
                opacity: loading || !input.trim() ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
