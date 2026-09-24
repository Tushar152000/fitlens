-- AlterTable
ALTER TABLE "foods" ADD COLUMN     "isLiquid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "meal_items" ADD COLUMN     "isLiquid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "meal_logs" ADD COLUMN     "note" TEXT;
