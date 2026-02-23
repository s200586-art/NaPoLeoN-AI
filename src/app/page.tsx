"use client";

import { useEffect, useMemo, useState, useRef } from "react";

type Msg = { role: "user" | "assistant"; text: string };

// Icons
const IconMenu = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;
const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconSend = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const IconAI = () => <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">AI</div>;
const IconUser = () => <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-[10px] font-bold">YOU</div>;

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Auto-scroll ref
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
    const es = new EventSource("/api/live-log");
    es.onmessage = (e) => setLogs((prev) => [e.data, ...prev].slice(0, 40));
    return () => es.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      
      {/* Sidebar (Left) - ChatGPT Style */}
      <aside className="w-[260px] flex-shrink-0 bg-[var(--bg-sidebar)] flex flex-col h-full border-r border-[var(--border)] transition-all hidden md:flex">
        <div className="p-3">
          <button 
            onClick={() => setMessages([])}
            className="flex items-center gap-2 w-full px-3 py-3 rounded-lg border border-[var(--border)] hover:bg-[rgba(0,0,0,0.05)] transition text-sm font-medium text-[var(--text-primary)]"
          >
            <IconPlus /> Новый чат
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <div className="px-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 mt-4">Сегодня</div>
          <button className="sidebar-btn">🚀 Стратегия запуска</button>
          <button className="sidebar-btn">📊 Анализ конкурентов</button>
          <button className="sidebar-btn">🧱 Flooring Trends</button>
          
          <div className="px-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 mt-6">Проекты</div>
          <button className="sidebar-btn">🏢 npln.tech</button>
          <button className="sidebar-btn">🧩 Ceramic Digest</button>
        </div>

        <div className="p-3 border-t border-[var(--border)]">
          <button onClick={toggleTheme} className="sidebar-btn justify-between">
            <span>{theme === "dark" ? "Тёмная тема" : "Светлая тема"}</span>
            <span className="text-xs opacity-50">{theme === "dark" ? "🌙" : "☀️"}</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area (Center) */}
      <main className="flex-1 flex flex-col h-full relative bg-[var(--bg-app)]">
        
        {/* Mobile Header */}
        <div className="md:hidden h-14 border-b border-[var(--border)] flex items-center px-4 justify-between">
          <span className="font-semibold">NaPoLeoN AI</span>
          <button onClick={toggleTheme}>{theme === "dark" ? "🌙" : "☀️"}</button>
        </div>

        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50">
                <div className="text-4xl mb-4">🥷</div>
                <h2 className="text-2xl font-semibold mb-2">Чем могу помочь?</h2>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                
                {/* AI Avatar (Left) */}
                {m.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1"><IconAI /></div>
                )}

                {/* Bubble */}
                <div className={`prose max-w-[85%] rounded-2xl px-5 py-3.5 ${
                  m.role === "user" 
                    ? "bg-[var(--bg-user-bubble)] text-[var(--text-primary)] rounded-tr-sm" 
                    : "text-[var(--text-primary)] leading-7 pl-0"
                }`}>
                  {m.text}
                </div>

                {/* User Avatar (Right) - Optional, usually ChatGPT just aligns right */}
                {/* {m.role === "user" && <div className="flex-shrink-0 mt-1"><IconUser /></div>} */}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area (Floating Bottom) */}
        <div className="w-full p-4 pb-6">
          <div className="max-w-3xl mx-auto relative">
            <div className="input-area rounded-2xl flex flex-col w-full overflow-hidden transition-all focus-within:ring-1 focus-within:ring-[var(--text-secondary)]">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Сообщение NaPoLeoN..."
                className="w-full bg-transparent border-none outline-none resize-none px-4 py-4 min-h-[52px] max-h-[200px] text-[var(--text-primary)]"
                rows={1}
                style={{ height: input.length > 50 ? "auto" : "54px" }} 
              />
              <div className="flex justify-between items-center px-2 pb-2">
                <div className="text-[var(--text-secondary)] text-xs px-2 cursor-pointer hover:text-[var(--text-primary)] transition">+ файл</div>
                <button 
                  onClick={sendChat}
                  disabled={!input.trim()}
                  className={`p-2 rounded-lg transition-all ${
                    input.trim() 
                      ? "bg-black text-white dark:bg-white dark:text-black" 
                      : "bg-transparent text-[var(--border)] cursor-not-allowed"
                  }`}
                >
                  <IconSend />
                </button>
              </div>
            </div>
            <div className="text-center text-xs text-[var(--text-secondary)] mt-2">
              NaPoLeoN AI может совершать ошибки. Проверяйте важную информацию.
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel (Live Log) - Optional / Collapsible */}
      <aside className="w-[300px] bg-[var(--bg-sidebar)] border-l border-[var(--border)] hidden xl:flex flex-col h-full">
        <div className="p-4 border-b border-[var(--border)] font-medium text-sm flex justify-between items-center">
          <span>Live Process</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {logs.map((l, i) => (
            <div key={i} className="text-xs font-mono p-2 rounded border border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-app)]">
              {l}
            </div>
          ))}
        </div>
      </aside>

    </div>
  );
}
