import { prisma } from "@/lib/db";
import DateRangePicker from "@/components/DateRangePicker";
import { getDailyRevenueSeries, parseRangeFromSearch, toYMD } from "@/lib/kpis";
import AreaSeries from "@/components/AreaSeries";

function fmtEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n ?? 0);
}

export default async function OrdersPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const shop = await prisma.shop.findFirst();
  const shopId = shop?.id ?? "local";

  const range = parseRangeFromSearch(searchParams as any);

  const series = await getDailyRevenueSeries(shopId, range);

  const recent = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: range.from, lt: range.to } as any },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, name: true, createdAt: true, netRevenue: true },
  });

  return (
    <div className="text-slate-100 space-y-6">
      <DateRangePicker
        from={toYMD(range.from)}
        to={toYMD(new Date(range.to.getTime() - 24 * 3600 * 1000))}
      />

      <section className="space-y-2">
        <div className="text-slate-200 text-sm font-semibold">
          Umsatzverlauf (Tage)
        </div>
        <AreaSeries data={series} />
      </section>

      <section>
        <div className="text-slate-200 text-sm font-semibold mb-2">
          Letzte Bestellungen
        </div>
        <table className="text-xs text-slate-200 w-full max-w-xl border-collapse">
          <thead className="text-slate-400">
            <tr className="border-b border-slate-700 text-left">
              <th className="py-1 pr-2">Order</th>
              <th className="py-1 pr-2">Datum</th>
              <th className="py-1 pr-2">Summe (netto)</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr
                key={o.id}
                className="border-b border-slate-800 hover:bg-slate-800/40"
              >
                <td className="py-1 pr-2">{o.name}</td>
                <td className="py-1 pr-2">
                  {o.createdAt.toLocaleDateString("de-DE")}
                </td>
                <td className="py-1 pr-2">
                  {fmtEUR(Number(o.netRevenue || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 text-xs">
          <a
            className="underline"
            href={`/orders/table?from=${toYMD(range.from)}&to=${toYMD(
              new Date(range.to.getTime() - 86400000)
            )}`}
          >
            Vollständige Tabelle & CSV →
          </a>
        </div>
      </section>
    </div>
  );
}
