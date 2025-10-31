"use client";

type MonthKey =
  | "Jan" | "Feb" | "Mär" | "Apr" | "Mai" | "Jun"
  | "Jul" | "Aug" | "Sep" | "Okt" | "Nov" | "Dez" | "Summe";

const MONTHS: MonthKey[] = [
  "Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"
];

function eur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);
}

function sumRow(r: Record<string, number>) {
  return MONTHS.reduce((acc, m) => acc + (r[m] || 0), 0);
}

export default function EbitdaTable({
  year,
  current,
  previous,
  previousTotals,
}: {
  year: number;
  current: { rows: Array<{ key: string; label: string; data: Record<string, number> }> };
  previous: { rows: Array<{ key: string; label: string; data: Record<string, number> }> };
  previousTotals: Record<string, number>;
}) {
  const map = new Map(current.rows.map((r) => [r.key, r]));

  // PC II = PC I − Logistik − Verpackung − Payment
  const pcI  = map.get("pci1")?.data || {};
  const log  = map.get("logistics")?.data || {};
  const pack = map.get("packaging")?.data || {};
  const pay  = map.get("payment")?.data || {};
  const pcII: Record<string, number> = {};
  for (const m of MONTHS) {
    pcII[m] = (pcI[m] || 0) - (log[m] || 0) - (pack[m] || 0) - (pay[m] || 0);
  }
  pcII["Summe"] = sumRow(pcII);

  const get = (k: string) => map.get(k)?.data || {};

  const rows = [
    { section: "header", label: "TOPLINE" },
    { key: "nmv", label: "NMV", data: get("nmv") },
    { key: "discounts", label: "Discounts", data: get("discounts") },
    { key: "returns", label: "Returns", data: get("returns") },
    { key: "netRevenue", label: "Net Revenue", data: get("netRevenue"), highlight: true },

    { section: "header", label: "BOTTOMLINE" },
    { key: "shipping", label: "Shipping Charges", data: get("shipping") },
    { key: "cogs", label: "COGS", data: get("cogs") },
    { key: "pci1", label: "PC I", data: get("pci1"), highlight: true },
    { key: "logistics", label: "Logistik", data: get("logistics") },
    { key: "packaging", label: "Verpackung", data: get("packaging") },
    { key: "payment", label: "Payment (2,8 %)", data: get("payment") },
    { key: "pci2", label: "PC II", data: pcII, highlight: true },
    { key: "marketing", label: "Marketing", data: get("marketing") },
    { key: "commissions", label: "Commissions", data: get("commissions") },
    { key: "personnel", label: "Personnel", data: get("personnel") },
    { key: "admin", label: "Admin", data: get("admin") },
    { key: "ebitda", label: "EBITDA", data: get("ebitda"), highlight: true },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-slate-100 font-semibold">EBITDA-Breakdown {year}</h2>

      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="min-w-[1000px] w-full border-collapse">
          <thead className="bg-slate-900/70">
            <tr>
              <th className="text-left px-3 py-2 text-slate-300 font-semibold sticky left-0 bg-slate-900/70">Position</th>
              {MONTHS.map((m) => (
                <th key={m} className="text-right px-3 py-2 text-slate-300 font-semibold">
                  {m}
                </th>
              ))}
              <th className="text-right px-3 py-2 text-slate-300 font-semibold bg-slate-900/70">Summe</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              if (row.section === "header") {
                return (
                  <tr key={i} className="bg-slate-900">
                    <td
                      colSpan={MONTHS.length + 2}
                      className="text-slate-200 uppercase tracking-wide px-3 py-2 font-semibold border-y border-slate-800"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const data = row.data || {};
              const isSum = row.highlight;
              const bg = isSum ? "bg-slate-800" : "bg-slate-950";

              return (
                <tr key={row.key} className={bg + " border-b border-slate-800"}>
                  <td className="px-3 py-2 text-slate-200 font-semibold sticky left-0">{row.label}</td>
                  {MONTHS.map((m) => (
                    <td key={m} className="px-3 py-2 text-right text-slate-100 font-semibold">
                      {eur(data[m] || 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold text-slate-100">{eur(sumRow(data))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="text-slate-300">
        <summary className="cursor-pointer">
          ► Vorjahr – <span className="font-semibold">Summe: {eur(previousTotals.ebitda)}</span> (zum Aufklappen klicken)
        </summary>
      </details>
    </section>
  );
}
