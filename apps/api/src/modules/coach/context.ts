import { Injectable } from "@nestjs/common";
import { DashboardService } from "../progress/dashboard.service.js";
import { PlanService } from "../plan/plan.service.js";
import { UsersService } from "../users/users.service.js";
import { PastChatsService } from "./history/past-chats.service.js";
import { CoachMemoryService } from "./memory/memory.service.js";

/**
 * The <context> block that opens each user message (never the system prompt: that stays byte-stable
 * for caching). The first message of a chat carries everything the coach needs to personalise without
 * a tool call; later messages carry only the time and today's numbers, since the rest is already in
 * the transcript.
 */
@Injectable()
export class CoachContext {
  constructor(
    private readonly users: UsersService,
    private readonly plan: PlanService,
    private readonly dashboard: DashboardService,
    private readonly memory: CoachMemoryService,
    private readonly pastChats: PastChatsService,
  ) {}

  async build(
    userId: string,
    { timezone, conversationId, full }: { timezone: string; conversationId: string; full: boolean },
  ): Promise<string> {
    const lines = [`Now: ${localNow(timezone)} (${timezone})`];
    const todayLine = await this.today(userId);
    if (!full) return [...lines, todayLine].join("\n");

    const [profile, plan, memories, recent] = await Promise.all([
      this.users.coachProfile(userId),
      this.plan.getPlan(userId).catch(() => null),
      this.memory.list(userId),
      this.pastChats.recent(userId, conversationId),
    ]);

    if (profile) {
      const p = profile;
      lines.push(
        `User: ${[
          p.name,
          `${p.age} y`,
          lower(p.sex),
          `${p.heightCm} cm`,
          `diet ${lower(p.dietType)}`,
          `activity ${lower(p.activityLevel)}`,
          `training experience ${lower(p.experience)}`,
          `equipment ${lower(p.equipment)}`,
          `${p.trainingDaysPerWeek} training days a week, ${p.sessionMinutes} min sessions`,
        ]
          .filter(Boolean)
          .join(", ")}`,
        `Injuries: ${p.injuries.length ? p.injuries.join(", ") : "none reported"}`,
      );
      if (p.medicalFlag)
        lines.push(
          `Medical: has a condition or is pregnant${p.medicalNote ? ` (${p.medicalNote})` : ""}; keep advice conservative`,
        );
    } else {
      lines.push("User: hasn't finished onboarding (no profile or targets yet)");
    }

    if (plan) {
      const g = plan.goal;
      const m = plan.metric;
      lines.push(
        `Goal: ${lower(g.type)}${g.targetWeightKg ? ` to ${g.targetWeightKg} kg` : ""}${g.targetBodyFatPct ? ` / ${g.targetBodyFatPct}% body fat` : ""} by ${g.targetDate}`,
        `Latest measurement (${m.date}): ${m.weightKg} kg${m.bodyFatPct ? `, ${round(m.bodyFatPct)}% body fat` : ""}${m.waistCm ? `, waist ${m.waistCm} cm` : ""}`,
      );
    }
    lines.push(todayLine);

    lines.push(
      memories.length
        ? `<memory>\n${memories.map((m) => `- [${m.id}] ${m.text}`).join("\n")}\n</memory>`
        : "<memory>nothing saved yet</memory>",
    );
    if (recent.length)
      lines.push(`Recent chats: ${recent.map((c) => `"${c.title}" (${c.date})`).join("; ")}`);
    return lines.join("\n");
  }

  /** Today's target, eaten and left, or why there isn't one. */
  private async today(userId: string): Promise<string> {
    const day = await this.dashboard.dayTotals(userId, await this.users.today(userId));
    const eaten = day.eaten;
    const eatenText = `eaten ${round(eaten.kcal)} kcal, ${round(eaten.proteinG)} g protein, ${round(eaten.carbsG)} g carbs, ${round(eaten.fatG)} g fat`;
    if (!day.target) return `Today: no target yet; ${eatenText}`;
    const t = day.target;
    return `Today: target ${round(t.kcal)} kcal, ${round(t.proteinG)} g protein, ${round(t.carbsG)} g carbs, ${round(t.fatG)} g fat; ${eatenText}; ${day.remainingKcal} kcal left`;
  }
}

const lower = (s: string) => s.toLowerCase().replace(/_/g, " ");
const round = (n: number) => Math.round(n);

function localNow(timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}
