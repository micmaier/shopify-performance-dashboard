"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function BarSeries({ data }: { data: { month: string; net: number }[] }) {
  return (
    <div className="w-full h-[260px] text-slate-200">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#6b7280" />
          <XAxis dataKey="month" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ backgroundColor: "#000", border: "1px solid #555", color: "#fff" }}
            formatter={(v: any) => [`${Number(v).toFixed(2)} €`, "Netto (€)"]}
          />
          <Bar dataKey="net" stroke="#60a5fa" fill="#60a5fa" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
