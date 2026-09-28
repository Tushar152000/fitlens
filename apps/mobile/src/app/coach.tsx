import type { CoachChatInput, CoachConversationView, CoachMessageView, CoachStreamEvent } from "@fitlens/contracts";
import { ArrowUp, Check, CircleAlert, LoaderCircle, RotateCw, Square, SquarePen } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/back-header";
import { Line } from "@/components/skeletons";
import { Button, Card, Chip, FieldError, Text } from "@/components/ui";
import { api, ApiError, apiStream } from "@/lib/api";
import { readConversationId, writeConversationId } from "@/lib/coach-store";
import { queryClient } from "@/lib/query";
import { colors, fonts, gutter, radius } from "@/lib/theme";

type ToolStatus = Extract<CoachStreamEvent, { type: "tool" }>["status"];
type ToolChip = { id: string; label: string; status: ToolStatus };
type Message = {
  id: string;
  role: CoachMessageView["role"];
  text: string;
  tools: ToolChip[];
  streaming?: boolean;
  /** The reply stopped before the coach finished (user stop, dropped connection, server error). */
  cut?: boolean;
};
type Problem = { kind: "limit" | "error"; message: string };

const MAX_LENGTH = 2000; // CoachChatSchema
const SUGGESTIONS = [
  "How am I doing on protein today?",
  "What should I eat for dinner?",
  "How much water should I drink today?",
  "Why is my calorie target what it is?",
];

const fromView = (m: CoachMessageView): Message => ({
  id: m.id,
  role: m.role,
  text: m.text,
  tools: m.actions.map((label, i) => ({ id: `${m.id}-${i}`, label, status: "done" })),
});

function upsertTool(tools: ToolChip[], e: Extract<CoachStreamEvent, { type: "tool" }>): ToolChip[] {
  const next = { id: e.id, label: e.label, status: e.status };
  return tools.some((t) => t.id === e.id) ? tools.map((t) => (t.id === e.id ? next : t)) : [...tools, next];
}

/** Chat with the FitLens coach. Replies stream in; the thread is kept so reopening continues it. */
export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [reloads, setReloads] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const streamRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Reopen the last thread, if there is one.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const id = await readConversationId();
      if (ctrl.signal.aborted) return;
      if (!id) {
        setStatus("ready");
        return;
      }
      try {
        const view = await api<CoachConversationView>(`/api/coach/conversations/${encodeURIComponent(id)}`, {
          signal: ctrl.signal,
        });
        setConversationId(view.id);
        setMessages(view.messages.map(fromView));
        setStatus("ready");
      } catch (error) {
        if (ctrl.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) {
          // Deleted or from another account: start fresh.
          await writeConversationId(null);
          setStatus("ready");
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Couldn't open your chat.");
        setStatus("error");
      }
    })();
    return () => ctrl.abort();
  }, [reloads]);

  // Leaving the screen stops the reply (the server aborts the model stream on disconnect).
  useEffect(() => {
    const stream = streamRef;
    return () => stream.current?.abort();
  }, []);

  async function send(raw: string) {
    const message = raw.trim().slice(0, MAX_LENGTH);
    if (!message || sending) return;
    const stamp = Date.now();
    const replyId = `reply-${stamp}`;
    const userId = `me-${stamp}`;
    const patch = (fn: (m: Message) => Message) => setMessages((all) => all.map((m) => (m.id === replyId ? fn(m) : m)));

    setProblem(null);
    setDraft("");
    setSending(true);
    setMessages((all) => [
      ...all,
      { id: userId, role: "user", text: message, tools: [] },
      { id: replyId, role: "assistant", text: "", tools: [], streaming: true },
    ]);

    const ctrl = new AbortController();
    streamRef.current = ctrl;
    let gotReply = false;
    let usedTools = false;
    let serverError: string | null = null;
    let dropped = false;
    try {
      const body: CoachChatInput = { conversationId: conversationId ?? undefined, message };
      await apiStream<CoachStreamEvent>("/api/coach/chat", {
        json: body,
        signal: ctrl.signal,
        onEvent: (e) => {
          switch (e.type) {
            case "conversation":
              setConversationId(e.conversationId);
              writeConversationId(e.conversationId);
              break;
            case "text":
              gotReply = true;
              patch((m) => ({ ...m, text: m.text + e.delta }));
              break;
            case "tool":
              gotReply = true;
              if (e.status === "done") usedTools = true;
              patch((m) => ({ ...m, tools: upsertTool(m.tools, e) }));
              break;
            case "done":
              patch((m) => ({ ...m, streaming: false }));
              break;
            case "error":
              serverError = e.message;
              break;
          }
        },
      });
      if (serverError) setProblem({ kind: "error", message: serverError });
    } catch (error) {
      if (!ctrl.signal.aborted) {
        dropped = true;
        const limit = error instanceof ApiError && error.status === 429;
        setProblem({
          kind: limit ? "limit" : "error",
          message: error instanceof Error ? error.message : "Something went wrong. Try again.",
        });
        if (!gotReply) {
          // Nothing came back: take the message out of the thread and give it back to edit or resend.
          setMessages((all) => all.filter((m) => m.id !== replyId && m.id !== userId));
          setDraft(message);
        }
      }
    } finally {
      if (streamRef.current === ctrl) streamRef.current = null;
      const stopped = ctrl.signal.aborted || dropped || serverError !== null;
      setMessages((all) =>
        all
          .filter((m) => !(m.id === replyId && !m.text && m.tools.length === 0))
          .map((m) =>
            m.id === replyId
              ? {
                  ...m,
                  cut: m.streaming && stopped ? true : m.cut,
                  streaming: false,
                  tools: m.tools.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)),
                }
              : m,
          ),
      );
      setSending(false);
      // The coach may have logged water or a weigh-in: refresh Today and Progress.
      if (usedTools) queryClient.invalidateQueries();
    }
  }

  function newChat() {
    streamRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setProblem(null);
    setDraft("");
    setStatus("ready");
    writeConversationId(null);
  }

  const canSend = draft.trim().length > 0 && !sending && status === "ready";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackHeader>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text variant="meta">Ask about food, training or today</Text>
              <Text variant="h2">Your coach</Text>
            </View>
            {(messages.length > 0 || conversationId) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New chat"
                onPress={newChat}
                hitSlop={8}
                style={styles.newChat}
              >
                <SquarePen size={18} color={colors.brand} />
                <Text weight={600} size={13} color={colors.brand}>
                  New chat
                </Text>
              </Pressable>
            )}
          </View>
        </BackHeader>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.thread}
      >
        {status === "loading" ? (
          <ThreadSkeleton />
        ) : status === "error" ? (
          <Card>
            <FieldError>{loadError}</FieldError>
            <Button variant="secondary" icon={RotateCw} onPress={() => setReloads((n) => n + 1)}>
              Try again
            </Button>
          </Card>
        ) : messages.length === 0 ? (
          <Intro onPick={send} />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}

        {problem && (
          <View accessibilityLiveRegion="polite">
            {problem.kind === "limit" ? (
              <Card>
                <Text weight={600}>That&apos;s today&apos;s coach chats used up</Text>
                <Text size={13} color={colors.ink2}>
                  {problem.message} Logging meals, water and workouts still works as usual.
                </Text>
              </Card>
            ) : (
              <FieldError>{problem.message}</FieldError>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          accessibilityLabel="Message your coach"
          value={draft}
          onChangeText={setDraft}
          editable={status === "ready"}
          multiline
          maxLength={MAX_LENGTH}
          placeholder="Ask your coach"
          placeholderTextColor={colors.ink3}
          style={styles.input}
          textAlignVertical="top"
        />
        {sending ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop the reply"
            onPress={() => streamRef.current?.abort()}
            style={[styles.send, { backgroundColor: colors.ink }]}
          >
            <Square size={16} color={colors.white} fill={colors.white} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => send(draft)}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: pressed ? colors.brandHover : colors.brand },
              !canSend && { opacity: 0.5 },
            ]}
          >
            <ArrowUp size={22} color={colors.white} strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Intro({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Text variant="h2">Ask me anything about your plan</Text>
        <Text color={colors.ink2}>
          I can see your meals, targets, water and workouts, and I can log water or a weigh-in for you. Every number
          comes from your logs.
        </Text>
      </Card>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} onPress={() => onPick(s)}>
            {s}
          </Chip>
        ))}
      </View>
      <Text variant="meta">General guidance, not medical advice.</Text>
    </View>
  );
}

function Bubble({ message: m }: { message: Message }) {
  if (m.role === "user") {
    return (
      <View style={[styles.bubble, styles.mine]}>
        <Text color={colors.white}>{m.text}</Text>
      </View>
    );
  }
  const thinking = m.streaming && !m.text && m.tools.every((t) => t.status !== "running");
  return (
    <View style={{ gap: 8, alignSelf: "stretch" }}>
      {m.tools.length > 0 && (
        <View style={styles.tools}>
          {m.tools.map((t) => (
            <ToolStatusChip key={t.id} tool={t} />
          ))}
        </View>
      )}
      {(m.text || thinking) && (
        <View style={[styles.bubble, styles.theirs]} accessibilityLiveRegion={m.streaming ? "polite" : "none"}>
          {m.text ? <Text>{m.text}</Text> : <Text color={colors.ink3}>Thinking…</Text>}
        </View>
      )}
      {m.cut && <Text variant="meta">Reply stopped before it finished.</Text>}
    </View>
  );
}

function ToolStatusChip({ tool }: { tool: ToolChip }) {
  const Icon = tool.status === "running" ? LoaderCircle : tool.status === "done" ? Check : CircleAlert;
  const tint = tool.status === "done" ? colors.protein : tool.status === "error" ? colors.caution : colors.ink3;
  return (
    <View style={styles.tool} accessibilityLabel={`${tool.label}${tool.status === "running" ? ", working" : ""}`}>
      <Icon size={14} color={tint} strokeWidth={2} />
      <Text weight={600} size={12} color={colors.ink2}>
        {tool.label}
      </Text>
    </View>
  );
}

function ThreadSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.bubble, styles.theirs, { gap: 8 }]}>
        <Line tone="card" width="90%" />
        <Line tone="card" width="70%" />
      </View>
      <View style={{ alignSelf: "flex-end", width: "60%" }}>
        <Line height={40} />
      </View>
      <View style={[styles.bubble, styles.theirs, { gap: 8 }]}>
        <Line tone="card" width="80%" />
        <Line tone="card" width="95%" />
        <Line tone="card" width="40%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: gutter,
    paddingBottom: 8,
    backgroundColor: colors.ground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  newChat: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  thread: { flexGrow: 1, paddingHorizontal: gutter, paddingVertical: 20, gap: 16 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bubble: { maxWidth: "88%", borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 12 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tool: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.chip,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: gutter,
    backgroundColor: colors.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: fonts.sans400,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  send: { width: 48, height: 48, borderRadius: radius.input, alignItems: "center", justifyContent: "center" },
});
