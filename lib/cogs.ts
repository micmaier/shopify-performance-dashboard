// lib/cogs.ts
// 1) Direkte SKU-Mappings (Beispielwerte)
const SKU_COGS: Record<string, number> = {
  // Wandfarbe
  "FP01-01000-XXX": 8.5,   // 1L (Beispiel)
  "FP01-02500-XXX": 15.0,  // 2.5L
  "FP01-10000-XXX": 40.0,  // 10L
  // Lack
  "FP02-00750-XXX": 9.0,   // 0.75L
  "FP02-02500-XXX": 20.0,  // 2.5L
  // Primer/Schutz
  "FP03-00750-002": 6.5,
  "FP03-25000-001": 12.0,
  // Muster
  "FM06-02020-000": 0.4,
};

// 2) SKU normalisieren → Wildcards unterstützen (optional)
function normalizeSku(sku: string) {
  return sku.trim().toUpperCase();
}

// exakte oder „Prefix“-Matches erlauben
export function getCOGSForSku(sku: string): number | undefined {
  const s = normalizeSku(sku);
  if (SKU_COGS[s] !== undefined) return SKU_COGS[s];

  // einfache Prefix-Heuristik (ersetze Endungen durch -XXX)
  const candidates = Object.keys(SKU_COGS).filter(k => k.includes("XXX"));
  for (const k of candidates) {
    const prefix = k.split("XXX")[0];
    if (s.startsWith(prefix)) return SKU_COGS[k];
  }
  return undefined;
}

// 3) Fallback nach Titel/Variantentitel (einfache Heuristik)
export function getCOGSForFallback(productTitle: string, variantTitle: string, sku: string): number | undefined {
  const title = (productTitle + " " + variantTitle).toLowerCase();

  // Wandfarbe
  if (title.includes("wandfarbe")) {
    if (title.includes("10 liter")) return 40;
    if (title.includes("2.5 liter")) return 15;
    if (title.includes("1 liter")) return 8.5;
    if (title.includes("0,375") || title.includes("0.375")) return 4.0;
  }
  // Lack
  if (title.includes("lack")) {
    if (title.includes("2.5 liter")) return 20;
    if (title.includes("0.75 liter") || title.includes("0,75 liter")) return 9;
  }
  // Primer/Schutz
  if (title.includes("primer") || title.includes("schutz")) {
    if (title.includes("2.5 liter")) return 12;
    if (title.includes("0.75 liter") || title.includes("0,75 liter")) return 6.5;
    if (title.includes("1 liter")) return 7.5;
    if (title.includes("10 liter")) return 30;
  }
  // Muster
  if (title.includes("farbmuster")) return 0.4;

  return undefined;
}
