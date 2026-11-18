-- CreateTable
CREATE TABLE "coach_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_notes" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_notes_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "coach_memories_userId_createdAt_idx" ON "coach_memories"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "coach_memories" ADD CONSTRAINT "coach_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
