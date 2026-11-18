import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infra/prisma/prisma.service.js";
import { toOrQuery } from "../knowledge/knowledge.service.js";

export interface PastChatHit {
  conversation: string;
  date: string;
  from: "user" | "coach";
  text: string;
}

const SNIPPET_CHARS = 500;

/** The user's earlier coach chats: the few most recent, and full-text search over what was said. */
@Injectable()
export class PastChatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The latest other conversations (title and last activity), newest first. */
  async recent(userId: string, exceptId: string | null, take = 3) {
    const rows = await this.prisma.coachConversation.findMany({
      where: { userId, ...(exceptId ? { id: { not: exceptId } } : {}) },
      orderBy: { updatedAt: "desc" },
      take,
      select: { title: true, updatedAt: true },
    });
    return rows.map((r) => ({ title: r.title, date: r.updatedAt.toISOString().slice(0, 10) }));
  }

  /** Messages from the user's other conversations that best match the query. */
  async search(
    userId: string,
    query: string,
    exceptId: string | null,
    limit = 6,
  ): Promise<PastChatHit[]> {
    const q = toOrQuery(query);
    if (!q) return [];
    const rows = await this.prisma.$queryRaw<
      { title: string; createdAt: Date; role: string; text: string }[]
    >`
      SELECT c.title, m."createdAt", m.role, m.text
      FROM coach_messages m
        JOIN coach_conversations c ON c.id = m."conversationId",
        to_tsquery('english', ${q}) q
      WHERE c."userId" = ${userId}
        AND c.id <> ${exceptId ?? ""}
        AND m.text <> ''
        AND to_tsvector('english', m.text) @@ q
      ORDER BY ts_rank(to_tsvector('english', m.text), q) DESC, m."createdAt" DESC
      LIMIT ${limit}`;
    return rows.map((r) => ({
      conversation: r.title,
      date: r.createdAt.toISOString().slice(0, 10),
      from: r.role === "assistant" ? "coach" : "user",
      text: r.text.length > SNIPPET_CHARS ? `${r.text.slice(0, SNIPPET_CHARS)}…` : r.text,
    }));
  }
}
