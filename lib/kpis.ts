// src/lib/kpis.ts
import { prisma } from './db';
import { Range, parseRangeFromSearch, startOfDayUTC, addDaysUTC, addMonthsUTC, toYMD } from './date';

export { parseRangeFromSearch, toYMD }; // Re-export für einfache Imports in Pages

/** Summen im Zeitraum für Dashboard-Kacheln */
export async function getNetKpis(shopId: string, range: Range) {
  const rows = await prisma.order.findMany({
    where: {
      shopId,
      createdAt: { gte: range.from, lt: range.to },
    },
    select: {
      grossSales: true,
      discounts: true,
      returns: true,
      netRevenue: true,
      cogs: true,
    },
  });

  let grossSales = 0,
    discounts = 0,
    returns = 0,
    netRevenue = 0,
    cogs = 0;

  for (const r of rows) {
    grossSales += Number(r.grossSales);
    discounts += Number(r.discounts);
    returns += Number(r.returns);
    netRevenue += Number(r.netRevenue);
    cogs += Number(r.cogs);
  }

  const grossMargin = netRevenue - cogs;

  return { grossSales, discounts, returns, netRevenue, cogs, grossMargin };
}

/** Split Nettoumsatz nach Segment im Zeitraum */
export async function getNetRevenueSplit(shopId: string, range: Range) {
  const rows = await prisma.order.groupBy({
    by: ['segment'],
    where: {
      shopId,
      createdAt: { gte: range.from, lt: range.to },
    },
    _sum: { netRevenue: true },
  });

  let b2c = 0,
    b2b = 0,
    platform = 0,
    unknown = 0;

  for (const row of rows) {
    const v = Number(row._sum.netRevenue ?? 0);
    if (row.segment === 'b2c') b2c += v;
    else if (row.segment === 'b2b') b2b += v;
    else if (row.segment === 'platform') platform += v;
    else unknown += v;
  }

  return { b2c, b2b, platform, unknown };
}

/** Nettoumsatz Monatssummen der letzten N Monate bis inkl. anchorDate */
export async function getNetRevenueLastNMonths(
  shopId: string,
  n: number,
  anchorDate: Date
) {
  // wir bauen eine Liste von Monats-Buckets rückwärts
  const buckets: { label: string; from: Date; to: Date }[] = [];
  let cursorStart = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    const start = new Date(cursorStart.getTime());
    const end = addMonthsUTC(start, 1);
    const label = start.toLocaleString('de-DE', {
      month: 'short',
      year: '2-digit',
    });
    buckets.unshift({ label, from: start, to: end });
    cursorStart = addMonthsUTC(cursorStart, -1);
  }

  const results: { month: string; net: number }[] = [];
  for (const b of buckets) {
    const sumRows = await prisma.order.aggregate({
      where: { shopId, createdAt: { gte: b.from, lt: b.to } },
      _sum: { netRevenue: true },
    });
    results.push({
      month: b.label,
      net: Number(sumRows._sum.netRevenue || 0),
    });
  }
  return results;
}

/** Für Orders-Seite: Nettoumsatz pro Tag im Bereich */
export async function getDailyRevenueSeries(shopId: string, range: Range) {
  // Alle Orders im Bereich holen
  const orders = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: range.from, lt: range.to } },
    select: { createdAt: true, netRevenue: true },
  });

  // Bucket nach UTC-Tag
  const bucket = new Map<string, number>();
  for (const o of orders) {
    const day = startOfDayUTC(o.createdAt);
    const key = toYMD(day);
    bucket.set(key, (bucket.get(key) || 0) + Number(o.netRevenue || 0));
  }

  // sortierte Liste aller Tage im Bereich
  const days: Date[] = [];
  for (let d = startOfDayUTC(range.from); d < range.to; d = addDaysUTC(d, 1)) {
    days.push(d);
  }

  return days.map((d) => ({
    date: toYMD(d).slice(5), // "MM-DD"
    revenue: bucket.get(toYMD(d)) || 0,
  }));
}
