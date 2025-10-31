// src/lib/kpis.ts
import { prisma } from "./db";
import { parseRangeFromSearch, toYMD } from "./date";
export { parseRangeFromSearch, toYMD } from "./date";

type Range = { from: Date; to: Date };

// Helper: Prisma Decimal/undefined → number
const num = (v: any) => Number(v ?? 0);

/**
 * Aggregierte KPIs für ein Zeitfenster.
 * Definitionen:
 *  - grossSales = Brutto ohne Steuer
 *  - discounts, returns = positive Beträge
 *  - netRevenue = grossSales - discounts - returns (ohne Steuer)
 *  - tax = Steuer
 *  - total = netRevenue + tax
 *  - cogs = Wareneinsatz
 *  - grossMargin (Deckungsbeitrag) = netRevenue - cogs
 */
export async function getNetKpis(shopId: string, range: Range) {
  const agg = await prisma.order.aggregate({
    where: {
      shopId,
      createdAt: { gte: range.from, lt: range.to }, // to ist exklusiv
    },
    _sum: {
      grossSales: true,
      discounts: true,
      returns: true,
      netRevenue: true,
      tax: true,
      total: true,
      cogs: true,
    },
  });

  const grossSales = num(agg._sum.grossSales);
  const discounts  = num(agg._sum.discounts);
  const returns    = num(agg._sum.returns);
  const netRevenue = num(agg._sum.netRevenue);
  const tax        = num(agg._sum.tax);
  const total      = num(agg._sum.total);
  const cogs       = num(agg._sum.cogs);

  // Wichtig: Umsatz NICHT um COGS reduzieren.
  const grossMargin = netRevenue - cogs;

  return { grossSales, discounts, returns, netRevenue, tax, total, cogs, grossMargin };
}

/**
 * Split Nettoumsatz nach Segmenten.
 * (Umsatz hier = netRevenue, also ohne Steuer und ohne COGS.)
 */
export async function getNetRevenueSplit(shopId: string, range: Range) {
  const orders = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: range.from, lt: range.to } },
    select: { segment: true, netRevenue: true },
  });

  let b2c = 0, b2b = 0, platform = 0, unknown = 0;
  for (const o of orders) {
    const val = num(o.netRevenue);
    switch (o.segment) {
      case "b2c": b2c += val; break;
      case "b2b": b2b += val; break;
      case "platform": platform += val; break;
      default: unknown += val; break;
    }
  }
  return { b2c, b2b, platform, unknown };
}

/**
 * Letzte N Monate Nettoumsatz (netRevenue) bis einschließlich monthEnd.
 * Gibt [{ month: "YYYY-MM", net: number }, ...]
 */
export async function getNetRevenueLastNMonths(shopId: string, n: number, monthEnd: Date) {
  // Normiere auf Monatsende (exklusiv)
  const end = new Date(monthEnd);
  end.setDate(1);
  end.setMonth(end.getMonth() + 1); // erstes Datum des Folgemonats (exklusiv)

  const start = new Date(end);
  start.setMonth(start.getMonth() - n);

  const orders = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: start, lt: end } },
    select: { createdAt: true, netRevenue: true },
    orderBy: { createdAt: "asc" },
  });

  // Bucketing
  const bucket = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    bucket.set(key, 0);
  }

  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    bucket.set(key, (bucket.get(key) ?? 0) + num(o.netRevenue));
  }

  return Array.from(bucket.entries()).map(([month, net]) => ({ month, net }));
}

/**
 * Tagesserie Nettoumsatz – falls benötigt (Orders-Page etc.)
 */
export async function getDailyRevenueSeries(
  shopId: string,
  range: { from: Date; to: Date }
) {
  const start = new Date(range.from);
  const end   = new Date(range.to);

  const orders = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: start, lt: end } },
    select: { createdAt: true, netRevenue: true },
    orderBy: { createdAt: "asc" },
  });

  const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const bucket = new Map<string, number>();

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    bucket.set(dayKey(d), 0);
  }

  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = dayKey(d);
    if (bucket.has(key)) {
      bucket.set(key, (bucket.get(key) ?? 0) + Number(o.netRevenue ?? 0));
    }
  }

  return Array.from(bucket.entries()).map(([date, net]) => ({ date, net }));
}

/**
 * Segment-KPIs: #Customers (unique), #New, #Existing, Basket Size, Order Frequency.
 * customerExternalId (Shopify customer.id) hat Priorität; Fallback: customerEmail.
 */
export async function getSegmentStats(
  shopId: string,
  segment: "b2c" | "b2b" | "platform",
  range: Range
) {
  // Alle Orders dieses Segments im Zeitraum
  const orders = await prisma.order.findMany({
    where: {
      shopId,
      segment,
      createdAt: { gte: range.from, lt: range.to },
    },
    select: {
      netRevenue: true,
      customerExternalId: true,
      customerEmail: true,
      createdAt: true,
    },
  });

  const orderCount = orders.length;
  const netSum = orders.reduce((s, o) => s + num(o.netRevenue), 0);

  // Uniq-Kunden-Schlüssel bestimmen
  const keys = orders
    .map((o) => o.customerExternalId || o.customerEmail)
    .filter((k): k is string => !!k);

  const uniqueKeys = new Set(keys);
  const uniqueCustomers = uniqueKeys.size;

  const basketSize = orderCount > 0 ? netSum / orderCount : 0;
  const orderFrequency = uniqueCustomers > 0 ? orderCount / uniqueCustomers : 0;

  // New/Existing: Ersten Bestellzeitpunkt je Kunde im GESAMTEN Shop ermitteln
  let newCustomers = 0;
  let existingCustomers = 0;

  if (uniqueCustomers > 0) {
    const keyArr = Array.from(uniqueKeys);

    // Hole alle Orders dieser Keys (shopweit), sortiert nach createdAt (asc)
    const firsts = await prisma.order.findMany({
      where: {
        shopId,
        OR: [
          { customerExternalId: { in: keyArr } },
          { customerEmail: { in: keyArr } },
        ],
      },
      select: { customerExternalId: true, customerEmail: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Map: key -> frühestes Datum
    const firstByKey = new Map<string, Date>();
    for (const f of firsts) {
      const k = f.customerExternalId || f.customerEmail;
      if (!k) continue;
      if (!firstByKey.has(k)) firstByKey.set(k, f.createdAt);
    }

    // Zähle je nach Erstkauf innerhalb des aktuellen Range
    for (const k of uniqueKeys) {
      const first = firstByKey.get(k);
      if (first && first >= range.from && first < range.to) newCustomers++;
      else existingCustomers++;
    }
  }

  return {
    uniqueCustomers,
    newCustomers,
    existingCustomers,
    basketSize,
    orderFrequency,
  };
}
