// scripts/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Ein Shop
  const shop = await prisma.shop.upsert({
    where: { id: "local" },
    update: {},
    create: {
      id: "local",
      name: "Local Demo Shop",
      domain: "local.test",
    },
  });

  // Beispiel-Orders (vereinfachte Dummywerte)
  const o1 = await prisma.order.create({
    data: {
      shopId: shop.id,
      name: "#1358",
      createdAt: new Date(Date.UTC(2025, 9, 20)), // 20.10.2025
      segment: "b2c",
      grossSales: 13880.42,
      discounts: 138.37,
      returns: 0,
      netRevenue: 11525.68,
      tax: 0,
      total: 0,
      cogs: 5248.95,
      items: {
        create: [
          {
            productTitle: "Cosy Cashmere",
            variantTitle: "Wandfarbe / 2.5 Liter",
            sku: "FP01-02500-008",
            quantity: 3,
            gross: 148.74,
            discount: 0,
            net: 148.74,
            cogs: 56.3,
            category: "Wandfarbe",
            size: "2.5L",
          },
        ],
      },
    },
  });

  console.log("Seed done", { shop: shop.id, order: o1.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
