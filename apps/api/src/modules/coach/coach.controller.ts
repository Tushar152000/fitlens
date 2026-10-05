import { Controller, Delete, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CoachChatSchema,
  type CoachChatInput,
  type CoachConversationSummary,
  type CoachConversationView,
  type CoachStreamEvent,
} from "@fitr8/contracts";
import type { Response } from "express";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { CoachService } from "./coach.service.js";

const HEARTBEAT_MS = 15_000;

@Controller("coach")
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  /**
   * One user turn, streamed as server-sent events (see CoachStreamEvent in @fitr8/contracts).
   * Limit/ownership/lock errors are returned as normal JSON before the stream opens.
   */
  @Post("chat")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @UserId() userId: string,
    @ZodBody(CoachChatSchema) input: CoachChatInput,
    @Res() res: Response,
  ) {
    const turn = await this.coach.prepareTurn(userId, input);

    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (nginx and friends)
    });
    res.flushHeaders();

    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort(); // client went away: stop the model and the tools
    });
    const send = (event: CoachStreamEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

    try {
      await this.coach.runTurn(turn, send, abort.signal);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }

  @Get("conversations")
  list(@UserId() userId: string): Promise<CoachConversationSummary[]> {
    return this.coach.list(userId);
  }

  @Get("conversations/:id")
  get(@UserId() userId: string, @Param("id") id: string): Promise<CoachConversationView> {
    return this.coach.get(userId, id);
  }

  @Delete("conversations/:id")
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param("id") id: string) {
    await this.coach.remove(userId, id);
  }
}
