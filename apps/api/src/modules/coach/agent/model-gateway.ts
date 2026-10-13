import type Anthropic from "@anthropic-ai/sdk";

export type BetaMessage = Anthropic.Beta.BetaMessage;
export type BetaMessageParam = Anthropic.Beta.BetaMessageParam;

export interface ModelTurnRequest {
  system: Anthropic.Beta.BetaTextBlockParam[];
  tools: Anthropic.Beta.BetaTool[];
  messages: BetaMessageParam[];
  /** "none" on the last allowed iteration forces a plain-text answer. */
  toolChoice: "auto" | "none";
}

export interface ModelTurnOptions {
  signal: AbortSignal;
  onTextDelta: (delta: string) => void;
}

/**
 * One streamed model request. The agent loop depends on this port, not on the SDK, so it is unit-testable
 * with a scripted gateway and runs end-to-end in dev/CI with the mock gateway.
 */
export interface ModelGateway {
  readonly provider: string;
  readonly model: string;
  createTurn(request: ModelTurnRequest, options: ModelTurnOptions): Promise<BetaMessage>;
}

/**
 * A failed model request from a non-Anthropic gateway (auth, rate limit after retries, 5xx). The agent
 * loop propagates these like Anthropic.APIError instead of retrying them as malformed tool JSON.
 */
export class ModelRequestError extends Error {
  override readonly name = "ModelRequestError";
}

export const MODEL_GATEWAY = Symbol("COACH_MODEL_GATEWAY");
