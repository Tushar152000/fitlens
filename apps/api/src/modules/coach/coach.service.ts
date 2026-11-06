import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  CoachConversationSummary,
  CoachConversationView,
  CoachMessageView,
  CoachStreamEvent,
} from "@fitr8/contracts";
import { startOfLocalDay } from "@fitr8/domain/dates";
import type { Prisma } from "@fitr8/db";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { runAgent, type AgentStep } from "./agent/agent-loop.js";
import {
  MODEL_GATEWAY,
  type BetaMessage,
  type BetaMessageParam,
  type ModelGateway,
} from "./agent/model-gateway.js";
import { COACH_SYSTEM_PROMPT } from "./coach.prompt.js";
import { BillingService } from "../billing/billing.service.js";
import { CoachToolbox } from "./tools/coach-toolbox.js";
import { TurnLock } from "./turn-lock.js";

const SYSTEM = [
  {
    type: "text" as const,
    text: COACH_SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" as const },
  },
];

export interface PreparedTurn {
  userId: string;
  conversationId: string;
  history: BetaMessageParam[];
  release: () => Promise<void>;
}

/**
 * Application service for the AI coach: conversations, limits, persistence and observability around
 * the agent loop. The loop itself (agent/agent-loop.ts) knows nothing about HTTP or the database.
 */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly toolbox: CoachToolbox,
    private readonly lock: TurnLock,
    private readonly billing: BillingService,
    @Inject(MODEL_GATEWAY) private readonly gateway: ModelGateway,
  ) {}

  /**
   * Everything that can fail before streaming starts (so it becomes a normal JSON error):
   * daily limit, ownership, the per-conversation lock. Persists the user's message.
   */
  async prepareTurn(
    userId: string,
    input: { conversationId?: string; message: string },
  ): Promise<PreparedTurn> {
    const timezone = await this.users.timezone(userId);
    const sentToday = await this.prisma.coachMessage.count({
      where: {
        role: "user",
        createdAt: { gte: startOfLocalDay(timezone) },
        conversation: { userId },
      },
    });
    const { coach: limit, plan, paywall } = await this.billing.limits(userId);
    if (sentToday >= limit) {
      throw new AppError(
        429,
        plan === "FREE" && paywall
          ? `You've used today's ${limit} free coach messages. Pro gives you more.`
          : "You've reached today's coach limit. It resets at midnight.",
        { limit, plan, paywall },
      );
    }

    const conversation = input.conversationId
      ? await this.prisma.coachConversation.findFirst({
          where: { id: input.conversationId, userId },
        })
      : await this.prisma.coachConversation.create({
          data: { userId, title: titleFrom(input.message) },
        });
    if (!conversation) throw notFound("Conversation");

    const release = await this.lock.acquire(conversation.id);
    if (!release) throw new AppError(409, "Your coach is still replying. Try again in a moment.");

    try {
      const previous = await this.prisma.coachMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { role: true, content: true },
      });
      // Volatile context goes in the new user turn (append-only), never in the cached system prompt.
      const userMessage: BetaMessageParam = {
        role: "user",
        content: [
          { type: "text", text: `<context>${localNow(timezone)}</context>` },
          { type: "text", text: input.message },
        ],
      };
      await this.prisma.coachMessage.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: userMessage.content as Prisma.InputJsonValue,
          text: input.message,
        },
      });
      const history = [
        ...previous.map(
          (m) => ({ role: m.role as "user" | "assistant", content: m.content }) as BetaMessageParam,
        ),
        userMessage,
      ];
      return { userId, conversationId: conversation.id, history, release };
    } catch (err) {
      await release();
      throw err;
    }
  }

  /** Runs the agent for a prepared turn, streaming events. Never throws: failures become an `error` event. */
  async runTurn(turn: PreparedTurn, send: (event: CoachStreamEvent) => void, signal: AbortSignal) {
    send({ type: "conversation", conversationId: turn.conversationId });
    let lastMessageId: string | null = null;
    try {
      const outcome = await runAgent({
        gateway: this.gateway,
        system: SYSTEM,
        tools: this.toolbox.forUser(turn.userId),
        history: turn.history,
        signal,
        onEvent: (e) => send(e),
        onStep: async (step) => {
          lastMessageId = await this.persistStep(turn.conversationId, step);
        },
        onModelCall: (call) => this.recordCall(turn.userId, call),
      });

      if (outcome.status === "completed" && lastMessageId) {
        await this.prisma.coachConversation.update({
          where: { id: turn.conversationId },
          data: { updatedAt: new Date() },
        });
        send({ type: "done", messageId: lastMessageId });
      } else if (outcome.status === "refused") {
        send({
          type: "error",
          message: "I can't help with that one. Try asking about your meals, water or training.",
        });
      } else if (outcome.status === "failed") {
        send({ type: "error", message: "I lost my train of thought. Please ask again." });
      }
    } catch (err) {
      this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
      if (!signal.aborted)
        send({
          type: "error",
          message: "Your coach is unavailable right now. Please try again shortly.",
        });
    } finally {
      await turn.release();
    }
  }

  async list(userId: string): Promise<CoachConversationSummary[]> {
    const rows = await this.prisma.coachConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true },
    });
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() }));
  }

  async get(userId: string, id: string): Promise<CoachConversationView> {
    const conversation = await this.prisma.coachConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!conversation) throw notFound("Conversation");
    return {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
      messages: toViews(conversation.messages),
    };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.coachConversation.deleteMany({ where: { id, userId } });
    if (!count) throw notFound("Conversation");
  }

  /** Writes one agent step atomically (assistant turn + its tool results). Returns the assistant message id. */
  private async persistStep(conversationId: string, step: AgentStep): Promise<string> {
    const usage = step.response.usage;
    const rows = await this.prisma.$transaction(
      step.messages.map((m, i) =>
        this.prisma.coachMessage.create({
          data: {
            conversationId,
            role: m.role,
            content: m.content as Prisma.InputJsonValue,
            text: i === 0 ? step.text : "",
            actions: i === 0 ? step.actions : [],
            // createdAt ties are broken by insertion order via the id sort in reads.
            ...(i === 0
              ? {
                  tokensIn: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0),
                  tokensOut: usage.output_tokens,
                  cacheReadTokens: usage.cache_read_input_tokens ?? 0,
                }
              : {}),
          },
          select: { id: true },
        }),
      ),
    );
    return rows[0]!.id;
  }

  private async recordCall(
    userId: string,
    call: { response?: BetaMessage; latencyMs: number; error?: unknown },
  ) {
    const u = call.response?.usage;
    await this.prisma.aiCall
      .create({
        data: {
          userId,
          type: "COACH_CHAT",
          provider: this.gateway.provider,
          model: call.response?.model ?? this.gateway.model,
          tokensIn: u
            ? u.input_tokens +
              (u.cache_read_input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0)
            : null,
          tokensOut: u?.output_tokens ?? null,
          latencyMs: call.latencyMs,
          success: !call.error,
          error: call.error
            ? String(call.error instanceof Error ? call.error.message : call.error).slice(0, 500)
            : null,
        },
      })
      .catch((err: Error) => this.logger.warn(`AiCall not recorded: ${err.message}`));
  }
}

function titleFrom(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
}

function localNow(timezone: string): string {
  const now = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  return `Now: ${now} (${timezone})`;
}

/** Collapse the raw transcript into chat bubbles: user text, and one bubble per assistant reply. */
function toViews(
  rows: {
    id: string;
    role: string;
    text: string;
    actions: string[];
    content: unknown;
    createdAt: Date;
  }[],
): CoachMessageView[] {
  const views: CoachMessageView[] = [];
  for (const row of rows) {
    const isToolResults =
      row.role === "user" &&
      Array.isArray(row.content) &&
      row.content.every((b: { type?: string }) => b.type === "tool_result");
    if (isToolResults) continue;
    const prev = views.at(-1);
    if (row.role === "assistant" && prev?.role === "assistant") {
      // Steps of the same reply (tool calls, then the answer) render as one bubble.
      prev.text = [prev.text, row.text].filter(Boolean).join("\n\n");
      prev.actions.push(...row.actions);
      continue;
    }
    views.push({
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      text: row.text,
      actions: [...row.actions],
      createdAt: row.createdAt.toISOString(),
    });
  }
  return views;
}
