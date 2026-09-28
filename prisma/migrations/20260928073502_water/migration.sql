-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "remindWater" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "water_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ml" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "water_logs_userId_date_idx" ON "water_logs"("userId", "date");

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

