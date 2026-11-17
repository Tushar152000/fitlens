import { Armchair, Bike, Dumbbell, Footprints, House, Medal, Trophy, type LucideIcon } from "lucide-react-native";
import type { ChoiceOption, TileOption } from "@/components/ui";
import type { OnboardingDraft } from "@/lib/onboarding-draft";

type Activity = NonNullable<OnboardingDraft["activityLevel"]>;
type Equipment = NonNullable<OnboardingDraft["equipment"]>;

/** Renders a lucide icon in the colour the choice card gives it (selected / not). */
export function choiceIcon(I: LucideIcon) {
  return function ChoiceIcon(color: string) {
    return <I size={20} color={color} />;
  };
}

/** "How active are you outside workouts?" — onboarding and the welcome-back check-in. */
export const ACTIVITY_OPTIONS: ChoiceOption<Activity>[] = [
  { value: "SEDENTARY", label: "Mostly sitting", description: "Desk job, under 5k steps", icon: choiceIcon(Armchair) },
  { value: "LIGHT", label: "Lightly active", description: "5–8k steps, some walking", icon: choiceIcon(Footprints) },
  {
    value: "MODERATE",
    label: "Moderately active",
    description: "8–12k steps or an active job",
    icon: choiceIcon(Bike),
  },
  {
    value: "VERY_ACTIVE",
    label: "Very active",
    description: "On your feet all day or hard training",
    icon: choiceIcon(Medal),
  },
  {
    value: "ATHLETE",
    label: "Athlete",
    description: "Twice-a-day training or a very physical job",
    icon: choiceIcon(Trophy),
  },
];

/** "Where I train" — onboarding and the welcome-back check-in. */
export const EQUIPMENT_OPTIONS: TileOption<Equipment>[] = [
  { value: "FULL_GYM", label: "Gym", sub: "Machines, barbells", icon: choiceIcon(Dumbbell) },
  { value: "DUMBBELLS", label: "Home", sub: "A few dumbbells", icon: choiceIcon(House) },
  { value: "BODYWEIGHT", label: "Anywhere", sub: "No equipment", icon: choiceIcon(Footprints) },
];
