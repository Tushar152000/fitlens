-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "remindDinner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remindLunch" BOOLEAN NOT NULL DEFAULT false;
