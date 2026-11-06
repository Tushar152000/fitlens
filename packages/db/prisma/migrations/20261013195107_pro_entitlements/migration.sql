-- CreateTable
CREATE TABLE "entitlements" (
    "userId" TEXT NOT NULL,
    "proUntil" TIMESTAMP(3),
    "lifetime" BOOLEAN NOT NULL DEFAULT false,
    "willRenew" BOOLEAN NOT NULL DEFAULT true,
    "productId" TEXT,
    "store" TEXT,
    "periodType" TEXT,
    "environment" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_events_receivedAt_idx" ON "billing_events"("receivedAt");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
