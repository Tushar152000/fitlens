-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FoodSource" ADD VALUE 'OPEN_FOOD_FACTS';
ALTER TYPE "FoodSource" ADD VALUE 'LABEL_SCAN';

-- AlterTable
ALTER TABLE "foods" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "servingLabel" TEXT,
ADD COLUMN     "servingSizeG" DOUBLE PRECISION,
ADD COLUMN     "sodiumMgPer100g" DOUBLE PRECISION,
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "sugarPer100g" DOUBLE PRECISION,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "barcode_misses" (
    "code" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_misses_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "label_scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoKey" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT,
    "extracted" JSONB NOT NULL,
    "foodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "label_scans_userId_createdAt_idx" ON "label_scans"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "foods_barcode_key" ON "foods"("barcode");

-- AddForeignKey
ALTER TABLE "label_scans" ADD CONSTRAINT "label_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

