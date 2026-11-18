import { Injectable } from "@nestjs/common";
import type { CoachMemoryView } from "@fitr8/contracts";
import { notFound } from "../../../common/errors.js";
import { PrismaService } from "../../../infra/prisma/prisma.service.js";

/** How many facts the coach keeps per user. The coach must forget one before adding more. */
export const MEMORY_LIMIT = 50;

const view = (m: { id: string; text: string; createdAt: Date }): CoachMemoryView => ({
  id: m.id,
  text: m.text,
  createdAt: m.createdAt.toISOString(),
});

/**
 * Lasting facts the coach keeps about a user across chats (injuries, allergies, preferences, schedule,
 * equipment). The coach adds and removes them with its tools; the user sees and deletes them in the app.
 */
@Injectable()
export class CoachMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<CoachMemoryView[]> {
    const rows = await this.prisma.coachMemory.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MEMORY_LIMIT,
    });
    return rows.map(view);
  }

  /**
   * Saves one fact. The same fact (ignoring case and spacing) is not stored twice. At the limit nothing
   * is saved and `full` is returned, so the coach can ask which old fact to drop.
   */
  async add(
    userId: string,
    text: string,
  ): Promise<{ saved: CoachMemoryView | null; duplicate?: true; full?: true }> {
    const clean = text.replace(/\s+/g, " ").trim();
    const existing = await this.list(userId);
    const same = existing.find((m) => m.text.toLowerCase() === clean.toLowerCase());
    if (same) return { saved: same, duplicate: true };
    if (existing.length >= MEMORY_LIMIT) return { saved: null, full: true };
    const row = await this.prisma.coachMemory.create({ data: { userId, text: clean } });
    return { saved: view(row) };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.coachMemory.deleteMany({ where: { id, userId } });
    if (!count) throw notFound("Memory");
  }
}
