"use client";

import { Dumbbell, Scale, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Button,
  CalorieRing,
  ChipGroup,
  ChoiceCardGroup,
  InsightCard,
  MacroBar,
  MealItemEditor,
  MealRow,
  NumberField,
  ProgressSteps,
  Segmented,
  Switch,
  TabBar,
  type EditableItem,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="display text-[19px]">{title}</h2>
      {children}
    </section>
  );
}

export function UiGallery() {
  const [weight, setWeight] = useState("78.5");
  const [sex, setSex] = useState<"MALE" | "FEMALE">("MALE");
  const [goal, setGoal] = useState<string>("FAT_LOSS");
  const [diet, setDiet] = useState<string>("VEG");
  const [ghee, setGhee] = useState(true);
  const [eaten, setEaten] = useState(1240);
  const [items, setItems] = useState<EditableItem[]>([
    { name: "roti", quantity: 2, unit: "piece", grams: 80, kcal: 211, confidence: 0.93 },
    {
      name: "mixed veg sabzi",
      quantity: 0.5,
      unit: "katori",
      grams: 75,
      kcal: 68,
      confidence: 0.55,
    },
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col gap-8 px-5 pt-8 pb-32">
      <header className="flex flex-col gap-1">
        <p className="text-[13px] font-semibold text-ink-3">docs/DESIGN.md</p>
        <h1 className="display text-[28px]">UI primitives</h1>
      </header>

      <Section title="Type">
        <p className="display text-[40px] leading-none">2,050</p>
        <p className="display text-[28px]">Snap your meal.</p>
        <p>Body text is Figtree 15/1.45. All numbers use tabular figures: 1,111 / 8,888.</p>
        <p className="text-[13px] font-semibold text-ink-3">Meta · 13:15</p>
      </Section>

      <Section title="Button">
        <Button>Start my plan</Button>
        <Button variant="strong">Save check-in</Button>
        <Button variant="secondary">Continue with Google</Button>
        <Button variant="dashed">+ Add dinner</Button>
        <Button asChild variant="secondary">
          <Link href="/today">Link styled as a button</Link>
        </Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="NumberField">
        <NumberField label="Weight" unit="kg" value={weight} onValueChange={setWeight} />
        <NumberField
          label="Waist"
          unit="cm"
          value=""
          onValueChange={() => {}}
          error="Enter your waist"
        />
      </Section>

      <Section title="Segmented">
        <Segmented
          label="Sex"
          value={sex}
          onChange={setSex}
          options={[
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
          ]}
        />
      </Section>

      <Section title="ChoiceCard">
        <ChoiceCardGroup
          label="Goal"
          value={goal}
          onChange={setGoal}
          options={[
            {
              value: "FAT_LOSS",
              label: "Lose fat",
              description: "Keep muscle, drop fat",
              icon: <Scale className="size-5" />,
            },
            {
              value: "MUSCLE_GAIN",
              label: "Build muscle",
              description: "Lean surplus",
              icon: <Dumbbell className="size-5" />,
            },
            {
              value: "RECOMPOSITION",
              label: "Recomposition",
              description: "Same weight, better shape",
              icon: <Sparkles className="size-5" />,
            },
          ]}
        />
      </Section>

      <Section title="Chip">
        <ChipGroup
          label="Diet"
          value={diet}
          onChange={setDiet}
          options={[
            { value: "VEG", label: "Veg" },
            { value: "NON_VEG", label: "Non-veg" },
            { value: "EGGETARIAN", label: "Eggetarian" },
            { value: "VEGAN", label: "Vegan" },
          ]}
        />
      </Section>

      <Section title="ProgressSteps">
        <ProgressSteps current={2} />
      </Section>

      <Section title="CalorieRing + MacroBar">
        <div className="flex items-center gap-5 rounded-card bg-surface p-4">
          <CalorieRing eaten={eaten} target={2050} size={140} />
          <div className="flex flex-1 flex-col gap-3">
            <MacroBar macro="protein" eaten={74} target={148} />
            <MacroBar macro="carbs" eaten={150} target={220} />
            <MacroBar macro="fat" eaten={38} target={62} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEaten((e) => Math.max(0, e - 300))}>
            −300
          </Button>
          <Button variant="secondary" onClick={() => setEaten((e) => e + 300)}>
            +300
          </Button>
        </div>
      </Section>

      <Section title="MealRow">
        <MealRow href="#" meta="Lunch · 13:15" title="Roti, dal tadka, jeera rice" kcal={612} />
        <MealRow href="#" meta="Snack · 17:40" title="Photo" kcal={0} status="ANALYZING" />
        <MealRow href="#" meta="Dinner · 20:10" title="3 items found" kcal={0} status="READY" />
      </Section>

      <Section title="MealItemEditor">
        {items.map((item, i) => (
          <MealItemEditor
            key={item.name}
            item={item}
            onRemove={() => setItems((all) => all.filter((_, j) => j !== i))}
            onQuantityChange={(q) =>
              setItems((all) =>
                all.map((it, j) =>
                  j === i
                    ? {
                        ...it,
                        quantity: q,
                        grams: (it.grams / it.quantity) * q,
                        kcal: (it.kcal / it.quantity) * q,
                      }
                    : it,
                ),
              )
            }
          />
        ))}
      </Section>

      <Section title="Switch">
        <div className="flex items-center justify-between rounded-card bg-surface p-4">
          <span id="ghee-label" className="font-semibold">
            Cooked with ghee or oil
          </span>
          <Switch checked={ghee} onChange={setGhee} labelledBy="ghee-label" />
        </div>
      </Section>

      <Section title="InsightCard">
        <InsightCard
          headline="Targets lowered to 1,950 kcal"
          reason="Down 0.2 kg this week vs 0.5 kg planned, so we trimmed 100 kcal."
        />
      </Section>

      <TabBar />
    </div>
  );
}
