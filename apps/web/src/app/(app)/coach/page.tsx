import type { CoachConversationSummary, CoachConversationView } from "@fitr8/contracts";
import { requireOnboardedViewer, serverApiOrNull } from "@/lib/server/api";
import { CoachChat } from "./coach-chat";

export const metadata = { title: "Coach — FITR8" };

/**
 * Coach chat. Opens the most recent conversation (or `?c=<id>`); `?new=1` starts a fresh one.
 * If the coach endpoints can't be reached, the screen still renders and sending shows the error.
 */
export default async function CoachPage({ searchParams }: PageProps<"/coach">) {
  const { name } = await requireOnboardedViewer();
  const sp = await searchParams;
  const conversations =
    (await serverApiOrNull<CoachConversationSummary[]>("/coach/conversations")) ?? [];
  const wanted = typeof sp.c === "string" ? sp.c : sp.new ? null : (conversations[0]?.id ?? null);
  const conversation = wanted
    ? await serverApiOrNull<CoachConversationView>(
        `/coach/conversations/${encodeURIComponent(wanted)}`,
      )
    : null;

  return (
    <CoachChat
      key={conversation?.id ?? "new"}
      firstName={name?.split(" ")[0] ?? null}
      initial={conversation}
      recent={conversations.filter((c) => c.id !== conversation?.id).slice(0, 3)}
    />
  );
}
