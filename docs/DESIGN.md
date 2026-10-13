# FITR8 design spec (v2, FITR8 palette)

Source of truth for UI work. Layouts and components come from the "FitLens App Design" canvas on
claude.ai (8 phone screens + a design-system board); since the FITR8 rebrand, brand, colour and icon
come from the FITR8 Figma file ("Ganesh's Work"). This file is the build contract for code.

## Brand: logo and app icon

The mark is the **FITR8 mark** (Figma node `3788:3999`): two stacked white strokes forming an "F",
on a brand-purple tile (#8116E0, radius 116/512), mark at 54% of the tile width. Wordmark "FITR8":
"FIT" in ink, "R8" in brand purple.

| File                                        | Use                                                             |
| ------------------------------------------- | --------------------------------------------------------------- |
| `src/app/favicon.ico`                       | 16/32/48 px favicon (small-size variant: mark at 66%)           |
| `src/app/icon.svg`                          | SVG favicon for modern browsers (small-size variant)            |
| `src/app/apple-icon.png`                    | 180 px iOS home-screen icon, full-bleed (iOS rounds it)         |
| `src/app/manifest.ts`                       | PWA manifest; theme #8116E0, background #F6F6F8, start `/today` |
| `public/icons/icon-192.png`, `icon-512.png` | PWA icons (rounded tile)                                        |
| `public/icons/icon-maskable-512.png`        | Android maskable icon (mark at 42%, inside the 80% safe zone)   |
| `public/brand/mark.svg`                     | Master icon, 512 px                                             |

- In the UI, render the icon with the inline SVG `Logo` / `LogoMark` components (24–40 px) rather
  than an `<img>`.
- Never recolour, rotate or stretch the mark, or add gradients or shadows. Minimum size: 16 px
  favicon, 24 px in UI.

## Public web pages (FITR8 marketing look)

The signed-out web pages follow the FITR8 Figma file ("Ganesh's Work", section `3833:3185`) layout
and fonts. Everything behind sign-in uses the app tokens below, which share the same purple.

| Route           | Figma node                 | What it is                                                                                |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| `/`             | `3788:3985` "FITR8"        | Landing page: hero with QR + store badges, feature cards, stats, testimonial, FAQ, footer |
| `/welcome`      | `3828:2321` "Onboarding 0" | "Welcome to FITR8" + three cards → Continue                                               |
| `/welcome/name` | `3828:3096` "Onboarding 1" | Step 1 of 5, "First, what can we call you?" → saves `PATCH /api/profile/name`             |
| `/welcome/done` | none                       | After sign-in: saves the name typed while signed out, then `/onboarding` (or `/today`)    |

- **Tokens:** `--color-fitr8*` in `apps/web/src/app/globals.css` (brand purple `#8116E0`). Fonts:
  Inter, Playfair Display (testimonial), Roboto Bold (pill labels), loaded only by the `(marketing)`
  and `(welcome)` layouts.
- **Navbar** (not in Figma): `SiteHeader`, fixed. Transparent at the top with the wordmark at Figma's hero position (the hero keeps an empty 22 px row for it), solid `fitr8` purple with a shadow once scrolled. Features / Results / FAQ anchors (md+), "Log in" (outline pill → `/login`) and "Start for free" (white pill → `/welcome`, sm+). `/welcome` also links "Already have an account? Log in".
- **Wordmark:** `Fitr8Wordmark`. Figma sets it in Rostex; until that font is licensed into the repo it
  falls back to Inter ExtraBold.
- **Assets:** `apps/web/public/landing/` and `public/welcome/`, exported from Figma.
- **Steps 2–5** of the welcome flow aren't designed yet; after step 1 the user continues in the
  existing in-app onboarding.

## Principles

1. **One job per screen.** One purple primary action per screen, pinned to the bottom, full width.
2. **Numbers you can trust.** Always show grams and units beside kcal. Flag low-confidence AI items in amber; never hide uncertainty.
3. **Explain every change.** Any target change shows a one-line reason with the numbers behind it.
4. **Kind, never shaming.** Over target uses neutral ink, never red. Missed days get a fresh start.
5. **Thumb first.** Mobile-first PWA at 390 px. On wider screens, centre a 480 px column (app shell), no desktop layout in v1.

## Tokens

Put these in `src/app/globals.css` using Tailwind v4 `@theme`:

```css
@theme {
  --color-ground: #f6f6f8; /* app background */
  --color-surface: #ffffff; /* cards, inputs, tab bar */
  --color-sunken: #f0f0f5; /* steppers, set fields */
  --color-track: #ececf2; /* empty ring/bar track */
  --color-line: #e3e3ea; /* dividers */
  --color-line-strong: #d4d4de; /* input + secondary button border */
  --color-ink: #151724; /* text, strong buttons, dark cards */
  --color-ink-2: #4a4c5a; /* secondary text */
  --color-ink-3: #6b6d7a; /* meta text (still >= 4.5:1 on ground) */
  --color-brand: #8116e0; /* FITR8 purple: primary action, calories ring */
  --color-brand-hover: #6a0fbd;
  --color-brand-glow: #a855f7; /* shutter, streak flame; never under text */
  --color-protein: #2f6b4f; /* protein + success */
  --color-protein-soft: #ddebe3;
  --color-carbs: #e3a13b; /* bar fill only; carbs text = #9A6212 */
  --color-fat: #c0396b; /* rose: distinct from brand purple and water blue */
  --color-caution-soft: #fdebd3; /* low-confidence tag bg; text #8A3C08 */
  --color-water: #2f6f9f; /* water bar, icon, + Glass text (>= 4.5:1 on ground and surface) */
  --color-water-soft: #dde9f2; /* water icon tile, pressed + Glass */

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

All 19 screens are drawn in the canvas (numbers match the artboard titles). Each flow is clickable in Play.

### Onboarding

| #   | Route                | Purpose                          | Key content                                                                                                                                                                                                                                          |
| --- | -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/login`             | Welcome + sign-in                | Hero plate with detection chips, "Snap your meal. Hit your goal.", Google + email link, terms + "not medical advice".                                                                                                                                |
| 2   | `/onboarding` step 1 | Your goal                        | ChoiceCards (Lose fat / Build muscle / Recomposition) with icon tile; "Aim for" segmented (Body fat % / Weight) + NumberField; "By when?" 3 tiles (12 / 16 / 24 weeks with end dates) + "Choose an exact date".                                      |
| 3   | `/onboarding` step 2 | About you                        | Sex segmented, height, weight, waist, neck (+ hip for female), measuring tip, activity ChoiceCards.                                                                                                                                                  |
| 4   | `/onboarding` step 3 | Food and training                | Diet chips, "Where I train" 3 tiles (Gym / Home / Anywhere), days-per-week 2–6, minutes segmented 30/45/60, injuries input, medical/pregnant/under-18 checkbox (sets `medicalFlag`). CTA "Build my plan".                                            |
| 5   | `/onboarding/plan`   | Your plan (`feasible=true`)      | "Realistic goal" badge, now → goal card with projection, dark target card, BMI / BMR / workouts tiles, "Start my plan".                                                                                                                              |
| 5b  | `/onboarding/plan`   | Goal too fast (`feasible=false`) | Amber "Too fast to be safe" badge, headline with the unsafe rate, two option cards: **Keep the goal** (later date, recommended) / **Keep the date** (closer target); dark "daily target either way" card; CTA reflects the choice; "Change my goal". |

**4 → 5 "Building your plan"** (app): full-screen coach avatar (skin #E9C58E head and arms, brand shirt, ink legs) pressing brand-glow dumbbells overhead in a 200 px ring that fills in `brand` as a 3-step checklist ticks ("Reading your body stats", "Setting calories and macros", "Planning your training week"); ends on "Your plan is ready". Shown for at least 2.6 s; still (no loop) under reduced motion. The logo arc itself is never animated.

### Daily loop

| #   | Route                           | Purpose             | Key content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | `/today`                        | Home grid           | Date + "Training day" tag, greeting, streak pill. **Calorie card** (tap → History): 116 px ring with kcal left, compact macro grid (label · bar · "74/148 g"), one "focus" line in protein green ("Protein is your focus: 74 g to go"). **2×2 grid** of 20 px-radius tiles, each = 30 px icon tile + label, big number, 8 px bar, one action: **Water** ("1.5 / 3.7 L", `water` bar, "+ Glass 250 ml" button, tap label → 6f), **Steps** ("6,240 / 8k", protein bar, coaching line "1,760 to go · a 15-min walk after dinner"), **Workout** (ink tile, "Workout · 7 pm", session name, "45 min · 6 exercises", brand "Start" → 10a), **Weight** ("80.6 kg", brand sparkline of weekly averages, "−1.4 kg in 3 weeks · on track" → 11). **Next up** row: "Next up: dinner" + "3 meals today · 1,239 kcal" link, dashed "Add dinner" + "Ideas" pill. TabBar (Progress → 11a). |
| 6b  | `/today`                        | Nothing logged yet  | Empty ring "2,260 kcal to go", zero bars, dark "Start with breakfast" card (Snap / type), 2×2 dashed slots + rest-day tile.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6c  | `/today`                        | Over target         | Ring fully ink with a grey overflow arc, centre "212 kcal over"; over-target bars fill **ink**; neutral InsightCard "A little over. No stress." + a positive note. Never red.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6d  | `/today/ideas?meal=DINNER`      | What should I eat?  | Dark "Left for dinner" card (kcal + protein with mini bars), scrollable filter chips (All, My usuals, Under 15 min, Veg, High protein), 3 ranked idea cards (tag "Best fit" with brand border on #1, meta line, kcal, protein in protein colour, "leaves N kcal"), protein top-up tip when the best idea leaves > 20 g uncovered, footer note on what it's based on. Entry: "Dinner ideas" pill beside the next unlogged meal slot on Today.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6e  | `/today/ideas/[id]`             | Adjust and log idea | Tag + name, one-line reason, item rows with steppers (katori 0.5, piece 1), whey/curd top-up switch, sticky footer (this meal kcal, protein of remaining, left after), "Log as dinner" (no photo scan), "Not today".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | `/log`                          | Camera              | Dark screen; meal-type chips; viewfinder; gallery / shutter / type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7b  | `/log/type`                     | Type a meal         | Meal chips, large textarea, hint on amounts, "Your usuals" (one-tap relog, no AI scan used), "Get calories".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `/log/[id]` (PENDING/ANALYZING) | Analysing           | Photo with animated scan line (off under reduced motion), 3-step checklist (uploaded → finding foods → portions), skeleton rows, `aria-live`; when READY becomes "Found N items" + "Review N items"; "Taking too long? Type it instead".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | `/log/[id]` (READY)             | Confirm AI result   | MealItemEditor list, "Add a missed item", ghee/oil switch, sticky total footer, "Save to dinner".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9b  | `/log/[id]` (FAILED)            | Couldn't read photo | Two variants: **notFood** (tips card, "Retake photo", "doesn't count toward daily scans") and **error** ("Your photo is saved", "Try again"). Both offer "Type it instead".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9c  | sheet on `/log` (HTTP 429)      | Daily scans used up | Bottom sheet: 3/3 usage pips, "You've used today's 3 free photo scans", reset time, typing is free; dark Pro card ([PRICE] placeholder); "Upgrade to Pro" + "Type my meal instead".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Packaged food: barcode

| #   | Route                       | Purpose            | Key content                                                                                                                                                                                                                                                                     |
| --- | --------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | `/log`                      | Mode switch        | Bottom pill tabs on the camera: **Type · Photo · Barcode** (current mode = white pill).                                                                                                                                                                                         |
| 7c  | `/log/barcode`              | Scan barcode       | Dark camera, wide rounded scan box with dimmed surround, pulsing laser line, status pill (`aria-live`) "Line up the barcode…" → "Barcode read" (box turns green) + result button; torch; "Type the number" and "Scan the label" buttons.                                        |
| 7d  | `/log/barcode/[code]`       | Product found      | "Exact label values" badge, pack image, brand, name, serving definition; Servings / Grams segmented with stepper (0.5 servings or 5 g); nutrition table per 100 g vs "You"; Open Food Facts attribution + "Report it"; sticky footer kcal + "No AI scan used" + "Add to snack". |
| 7e  | `/log/barcode/[code]` (404) | Not found          | "We don't know this product yet", label-photo tips (whole table, per 100 g column, no glare, uses 1 scan), optional product name, "Photograph the label" / "Type it instead".                                                                                                   |
| 7f  | `/log/label`                | Photograph label   | Dark camera with a tall frame for the nutrition table; single shutter.                                                                                                                                                                                                          |
| 7g  | `/log/label/[id]`           | Check label values | Product name, per-100 g fields (energy, protein, carbs, fat) prefilled from the AI read and editable, "Numbers add up" check badge (or amber "Please check" when the kcal check fails), serving size, servings stepper, sticky total + "Save and add to snack".                 |

### Train, progress and you

| #   | Route                | Purpose                | Key content                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10a | `/workout/brief`     | Coach briefing         | Header "Upper body A · 45 min", fuel card (green "Fuelled" / amber "Running low" with kcal so far), pre-workout snack card when low (with "Log it"), energy check Great / OK / Tired, dark "What your coach set today" card (2–3 rules with the reason), today's exercise list with prescriptions (trimmed sets shown in green when adjusted), "Start workout". Today's workout card links here.                                                                   |
| 10  | `/workout`           | Today's session        | Week strip, chips, active exercise set table with done toggles + progression hint, remaining list.                                                                                                                                                                                                                                                                                                                                                                 |
| 11  | `/progress`          | Weekly check-in        | Weight + waist inputs, InsightCard with adjustment + reason, weight trend (you vs dashed plan), 3 tiles.                                                                                                                                                                                                                                                                                                                                                           |
| 12  | `/history`           | Meal history           | 7 / 30-day segmented, avg on full days + days logged, daily kcal bars (brand = within target, ink = over, grey stub = not logged, faded = today so far) with dashed target line, selected day's meals (tap to edit).                                                                                                                                                                                                                                               |
| 13  | `/profile`           | Profile and settings   | Avatar + plan + streak, dark current-goal card (Edit), Body and training rows, reminder switches (2 pm lunch / 9 pm dinner), plan card with scans left + "Go Pro", data: export CSV, sign out, delete account (danger text).                                                                                                                                                                                                                                       |
| 6f  | `/today/water`       | Water                  | Bottle graphic filling in `water` (turns protein green at target), "1.5 / 3.7 L", "2.2 L to go · about 9 glasses"; 3 quick adds (+ Glass 250, + Bottle 500, Custom); "Why 3.7 L" reason card; today's entries (time · size) with Undo on the latest; dark reminder card ("Next reminder at 6:00 pm" / "Reminders paused until tomorrow") → 13a.                                                                                                                    |
| 11a | `/progress`          | Your week (analytics)  | Week / 30 days segmented; dark scorecard (mini ring "3/6", "3 of 6 habits on track" + one-line summary); **metric table** of 6 rows (Calories, Protein, Water, Steps, Workouts, Weight), each = label, value, status line (green when on track) and 7 mini bars Mon–Sun in the metric colour, full opacity on days the goal was hit and 30% otherwise; pattern card in protein-soft (one data-backed observation); "Do your Sunday check-in" → 11.                 |
| 13a | `/profile/reminders` | Reminders              | Water row with switch; when on: interval segmented (Every 1 / 2 / 3 h), From/To times, "Up to N reminders today · next at 6:00 pm". Then Log lunch (2 pm if nothing logged), Log dinner (9 pm, with ideas), Workout (30 min before usual time), Weekly check-in (Sun 9 am), each with switch; Quiet hours 10 pm–7 am; "Send me a test notification".                                                                                                               |
| 13b | notifications        | Reminder notifications | Copy and actions: **Water** "Time for some water / A glass (250 ml) now. 2.2 L to go today." [+ 250 ml] [Snooze 30 min]; **Workout** "Upper body A in 30 min / You have eaten 1,239 kcal. Fuelled and ready." [Open briefing] [Skip today]; **Dinner** "Log dinner? / 1,021 kcal and 74 g protein left. Chicken curry, 2 roti and curd fits." [Snap it] [See ideas]; **Check-in** "Your 30-second check-in / Weigh in and see this week's adjustment." [Check in]. |

## Water (hydration)

- **Target** (`src/lib/nutrition/water.ts`, unit-tested; never from an LLM): 33 ml × body weight, plus daily activity (sedentary 0, light 250, moderate 500, very active 750, athlete 1,000 ml), plus 500 ml on training days (from the week's workout plan); rounded to 100 ml, kept within 1.5–4.5 L. The card shows the reason with the numbers ("82 kg × 33 ml + 250 ml for light activity ≈ 3.0 L") and a goal tip. With `medicalFlag`, add "follow your doctor's fluid advice".
- **In the Today card** (no separate card): a fourth bar **Water** under Protein / Carbs / Fat ("1.0 / 3.5 L", 8 px bar in `water`, full at target). Below "N eaten of N kcal target", one compact row: "2.5 L left" (water colour; protein-green "Target reached" at target), 32 px `water-soft` chips **+250 ml** and **+500 ml**, an undo icon for the last entry, and an info icon that toggles the target's reason and goal tip.
- **Reminders** (Profile → Reminders, first row): "Water reminders · Every 2 hours, 9 am–9 pm, until you hit today's target". Local notifications scheduled by the app for the next 7 days; today's remaining ones are dropped once the target is reached. Copy: "Time for some water / A glass (250 ml) now. 1.8 L to go today."
- **API:** `GET /api/water` (target, reason, tip, consumed, entries), `POST /api/water { ml }` (50–2,000), `DELETE /api/water/:id`; `PATCH /api/profile/reminders { water }`.

## Reminders (all types)

- **Mobile app (Expo):** local notifications via `expo-notifications` on an Android channel "Reminders". Reschedule the next 7 days whenever the relevant data or setting changes, and cancel today's remaining ones once done (water target hit, meal logged, workout done). Android 13+ needs the notification permission: ask right after onboarding with a one-line reason, never on first launch.
- **Actions:** register notification categories so "+ 250 ml" posts `POST /api/water { ml: 250 }` and "Snooze 30 min" reschedules, both without opening the app; other actions deep-link (`fitlens://log`, `fitlens://today/ideas`, `fitlens://workout/brief`, `fitlens://progress/checkin`).
- **Rules:** never during quiet hours (default 10 pm–7 am); skip a reminder whose job is already done; at most one reminder per 30 min (the later one wins).
- **Web (PWA):** browsers can't reliably schedule local notifications, so the web app only shows in-app nudges; real push on web would need Web Push from the server (not in v1).
- **Settings API:** `GET/PATCH /api/profile/reminders` → `{ water: { on, everyHours: 1|2|3, from: "09:00", to: "21:00" }, lunch, dinner, workout, checkin, quiet: { from: "22:00", to: "07:00" } }`.

## Analytics (Progress tab, 11a)

- **Endpoint:** `GET /api/insights?range=7|30` → per-day series for kcal, protein g, water ml, steps, workouts done, 7-day-average weight, plus each day's target, and a `summary` (`onTrack: n of 6`, one-line text) and `pattern` (optional).
- **"On track" rules:** Calories: weekly average within ±5% of target. Protein: target hit ≥ 5 of 7 days. Water: target hit ≥ 5 of 7 days. Steps: average ≥ goal. Workouts: done ≥ planned. Weight: trend within ±25% of the planned rate (or stable for recomposition).
- **Pattern line:** computed, not generated: compare days that hit a goal vs days that didn't on one feature (e.g. protein at breakfast ≥ 25 g, logged before 10 am, trained that day). Show only when the split is at least 3 vs 3 days. An LLM may reword it, never change the numbers.
- **Steps source:** manual entry today; in the Expo app, read daily steps from Health Connect (Android) and HealthKit (iOS) and store with `source`.

## States

Drawn: 5b, 6b, 6c, 8, 9b, 9c. Build these from the description:

- **Polling:** while a meal is `PENDING|ANALYZING`, poll `GET /api/meals/[id]` every 1 s (target ≤ 6 s), then swap screen 8 → 9, or → 9b on `FAILED`.
- **Offline:** banner "You're offline — we'll sync when you're back"; queue typed meals locally.
- **Loading (any data screen):** skeleton blocks in `sunken`, same shapes as the content; never a spinner alone.
- **Form errors:** message under the field in ink with an amber icon, e.g. "Waist must be bigger than neck".

## Accessibility

- Contrast ≥ 4.5:1 for text (ink-3 on ground passes; never put text on `brand-glow` or `carbs`).
- Real `<button>`, `<a>`, `<label>` + `<input>`; icon-only buttons get `aria-label`.
- Macro colours differ in lightness as well as hue; bars always carry a text value.
- Charts include an `aria-label` summarising the values.

## Backend follow-ups implied by the design

- A not-food result (9b) must not count toward the daily scan limit.
- Free tier = 3 photo scans a day (`AI_DAILY_LIMIT` defaults to 30 today). Typed meals and "usuals" never count.
- Unrealistic goals (5b): `suggestedTargetDate` must use the pace after the 25% deficit cap (≈0.6 kg/week for the 82 kg example), not the 1%/week rate, and return both options (later date, or closer target by the original date).
- "Your usuals" (7b) needs a favourites/frequent-meals endpoint (PRD FR-13, P1).
- History (12) needs `GET /api/history?days=7|30` returning daily totals and meals.

## Barcode scanning (backend + client)

- **Scanner:** use `window.BarcodeDetector` when present (experimental; missing in several major browsers), else lazy-load the MIT `barcode-detector` polyfill (ZXing-C++ WebAssembly). Formats: `ean_13`, `ean_8`, `upc_a`, `upc_e`. Needs HTTPS and camera permission; debounce so one code = one lookup.
- **Schema (`Food`):** add `barcode String? @unique`, `brand String?`, `servingSizeG Float?`, `servingLabel String?` ("3 biscuits"), `imageUrl String?`, `verified Boolean @default(false)`, `submittedById String?`; add `OPEN_FOOD_FACTS` and `LABEL_SCAN` to `FoodSource`.
- **`GET /api/foods/barcode/:code`:** validate the check digit → look up `foods` → else call Open Food Facts API v3 server-side (User-Agent `FITR8/0.1 (contact email)`; limit is 15 product reads/min/IP, so cache every hit and miss in Postgres, misses for 24 h) → map `nutriments` per 100 g → return product or 404.
- **`POST /api/foods/label`:** body `{ photoKey, barcode, name? }` → vision model extracts per-100 g energy/protein/carbs/fat/sugar/sodium + serving size as JSON → run the kcal check (4P + 4C + 9F within 15% of energy) → return values for 7g. Counts as 1 photo scan.
- **Save from 7g:** create `Food` with `source=LABEL_SCAN`, `verified=false`, linked to the barcode; visible to its submitter immediately and to everyone after review (admin flag for now).
- **Quota:** barcode lookups never count toward the daily photo-scan limit.
- **Attribution:** Open Food Facts data is ODbL (images CC BY-SA); show "Data: Open Food Facts" on 7d.

## Meal ideas ("What should I eat?")

- **Endpoint:** `GET /api/suggestions?meal=BREAKFAST|LUNCH|DINNER|SNACK&filter=all|usuals|quick|veg|protein` → `{ budget: {kcal, proteinG}, options: [{ id, name, items: [{foodId, quantity, unit, grams, kcal, proteinG, carbsG, fatG}], totals, reason, tags, score }], topUp? }`.
- **Budget:** remaining kcal/protein today; if later meals are unlogged, reserve a share for them (lunch ≈ 55% of what's left when dinner is still to come).
- **Candidates:** the user's `CONFIRMED` meal logs from the last 60 days, grouped by item set (their "usuals"), plus a seeded `meal_templates` table (~150 Indian meals: items, meal types, veg/egg/non-veg, prep minutes, which items scale). Hard filters: diet type, `Profile.avoidFoods` (new `String[]`), meal type.
- **Portion fitting:** scale scalable items in 0.5 steps within per-item min/max so totals land within ±10% of the budget without exceeding remaining fat.
- **Score:** 0.45 × kcal fit + 0.35 × protein coverage + 0.1 × familiarity + 0.1 × variety (penalise items eaten in the last 48 h); "Not today" feedback lowers that option's score for 14 days.
- **Numbers never come from the LLM.** An LLM may only rephrase the `reason` line.
- **Logging:** `POST /api/meals` with `source: SUGGESTION` and the item list → status `CONFIRMED` directly; never counts toward the photo-scan limit.
- **Safety:** no ideas when over target (show light options only); never suggest pushing the day below the calorie floor.

## Workout coach engine (calorie-aware)

The plan is built by deterministic rules in `src/lib/training/` (unit-tested like `src/lib/nutrition`). An LLM may only vary exercise choice inside a slot and write the one-line coach notes; it never sets sets, reps or loads.

### 1. Inputs

Profile (experience, equipment, days/week, session minutes, injuries, `medicalFlag`), active goal, current `DailyTarget`, TDEE, last 14 days of meal logs, last 4 weeks of `WorkoutLog`, and today's energy check.

### 2. Calorie phase → weekly dose

`phase = deficit` if target < TDEE × 0.95, `surplus` if > TDEE × 1.03, else `maintenance`. Recompute at every weekly check-in.

| Phase                | Hard sets / muscle / week           | Main lifts | Accessories | Effort (reps in reserve) | Cardio                                             | Deload         |
| -------------------- | ----------------------------------- | ---------- | ----------- | ------------------------ | -------------------------------------------------- | -------------- |
| Deficit              | 10–12 (10 if deficit > 20% of TDEE) | 3 × 5–8    | 2 × 8–15    | 1–3                      | Zone 2 2–3 × 20–25 min + steps goal; no extra HIIT | every 6th week |
| Maintenance          | 12–16                               | 3–4 × 6–10 | 2–3 × 8–15  | 1–2                      | 2 × 20 min                                         | every 8th week |
| Surplus              | 14–20                               | 3–4 × 6–10 | 3 × 10–15   | 0–2 on accessories       | 2 × 20 min                                         | every 8th week |
| Beginner (any phase) | low end of range                    | 3 × 8–10   | 2 × 10–12   | 2–3, technique first     | as phase                                           | every 6th week |

Deload week: same exercises, half the sets, loads −10%.

### 3. Split and slots

| Days | Split              | Day slots (in order)                                                                                                                                                                                               |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2–3  | Full body A/B      | squat, horizontal push, horizontal pull, hinge, vertical push, core                                                                                                                                                |
| 4    | Upper / lower ×2   | Upper: horizontal push (main), horizontal pull, vertical push, vertical pull, lateral delt, arms. Lower: squat (main), hinge, single-leg, hamstring curl, calves, core                                             |
| 5–6  | Push / pull / legs | Push: horizontal push (main), incline push, vertical push, lateral delt, triceps. Pull: vertical pull (main), horizontal pull, rear delt, biceps ×2. Legs: squat (main), hinge, single-leg, leg curl, calves, core |

Exercises per session by length: 30 min → 4 (drop the last slots), 45 min → 6, 60 min → 7–8. Rest: main lifts 2–3 min, accessories 60–90 s.

### 4. Exercise library (`exercises` table, ~60 rows)

Add columns `slot String`, `isMain Boolean`, `equipment Equipment[]`, `avoidIf String[]` (e.g. `lower back`, `knee`, `shoulder`), `loadStepKg Float` (2.5 upper, 5 lower, 2 for dumbbells). Every slot needs at least one option per equipment level:

| Slot            | Gym                    | Dumbbells                    | Bodyweight                         |
| --------------- | ---------------------- | ---------------------------- | ---------------------------------- |
| Horizontal push | Barbell bench press    | Dumbbell bench / floor press | Push-up (incline → decline)        |
| Horizontal pull | Chest-supported row    | One-arm dumbbell row         | Towel/table row                    |
| Squat           | Back squat / leg press | Goblet squat                 | Split squat, tempo squat           |
| Hinge           | Romanian deadlift      | Dumbbell RDL                 | Single-leg hip hinge, glute bridge |
| Vertical push   | Seated dumbbell press  | Dumbbell shoulder press      | Pike push-up                       |
| Vertical pull   | Lat pulldown / pull-up | Dumbbell pullover            | Doorframe pull, band pulldown      |

Injury filter removes any exercise whose `avoidIf` matches the user's injuries and picks the next option in the slot.

### 5. Example: the 82 kg fat-loss user (4 days, gym, 45 min, deficit 19%)

| Day           | Exercises (sets × reps, RIR)                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mon · Upper A | Bench press 3×6–8 (2) · Chest-supported row 3×8–10 (2) · DB shoulder press 2×8–12 · Lat pulldown 2×10–12 · Cable lateral raise 2×12–15 · Curl + pushdown superset 2×10–15 |
| Tue · Lower A | Back squat 3×5–8 (2) · Romanian deadlift 3×8–10 (2) · Leg press 2×10–12 · Leg curl 2×10–15 · Calf raise 2×12–15 · Plank 3×40 s                                            |
| Thu · Upper B | Incline DB press 3×8–10 · Pull-up / assisted 3×6–10 · Seated cable row 2×10–12 · Machine fly 2×12–15 · Rear-delt fly 2×12–15 · Hammer curl 2×10–12                        |
| Fri · Lower B | Trap-bar deadlift 3×4–6 (2) · Bulgarian split squat 2×8–10 / leg · Hip thrust 3×8–12 · Leg extension 2×12–15 · Hanging knee raise 2×10–15                                 |
| Wed, Sat, Sun | Rest · 8–10k steps · zone 2 walk/cycle 25 min on 2 of these days                                                                                                          |

### 6. Progression (double progression, per exercise)

- Hit the top of the rep range on every set at the target effort → next session load += `loadStepKg`, reps reset to the bottom.
- Miss the bottom of the range on 2 sessions in a row → keep the load, drop one set of that exercise for a week; 3 misses → load −5%.
- In a deficit, reps may stall; **never** lower the load just because of the deficit: keeping the load is the win.
- First session of an exercise: suggest a conservative start (e.g. bench = 50% of bodyweight for an intermediate, empty bar for a beginner) and calibrate from the first two sessions.

### 7. Daily adjustments (this session only)

| Trigger                                                         | Change                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Energy check = Tired, or yesterday's intake < 70% of target     | Keep main lifts; drop the last set of every accessory; add 1 rep in reserve; session ≈ 20% shorter                     |
| Energy check = Great                                            | Allow +1 rep on the last main-lift set; no extra sets in a deficit (surplus: +1 accessory set allowed)                 |
| Eaten < 30% of today's target by 2 h before usual training time | Show the pre-workout snack card (~20 g protein + 30–40 g carbs), picked from the user's usuals or the template library |
| After the session                                               | Nudge 25–40 g protein at the next meal (links to meal ideas)                                                           |
| `medicalFlag` or age < 18                                       | No deficit programming; beginner full-body, RIR ≥ 3, and a "check with a professional" note                            |

### 8. Food follows training ("Fuel my training days", optional)

Keep the weekly kcal the same and protein fixed; move carbs. With T training days and R rest days: `training = weekly × 1.035 / 7`, rest days get the remainder. Example (2,260/day, 4 training days): training 2,340 kcal (+20 g carbs), rest 2,153 kcal (−27 g carbs). Implement as a per-date override on top of `DailyTarget`.

### 9. Weekly check-in hooks

- Adherence < 50% of sessions for 2 weeks → drop to one fewer day or a shorter session, and say so.
- Weight trend stalled 2 weeks → food or steps change (never more training volume in a deficit).
- Missed rep targets on most main lifts for 2 weeks → schedule a deload next week.

### 10. API

- `POST /api/workouts/generate` → builds the week (`WorkoutPlan.plan` JSON: `{ phase, split, days: [{ date, name, exercises: [{ slug, sets, repMin, repMax, rir, restSec, targetKg }] }] }`), validated with Zod before saving.
- `GET /api/workouts/today?energy=great|ok|tired` → today's session with daily adjustments applied and the coach notes.
- `POST /api/workouts/logs` → `{ planId, exerciseSlug, sets: [{ kg, reps, rir? }] }`; returns the next target for that exercise.

## Build order for Claude Code

1. Tokens + fonts in `globals.css` / `layout.tsx`; add `lucide-react`.
2. `src/components/ui/*` primitives above, with a `/dev/ui` page showing them all.
3. App shell: `(app)/layout.tsx` with 480 px centred column + TabBar.
4. Onboarding (3 steps + plan) wired to `POST /api/onboarding`.
5. Today dashboard wired to `GET /api/dashboard`.
6. Camera → upload → confirm flow wired to the meals API, with all states above.
7. Progress (check-in form + chart); Workout screen with mock data until the plan API lands.
