"use client";

import type { CoachConversationSummary, CoachConversationView } from "@fitr8/contracts";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader,
  MessageCirclePlus,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { StickyFooter } from "@/components/sticky-footer";
import { Chip } from "@/components/ui";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { applyEvent, fromView, parseSse, type ChatMessage, type ToolChip } from "./stream";

const SUGGESTIONS = [
  "What should I eat for dinner?",
  "How is my week going?",
  "Why is my calorie target what it is?",
];

const OFFLINE = "Couldn't reach your coach. Check your connection and try again.";
const DROPPED = "The reply was cut off. Try asking again.";

export function CoachChat({
  firstName,
  initial,
  recent,
}: {
  firstName: string | null;
  initial: CoachConversationView | null;
  recent: CoachConversationSummary[];
}) {
  const [conversationId, setConversationId] = useState<string | null>(initial?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (initial?.messages ?? []).map(fromView),
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Leaving the screen stops the reply (the API aborts the model stream when we disconnect).
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function remember(id: string) {
    setConversationId(id);
    const url = new URL(window.location.href);
    url.search = `?c=${encodeURIComponent(id)}`;
    window.history.replaceState(null, "", url);
  }

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || streaming) return;
    setError(null);
    setInput("");
    setStreaming(true);
    const userMsg: ChatMessage = {
      id: `local-u-${Date.now()}`,
      role: "user",
      text: message,
      tools: [],
    };
    const reply: ChatMessage = {
      id: `local-a-${Date.now()}`,
      role: "assistant",
      text: "",
      tools: [],
      streaming: true,
    };
    setMessages((m) => [...m, userMsg, reply]);

    // Nothing arrived: take the turn back and put the text in the box so it can be resent.
    const undo = (why: string) => {
      setMessages((m) => m.filter((x) => x.id !== userMsg.id && x.id !== reply.id));
      setInput(message);
      setError(why);
    };

    const controller = new AbortController();
    abortRef.current = controller;
    let res: Response;
    try {
      res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(conversationId ? { conversationId, message } : { message }),
        signal: controller.signal,
      });
    } catch {
      if (!controller.signal.aborted) undo(OFFLINE);
      setStreaming(false);
      return;
    }

    if (res.status === 401) {
      window.location.assign(new URL("/login", window.location.origin).href);
      return;
    }
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 429) {
        setMessages((m) => m.filter((x) => x.id !== reply.id && x.id !== userMsg.id));
        setInput(message);
        setLimited(
          body?.error ??
            "You've used today's coach messages. They reset tomorrow, and logging meals works as usual.",
        );
      } else {
        undo(body?.error ?? "Your coach couldn't answer just now. Try again in a moment.");
      }
      setStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSse(buffer);
        buffer = rest;
        for (const event of events) {
          if (event.type === "conversation") remember(event.conversationId);
          if (event.type === "done" || event.type === "error") finished = true;
          setMessages((m) => applyEvent(m, event));
        }
      }
    } catch {
      // Aborted on unmount, or the connection dropped; handled below.
    }
    if (controller.signal.aborted) return;
    if (!finished) {
      setMessages((m) => applyEvent(m, { type: "error", message: DROPPED }));
    }
    setStreaming(false);
    abortRef.current = null;
    inputRef.current?.focus();
  }

  function startNew() {
    abortRef.current?.abort();
    setStreaming(false);
    setConversationId(null);
    setMessages([]);
    setError(null);
    window.history.replaceState(null, "", "/coach?new=1");
    inputRef.current?.focus();
  }

  async function remove() {
    if (!conversationId) return;
    if (!window.confirm("Delete this chat? Your meals, plan and logs stay as they are.")) return;
    try {
      await api(`/api/coach/conversations/${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
      startNew();
    } catch {
      setError("Couldn't delete this chat. Try again.");
    }
  }

  const empty = messages.length === 0;

  return (
    <main className="flex flex-1 flex-col px-5 pt-3">
      <header className="flex items-center gap-1">
        <Link
          href="/today"
          aria-label="Back to Today"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-sunken"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="flex-1 display text-[26px] leading-tight">Your coach</h1>
        {conversationId && (
          <button
            type="button"
            onClick={remove}
            disabled={streaming}
            aria-label="Delete this chat"
            className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-sunken disabled:opacity-40"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        )}
        {!empty && (
          <button
            type="button"
            onClick={startNew}
            aria-label="New chat"
            className="-mr-2 grid size-11 place-items-center rounded-full text-ink-2 hover:bg-sunken"
          >
            <MessageCirclePlus className="size-5" aria-hidden />
          </button>
        )}
      </header>

      {empty ? (
        <section className="mt-6 flex flex-col gap-5" aria-label="Start a chat">
          <div className="flex flex-col gap-3 rounded-card bg-ink p-5 text-white">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10">
              <Sparkles className="size-5 text-brand-glow" aria-hidden />
            </span>
            <p className="display text-[22px] leading-tight">
              Hi{firstName ? ` ${firstName}` : ""}, what&apos;s on your mind?
            </p>
            <p className="text-[13px] text-white/75">
              Ask about your meals, training or plan. I look at your own logs before answering, and
              I can log water or a weigh-in for you. General guidance, not medical advice.
            </p>
          </div>
          <div role="group" aria-label="Suggestions" className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} onClick={() => send(s)} disabled={streaming || Boolean(limited)}>
                {s}
              </Chip>
            ))}
          </div>
          {recent.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold text-ink-3">Earlier chats</h2>
              <ul className="flex flex-col divide-y divide-line rounded-card bg-surface">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/coach?c=${encodeURIComponent(c.id)}`}
                      className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="truncate font-semibold">{c.title}</span>
                      <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <div
          role="log"
          aria-label="Conversation"
          aria-busy={streaming}
          className="mt-4 flex flex-col gap-3"
        >
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
        </div>
      )}
      <div ref={endRef} />

      <StickyFooter gutter={20} className="flex flex-col gap-2">
        {limited && (
          <p role="status" className="rounded-card bg-sunken px-4 py-3 text-[13px] text-ink-2">
            <span className="block font-semibold text-ink">That&apos;s all for today</span>
            {limited}
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-[13px] font-semibold text-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
            {error}
          </p>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="coach-input" className="sr-only">
            Message your coach
          </label>
          <textarea
            ref={inputRef}
            id="coach-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={limited ? "Back tomorrow" : "Ask your coach…"}
            disabled={Boolean(limited)}
            className="[field-sizing:content] max-h-36 min-h-[54px] flex-1 resize-none rounded-input border border-line-strong bg-surface px-4 py-[15px] text-base leading-snug outline-none focus:border-ink disabled:bg-sunken"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={streaming || !input.trim() || Boolean(limited)}
            className="grid size-[54px] shrink-0 place-items-center rounded-button bg-brand text-white transition-colors duration-150 hover:bg-brand-hover disabled:bg-brand/50"
          >
            {streaming ? (
              <Loader className="size-5 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="size-6" aria-hidden />
            )}
          </button>
        </form>
      </StickyFooter>
    </main>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <p className="ml-auto max-w-[85%] rounded-card rounded-br-md bg-ink px-4 py-3 whitespace-pre-wrap text-white">
        {message.text}
      </p>
    );
  }
  const waiting = message.streaming && !message.text && message.tools.length === 0;
  return (
    <div className="mr-auto flex max-w-[92%] flex-col gap-2">
      {message.tools.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="What your coach checked">
          {message.tools.map((t) => (
            <ToolStatus key={t.id} tool={t} />
          ))}
        </ul>
      )}
      {waiting ? (
        <div
          className="flex w-40 flex-col gap-2 rounded-card rounded-bl-md bg-surface px-4 py-3.5"
          aria-label="Your coach is thinking"
        >
          <span className="h-3 w-full animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-sunken" />
          <span className="h-3 w-2/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-sunken" />
        </div>
      ) : (
        message.text && (
          <div className="flex flex-col gap-2 rounded-card rounded-bl-md bg-surface px-4 py-3 text-[15px] leading-[1.45]">
            <RichText text={message.text} />
          </div>
        )
      )}
      {message.failed && (
        <p className="flex items-start gap-2 text-[13px] font-semibold text-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
          {message.failed}
        </p>
      )}
    </div>
  );
}

function ToolStatus({ tool }: { tool: ToolChip }) {
  return (
    <li
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold",
        tool.status === "error" ? "bg-caution-soft text-caution-text" : "bg-chip text-ink-2",
      )}
    >
      {tool.status === "running" ? (
        <Loader className="size-3.5 animate-spin" aria-hidden />
      ) : tool.status === "done" ? (
        <Check className="size-3.5 text-protein" aria-hidden />
      ) : (
        <CircleAlert className="size-3.5" aria-hidden />
      )}
      {tool.status === "running" ? `${tool.label.replace(/[.…]+$/, "")}…` : tool.label}
    </li>
  );
}

/** Just enough formatting for chat replies: paragraphs, "- " bullet lists and **bold**. No HTML is parsed. */
function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{bold(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {bold(block)}
          </p>
        );
      })}
    </>
  );
}

function bold(s: string): ReactNode {
  return s
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) =>
      i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
}
