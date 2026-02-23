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
    <div style={{ background: "var(--bg-app)", color: "var(--text-primary)" }} className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-7 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">NaPoLeoN AI</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Private command center access</p>
      </div>

      <form
        onSubmit={onSubmit}
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 10px 36px rgba(0,0,0,.22)" }}
        className="w-full max-w-sm rounded-2xl p-6"
      >
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Access key</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter key..."
          style={{ background: "var(--bg-app)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          className="w-full rounded-xl px-4 py-3 outline-none text-sm transition mb-4"
        />
        <button
          type="submit"
          disabled={!token.trim()}
          style={{ background: token.trim() ? "var(--accent)" : "var(--border)", color: token.trim() ? "var(--bg-app)" : "var(--text-secondary)" }}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
