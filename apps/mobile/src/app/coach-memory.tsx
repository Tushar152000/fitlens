import { useQuery } from "@tanstack/react-query";
import type { CoachMemoryView } from "@fitr8/contracts";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { BackHeader } from "@/components/back-header";
import { QueryError } from "@/components/query-error";
import { ListSkeleton } from "@/components/skeletons";
import { Card, FieldError, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { queryClient } from "@/lib/query";
import { coachMemoriesQuery } from "@/lib/queries";
import { makeStyles, radius, useColors } from "@/lib/theme";

/** What the coach remembers about the user across chats. Each fact can be deleted. */
export default function CoachMemoryScreen() {
  const c = useColors();
  const styles = useStyles();
  const list = useQuery(coachMemoriesQuery);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function forget(m: CoachMemoryView) {
    const ok = await confirmAction("Forget this?", m.text, "Forget");
    if (!ok) return;
    setRemoving(m.id);
    setError(null);
    try {
      await api(`/api/coach/memories/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      queryClient.setQueryData<CoachMemoryView[]>(coachMemoriesQuery.queryKey, (old) =>
        old?.filter((x) => x.id !== m.id),
      );
    } catch {
      setError("Couldn't forget that. Check your connection and try again.");
    } finally {
      setRemoving(null);
    }
  }

  const memories = list.data ?? [];
  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <BackHeader />
      <View style={{ gap: 6 }}>
        <Text variant="h1">What your coach remembers</Text>
        <Text color={c.ink2}>
          Facts you shared in chats, like injuries, foods you avoid or your schedule, so you don&apos;t have to repeat
          them. Tell the coach to forget something, or delete it here.
        </Text>
      </View>

      {error && <FieldError>{error}</FieldError>}
      {list.isPending ? (
        <ListSkeleton rows={3} />
      ) : list.isError ? (
        <QueryError error={list.error} onRetry={() => list.refetch()} />
      ) : memories.length === 0 ? (
        <Card>
          <Text weight={600}>Nothing saved yet</Text>
          <Text size={13} color={c.ink2}>
            When you mention something lasting, like a knee injury or that you don&apos;t eat eggs, your coach keeps it
            here.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {memories.map((m, i) => (
            <View key={m.id} style={[styles.row, i > 0 && styles.divider]}>
              <Text style={{ flex: 1 }}>{m.text}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Forget: ${m.text}`}
                disabled={removing === m.id}
                onPress={() => forget(m)}
                hitSlop={8}
                style={{ opacity: removing === m.id ? 0.4 : 1 }}
              >
                <Trash2 size={18} color={c.ink3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
}));
