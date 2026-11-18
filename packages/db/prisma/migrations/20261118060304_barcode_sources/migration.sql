-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FoodSource" ADD VALUE 'FATSECRET';
ALTER TYPE "FoodSource" ADD VALUE 'EDAMAM';

-- AlterTable
ALTER TABLE "barcode_misses" ADD COLUMN     "brand" VARCHAR(120),
ADD COLUMN     "imageUrl" VARCHAR(500),
ADD COLUMN     "name" VARCHAR(200);
