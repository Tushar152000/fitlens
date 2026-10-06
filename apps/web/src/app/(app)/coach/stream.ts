import type { CoachMessageView, CoachStreamEvent } from "@fitr8/contracts";

/** A tool the coach is using (or used) for a reply, shown as a small status chip. */
export interface ToolChip {
  id: string;
  label: string;
  status: "running" | "done" | "error";
}

/** A chat bubble. `streaming` is true while the assistant reply is still arriving. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolChip[];
  streaming?: boolean;
  /** The reply stopped early (error event or dropped connection). */
  failed?: string;
}

export function fromView(m: CoachMessageView): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    tools: m.actions.map((label, i) => ({ id: `${m.id}-${i}`, label, status: "done" })),
  };
}

/**
 * Splits buffered `text/event-stream` data into complete events. Returns the parsed events and the
 * unfinished tail to keep for the next chunk. Lines other than `data:` (comments, `event:`, `id:`) are ignored.
 */
export function parseSse(buffer: string): { events: CoachStreamEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n?/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: CoachStreamEvent[] = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as CoachStreamEvent);
    } catch {
      // A malformed event is skipped rather than ending the whole reply.
    }
  }
  return { events, rest };
}

/** Applies one stream event to the assistant message being written (the last one). */
export function applyEvent(messages: ChatMessage[], event: CoachStreamEvent): ChatMessage[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return messages;
  let next: ChatMessage = last;
  switch (event.type) {
    case "text":
      next = { ...last, text: last.text + event.delta };
      break;
    case "tool": {
      const chip: ToolChip = { id: event.id, label: event.label, status: event.status };
      const known = last.tools.some((t) => t.id === event.id);
      next = {
        ...last,
        tools: known
          ? last.tools.map((t) => (t.id === event.id ? chip : t))
          : [...last.tools, chip],
      };
      break;
    }
    case "done":
      next = { ...last, id: event.messageId, streaming: false };
      break;
    case "error":
      next = { ...last, streaming: false, failed: event.message };
      break;
    case "conversation":
      return messages;
  }
  return [...messages.slice(0, -1), next];
}
