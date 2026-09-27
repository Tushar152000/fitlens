/**
 * Spec §8 "Fuel my training days": same weekly kcal and protein, carbs move to training days.
 * training = weekly × 1.035 / 7 (to the nearest 10 kcal); rest days share the remainder.
 */
export function fuelTrainingDays(dailyKcal: number, trainingDays: number) {
  const t = Math.min(7, Math.max(0, Math.round(trainingDays)));
  const weekly = dailyKcal * 7;
  if (t === 0 || t === 7) {
    return {
      trainingKcal: dailyKcal,
      restKcal: dailyKcal,
      trainingCarbDeltaG: 0,
      restCarbDeltaG: 0,
    };
  }
  const trainingKcal = Math.round((weekly * 1.035) / 7 / 10) * 10;
  const restKcal = Math.round((weekly - trainingKcal * t) / (7 - t));
  return {
    trainingKcal,
    restKcal,
    trainingCarbDeltaG: Math.round((trainingKcal - dailyKcal) / 4),
    restCarbDeltaG: Math.round((restKcal - dailyKcal) / 4),
  };
}
