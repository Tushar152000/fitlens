# FITR8 website and web redesign

Build contract for the public website (`/`), the desktop web app shell, and the onboarding redesign
that comes next. App screens and tokens live in [DESIGN.md](DESIGN.md); architecture rules in
[ARCHITECTURE.md](ARCHITECTURE.md). Approved prototype of the landing page:
[FITR8 Website artifact](https://claude.ai/artifact/MuywVVqmy7Qy7k3CCNNVRF).

| Part                           | Status                         | Where                                                   |
| ------------------------------ | ------------------------------ | ------------------------------------------------------- |
| Landing page `/`               | Built                          | `apps/web/src/app/(marketing)/`                         |
| Desktop app shell (lg+)        | Built                          | `apps/web/src/components/side-nav.tsx`, `(app)/(tabs)/` |
| Onboarding (`/welcome` → plan) | Next: to be designed and built | `apps/web/src/app/(welcome)/`, `(app)/onboarding/`      |
| Footer pages (About, Privacy…) | Not designed                   | Footer lists them as plain text until the pages exist   |

## 1. Landing page

### Look

- **Font:** Plus Jakarta Sans only (variable, `marketingFontVars` in `src/lib/fitr8-fonts.ts`,
  utility `font-jakarta`). Headings semibold (600), body regular, tracking −0.025em on headings.
  Only the "FITR8" wordmark is extrabold. No serif, no second family.
- **Colours:** the `--color-fitr8*` tokens in `globals.css` (brand `#8116E0`, deep `#29004D`,
  lilac `#E0B8FF`, lilac-soft `#F3E8FF`, night `#151824`, soft `#F6F6F8`, footer `#101010`) plus the
  app's protein / carbs / fat / caution colours for nutrition data.
- **Signature:** a hard deep-purple offset shadow (`shadow-hard-sm|hard|hard-hover|hard-press|hard-lg`)
  on things you can press or try: CTAs, the scan demo, the feature stage, the story card. Buttons
  lift on hover (−2 px, bigger shadow) and press into the shadow on click (`hardButton` in
  `_components/cta.ts`). Nothing else gets a shadow.
- **Highlight pill:** a word set on a white pill on purple, or a purple pill on light sections
  (`PillWord`).
- **Width:** content column max **1300 px** with 16 / 24 / 40 px gutters (phone / sm / lg). Bands
  run full-bleed.
- **Light only.** The marketing site has no dark theme.

### Sections (in order)

| #   | Section               | Component                             | Content and interaction                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Header + section dock | `site-header.tsx`, `section-dock.tsx` | Sticky top bar: logo, Log in → `/login`, Start for free → `/welcome`; purple over the hero, white with blur once scrolled. Section links (Features · How it works · Your numbers · Results · FAQ) sit in a floating pill fixed to the bottom of the screen; the section in view is filled purple. On phones the pill scrolls sideways.    |
| 2   | Hero                  | `hero.tsx`                            | "Free" eyebrow, H1 "The world’s / #1 nutrition & progress / tracking app", lede, Start for free + "See how it works", then an `AppComingSoon` pill ("The FITR8 app is coming soon to the App Store and Google Play"). Faint white FITR8 mark in the background.                                                                           |
| 2a  | Scan demo             | `scan-demo.tsx`                       | Plate photo scans on load (lilac line, 1.3 s), then 6 food chips pop in (90 ms stagger) and the result card rises. Tap a chip ↔ highlights its row. ± steppers change portions; kcal counts to the new total. The dressing is the amber "Not sure, check this" item; adjusting it flips the badge to "All checked". "Scan again" replays. |
| 3   | Track band            | `track-band.tsx`                      | Night band, "Track [Nutrition / Workout / Progress] at one place" (word rotates every 1.8 s, `RotatingWord`), chips for every way to log.                                                                                                                                                                                                 |
| 4   | Features              | `features.tsx`                        | Vertical tablist of 5 features beside the matching app screen. Auto-advances every 6 s while on screen (progress bar on the active tab); hover or focus pauses; arrow keys move.                                                                                                                                                          |
| 5   | How it works          | `how-it-works.tsx`                    | Three numbered steps (a real sequence): Set your goal · Log in seconds · Get your next move, each with a small app preview. Cards lift with the hard shadow on hover.                                                                                                                                                                     |
| 6   | Your numbers          | `target-calculator.tsx`               | Goal, sex, age, height, weight, activity → daily kcal (counts up), protein / carbs / fat bars, BMR, maintenance, water, and one line with the numbers behind the target. Validation messages under the form. "Start with these numbers" → `/welcome`.                                                                                     |
| 7   | Stats                 | `stats.tsx`                           | Purple band, "…and everything in between.", 100+ / 50+ / 7 days count up once when scrolled into view, app screens image.                                                                                                                                                                                                                 |
| 8   | Results               | `testimonials.tsx`                    | One quote at a time (light-weight sans), initial avatar, arrows, dots, 7 s autoplay that restarts after a manual change.                                                                                                                                                                                                                  |
| 9   | FAQ                   | `faq.tsx`                             | Sticky title + "Still have questions?" card (email with a Copy button; falls back to selecting the text). Accordion, one open at a time, animated height.                                                                                                                                                                                 |
| 10  | Final CTA             | `final-cta.tsx`                       | "Your next meal is a good place to start." + Start for free + compact `AppComingSoon` ("App coming soon on iOS & Android").                                                                                                                                                                                                               |
| 11  | Footer                | `site-footer.tsx`                     | Wordmark, line, social icons, company links (Privacy Policy → `/privacy`, Terms of Use → `/terms`, Reviews → results; the rest plain text until the pages exist), contact, legal line.                                                                                                                                                    |

### Calculator rules

The numbers come from `previewTarget()` in `packages/domain/src/nutrition/preview.ts` (unit-tested),
never from the page. It runs `planGoal`, the same rules as onboarding, with an assumed pace because
there's no dated goal yet: fat loss 0.75% of body weight a week, muscle gain 0.25%, recomposition a
5% deficit, all over 12 weeks. The usual caps still apply: 1% / 0.5% rate caps, deficit at most 25% of
maintenance, surplus 5–15%, calorie floor (1,500 men / 1,200 women, never below BMR), no deficit
under 18. Water = the rest-day `waterTarget`. Nothing is sent to the API.

Example (male, 29, 176 cm, 82 kg, lightly active, lose fat): BMR 1,780, maintenance 2,448,
target **1,836 kcal** (2,448 − 612, the 25% cap), P 148 g · C 197 g · F 51 g, water 3.0 L,
≈ 0.6 kg a week.

### Motion and accessibility

- Every animation is 150–420 ms ease-out and off under `prefers-reduced-motion` (scan, rotation,
  autoplay, count-ups and stagger all skip).
- The page is complete at rest: stats render their real numbers before counting, quotes and chips
  are in the HTML.
- Real buttons, tabs (`role="tablist"`), accordion regions with `aria-expanded`, `aria-live` on the
  scan result, calculator result and quote. Images have alt text; decorative marks are
  `aria-hidden`.
- No horizontal scroll at 390 px. Below 560 px chips drop their kcal and the result card sits under
  the photo.

### Legal pages

`/privacy` and `/terms` (`(marketing)/privacy`, `/terms`, shared `LegalPage`) are linked from the
footer, onboarding's sign-in step, `/login` and the app's login and Profile screens. The privacy
policy states only what the code does (see docs/STORE.md §7); update both when data handling
changes.

### Before launch

- **Testimonials are placeholders.** Only Rahul's quote is in Figma; the other four were written for
  design review. Replace all five with real member stories (with consent) before the site goes
  public.
- **FAQ "Is FITR8 free?"** follows the free tier in DESIGN.md (3 photo scans a day; typing and
  usuals free). Needs product sign-off, like answers 2–4.
- **"World’s #1"** is the Figma headline; confirm the claim is one you can stand behind.
- **QR code and store badges** were removed (the QR was a stock placeholder that opened nothing). Once the apps are published, swap `AppComingSoon` (hero, final CTA) and the `GetAppCard` copy for a real QR and store links.
- Unused Figma exports in `public/landing/` (testimonial photos, deco SVGs, hero outline mask) can be
  deleted once the old design is no longer needed for reference.

## 2. Desktop web app shell (not reachable on the web)

The web no longer shows the full app: `/today`, `/workout`, `/progress`, `/history`, `/profile`,
`/log/*` and `/coach` redirect to `/home` (§4); logging happens in the phone app. The shell below
stays in the code (`side-nav.tsx`, `(app)/(tabs)/`) in case the web app comes back. The full rules
are in DESIGN.md → "Desktop app shell".

- From `lg` (1024 px) the tab screens show `SideNav` (256 px: logo, Log a meal, Type a meal, Today ·
  Workout · Progress · History · Coach, profile card) instead of the bottom `TabBar`. Shortcuts:
  `L` log, `T` type, `1`–`5` nav, `6` profile.
- Content up to 1120 px; Today, Workout, Progress and History are two columns with a sticky right
  column; Profile flows into two columns.
- Today's calorie card has water (+250 / +500 ml, undo, "why this target") from `GET/POST/DELETE
/api/water`.
- Motion: page fade-in (`(tabs)/template.tsx`), ring draw-in, bar fill, `lift` hover on cards,
  button press.
- Full-screen flows (`/log/*`, `/coach`, `/onboarding`) stay a 480 px column (`AppColumn`).

## 3. Onboarding

Built. Prototype: [FITR8 Onboarding artifact](https://claude.ai/artifact/47PvZuio6rfYMLr1o16LFp).
One flow in the landing page's look (Plus Jakarta Sans, FITR8 purple, hard-shadow buttons) for
every entry point. Code: `src/components/onboarding/` (shell, steps, flow, building animation),
`src/lib/onboarding/` (draft rules, live estimate, sessionStorage handoff), pages under
`(welcome)/welcome/` and `(app)/onboarding/`.

### Entry points

| Mode      | Starts at     | Who                                        | Steps (rail)                                                                                             |
| --------- | ------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `welcome` | `/welcome`    | Signed out, from "Start for free"          | Your name · Your goal · About you · Food and training · Save your plan · Your daily target · Get the app |
| `new`     | `/onboarding` | Signed in, not onboarded (e.g. via /login) | Your goal · About you · Food and training · Your daily target · Get the app                              |
| `edit`    | `/onboarding` | Onboarded, changing the goal from Profile  | Your goal · About you · Food and training · Your daily target (then Today)                               |

Signed-in visitors to `/welcome` are sent to `/onboarding` (or `/today` if onboarded).
`/welcome/name` redirects to `/welcome`.

### Flow

1. **Your name** (welcome only). "Already have an account? Log in" → `/login`.
2. **Your goal**, **About you**, **Food and training**: the same fields, options and validation
   messages as the mobile app (`apps/mobile/src/app/onboarding/`) via `lib/onboarding/draft.ts`.
3. **Save your plan** (welcome only): "Continue with Google" → `/api/auth/google?returnTo=/welcome/done`
   (dev email login locally). Answers are stashed in sessionStorage when this step opens.
4. **Building your plan**: full-screen ring + three ticks, at least 2.6 s. Signed out it runs on
   `/welcome/done` after sign-in (saves the name, then `POST /api/onboarding`); signed in it runs
   in place. If saving fails, the answers go back into storage and `/onboarding` reopens with them.
5. **Your daily target** (`/onboarding/plan?flow=…`): Realistic goal, dark target card
   (maintenance ± deficit, macro split), now → goal line, BMI / BMR / workouts, warnings. "Too fast
   to be safe" variant with Keep the goal / Keep the date (`POST /api/goal/option`).
6. **Get the app** (`/onboarding/app`): a "The FITR8 app is coming soon" card (no QR or store badges until the apps are published); phones also show
   "Already have the app? Open it" (`fitlens://today`) for beta testers. This is the end of onboarding: there is
   no "continue on the web" button, so new users are sent to the phone app.
7. Signed in again later on the web → `/home` (§4).

### Layout

- **Desktop (lg):** 340 px purple rail (logo, steps with ticks, reached form steps clickable, live
  estimate card with the hard shadow, "Log in" link) + one question column (640 px; 860 px on the
  plan and app screens). The footer button sits under the content and sticks to the bottom only when
  a step is taller than the screen.
- **Phones:** logo + estimate chip (tap for the breakdown), 5-segment progress bar and "Step n of
  5", one column, Continue pinned to the bottom.

### Live estimate

`estimateFromDraft()` (unit-tested) runs `planGoal` from `@fitr8/domain` on the answers so far:
the landing-page preview pace until the goal step is complete, then the real goal. Display only;
the API computes the saved plan. Until there's a date of birth it uses the calculator's age.

### Calculator handoff

"Start with these numbers" on the landing page stores goal, sex, age, height, weight and activity in
sessionStorage. The flow prefills those fields, marks them "From the home page" until changed, says
"On the home page you said you're 29" under date of birth, and offers "start blank".

### Not in this change

- The mobile app's onboarding (`apps/mobile`) keeps its current look; the questions and rules
  already match.
- `/login` is restyled to match (purple panel on desktop, "Welcome back", link to `/welcome`).

## 4. Signed-in web home (`/home`)

What a returning user sees after signing in on the web: basic information, read-only, in the
website's look (no sidebar, no logging). `/login`, `/welcome` (signed in), `/welcome/done`
(already onboarded) and the PWA start URL all land here.

- **Header:** logo → `/`, name and initial.
- **Hi, {name}** with today's date and one line: log in the app, your numbers show up here.
- **Today so far:** kcal left and meals logged; calories, protein and water bars vs target
  (`GET /api/dashboard`, `GET /api/water`).
- **Your daily target:** dark card with kcal, protein / carbs / fat, goal, weight now → goal with
  the date, training days and minutes (`GET /api/plan`).
- **Log in the app:** `GetAppCard` ("The FITR8 app is coming soon"; phones also get the "Already have the app? Open it" deep link).
- **Account:** name and email, Edit my plan (→ `/onboarding`, back to `/home` after saving),
  Export my data (CSV), Sign out, Delete account.
