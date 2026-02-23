"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

const Logo = () => (
  <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--bg-app)] grid place-items-center text-[10px] font-bold">NP</div>
);

const PlusIcon = () => <span className="text-base">＋</span>;

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = (localStorage.getItem("acc_theme") as "dark" | "light") || "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("acc_theme", next);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const es = new EventSource("/api/live-log");
    es.onmessage = (e) => setLogs((prev) => [e.data, ...prev].slice(0, 30));
    return () => es.close();
  }, []);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: userText }),
    });
    const data = await res.json();
    setMessages((m) => [...m, { role: "assistant", text: data.answer || "Нет ответа" }]);
    setLoading(false);
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--bg-app)]">
      <aside className="hidden md:flex w-[280px] shrink-0 h-full bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex-col">
        <div className="p-3 border-b border-[var(--border)]">
          <button className="nav-item active"><PlusIcon /> New chat</button>
        </div>
        <div className="p-2 overflow-auto flex-1">
          <div className="px-2 py-2 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">Today</div>
          <button className="nav-item active">NaPoLeoN Launch Plan</button>
          <button className="nav-item">UI Refactor v2</button>
          <button className="nav-item">Marketing ideas</button>

          <div className="px-2 py-3 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">Projects</div>
          <button className="nav-item">npln.tech</button>
          <button className="nav-item">Flooring</button>
          <button className="nav-item">Ceramic</button>
        </div>
        <div className="p-3 border-t border-[var(--border)]">
          <button onClick={toggleTheme} className="nav-item">{theme === "dark" ? "Dark" : "Light"} mode</button>
        </div>
      </aside>

      <main className="flex-1 h-full flex flex-col relative">
        <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4 md:px-6 bg-[var(--bg-app)]/90 backdrop-blur">
          <div className="font-semibold tracking-tight">NaPoLeoN AI</div>
          <div className="flex items-center gap-2">
            <span className="chip">Pro UI</span>
            <span className="chip">Live</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 md:py-10 space-y-8">
            {messages.length === 0 && !loading && (
              <div className="h-[45vh] grid place-items-center text-center">
                <div>
                  <h1 className="text-3xl font-semibold mb-2 tracking-tight">What should we build next?</h1>
                  <p className="text-[var(--text-secondary)]">Premium interface baseline is ready. Next step: behaviors & motion polish.</p>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <Logo />}
                <div className={m.role === "assistant" ? "msg-ai max-w-[88%]" : "msg-user max-w-[75%]"}>{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-center">
                <Logo />
                <div className="text-[var(--text-secondary)]">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-3 md:px-6 pb-5 pt-3">
          <div className="max-w-3xl mx-auto">
            <div className="composer p-2 md:p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message NaPoLeoN..."
                className="w-full bg-transparent outline-none resize-none px-3 py-2 text-[15px] min-h-[48px] max-h-[180px]"
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex gap-2 text-sm text-[var(--text-secondary)]">
                  <button className="chip">Attach</button>
                  <button className="chip">Tools</button>
                </div>
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="h-10 px-4 rounded-xl bg-[var(--accent)] text-[var(--bg-app)] font-semibold disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
            <div className="text-center text-xs text-[var(--text-secondary)] mt-2">NaPoLeoN AI can make mistakes. Check critical facts.</div>
          </div>
        </div>
      </main>

      <aside className="hidden xl:flex w-[320px] shrink-0 h-full bg-[var(--bg-sidebar)] border-l border-[var(--border)] flex-col">
        <div className="h-14 border-b border-[var(--border)] flex items-center px-4 font-medium">Live Process</div>
        <div className="p-3 overflow-auto space-y-2">
          {logs.map((l, i) => (
            <div key={i} className="text-xs rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)] bg-[#00000010]">{l}</div>
          ))}
        </div>
      </aside>
    </div>
  );
}
