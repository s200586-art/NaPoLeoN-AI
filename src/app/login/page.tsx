"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    document.cookie = `acc_token=${encodeURIComponent(token.trim())}; path=/; max-age=604800; samesite=lax; secure`;
    router.push("/");
  };

  return (
    <div
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-4">🥷</div>
        <h1 className="text-3xl font-semibold tracking-tight">NaPoLeoN AI</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Ваш персональный командный центр
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={onSubmit}
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-input)",
        }}
        className="w-full max-w-sm rounded-2xl p-6"
      >
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Ключ доступа
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Введи токен..."
          style={{
            background: "var(--bg-app)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          className="w-full rounded-xl px-4 py-3 outline-none text-sm transition focus:ring-2 focus:ring-white/20 mb-4"
        />
        <button
          type="submit"
          disabled={!token.trim()}
          style={{
            background: token.trim() ? "var(--text-primary)" : "var(--border)",
            color: token.trim() ? "var(--bg-app)" : "var(--text-secondary)",
          }}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
        >
          Войти →
        </button>
      </form>

      <p className="mt-6 text-xs" style={{ color: "var(--text-secondary)" }}>
        Только для авторизованных пользователей
      </p>
    </div>
  );
}
