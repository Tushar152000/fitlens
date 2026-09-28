import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

/**
 * One error shape for every client: `{ error: string, details?: unknown }`.
 * Matches the contract the web and mobile apps already parse.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Http");

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) {
      // Streaming responses (SSE) report their own errors in-band.
      this.logger.error(err);
      res.end();
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    if (err instanceof HttpException) {
      const body = err.getResponse();
      const message =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message ?? err.message);
      res
        .status(err.getStatus())
        .json({ error: Array.isArray(message) ? message.join(", ") : message });
      return;
    }
    this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    res.status(500).json({ error: "Internal server error" });
  }
}
