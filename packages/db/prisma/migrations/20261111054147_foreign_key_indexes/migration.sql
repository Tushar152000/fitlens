-- CreateIndex
CREATE INDEX "auth_codes_userId_idx" ON "auth_codes"("userId");

-- CreateIndex
CREATE INDEX "daily_targets_goalId_idx" ON "daily_targets"("goalId");

-- CreateIndex
CREATE INDEX "meal_items_foodId_idx" ON "meal_items"("foodId");

-- CreateIndex
CREATE INDEX "workout_logs_planId_idx" ON "workout_logs"("planId");
