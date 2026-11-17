-- One account per phone number. The column is new (20261117185447), so only local/test data can
-- hold duplicates: keep the number on the oldest account, clear it on the others.
UPDATE "users" AS u
SET "phone" = NULL
WHERE u."phone" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "users" AS o
    WHERE o."phone" = u."phone"
      AND (o."createdAt" < u."createdAt" OR (o."createdAt" = u."createdAt" AND o."id" < u."id"))
  );

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
