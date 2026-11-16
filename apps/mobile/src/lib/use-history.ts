import { useState } from "react";

const MAX_STEPS = 50;

/**
 * State with undo and redo. `set` records a step (and clears redo, like any editor); `undo` and
 * `redo` walk the steps. Kept on the device: nothing is saved until the screen saves.
 */
export function useHistory<T>(initial: T) {
  const [h, setH] = useState({ past: [] as T[], present: initial, future: [] as T[] });

  const set = (next: T | ((current: T) => T)) =>
    setH((s) => {
      const value = typeof next === "function" ? (next as (current: T) => T)(s.present) : next;
      if (Object.is(value, s.present)) return s;
      return { past: [...s.past, s.present].slice(-MAX_STEPS), present: value, future: [] };
    });

  const undo = () =>
    setH((s) =>
      s.past.length === 0
        ? s
        : { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] },
    );

  const redo = () =>
    setH((s) =>
      s.future.length === 0 ? s : { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) },
    );

  return {
    value: h.present,
    set,
    undo,
    redo,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}
