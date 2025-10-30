"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DateRangePicker({ from, to }: { from: string; to: string }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const router = useRouter();

  function goCustom() {
    router.push(`?from=${f}&to=${t}`);
  }
  function goPreset(p: string) {
    router.push(`?preset=${p}`);
  }

  const btn =
    "border border-slate-500/50 text-xs px-2 py-1 rounded hover:bg-slate-700/40";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200 mb-4">
      <div className="flex items-center gap-1">
        <label>Von</label>
        <input
          type="date"
          value={f}
          onChange={(e) => setF(e.target.value)}
          className="bg-black border border-slate-600 rounded px-1 py-0.5 text-white text-xs"
        />
      </div>

      <div className="flex items-center gap-1">
        <label>Bis</label>
        <input
          type="date"
          value={t}
          onChange={(e) => setT(e.target.value)}
          className="bg-black border border-slate-600 rounded px-1 py-0.5 text-white text-xs"
        />
      </div>

      <button className={btn} onClick={goCustom}>Anwenden</button>

      <button className={btn} onClick={() => goPreset("last30")}>Letzte 30T</button>
      <button className={btn} onClick={() => goPreset("mtd")}>MTD</button>
      <button className={btn} onClick={() => goPreset("qtd")}>QTD</button>
      <button className={btn} onClick={() => goPreset("ytd")}>YTD</button>
      <button className={btn} onClick={() => goPreset("prevmonth")}>Vor-Monat</button>
    </div>
  );
}
