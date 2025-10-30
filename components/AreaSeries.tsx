"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AreaSeries({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <div className="w-full h-[260px] text-slate-200">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#6b7280" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ backgroundColor: "#000", border: "1px solid #555", color: "#fff" }}
            formatter={(v: any) => [`${Number(v).toFixed(2)} €`, "Netto (€)"]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#60a5fa"
            fill="#60a5fa"
            fillOpacity={0.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
