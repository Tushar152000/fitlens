/**
 * Shapes of the FITR8 API responses the app reads. They come from @fitr8/contracts (the API is
 * type-checked against the same DTOs); the local names are kept as aliases.
 */
import type {
  DashboardDto,
  DashboardMealDto,
  EnergyLevel,
  MeDto,
  MealItemDto,
  ProfileDto,
  SnackPickDto,
  TodayWorkoutDto,
  WaterDayDto,
} from "@fitr8/contracts";
import type { MealType } from "./format";

export type {
  ActivityLevel,
  AdjustedExercise,
  AdjustedSession,
  CoachRule,
  DayState,
  DietType,
  Equipment,
  Experience,
  GoalType,
  Macros,
  MealStatus,
  Prescription,
  Sex,
} from "@fitr8/contracts";
export type { MealType };
export type Energy = EnergyLevel;

export type Profile = ProfileDto;
export type Me = MeDto;
export type MealItem = MealItemDto;
/** A meal as the Today screen gets it (GET /api/dashboard). */
export type Meal = DashboardMealDto;
export type Day = DashboardDto;
export type SnackPick = SnackPickDto;
export type TodayWorkout = TodayWorkoutDto;
/** GET /api/water */
export type WaterDay = WaterDayDto;
