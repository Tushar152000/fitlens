-- CreateTable
CREATE TABLE "account_deletion_feedback" (
    "id" TEXT NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback" VARCHAR(1000),
    "accountAgeDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletion_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_deletion_feedback_createdAt_idx" ON "account_deletion_feedback"("createdAt");
