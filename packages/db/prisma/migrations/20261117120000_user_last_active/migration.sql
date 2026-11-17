-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- Backfill from what each existing user last did, so active users aren't greeted with "welcome back".
-- Users with no trace stay NULL; the app then falls back to their onboarding date.
UPDATE "users" u SET "lastActiveAt" = a.last
FROM (
  SELECT "userId", MAX(t) AS last FROM (
    SELECT "userId", "lastSeenAt" AS t FROM "sessions"
    UNION ALL SELECT "userId", "createdAt" FROM "meal_logs"
    UNION ALL SELECT "userId", "createdAt" FROM "body_metrics"
    UNION ALL SELECT "userId", "createdAt" FROM "water_logs"
    UNION ALL SELECT "userId", "createdAt" FROM "workout_logs"
    UNION ALL SELECT "userId", "updatedAt" FROM "profiles"
  ) x GROUP BY "userId"
) a
WHERE a."userId" = u."id";
