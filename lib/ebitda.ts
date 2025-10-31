// src/lib/ebitda.ts
import { prisma } from "./db";

export type MonthKey =
  | "Jan" | "Feb" | "Mär" | "Apr" | "Mai" | "Jun"
  | "Jul" | "Aug" | "Sep" | "Okt" | "Nov" | "Dez" | "Summe";

const MONTHS: MonthKey[] = [
  "Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez",
];

const monthName = (m: number): MonthKey =>
  (["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"][m] as MonthKey);

const zeroRow = () =>
  Object.fromEntries([...MONTHS, "Summe"].map((m) => [m, 0])) as Record<MonthKey | "Summe", number>;

const num = (v: any) => Number(v ?? 0);

// --- Shopify Shipping (Umsatz) für ein Datumsfenster einsammeln ----------------

const SHOP   = process.env.SHOPIFY_SHOP!;
const TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN!;
const APIVER = process.env.SHOPIFY_API_VERSION || "2024-10";

// summiert shipping_lines[].price pro Monat im [from, to)-Fenster
async function fetchShippingByMonth(from: Date, to: Date): Promise<Record<MonthKey, number>> {
  const out: Record<MonthKey, number> = Object.fromEntries(MONTHS.map(m => [m, 0])) as any;

  // ISO ohne ms
  const minIso = from.toISOString();
  const maxIso = to.toISOString();

  let nextUrl = `https://${SHOP}/admin/api/${APIVER}/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(minIso)}&created_at_max=${encodeURIComponent(maxIso)}&fields=created_at,shipping_lines`;
  const headers = { "X-Shopify-Access-Token": TOKEN };

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers });
    if (!res.ok) break;

    const data = await res.json();
    const orders = data.orders as Array<{ created_at: string; shipping_lines?: Array<{ price: string }> }>;

    for (const o of orders) {
      const d = new Date(o.created_at);
      const mk = monthName(d.getUTCMonth());
      const ship = (o.shipping_lines || []).reduce((s, l) => s + Number(l.price || 0), 0);
      out[mk] += ship;
    }

    // Pagination via Link header (page_info)
    const link = res.headers.get("Link");
    if (link && link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = match ? match[1] : "";
    } else {
      nextUrl = "";
    }
  }

  return out;
}

// -------------------------------------------------------------------------------

export async function getEbitdaByMonth(shopId: string, year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to   = new Date(Date.UTC(year + 1, 0, 1));

  // Orders aus DB (für NetRevenue/COGS etc.)
  const orders = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: from, lt: to } },
    select: {
      createdAt: true,
      grossSales: true,
      discounts: true,
      returns: true,
      netRevenue: true,
      cogs: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Shipping-Umsatz direkt aus Shopify
  const shippingByMonth = await fetchShippingByMonth(from, to);

  // Buckets
  const rows = {
    nmv:         zeroRow(),
    discounts:   zeroRow(),
    returns:     zeroRow(),
    netRevenue:  zeroRow(),

    shipping:    zeroRow(), // Umsatz
    cogs:        zeroRow(),

    // PCI I Details
    logistics:   zeroRow(),
    packaging:   zeroRow(),
    payment:     zeroRow(),

    pci1:        zeroRow(),

    marketing:   zeroRow(),
    commissions: zeroRow(),
    personnel:   zeroRow(),
    admin:       zeroRow(),

    ebitda:      zeroRow(),
  };

  // Fixkosten (monatlich konstant)
  const PERSONNEL = 2100;
  const ADMIN     = 1500;

  // Konstanten für Logistik
  const LOG_COEF = 2367.05 / 27505.27; // ≈ 0,0860...
  const LOG_BASE = 162;

  for (const o of orders) {
    const d = new Date(o.createdAt);
    const mk = monthName(d.getUTCMonth());

    const nmv   = num(o.grossSales);
    const disc  = num(o.discounts);
    const ret   = num(o.returns);
    const net   = num(o.netRevenue);
    const cogs  = num(o.cogs);

    rows.nmv[mk]        += nmv;
    rows.discounts[mk]  += disc;
    rows.returns[mk]    += ret;
    rows.netRevenue[mk] += net;
    rows.cogs[mk]       += cogs;
  }

  // Shipping (Umsatz) eintragen
  for (const m of MONTHS) {
    rows.shipping[m] = shippingByMonth[m] || 0;
  }

  // PCI I Details + Summe
  for (let m = 0; m < 12; m++) {
    const mk = monthName(m);

    const net = rows.netRevenue[mk];

    const payment   = 0.028 * net;
    const logistics = LOG_BASE + net * LOG_COEF;
    const packaging = 0; // Platzhalter

    rows.payment[mk]   = payment;
    rows.logistics[mk] = logistics;
    rows.packaging[mk] = packaging;

    rows.pci1[mk] = payment + logistics + packaging;

    // Fixkosten
    rows.personnel[mk] = PERSONNEL;
    rows.admin[mk]     = ADMIN;

    // EBITDA
    rows.ebitda[mk] =
      rows.netRevenue[mk]   // Umsatz (netto)
      + rows.shipping[mk]   // + Shipping-Umsatz
      - rows.cogs[mk]
      - rows.pci1[mk]
      - rows.marketing[mk]
      - rows.commissions[mk]
      - rows.personnel[mk]
      - rows.admin[mk];
  }

  // Summen
  const addSums = (r: Record<string, number>) => {
    r["Summe"] = MONTHS.reduce((acc, m) => acc + (r[m] || 0), 0);
  };
  Object.values(rows).forEach(addSums);

  return {
    year,
    rows: ([
      { key: "nmv",         label: "NMV" },
      { key: "discounts",   label: "Discounts" },
      { key: "returns",     label: "Returns" },
      { key: "netRevenue",  label: "Net Revenue" },

      { key: "shipping",    label: "Shipping Charges" }, // Umsatz

      { key: "cogs",        label: "COGS" },

      // PCI I Block
      { key: "pci1",        label: "PCI I" },
      { key: "logistics",   label: "  Logistik" },
      { key: "packaging",   label: "  Verpackung" },
      { key: "payment",     label: "  Payment (2,8 %)" },

      { key: "marketing",   label: "Marketing" },
      { key: "commissions", label: "Commissions" },
      { key: "personnel",   label: "Personnel" },
      { key: "admin",       label: "Admin" },

      { key: "ebitda",      label: "EBITDA" },
    ] as const).map(({ key, label }) => ({
      key: key as any,
      label,
      data: rows[key as keyof typeof rows],
    })),
  };
}

export function sumRows(prev: Awaited<ReturnType<typeof getEbitdaByMonth>>) {
  const out: Record<string, number> = {};
  for (const r of prev.rows) {
    out[r.key] = Number(r.data["Summe"] || 0);
  }
  return out;
}
