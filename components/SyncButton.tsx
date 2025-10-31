"use client";

import { useState } from "react";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) setMsg(`Sync ok: +${j.created}/~${j.updated} Orders, ${j.itemsUpserted} Positionen`);
      else setMsg(`Fehler: ${j.error || "unknown"}`);
    } catch (e: any) {
      setMsg(`Fehler: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="border px-2 py-1 rounded text-xs hover:bg-slate-700/40"
      >
        {loading ? "Sync läuft…" : "Jetzt synchronisieren"}
      </button>
      {msg && <span className="text-xs opacity-70">{msg}</span>}
    </div>
  );
}