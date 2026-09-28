import { z } from "zod";

/** POST /api/coach/chat — one user turn. Omit conversationId to start a new conversation. */
export const CoachChatSchema = z.object({
  conversationId: z.string().min(1).max(64).optional(),
  message: z.string().trim().min(1).max(2000),
});
export type CoachChatInput = z.infer<typeof CoachChatSchema>;

/**
 * Server-sent events streamed back by POST /api/coach/chat (`text/event-stream`, one JSON object per `data:` line).
 * Clients render `text` deltas as they arrive and show `tool` events as small status chips.
 */
export type CoachStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error" }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

/** A message as shown in the chat UI (tool plumbing and thinking are stripped). */
export interface CoachMessageView {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Labels of the tools the coach used for this reply, e.g. "Checked today's meals". */
  actions: string[];
  createdAt: string;
}

export interface CoachConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface CoachConversationView extends CoachConversationSummary {
  messages: CoachMessageView[];
}
