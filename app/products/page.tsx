import { prisma } from "@/lib/db";
import { parseRangeFromSearch, toYMD } from "@/lib/kpis";
import DateRangePicker from "@/components/DateRangePicker";

function eur(n: number | null | undefined) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const shop = await prisma.shop.findFirst();
  if (!shop) {
    return <div className="text-slate-300 p-4">Kein Shop gefunden.</div>;
  }

  const range = parseRangeFromSearch(searchParams);

  // wir aggregieren OrderItem nach category
  const items = await prisma.orderItem.groupBy({
    by: ["category"],
    where: {
      order: {
        shopId: shop.id,
        createdAt: { gte: range.from, lt: range.to },
      },
    },
    _sum: {
      quantity: true,
      gross: true,
      net: true,
      cogs: true,
    },
  });

  // Gesamtsumme
  let totalQty = 0,
    totalGross = 0,
    totalNet = 0,
    totalCogs = 0;

  for (const r of items) {
    totalQty += Number(r._sum.quantity || 0);
    totalGross += Number(r._sum.gross || 0);
    totalNet += Number(r._sum.net || 0);
    totalCogs += Number(r._sum.cogs || 0);
  }

  return (
    <div className="text-slate-100 space-y-6 p-4">
      <DateRangePicker
        from={toYMD(range.from)}
        to={toYMD(new Date(range.to.getTime() - 24 * 3600 * 1000))}
      />

      <h1 className="text-xl font-semibold">Produkte / Kategorien</h1>

      <section>
        <div className="text-slate-200 text-sm font-semibold mb-2">
          Nach Kategorie (Zeitraum)
        </div>
        <table className="text-xs text-slate-200 border-collapse">
          <thead className="text-slate-400">
            <tr className="border-b border-slate-700 text-left">
              <th className="py-1 pr-4">Kategorie</th>
              <th className="py-1 pr-4">Menge</th>
              <th className="py-1 pr-4">Umsatz brutto</th>
              <th className="py-1 pr-4">Umsatz netto</th>
              <th className="py-1 pr-4">COGS</th>
              <th className="py-1 pr-4">Bruttomarge</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const qty = Number(r._sum.quantity || 0);
              const gross = Number(r._sum.gross || 0);
              const net = Number(r._sum.net || 0);
              const cogs = Number(r._sum.cogs || 0);
              const margin = net - cogs;
              return (
                <tr
                  key={r.category || "Unbekannt"}
                  className="border-b border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="py-1 pr-4">{r.category ?? "Unbekannt"}</td>
                  <td className="py-1 pr-4">{qty}</td>
                  <td className="py-1 pr-4">{eur(gross)}</td>
                  <td className="py-1 pr-4">{eur(net)}</td>
                  <td className="py-1 pr-4">{eur(cogs)}</td>
                  <td className="py-1 pr-4">{eur(margin)}</td>
                </tr>
              );
            })}

            <tr className="font-semibold bg-slate-900/50">
              <td className="py-1 pr-4">Summe</td>
              <td className="py-1 pr-4">{totalQty}</td>
              <td className="py-1 pr-4">{eur(totalGross)}</td>
              <td className="py-1 pr-4">{eur(totalNet)}</td>
              <td className="py-1 pr-4">{eur(totalCogs)}</td>
              <td className="py-1 pr-4">{eur(totalNet - totalCogs)}</td>
            </tr>
          </tbody>
        </table>

        <div className="text-slate-500 text-[10px] mt-4">
          Basis: OrderItems (priceGross, priceNet, cogsTotal, quantity) &amp;
          Order(createdAt, shopId).
        </div>
      </section>
    </div>
  );
}
