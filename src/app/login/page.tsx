"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    document.cookie = `acc_token=${encodeURIComponent(token.trim())}; path=/; max-age=604800; samesite=lax`;
    setError("");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-2">AI Command Center</h1>
        <p className="text-sm text-[var(--muted)] mb-5">Введи gateway token для входа.</p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="GATEWAY_TOKEN"
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
        />
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        <button className="mt-4 w-full rounded-xl bg-sky-600 hover:bg-sky-500 transition px-4 py-2 font-medium" type="submit">
          Войти
        </button>
      </form>
    </div>
  );
}
