/*
  Warnings:

  - You are about to drop the column `customerId` on the `Order` table. All the data in the column will be lost.

*/
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
    "customerExternalId" TEXT,
    "customerEmail" TEXT,
    CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cogs", "createdAt", "customerEmail", "discounts", "externalId", "grossSales", "id", "name", "netRevenue", "newCustomer", "returns", "segment", "shopId", "tax", "total") SELECT "cogs", "createdAt", "customerEmail", "discounts", "externalId", "grossSales", "id", "name", "netRevenue", "newCustomer", "returns", "segment", "shopId", "tax", "total" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");
CREATE INDEX "Order_shopId_createdAt_idx" ON "Order"("shopId", "createdAt");
CREATE INDEX "Order_segment_idx" ON "Order"("segment");
CREATE INDEX "Order_segment_createdAt_idx" ON "Order"("segment", "createdAt");
CREATE INDEX "Order_customerExternalId_idx" ON "Order"("customerExternalId");
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
