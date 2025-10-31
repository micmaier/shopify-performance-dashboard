// app/api/sync/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCOGSForSku, getCOGSForFallback } from "@/lib/cogs";
import { classifyCategoryAndSize } from "@/lib/classify";

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP!;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VER = process.env.SHOPIFY_API_VERSION || "2024-10";

type SfOrder = {
  id: number;
  name: string;
  created_at: string;
  current_total_price: string;
  current_total_tax: string;
  total_discounts: string;
  // Top-level email Fallback (Shopify hat oft auch order.email)
  email?: string | null;
  refunds?: Array<{
    refund_line_items?: Array<{
      line_item: {
        id: number;
        price: string;
        sku: string | null;
        name: string;
        variant_title: string | null;
        quantity: number;
      };
      quantity: number;
      subtotal: string;
      total_tax: string;
    }>;
  }>;
  line_items: Array<{
    id: number;
    name: string;
    variant_title: string | null;
    sku: string | null;
    price: string;
    quantity: number;
    total_discount: string;
  }>;
  customer?: {
    id?: number | null;
    email?: string | null;
    orders_count?: number | null; // WICHTIG für „neu/returning“
    tags?: string | null;
  } | null;
};

async function fetchAllOrders(): Promise<SfOrder[]> {
  // Felder EXPLIZIT anfordern, damit customer & email sicher dabei sind
  const fields = [
    "id",
    "name",
    "created_at",
    "current_total_price",
    "current_total_tax",
    "total_discounts",
    "refunds",
    "line_items",
    "email",
    "customer", // enthält id, email, orders_count, tags …
  ].join(",");

  const url = `https://${SHOP}/admin/api/${API_VER}/orders.json?status=any&limit=250&fields=${encodeURIComponent(
    fields
  )}`;

  const res = await fetch(url, { headers: { "X-Shopify-Access-Token": TOKEN } });
  if (!res.ok) throw new Error(`Shopify orders fetch failed: ${res.status}`);
  const data = await res.json();
  return data.orders as SfOrder[];
}

// Robuster Kundenschlüssel
function getCustomerKey(o: SfOrder): { id: string | null; email: string | null } {
  const id =
    o.customer?.id != null ? String(o.customer.id) : null;
  const email = o.customer?.email ?? o.email ?? null;
  return { id, email };
}

export async function GET() {
  try {
    const shop = await prisma.shop.findFirst({ where: { externalId: SHOP } });
    if (!shop) {
      return NextResponse.json(
        { ok: false, error: "No Shop. Run /api/seed first." },
        { status: 400 }
      );
    }

    const orders = await fetchAllOrders();

    let created = 0,
      updated = 0,
      itemsUpserted = 0;

    for (const o of orders) {
      // Segment aus Tags
      const tags = (o.customer?.tags || "").toLowerCase();
      let segment: string | null = null;
      if (tags.includes("mynt pro plattform")) segment = "platform";
      else if (tags.includes("mynt pro")) segment = "b2b";
      else segment = "b2c";

      // Returns (Proxy)
      let returns = 0;
      if (o.refunds?.length) {
        for (const r of o.refunds) {
          if (r.refund_line_items) {
            for (const rli of r.refund_line_items) {
              returns += Number(rli.subtotal || 0);
            }
          }
        }
      }

      // Summen
      const grossSales =
        Number(o.current_total_price || 0) - Number(o.current_total_tax || 0);
      const discounts = Number(o.total_discounts || 0);
      const tax = Number(o.current_total_tax || 0);
      const total = Number(o.current_total_price || 0);
      const netRevenue = grossSales - discounts - returns;

      // Kunde
      const { id: custId, email: custEmail } = getCustomerKey(o);

      // „Neu“-Bestimmung: 1) Shopify orders_count, 2) Fallback DB-Min-Datum
      let isNew: boolean | null = null;
      if (custId || custEmail) {
        if (o.customer?.orders_count != null) {
          // Shopify-Wahrheit: 1 ⇒ erste Bestellung ⇒ „neu“
          isNew = Number(o.customer.orders_count) <= 1;
        } else {
          const firstOrder = await prisma.order.findFirst({
            where: {
              shopId: shop.id,
              OR: [
                custId ? { customerExternalId: custId } : undefined,
                custEmail ? { customerEmail: custEmail } : undefined,
              ].filter(Boolean) as any,
            },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          });
          isNew = !firstOrder
            ? true
            : new Date(o.created_at) <= firstOrder.createdAt;
        }
      }

      // Upsert Order
      const existing = await prisma.order.findUnique({
        where: { externalId: String(o.id) },
      });

      const saved = await prisma.order.upsert({
        where: { externalId: String(o.id) },
        update: {
          name: o.name,
          createdAt: new Date(o.created_at),
          segment,
          grossSales,
          discounts,
          returns,
          netRevenue,
          tax,
          total,
          shopId: shop.id,
          customerExternalId: custId,
          customerEmail: custEmail,
          newCustomer: isNew,
        },
        create: {
          externalId: String(o.id),
          name: o.name,
          createdAt: new Date(o.created_at),
          segment,
          grossSales,
          discounts,
          returns,
          netRevenue,
          tax,
          total,
          shopId: shop.id,
          cogs: 0,
          customerExternalId: custId,
          customerEmail: custEmail,
          newCustomer: isNew,
        },
      });

      if (existing) updated++;
      else created++;

      // Items & COGS
      let orderCogs = 0;
      for (const li of o.line_items) {
        const sku = li.sku || null;
        const price = Number(li.price || 0);
        const qty = li.quantity ?? 1;
        const gross = price * qty;
        const discount = Number(li.total_discount || 0);
        const net = gross - discount;

        let lineCogsPerUnit = 0;
        if (sku) lineCogsPerUnit = getCOGSForSku(sku) ?? 0;
        if (!lineCogsPerUnit) {
          lineCogsPerUnit =
            getCOGSForFallback(li.name, li.variant_title || "", sku || "") ?? 0;
        }

        const lineCogs = lineCogsPerUnit * qty;
        orderCogs += lineCogs;

        const { category, size } = classifyCategoryAndSize(
          li.name,
          li.variant_title || ""
        );

        await prisma.orderItem.upsert({
          where: { externalId: String(li.id) },
          update: {
            orderId: saved.id,
            productTitle: li.name,
            variantTitle: li.variant_title || "",
            sku,
            quantity: qty,
            gross,
            discount,
            net,
            cogs: lineCogs,
            category,
            size,
          },
          create: {
            externalId: String(li.id),
            orderId: saved.id,
            productTitle: li.name,
            variantTitle: li.variant_title || "",
            sku,
            quantity: qty,
            gross,
            discount,
            net,
            cogs: lineCogs,
            category,
            size,
          },
        });
        itemsUpserted++;
      }

      await prisma.order.update({
        where: { id: saved.id },
        data: { cogs: orderCogs },
      });
    }

    return NextResponse.json({ ok: true, created, updated, itemsUpserted });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
