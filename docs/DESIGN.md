# FitLens design spec (v1, "Warm Athletic")

Source of truth for UI work. The visual mockups live in the "FitLens App Design" canvas on claude.ai
(8 phone screens + a design-system board). This file is the build contract for code.

## Brand: logo and app icon

The mark is the **Progress lens**: an ink tile (#17181C, radius 116/512) with a 72%-full saffron arc (#E8772E, round caps, starting at 12 o'clock) on a #3A3C43 track, around a #F6F3EC focus dot. Wordmark "FitLens" in Bricolage Grotesque 700, −0.02em. See the "Logo and app icon" board on the canvas.

| File | Use |
| --- | --- |
| `src/app/favicon.ico` | 16/32/48 px favicon (small-size variant: heavier ring, bigger dot) |
| `src/app/icon.svg` | SVG favicon for modern browsers (small-size variant) |
| `src/app/apple-icon.png` | 180 px iOS home-screen icon, full-bleed (iOS rounds it) |
| `src/app/manifest.ts` | PWA manifest; theme #17181C, background #F6F3EC, start `/today` |
| `public/icons/icon-192.png`, `icon-512.png` | PWA icons (rounded tile) |
| `public/icons/icon-maskable-512.png` | Android maskable icon (glyph inside the 80% safe zone) |
| `public/brand/mark.svg` | Master mark, 512 px |
| `public/brand/logo-horizontal.svg` / `-on-dark.svg` (+ PNG @4x) | Mark + wordmark lockups; wordmark is outlined paths, no font needed |

- In the UI, render the mark as an inline SVG `Logo` component (sizes 24–40 px) next to live Bricolage text, rather than an `<img>`.
- On dark grounds, lift the tile to #2A2C33 so its edge shows.
- Never recolour or animate the arc in the icon, add gradients or shadows, or stretch the tile. Minimum size: 16 px favicon, 24 px in UI.

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

All 19 screens are drawn in the canvas (numbers match the artboard titles). Each flow is clickable in Play.

### Onboarding

| # | Route | Purpose | Key content |
| --- | --- | --- | --- |
| 1 | `/login` | Welcome + sign-in | Hero plate with detection chips, "Snap your meal. Hit your goal.", Google + email link, terms + "not medical advice". |
| 2 | `/onboarding` step 1 | Your goal | ChoiceCards (Lose fat / Build muscle / Recomposition) with icon tile; "Aim for" segmented (Body fat % / Weight) + NumberField; "By when?" 3 tiles (12 / 16 / 24 weeks with end dates) + "Choose an exact date". |
| 3 | `/onboarding` step 2 | About you | Sex segmented, height, weight, waist, neck (+ hip for female), measuring tip, activity ChoiceCards. |
| 4 | `/onboarding` step 3 | Food and training | Diet chips, "Where I train" 3 tiles (Gym / Home / Anywhere), days-per-week 2–6, minutes segmented 30/45/60, injuries input, medical/pregnant/under-18 checkbox (sets `medicalFlag`). CTA "Build my plan". |
| 5 | `/onboarding/plan` | Your plan (`feasible=true`) | "Realistic goal" badge, now → goal card with projection, dark target card, BMI / BMR / workouts tiles, "Start my plan". |
| 5b | `/onboarding/plan` | Goal too fast (`feasible=false`) | Amber "Too fast to be safe" badge, headline with the unsafe rate, two option cards: **Keep the goal** (later date, recommended) / **Keep the date** (closer target); dark "daily target either way" card; CTA reflects the choice; "Change my goal". |

### Daily loop

| # | Route | Purpose | Key content |
| --- | --- | --- | --- |
| 6 | `/today` | Dashboard | Greeting, streak pill, CalorieRing + MacroBars, meal list, dashed "Add dinner" slot, workout card, TabBar. |
| 6b | `/today` | Nothing logged yet | Empty ring "2,260 kcal to go", zero bars, dark "Start with breakfast" card (Snap / type), 2×2 dashed slots + rest-day tile. |
| 6c | `/today` | Over target | Ring fully ink with a grey overflow arc, centre "212 kcal over"; over-target bars fill **ink**; neutral InsightCard "A little over. No stress." + a positive note. Never red. |
| 6d | `/today/ideas?meal=DINNER` | What should I eat? | Dark "Left for dinner" card (kcal + protein with mini bars), scrollable filter chips (All, My usuals, Under 15 min, Veg, High protein), 3 ranked idea cards (tag "Best fit" with brand border on #1, meta line, kcal, protein in protein colour, "leaves N kcal"), protein top-up tip when the best idea leaves > 20 g uncovered, footer note on what it's based on. Entry: "Dinner ideas" pill beside the next unlogged meal slot on Today. |
| 6e | `/today/ideas/[id]` | Adjust and log idea | Tag + name, one-line reason, item rows with steppers (katori 0.5, piece 1), whey/curd top-up switch, sticky footer (this meal kcal, protein of remaining, left after), "Log as dinner" (no photo scan), "Not today". |
| 7 | `/log` | Camera | Dark screen; meal-type chips; viewfinder; gallery / shutter / type. |
| 7b | `/log/type` | Type a meal | Meal chips, large textarea, hint on amounts, "Your usuals" (one-tap relog, no AI scan used), "Get calories". |
| 8 | `/log/[id]` (PENDING/ANALYZING) | Analysing | Photo with animated scan line (off under reduced motion), 3-step checklist (uploaded → finding foods → portions), skeleton rows, `aria-live`; when READY becomes "Found N items" + "Review N items"; "Taking too long? Type it instead". |
| 9 | `/log/[id]` (READY) | Confirm AI result | MealItemEditor list, "Add a missed item", ghee/oil switch, sticky total footer, "Save to dinner". |
| 9b | `/log/[id]` (FAILED) | Couldn't read photo | Two variants: **notFood** (tips card, "Retake photo", "doesn't count toward daily scans") and **error** ("Your photo is saved", "Try again"). Both offer "Type it instead". |
| 9c | sheet on `/log` (HTTP 429) | Daily scans used up | Bottom sheet: 3/3 usage pips, "You've used today's 3 free photo scans", reset time, typing is free; dark Pro card ([PRICE] placeholder); "Upgrade to Pro" + "Type my meal instead". |

### Packaged food: barcode

| # | Route | Purpose | Key content |
| --- | --- | --- | --- |
| 7 | `/log` | Mode switch | Bottom pill tabs on the camera: **Type · Photo · Barcode** (current mode = white pill). |
| 7c | `/log/barcode` | Scan barcode | Dark camera, wide rounded scan box with dimmed surround, pulsing laser line, status pill (`aria-live`) "Line up the barcode…" → "Barcode read" (box turns green) + result button; torch; "Type the number" and "Scan the label" buttons. |
| 7d | `/log/barcode/[code]` | Product found | "Exact label values" badge, pack image, brand, name, serving definition; Servings / Grams segmented with stepper (0.5 servings or 5 g); nutrition table per 100 g vs "You"; Open Food Facts attribution + "Report it"; sticky footer kcal + "No AI scan used" + "Add to snack". |
| 7e | `/log/barcode/[code]` (404) | Not found | "We don't know this product yet", label-photo tips (whole table, per 100 g column, no glare, uses 1 scan), optional product name, "Photograph the label" / "Type it instead". |
| 7f | `/log/label` | Photograph label | Dark camera with a tall frame for the nutrition table; single shutter. |
| 7g | `/log/label/[id]` | Check label values | Product name, per-100 g fields (energy, protein, carbs, fat) prefilled from the AI read and editable, "Numbers add up" check badge (or amber "Please check" when the kcal check fails), serving size, servings stepper, sticky total + "Save and add to snack". |

### Train, progress and you

| # | Route | Purpose | Key content |
| --- | --- | --- | --- |
| 10 | `/workout` | Today's session | Week strip, chips, active exercise set table with done toggles + progression hint, remaining list. |
| 11 | `/progress` | Weekly check-in | Weight + waist inputs, InsightCard with adjustment + reason, weight trend (you vs dashed plan), 3 tiles. |
| 12 | `/history` | Meal history | 7 / 30-day segmented, avg on full days + days logged, daily kcal bars (brand = within target, ink = over, grey stub = not logged, faded = today so far) with dashed target line, selected day's meals (tap to edit). |
| 13 | `/profile` | Profile and settings | Avatar + plan + streak, dark current-goal card (Edit), Body and training rows, reminder switches (2 pm lunch / 9 pm dinner), plan card with scans left + "Go Pro", data: export CSV, sign out, delete account (danger text). |

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
- **`GET /api/foods/barcode/:code`:** validate the check digit → look up `foods` → else call Open Food Facts API v3 server-side (User-Agent `FitLens/0.1 (contact email)`; limit is 15 product reads/min/IP, so cache every hit and miss in Postgres, misses for 24 h) → map `nutriments` per 100 g → return product or 404.
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

## Build order for Claude Code

1. Tokens + fonts in `globals.css` / `layout.tsx`; add `lucide-react`.
2. `src/components/ui/*` primitives above, with a `/dev/ui` page showing them all.
3. App shell: `(app)/layout.tsx` with 480 px centred column + TabBar.
4. Onboarding (3 steps + plan) wired to `POST /api/onboarding`.
5. Today dashboard wired to `GET /api/dashboard`.
6. Camera → upload → confirm flow wired to the meals API, with all states above.
7. Progress (check-in form + chart); Workout screen with mock data until the plan API lands.
