// lib/shopify.ts
type ShopifyOrder = any;

const SHOP = process.env.SHOPIFY_SHOP!;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

if (!SHOP || !TOKEN) {
  console.warn("[Shopify] Missing SHOPIFY_SHOP / SHOPIFY_ACCESS_TOKEN");
}

const BASE = `https://${SHOP}/admin/api/${API_VERSION}`;

async function shopifyGET(path: string, qs?: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  Object.entries(qs || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Shopify ${res.status}] ${url.pathname}: ${text}`);
  }
  return res.json();
}

/** Hole Orders in Seiten (max 250) mit optionalem Datumsfilter */
export async function fetchOrdersSince(
  createdAtMin?: string,
  status: "any" | "open" | "closed" | "cancelled" = "any"
): Promise<ShopifyOrder[]> {
  const limit = 250;
  let pageInfo: string | null = null;
  const all: ShopifyOrder[] = [];

  while (true) {
    const qs: Record<string, string> = { limit: String(limit), status };
    if (createdAtMin) qs["created_at_min"] = createdAtMin;

    const url = new URL(`${BASE}/orders.json`);
    Object.entries(qs).forEach(([k, v]) => url.searchParams.set(k, v));
    if (pageInfo) url.searchParams.set("page_info", pageInfo);

    const res = await fetch(url.toString(), {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`[Shopify ${res.status}] ${t}`);
    }

    const data = await res.json();
    all.push(...(data.orders || []));

    // Pagination über rel= link header
    const link = res.headers.get("link");
    const hasNext = link && link.includes('rel="next"');
    if (!hasNext) break;

    // page_info aus Link ziehen
    const m = link?.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    pageInfo = m?.[1] ?? null;
    if (!pageInfo) break;
  }

  return all;
}

/** Kategorie/Größe/Segment gemäß deinen Regeln */
export function classifyLine(productTitle: string, variantTitle: string, customerTags: string[] = []) {
  // Kategorien
  let category: string | undefined;
  const t = (productTitle + " " + variantTitle).toLowerCase();

  if (t.includes("farbmuster") || t.includes("color book")) category = "Farbmuster";
  else if (t.includes("wandfarbe")) category = "Wandfarbe";
  else if (t.startsWith("custom color") || t.includes("custom color")) category = "Wandfarbe";
  else if (t.includes("lack primer")) category = "Lack Primer";
  else if (t.includes("wall primer")) category = "Wall Primer";
  else if (t.includes("wandschutz")) category = "Wandschutz";
  else if (t.includes("schutzlack")) category = "Schutzlack";
  else if (t.includes("lack")) category = "Lack";
  else category = "Zubehör";

  // Größe aus Variantentitel
  let size: string | undefined;
  const sizes = ["0,375l", "0.375l", "0,75 liter", "0,75l", "0.75 liter", "0.75l", "1 liter", "1l", "2.5 liter", "2.5l", "10 liter", "10l"];
  const match = sizes.find(s => variantTitle.toLowerCase().includes(s));
  if (match) {
    size = match
      .replace(" liter", "L")
      .replace("l", "L")
      .replace(",", ".")
      .replace(" ", "");
  } else {
    // häufige Kurzformen
    if (variantTitle.includes("10 Liter") || variantTitle.includes("10L")) size = "10L";
    else if (variantTitle.includes("2.5 Liter") || variantTitle.includes("2.5L")) size = "2.5L";
    else if (variantTitle.includes("1 Liter") || variantTitle.includes("1L")) size = "1L";
    else if (variantTitle.includes("0.75 Liter") || variantTitle.includes("0.75L")) size = "0.75L";
    else if (variantTitle.includes("0.375 Liter") || variantTitle.includes("0.375L")) size = "0.375L";
  }

  // Segment / Kundentag
  let segment: "b2c" | "b2b" | "platform" | "unknown" = "unknown";
  const tagsLower = customerTags.map(t => t.toLowerCase());
  if (tagsLower.includes("mynt pro plattform") || tagsLower.includes("mynt pro platform")) segment = "platform";
  else if (tagsLower.includes("mynt pro")) segment = "b2b";
  else segment = "b2c";

  return { category, size, segment };
}

/** Hilfsfunktion: sichere Dezimal-Strings für Prisma.Decimal */
export function toDec(v: number | string | null | undefined): string {
  if (v == null) return "0";
  const n = typeof v === "string" ? Number(v) : v;
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}
