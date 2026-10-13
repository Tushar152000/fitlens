-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'APPLE';

-- AlterTable
ALTER TABLE "auth_identities" ADD COLUMN     "refreshTokenSealed" TEXT;
