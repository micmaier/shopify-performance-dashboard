/*
  Warnings:

  - A unique constraint covering the columns `[domain]` on the table `Shop` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Shop` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `externalId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "externalId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "segment" TEXT,
    "grossSales" DECIMAL NOT NULL DEFAULT 0,
    "discounts" DECIMAL NOT NULL DEFAULT 0,
    "returns" DECIMAL NOT NULL DEFAULT 0,
    "netRevenue" DECIMAL NOT NULL DEFAULT 0,
    "tax" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "cogs" DECIMAL NOT NULL DEFAULT 0,
    "newCustomer" BOOLEAN,
    "externalId" TEXT NOT NULL,
    CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cogs", "createdAt", "discounts", "grossSales", "id", "name", "netRevenue", "newCustomer", "returns", "segment", "shopId", "tax", "total") SELECT "cogs", "createdAt", "discounts", "grossSales", "id", "name", "netRevenue", "newCustomer", "returns", "segment", "shopId", "tax", "total" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");
CREATE INDEX "Order_shopId_createdAt_idx" ON "Order"("shopId", "createdAt");
CREATE INDEX "Order_segment_idx" ON "Order"("segment");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "gross" DECIMAL NOT NULL DEFAULT 0,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "net" DECIMAL NOT NULL DEFAULT 0,
    "cogs" DECIMAL NOT NULL DEFAULT 0,
    "category" TEXT,
    "size" TEXT,
    "externalId" TEXT NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("category", "cogs", "discount", "gross", "id", "net", "orderId", "productTitle", "quantity", "size", "sku", "variantTitle") SELECT "category", "cogs", "discount", "gross", "id", "net", "orderId", "productTitle", "quantity", "size", "sku", "variantTitle" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE UNIQUE INDEX "OrderItem_externalId_key" ON "OrderItem"("externalId");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_category_size_idx" ON "OrderItem"("category", "size");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_externalId_key" ON "Shop"("externalId");
