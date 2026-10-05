import type { MealType } from "@fitr8/domain/format";

/** Typed meals saved while offline (design: "queue typed meals locally"). Per device, best effort. */
export interface QueuedMeal {
  mealType: MealType;
  text: string;
  date: string; // YYYY-MM-DD on the device when it was typed
}

const KEY = "fitlens.offlineMeals";

function read(): QueuedMeal[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(items: QueuedMeal[]) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked (private mode); nothing we can do
  }
}

export function queueMeal(meal: QueuedMeal) {
  write([...read(), meal]);
}

export function queuedCount() {
  return read().length;
}

/** Send queued meals; keeps the ones that fail so they retry next time. Returns how many were sent. */
export async function flushQueue(): Promise<number> {
  const items = read();
  if (!items.length) return 0;
  const left: QueuedMeal[] = [];
  let sent = 0;
  for (const m of items) {
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "TEXT", mealType: m.mealType, text: m.text, date: m.date }),
      });
      if (res.ok || res.status === 400)
        sent++; // 400 = bad entry; drop it rather than retry forever
      else left.push(m);
    } catch {
      left.push(m);
    }
  }
  write(left);
  return sent;
}
