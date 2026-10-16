"use client";

/** POST JSON to a store API route; throws the route's error message. */
export async function post<T = Record<string, unknown>>(url: string, body: unknown = {}, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export const fmtDate = (ms: number | null | undefined) =>
  ms === null ? "never" : !ms ? "-" : new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
