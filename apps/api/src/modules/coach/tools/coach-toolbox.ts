import { Injectable } from "@nestjs/common";
import { MealTypeSchema } from "@fitr8/contracts";
import { z } from "zod";
import { UsersService } from "../../users/users.service.js";
import { DashboardService } from "../../progress/dashboard.service.js";
import { HistoryService } from "../../progress/history.service.js";
import { ProgressService } from "../../progress/progress.service.js";
import { CheckinsService } from "../../progress/checkins.service.js";
import { WorkoutsService } from "../../workouts/workouts.service.js";
import { WaterService } from "../../water/water.service.js";
import { MealsService } from "../../meals/meals.service.js";
import { FoodsService } from "../../foods/foods.service.js";
import { PlanService } from "../../plan/plan.service.js";
import { PastChatsService } from "../history/past-chats.service.js";
import { KnowledgeService } from "../knowledge/knowledge.service.js";
import { CoachMemoryService } from "../memory/memory.service.js";
import { defineTool, type AgentTool } from "../agent/tool.js";

/** Keys the model never needs: internal ids, storage keys, raw model output, signed URLs. */
const HIDDEN_KEYS = new Set([
  "userId",
  "photoKey",
  "photoUrl",
  "aiRaw",
  "foodId",
  "planId",
  "goalId",
  "imageUrl",
]);

/** Strip plumbing and round floats so tool results stay small and readable. */
export function forModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(forModel);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number")
    return Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined)
        .map(([k, v]) => [k, forModel(v)]),
    );
  }
  return value;
}

/**
 * Builds the coach's tools for one user. The user id is closed over here — the model cannot supply it.
 * Tools are thin: each calls one application service, so rules stay in one place (the same code the
 * screens use). Order is fixed: tool definitions are part of the cached prompt prefix.
 */
@Injectable()
export class CoachToolbox {
  constructor(
    private readonly users: UsersService,
    private readonly dashboard: DashboardService,
    private readonly history: HistoryService,
    private readonly progress: ProgressService,
    private readonly checkins: CheckinsService,
    private readonly workouts: WorkoutsService,
    private readonly water: WaterService,
    private readonly meals: MealsService,
    private readonly foods: FoodsService,
    private readonly plan: PlanService,
    private readonly memory: CoachMemoryService,
    private readonly knowledge: KnowledgeService,
    private readonly pastChats: PastChatsService,
  ) {}

  /** `conversationId` is the chat in progress (null before it exists); past-chat search skips it. */
  forUser(userId: string, conversationId: string | null = null): AgentTool<unknown>[] {
    const today = () => this.users.today(userId);
    const tools = [
      defineTool({
        name: "get_today_overview",
        label: "Checking today's meals",
        description:
          "Today's calorie and macro targets, what has been eaten so far (per meal, with items), what is left, water drunk vs target, and the logging streak. Use for any question about today.",
        input: z.object({}),
        run: async () => {
          const date = await today();
          const [day, water] = await Promise.all([
            this.dashboard.getDay(userId, date),
            this.water.getDay(userId, date).catch(() => null),
          ]);
          return forModel({ ...day, water });
        },
      }),
      defineTool({
        name: "get_history",
        label: "Looking at your recent days",
        description:
          "Daily calories and macros against target for the last 7 or 30 days, with confirmed meals. Use for trends and 'this week' questions.",
        input: z.object({ days: z.union([z.literal(7), z.literal(30)]).default(7) }),
        run: async ({ days }) =>
          forModel(await this.history.getHistory(userId, days, await today())),
      }),
      defineTool({
        name: "get_progress",
        label: "Checking your progress",
        description:
          "Weight trend (weekly averages), body-fat estimates, the goal, target date and whether the user is on pace.",
        input: z.object({}),
        run: async () => forModel(await this.progress.get(userId)),
      }),
      defineTool({
        name: "get_workout_today",
        label: "Checking today's workout",
        description:
          "Today's planned session (exercises, sets, reps, loads) with the app's daily adjustments and coach notes, or that it's a rest day. Pass the user's energy if they mentioned it.",
        input: z.object({ energy: z.enum(["great", "ok", "tired"]).optional() }),
        run: async ({ energy }) => forModel(await this.workouts.getToday(userId, energy)),
      }),
      defineTool({
        name: "search_foods",
        label: "Looking up foods",
        description:
          "Search the food database by name. Returns nutrition per 100 g and household units (katori, piece…). Use before quoting any food's calories or protein.",
        input: z.object({ query: z.string().trim().min(2).max(60) }),
        run: async ({ query }) => forModel(await this.foods.search(userId, query)),
      }),
      defineTool({
        name: "log_water",
        label: "Logging water",
        description:
          "Log water the user says they drank, in millilitres (a glass is about 250 ml). Only when they state it.",
        input: z.object({ ml: z.number().int().min(50).max(2000) }),
        run: async ({ ml }) => {
          const date = await today();
          await this.water.add(userId, date, ml);
          const day = await this.water.getDay(userId, date);
          return forModel({ logged: ml, consumedMl: day.consumedMl, targetMl: day.targetMl });
        },
      }),
      defineTool({
        name: "log_weigh_in",
        label: "Saving your weigh-in",
        description:
          "Record today's body weight in kg (and waist in cm if given). Only when the user states the number.",
        input: z.object({
          weightKg: z.number().min(25).max(300),
          waistCm: z.number().min(40).max(200).optional(),
        }),
        run: async ({ weightKg, waistCm }) =>
          forModel(await this.checkins.logWeighIn(userId, { weightKg, waistCm })),
      }),
      defineTool({
        name: "draft_meal",
        label: "Preparing your meal",
        description:
          "Turn the user's description of what they ate into a meal with items, grams and calories from the food database. The meal is NOT logged until the user reviews and confirms it in the app — tell them.",
        input: z.object({
          description: z.string().trim().min(2).max(500),
          mealType: MealTypeSchema,
        }),
        run: async ({ description, mealType }) => {
          const { body } = await this.meals.create(userId, {
            source: "TEXT",
            text: description,
            mealType,
          });
          return forModel({ meal: body, reviewInApp: true });
        },
      }),
      defineTool({
        name: "get_profile",
        label: "Checking your profile",
        description:
          "The user's profile and plan: age, sex, height, diet type (veg/eggetarian/vegan/non-veg), activity level, training experience, equipment, training days and session length, injuries, medical flag, goal (type, target weight, date), latest body measurements and the plan summary. Use whenever advice depends on who the user is.",
        input: z.object({}),
        run: async () => {
          const [profile, plan] = await Promise.all([
            this.users.coachProfile(userId),
            this.plan.getPlan(userId).catch(() => null),
          ]);
          return forModel({ profile, plan });
        },
      }),
      defineTool({
        name: "remember",
        label: "Remembering that",
        description:
          "Save one lasting fact about the user for future chats, in a short third-person sentence: injuries and pain, allergies and intolerances, foods they avoid or love, schedule, equipment, sports, preferences about coaching, and decisions you agreed on. Not for numbers the app already tracks (meals, weight, water) or passing moods. Returns `full` when 50 facts are stored: then ask which one to forget.",
        input: z.object({ fact: z.string().trim().min(3).max(300) }),
        run: async ({ fact }) => forModel(await this.memory.add(userId, fact)),
      }),
      defineTool({
        name: "forget",
        label: "Forgetting that",
        description:
          "Delete one saved fact by its id (from the <memory> list in the context or a remember result), when the user says it's wrong, out of date, or asks you to forget it.",
        input: z.object({ id: z.string().trim().min(1).max(40) }),
        run: async ({ id }) => {
          await this.memory.remove(userId, id);
          return { forgotten: id };
        },
      }),
      defineTool({
        name: "search_knowledge",
        label: "Checking the science",
        description:
          "Search FITR8's science notes (training, hypertrophy, running, nutrition, protein, supplements, sleep, recovery, injuries, safety). Each note has its sources. Use before answering any factual health, nutrition or training question, and base the answer on the notes. Query in plain words, e.g. 'protein needs for muscle gain'.",
        input: z.object({ query: z.string().trim().min(2).max(200) }),
        run: async ({ query }) => {
          const notes = await this.knowledge.search(query);
          return notes.length ? forModel({ notes }) : { notes: [], note: "No matching notes." };
        },
      }),
      defineTool({
        name: "search_past_chats",
        label: "Looking through our past chats",
        description:
          "Search what the user and you said in earlier coach conversations (not this one). Use when they refer to something from before ('like you said last week', 'the plan we made').",
        input: z.object({ query: z.string().trim().min(2).max(200) }),
        run: async ({ query }) =>
          forModel({ results: await this.pastChats.search(userId, query, conversationId) }),
      }),
    ];
    return tools as AgentTool<unknown>[];
  }
}
