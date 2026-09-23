# FitLens design spec (v1, "Warm Athletic")

Source of truth for UI work. The visual mockups live in the "FitLens App Design" canvas on claude.ai
(8 phone screens + a design-system board). This file is the build contract for code.

## Principles

1. **One job per screen.** One saffron primary action per screen, pinned to the bottom, full width.
2. **Numbers you can trust.** Always show grams and units beside kcal. Flag low-confidence AI items in amber; never hide uncertainty.
3. **Explain every change.** Any target change shows a one-line reason with the numbers behind it.
4. **Kind, never shaming.** Over target uses neutral ink, never red. Missed days get a fresh start.
5. **Thumb first.** Mobile-first PWA at 390 px. On wider screens, centre a 480 px column (app shell), no desktop layout in v1.

## Tokens

Put these in `src/app/globals.css` using Tailwind v4 `@theme`:

```css
@theme {
  --color-ground: #f6f3ec; /* app background */
  --color-surface: #ffffff; /* cards, inputs, tab bar */
  --color-sunken: #f3efe7; /* steppers, set fields */
  --color-track: #f0ebe1; /* empty ring/bar track */
  --color-line: #e2ddd2; /* dividers */
  --color-line-strong: #d9d3c7; /* input + secondary button border */
  --color-ink: #17181c; /* text, strong buttons, dark cards */
  --color-ink-2: #4a4d55; /* secondary text */
  --color-ink-3: #6b6e76; /* meta text (still >= 4.5:1 on ground) */
  --color-brand: #c2410c; /* primary action, calories ring */
  --color-brand-hover: #9a3412;
  --color-brand-glow: #e8772e; /* shutter, streak flame; never under text */
  --color-protein: #2f6b4f; /* protein + success */
  --color-protein-soft: #ddebe3;
  --color-carbs: #e3a13b; /* bar fill only; carbs text = #9A6212 */
  --color-fat: #6d4fb0;
  --color-caution-soft: #fdebd3; /* low-confidence tag bg; text #8A3C08 */

  --font-display: "Bricolage Grotesque", sans-serif;
  --font-sans: "Figtree", system-ui, sans-serif;

  --radius-input: 14px;
  --radius-button: 16px;
  --radius-card: 20px;
  --radius-sheet: 28px;
}
```

Load fonts with `next/font/google` (`Bricolage_Grotesque` weights 500–800, `Figtree` 400–700) in `src/app/layout.tsx`, replacing Geist.

- **Type:** Display 40/1.0 Bricolage 700 (−0.03em). H1 26–30 Bricolage 700. H2 19 Bricolage 700. Body 15/1.45 Figtree. Button 16 Figtree 600. Meta 12–13 Figtree 600 ink-3. All numbers `tabular-nums`.
- **Spacing:** 4-pt scale (4, 8, 12, 16, 20, 24, 32, 48). Screen gutter 20 (app screens) / 24 (onboarding).
- **Touch:** every interactive target ≥ 44 × 44. Primary button height 54.
- **Elevation:** flat. The only shadow is the camera FAB: `0 6px 16px rgb(194 65 12 / .35)`.
- **Icons:** `lucide-react`, 2 px stroke, 20–24 px. No emoji anywhere.
- **Motion:** 150–220 ms ease-out; ring and bars animate value changes; honour `prefers-reduced-motion`.

## Components (build in `src/components/ui/`)

| Component        | Spec                                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | variants `primary` (brand bg, white), `strong` (ink bg, white), `secondary` (surface, line-strong border), `dashed` (transparent, 1.5 px dashed #C9C2B4, brand text). Height 54 (48 for dashed), radius 16, `asChild` for links. |
| `NumberField`    | Label above (13/600 ink-2), 52 px box, radius 14, big value (18/600), unit suffix in ink-3, `inputMode="decimal"`.                                                                                                               |
| `Segmented`      | Sunken track #EAE5DA, 4 px padding, selected = surface + 1 px shadow.                                                                                                                                                            |
| `ChoiceCard`     | Radio card, min-height 56, 1 px line-strong border; selected = 2 px brand border + filled radio dot.                                                                                                                             |
| `Chip`           | 36 px pill; selected = ink bg / white; idle = #EAE5DA / ink-2.                                                                                                                                                                   |
| `ProgressSteps`  | 4 segments, 6 px tall, ink for done, line for pending, "2 of 4" label.                                                                                                                                                           |
| `CalorieRing`    | SVG r=68, stroke 14, track colour, brand arc, round cap; centre shows kcal **left** (display 32) + "kcal left".                                                                                                                  |
| `MacroBar`       | Label + "74 / 148 g" row, 8 px bar; protein/carbs/fat colours.                                                                                                                                                                   |
| `MealRow`        | 48 px thumb (photo or text icon), meta line "Lunch · 13:15", title, kcal right-aligned bold.                                                                                                                                     |
| `MealItemEditor` | Name, "2 pieces · 80 g", optional amber tag "Not sure — check this" when confidence < 0.6 (card gets 1.5 px #E8A15C border), stepper (−/+ 44 px), kcal. Piece step 1, katori step 0.5.                                           |
| `Switch`         | `role="switch"`, 48×28 track, brand when on.                                                                                                                                                                                     |
| `TabBar`         | 5 columns: Today, Workout, **camera FAB** (60 px, radius 20, raised 26 px), Progress, Profile. 84 px tall, safe-area padding.                                                                                                    |
| `InsightCard`    | Protein-soft background, check badge, bold headline + one-line reason (used for weekly adjustments).                                                                                                                             |

## Screens

| #   | Route                       | Purpose           | Key content                                                                                                                                                                                                                                                              |
| --- | --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/` (signed out) → `/login` | Welcome + sign-in | Hero plate with detection chips, headline "Snap your meal. Hit your goal.", Google + email link buttons, terms + "not medical advice".                                                                                                                                   |
| 2   | `/onboarding` step 1        | Goal type         | ChoiceCards: Lose fat / Build muscle / Recomposition; target (weight or body fat %) + target date.                                                                                                                                                                       |
| 3   | `/onboarding` step 2        | About you         | Sex segmented, DOB, height, weight, waist, neck (+ hip for female), measuring tip, activity ChoiceCards.                                                                                                                                                                 |
| 4   | `/onboarding` step 3        | Diet and training | Diet chips (veg / non-veg / eggetarian / vegan), equipment, days per week, session length, injuries (optional).                                                                                                                                                          |
| 5   | `/onboarding/plan`          | Your plan         | "Realistic goal" badge (or amber warning + suggested date if `feasible=false`), now → goal card with projection line, dark target card (kcal, macro split bar, P/C/F), BMI / BMR / workouts tiles, "Start my plan". Data: `POST /api/onboarding` response.               |
| 6   | `/today`                    | Dashboard         | Date + greeting, streak pill, CalorieRing + 3 MacroBars, meal list, dashed "Add dinner" slot for the next unlogged meal, today's workout card, TabBar. Data: `GET /api/dashboard`.                                                                                       |
| 7   | `/log`                      | Camera            | Dark screen; meal-type chips (default by time of day); viewfinder with corner guides and tip "Shoot from above · whole plate in frame"; gallery, shutter, "type instead". Compress to ≤1024 px client-side, then `POST /api/meals/upload-url` → PUT → `POST /api/meals`. |
| 8   | `/log/[id]`                 | Confirm AI result | Photo header, "We found N items", MealItemEditor list, "Add a missed item", ghee/oil switch (+45 kcal, +5 g fat), sticky footer with live total + P/C/F and "Save to dinner". Data: `GET/PUT /api/meals/[id]`.                                                           |
| 9   | `/workout`                  | Today's session   | Week strip (done / today / planned / rest), chips (duration, count, equipment), active exercise card with set table (kg, reps, done toggle) and progression hint, remaining exercises list.                                                                              |
| 10  | `/progress`                 | Weekly check-in   | Weight + waist inputs, "Save check-in", InsightCard with the adjustment and reason, weight-trend chart (you vs dashed plan, 7-day average), tiles (avg intake, days logged, workouts).                                                                                   |

## States (not drawn — build them)

- **Analysing:** skeleton item rows + "Reading your plate…"; poll `GET /api/meals/[id]` every 1 s while `PENDING|ANALYZING` (target ≤ 6 s).
- **Not food / failed:** friendly copy + "Type it instead" button.
- **Empty day:** illustration-free card "Log your first meal" with the camera CTA.
- **Over target:** ring completes in ink, copy "212 kcal over — no stress, tomorrow resets". No red.
- **AI limit reached (429):** sheet explaining the free limit, "Type it instead" and "Go Pro" actions.
- **Offline:** banner "You're offline — we'll sync when you're back".

## Accessibility

- Contrast ≥ 4.5:1 for text (ink-3 on ground passes; never put text on `brand-glow` or `carbs`).
- Real `<button>`, `<a>`, `<label>` + `<input>`; icon-only buttons get `aria-label`.
- Macro colours differ in lightness as well as hue; bars always carry a text value.
- Charts include an `aria-label` summarising the values.

## Build order for Claude Code

1. Tokens + fonts in `globals.css` / `layout.tsx`; add `lucide-react`.
2. `src/components/ui/*` primitives above, with a `/dev/ui` page showing them all.
3. App shell: `(app)/layout.tsx` with 480 px centred column + TabBar.
4. Onboarding (3 steps + plan) wired to `POST /api/onboarding`.
5. Today dashboard wired to `GET /api/dashboard`.
6. Camera → upload → confirm flow wired to the meals API, with all states above.
7. Progress (check-in form + chart); Workout screen with mock data until the plan API lands.
