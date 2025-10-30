// app/api/sync/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { fetchOrdersSince, classifyLine, toDec } from "@/lib/shopify";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const since = url.searchParams.get("since"); // z.B. 2024-01-01T00:00:00Z

    const domain = process.env.SHOPIFY_SHOP!;
    if (!domain) {
      return NextResponse.json({ ok: false, error: "SHOPIFY_SHOP not set" }, { status: 400 });
    }

    // 1) Shop idempotent anlegen
    const shop = await prisma.shop.upsert({
      where: { externalId: domain },
      update: {},
      create: {
        name: "Nawa Home",
        domain,
        externalId: domain,
      },
    });

    // 2) Orders von Shopify holen (seit ...)
    const orders = await fetchOrdersSince(since || new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString()); // default: 60 Tage

    let imported = 0;
    for (const o of orders) {
      const orderExternalId = String(o.id);

      // Segment über Kundentags (falls vorhanden)
      const customerTags: string[] = (o.customer?.tags || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      // Summen
      const grossSales = toDec(o.current_subtotal_price ?? o.subtotal_price ?? 0); // ohne Tax
      const discounts = toDec(o.total_discounts ?? 0);
      const returns = "0.00"; // Refunds später (optional)
      const netRevenue = toDec(Number(grossSales) - Number(discounts) - Number(returns));
      const tax = toDec(o.total_tax ?? 0);
      const total = toDec(o.current_total_price ?? o.total_price ?? 0);
      const cogs = "0.00"; // optional später map/aus CSV

      // 2.1) Order upsert
      const dbOrder = await prisma.order.upsert({
        where: { externalId: orderExternalId },
        update: {
          name: o.name || `#${o.order_number}`,
          createdAt: new Date(o.created_at),
          segment: ((): string | null => {
            const seg = classifyLine("", "", customerTags).segment;
            return seg;
          })(),
          grossSales,
          discounts,
          returns,
          netRevenue,
          tax,
          total,
          cogs,
          shopId: shop.id,
        },
        create: {
          externalId: orderExternalId,
          shopId: shop.id,
          name: o.name || `#${o.order_number}`,
          createdAt: new Date(o.created_at),
          segment: classifyLine("", "", customerTags).segment,
          grossSales,
          discounts,
          returns,
          netRevenue,
          tax,
          total,
          cogs,
        },
      });

      // 2.2) Line Items upsert
      const lines = o.line_items || [];
      for (const li of lines) {
        const externalId = String(li.id);
        const qty = li.quantity ?? 0;

        const productTitle = li.product_exists === false && li.title ? li.title : li.title || "";
        const variantTitle = li.variant_title || "";

        const { category, size } = classifyLine(productTitle, variantTitle, customerTags);

        // Zahlen: brutto (ohne Steuer), Rabatt je Zeile, netto, cogs (optional 0)
        const gross = toDec((Number(li.price ?? 0) * qty) - 0); // Preis*Qty (ohne Rabatte)
        const discount = toDec(li.total_discount ?? 0);
        const net = toDec(Number(gross) - Number(discount));
        const cogsItem = "0.00";

        await prisma.orderItem.upsert({
          where: { externalId },
          update: {
            orderId: dbOrder.id,
            productTitle,
            variantTitle,
            sku: li.sku || null,
            quantity: qty,
            gross,
            discount,
            net,
            cogs: cogsItem,
            category: category || null,
            size: size || null,
          },
          create: {
            externalId,
            orderId: dbOrder.id,
            productTitle,
            variantTitle,
            sku: li.sku || null,
            quantity: qty,
            gross,
            discount,
            net,
            cogs: cogsItem,
            category: category || null,
            size: size || null,
          },
        });
      }

      imported++;
    }

    return NextResponse.json({ ok: true, imported, count: orders.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
