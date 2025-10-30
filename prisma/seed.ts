import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Beispiel-Shop anlegen
  const shop = await prisma.shop.create({
    data: {
      name: "Mynt Testshop",
      domain: "mynt.local",
    },
  });

  // Beispiel-Bestellung anlegen
  await prisma.order.create({
    data: {
      shopId: shop.id,
      name: "#1001",
      createdAt: new Date(),
      segment: "b2c",
      grossSales: 200,
      discounts: 10,
      returns: 0,
      netRevenue: 190,
      tax: 36.1,
      total: 226.1,
      cogs: 80,
      items: {
        create: [
          {
            productTitle: "Wandfarbe Weiß",
            variantTitle: "2.5L",
            quantity: 1,
            gross: 200,
            discount: 10,
            net: 190,
            cogs: 80,
          },
        ],
      },
    },
  });

  console.log("Seed erfolgreich ausgeführt 🌱");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
