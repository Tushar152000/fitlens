import { describe, expect, it } from "vitest";
import { OnboardingSchema } from "@/lib/validators";
import { emptyDraft, toPayload, validateStep, type OnboardingDraft } from "./draft";

const today = new Date("2026-09-24T00:00:00Z");

const complete: OnboardingDraft = {
  ...emptyDraft(today),
  goalType: "FAT_LOSS",
  targetWeightKg: "72",
  sex: "MALE",
  birthDate: "1996-05-10",
  heightCm: "175",
  weightKg: "80.5",
  waistCm: "90",
  neckCm: "38",
  hipCm: "99", // ignored for men
  activityLevel: "LIGHT",
  dietType: "VEG",
  experience: "BEGINNER",
  equipment: "DUMBBELLS",
  injuries: " knee , , lower back ",
};

describe("onboarding draft", () => {
  it("passes every step when complete", () => {
    for (const step of [1, 2, 3]) expect(validateStep(step, complete, today)).toEqual({});
  });

  it("requires a target for fat loss but not for recomposition", () => {
    expect(validateStep(1, { ...complete, targetWeightKg: "" }, today)).toHaveProperty(
      "targetWeightKg",
    );
    expect(
      validateStep(1, { ...complete, goalType: "RECOMPOSITION", targetWeightKg: "" }, today),
    ).toEqual({});
  });

  it("rejects a target date less than two weeks away", () => {
    expect(validateStep(1, { ...complete, targetDate: "2026-10-01" }, today)).toHaveProperty(
      "targetDate",
    );
  });

  it("needs waist and neck for a body-fat goal", () => {
    const d = {
      ...complete,
      targetMode: "BODY_FAT" as const,
      targetBodyFatPct: "15",
      waistCm: "",
      neckCm: "",
    };
    const e = validateStep(2, d, today);
    expect(e).toHaveProperty("waistCm");
    expect(e).toHaveProperty("neckCm");
    expect(validateStep(2, { ...complete, waistCm: "", neckCm: "" }, today)).toEqual({});
  });

  it("checks waist is bigger than neck", () => {
    expect(validateStep(2, { ...complete, waistCm: "45", neckCm: "50" }, today).waistCm).toBe(
      "Waist must be bigger than neck",
    );
  });

  it("flags out-of-range numbers", () => {
    expect(validateStep(2, { ...complete, heightCm: "17.5" }, today)).toHaveProperty("heightCm");
    expect(validateStep(2, { ...complete, weightKg: "abc" }, today)).toHaveProperty("weightKg");
  });

  it("builds a payload the API schema accepts", () => {
    const payload = toPayload(complete, "Asia/Kolkata");
    expect(payload.hipCm).toBeUndefined();
    expect(payload.injuries).toEqual(["knee", "lower back"]);
    expect(payload.goal).toEqual({
      type: "FAT_LOSS",
      targetWeightKg: 72,
      targetBodyFatPct: undefined,
      targetDate: "2026-12-17",
    });
    expect(OnboardingSchema.safeParse(payload).success).toBe(true);
  });

  it("sends no target for recomposition", () => {
    const payload = toPayload({ ...complete, goalType: "RECOMPOSITION" }, "Asia/Kolkata");
    expect(payload.goal.targetWeightKg).toBeUndefined();
    expect(OnboardingSchema.safeParse(payload).success).toBe(true);
  });
});
