// lib/classify.ts
export function classifyCategoryAndSize(productTitle: string, variantTitle: string) {
  const t = (productTitle + " " + variantTitle).toLowerCase();
  let category: string | null = null;
  let size: string | null = null;

  if (t.includes("wandfarbe")) category = "Wandfarbe";
  else if (t.includes("lack")) category = "Lack";
  else if (t.includes("primer") || t.includes("schutz")) category = "Grundierung/Schutz";
  else if (t.includes("farbmuster")) category = "Farbmuster";
  else category = "Zubehör";

  const sizes = ["10 liter","2.5 liter","1 liter","0.75 liter","0,75 liter","0.375 liter","0,375 liter","20x20 cm","default title"];
  for (const s of sizes) {
    if (t.includes(s)) { size = s; break; }
  }

  return { category: category || null, size: size || null };
}
