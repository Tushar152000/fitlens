import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendGAEvent = vi.fn();
vi.mock("@next/third-parties/google", () => ({ sendGAEvent }));

/** Fresh module per test: GA_ID and the consent memo are read once per module load. */
async function load(gaId: string | undefined, stored: string | null) {
  vi.resetModules();
  vi.doMock("@/lib/ga-id", () => ({ GA_MEASUREMENT_ID: gaId ?? "" }));
  const store = new Map<string, string>(stored ? [["fitr8.analytics-consent", stored]] : []);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("location", { hostname: "www.fitr8.com" });
  return { mod: await import("./analytics"), store };
}

describe("web analytics consent", () => {
  beforeEach(() => sendGAEvent.mockClear());
  afterEach(() => {
    vi.doUnmock("@/lib/ga-id");
    vi.unstubAllGlobals();
  });

  it("sends nothing without a Measurement ID, even with consent", async () => {
    const { mod } = await load(undefined, "granted");
    mod.track("calculator_used", {});
    expect(sendGAEvent).not.toHaveBeenCalled();
  });

  it("sends nothing before the visitor chooses", async () => {
    const { mod } = await load("G-TEST", null);
    mod.track("store_click", { store: "play_store" });
    expect(sendGAEvent).not.toHaveBeenCalled();
  });

  it("sends nothing after the visitor declines", async () => {
    const { mod } = await load("G-TEST", "denied");
    mod.track("onboarding_complete", { platform: "web" });
    expect(sendGAEvent).not.toHaveBeenCalled();
  });

  it("sends events once the visitor allows, and stops when they withdraw", async () => {
    const { mod, store } = await load("G-TEST", null);
    mod.setConsent("granted");
    expect(store.get("fitr8.analytics-consent")).toBe("granted");
    mod.track("store_click", { store: "app_store" });
    expect(sendGAEvent).toHaveBeenCalledWith("event", "store_click", { store: "app_store" });

    mod.setConsent("denied");
    mod.track("calculator_used", {});
    expect(sendGAEvent).toHaveBeenCalledTimes(1);
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
  });

  it("treats blocked storage as no choice (never as consent)", async () => {
    const { mod } = await load("G-TEST", null);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    vi.resetModules();
    const fresh = await import("./analytics");
    fresh.track("calculator_used", {});
    expect(sendGAEvent).not.toHaveBeenCalled();
    expect(mod.GA_ID).toBe("G-TEST");
  });
});
