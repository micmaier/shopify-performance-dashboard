// src/app/page.tsx
import { prisma } from "@/lib/db";
import {
  parseRangeFromSearch,
  toYMD,
  getNetKpis,
  getNetRevenueSplit,
  getNetRevenueLastNMonths,
} from "@/lib/kpis";
import DateRangePicker from "@/components/DateRangePicker";
import BarSeries from "@/components/BarSeries";

function eur(n: number | null | undefined) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const shop = await prisma.shop.findFirst({
    select: { id: true, name: true, domain: true },
  });

  if (!shop) {
    return (
      <div className="text-slate-300">
        Kein Shop gefunden. Bitte Seed oder Sync ausführen.
      </div>
    );
  }

  const range = parseRangeFromSearch(searchParams);

  const [totals, split, last12] = await Promise.all([
    getNetKpis(shop.id, range),
    getNetRevenueSplit(shop.id, range),
    getNetRevenueLastNMonths(shop.id, 12, range.to),
  ]);

  const untilDay = new Date(range.to.getTime() - 24 * 3600 * 1000);

  return (
    <div className="space-y-6 text-slate-100">
      <DateRangePicker from={toYMD(range.from)} to={toYMD(untilDay)} />

      {/* KPI Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">NMV (Bruttoumsatz)</div>
          <div className="text-xl font-semibold">{eur(totals.grossSales)}</div>
        </div>
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">Discounts</div>
          <div className="text-xl font-semibold">{eur(totals.discounts)}</div>
        </div>
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">Returns</div>
          <div className="text-xl font-semibold">{eur(totals.returns)}</div>
        </div>

        <div className="border border-slate-700 rounded p-3 md:col-span-2">
          <div className="text-xs text-slate-400">Netto</div>
          <div className="text-xl font-semibold">{eur(totals.netRevenue)}</div>
        </div>
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">COGS</div>
          <div className="text-xl font-semibold">{eur(totals.cogs)}</div>
        </div>

        <div className="border border-slate-700 rounded p-3 md:col-span-3">
          <div className="text-xs text-slate-400">Bruttomarge</div>
          <div className="text-xl font-semibold">{eur(totals.grossMargin)}</div>
        </div>
      </div>

      {/* Segment Split */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">B2C</div>
          <div className="text-lg font-semibold">{eur(split.b2c)}</div>
        </div>
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">Mynt Pro</div>
          <div className="text-lg font-semibold">{eur(split.b2b)}</div>
        </div>
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">Projects</div>
          <div className="text-lg font-semibold">{eur(split.platform)}</div>
        </div>
        <div className="border border-slate-700 rounded p-3">
          <div className="text-xs text-slate-400">Unklar</div>
          <div className="text-lg font-semibold">{eur(split.unknown)}</div>
        </div>
      </div>

      {/* Last 12 Months Chart */}
      <section className="space-y-2">
        <div className="text-slate-200 text-sm font-semibold">
          Nettoumsatz – letzte 12 Monate
        </div>
        <BarSeries data={last12.map((m) => ({ month: m.month, net: m.net }))} />
      </section>

      <p className="text-slate-500 text-xs">
        Basis: Order-Felder grossSales, discounts, returns, netRevenue, cogs.
        Zeitraum wirkt auf alle Kacheln & Split.
      </p>
    </div>
  );
}