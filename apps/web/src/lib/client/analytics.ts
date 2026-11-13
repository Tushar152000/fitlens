"use client";

import type { AnalyticsEventName, AnalyticsEvents } from "@fitr8/contracts";
import { sendGAEvent } from "@next/third-parties/google";
import { useSyncExternalStore } from "react";

/**
 * Google Analytics 4 on the website (docs/ANALYTICS.md). Off unless NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set at build time, and then only after the visitor accepts the analytics banner: no Google
 * script loads and no GA cookie is set before that.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null;

export type Consent = "granted" | "denied";
const KEY = "fitr8.analytics-consent";
const listeners = new Set<() => void>();

function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null; // storage blocked: ask every visit, never assume consent
  }
}

export function setConsent(choice: Consent) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // The choice still applies for this page view.
  }
  if (choice === "denied" && GA_ID) {
    // Stops an already-loaded gtag sending more hits, and removes its cookies.
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true;
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0]?.trim();
      if (name === "_ga" || name?.startsWith("_ga_")) {
        const base = `${name}=; Max-Age=0; path=/`;
        document.cookie = base;
        document.cookie = `${base}; domain=.${location.hostname.replace(/^www\./, "")}`;
      }
    }
  }
  memo = choice;
  listeners.forEach((l) => l());
}

let memo: Consent | null | undefined;
function snapshot(): Consent | null {
  if (memo === undefined) memo = readConsent();
  return memo;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The visitor's choice; `undefined` while server-rendering (render nothing until known). */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore<Consent | null | undefined>(subscribe, snapshot, () => undefined);
}

export function track<E extends AnalyticsEventName>(name: E, params: AnalyticsEvents[E]): void {
  if (!GA_ID || snapshot() !== "granted") return;
  try {
    sendGAEvent("event", name, params);
  } catch {
    // Analytics must never break the page.
  }
}
