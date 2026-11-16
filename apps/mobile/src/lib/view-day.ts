import { useSyncExternalStore } from "react";

/**
 * The day the Today tab is showing: null = today, else a past YYYY-MM-DD. Shared so that saving a
 * forgotten meal (on any log screen) lands the user on that day, where the meal now shows.
 */
let viewDay: string | null = null;
const listeners = new Set<() => void>();

export function showDay(ymd: string | null) {
  if (ymd === viewDay) return;
  viewDay = ymd;
  listeners.forEach((l) => l());
}

export function useViewDay(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => viewDay,
  );
}
