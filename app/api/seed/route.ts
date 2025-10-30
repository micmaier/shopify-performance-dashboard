import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const domain = process.env.SHOPIFY_SHOP!;
  if (!domain) return NextResponse.json({ ok: false, error: "SHOPIFY_SHOP not set" }, { status: 400 });

  const shop = await prisma.shop.upsert({
    where: { domain },
    update: {},
    create: {
      name: "Nawa Home",
      domain,
      externalId: domain,
    },
  });

  return NextResponse.json({ ok: true, shop });
}