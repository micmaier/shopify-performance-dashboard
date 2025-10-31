-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
