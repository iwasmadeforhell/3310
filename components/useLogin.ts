"use client";
import { useState, type FormEvent } from "react";
import type { Scope } from "@/lib/session";

export function useLogin(scope: Scope, next = "/") {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setPassword("");
        setBusy(false);
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return { password, setPassword, error, busy, submit };
}

export async function logout(next = "/login") {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign(next);
}
