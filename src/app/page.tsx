"use client";

import { useEffect, useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [tab, setTab] = useState<"chat" | "multi" | "dash">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [multi, setMulti] = useState<Record<string, string>>({ Claude: "", Gemini: "", Codex: "" });

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
    const es = new EventSource("/api/live-log");
    es.onmessage = (e) => setLogs((prev) => [e.data, ...prev].slice(0, 40));
    return () => es.close();
  }, []);

  const sendChat = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: userText }),
    });
    const data = await res.json();
    setMessages((m) => [...m, { role: "assistant", text: data.answer || "Нет ответа" }]);
  };

  const runMulti = async () => {
    if (!input.trim()) return;
    const res = await fetch("/api/multi-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: input.trim() }),
    });
    const data = await res.json();
    setMulti(data);
  };

  const dash = useMemo(
    () => [
      ["Gmail", "12 непрочитанных (mock)"],
      ["Fitbit", "8 420 шагов (mock)"],
      ["Telegram", "+37 подписчиков (mock)"],
      ["Twitter", "ER 4.2% (mock)"],
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4">
        <div className="font-semibold">AI Command Center</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab("chat")} className={`tab ${tab === "chat" ? "tab-active" : ""}`}>Chat</button>
          <button onClick={() => setTab("multi")} className={`tab ${tab === "multi" ? "tab-active" : ""}`}>Multi-Agent</button>
          <button onClick={() => setTab("dash")} className={`tab ${tab === "dash" ? "tab-active" : ""}`}>Dashboard</button>
          <button onClick={toggleTheme} className="tab">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-3 p-3 h-[calc(100vh-56px)]">
        <aside className="col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3">
          <div className="text-sm text-[var(--muted)] mb-2">Проекты</div>
          <div className="space-y-2 text-sm">
            <div className="item">🏢 npln.tech</div>
            <div className="item">🧱 Flooring News</div>
            <div className="item">🧩 Ceramic Digest</div>
            <div className="item">🚀 AI Product</div>
          </div>
        </aside>

        <section className="col-span-7 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 flex flex-col">
          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-auto space-y-3 pr-1">
                {messages.length === 0 && <p className="text-sm text-[var(--muted)]">Пиши задачу — отвечу в стиле Command Center.</p>}
                {messages.map((m, i) => (
                  <div key={i} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="pt-3 flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Напиши задачу..." className="input" />
                <button onClick={sendChat} className="btn">Send</button>
              </div>
            </>
          )}

          {tab === "multi" && (
            <>
              <div className="grid grid-cols-3 gap-3 flex-1 overflow-auto">
                {Object.keys(multi).map((k) => (
                  <div key={k} className="rounded-xl border border-[var(--border)] p-3">
                    <div className="font-medium mb-2">{k}</div>
                    <div className="text-sm text-[var(--muted)] whitespace-pre-wrap">{multi[k] || "Пусто"}</div>
                  </div>
                ))}
              </div>
              <div className="pt-3 flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Один запрос для 3 агентов..." className="input" />
                <button onClick={runMulti} className="btn">Run x3</button>
              </div>
            </>
          )}

          {tab === "dash" && (
            <div className="grid grid-cols-2 gap-3">
              {dash.map(([name, val]) => (
                <div key={name} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="text-sm text-[var(--muted)]">{name}</div>
                  <div className="mt-2 text-xl font-semibold">{val}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 overflow-auto">
          <div className="text-sm text-[var(--muted)] mb-2">Live Log</div>
          <div className="space-y-2 text-xs">
            {logs.map((l, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)]">{l}</div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
