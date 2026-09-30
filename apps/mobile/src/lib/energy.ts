import { useSyncExternalStore } from "react";
import type { Energy } from "./types";

/** Today's energy check (10a), shared by the briefing and the workout tab. Resets each day. */
let state: { day: string; energy: Energy } = { day: "", energy: "ok" };
const listeners = new Set<() => void>();
const today = () => new Date().toDateString();

export function setEnergy(energy: Energy) {
  state = { day: today(), energy };
  listeners.forEach((l) => l());
}

function read(): Energy {
  return state.day === today() ? state.energy : "ok";
}

export function useEnergy(): Energy {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    read,
  );
}
