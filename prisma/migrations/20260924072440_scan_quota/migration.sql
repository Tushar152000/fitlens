-- AlterEnum
ALTER TYPE "AiCallType" ADD VALUE 'LABEL_SCAN';

-- AlterTable
ALTER TABLE "ai_calls" ADD COLUMN     "countsAsScan" BOOLEAN NOT NULL DEFAULT false;
