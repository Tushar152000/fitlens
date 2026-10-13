# Releasing the FITR8 app (App Store + Google Play)

The app is `apps/mobile` (Expo SDK 57, EAS Build). Bundle id / package: **`com.fitr8.app`** (permanent
once published). Production talks to `https://www.fitr8.com` (`eas.json`).

## 0. Ready in the code

| Store requirement                               | Where                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sign in with Apple next to Google (Apple 4.8)   | iOS login screen; `POST /api/auth/apple` (identity token + nonce, `apps/api/.../apple/`) |
| In-app account deletion (Apple 5.1.1(v))        | Profile → Delete account; deletes data **and photos** and revokes Sign in with Apple     |
| Privacy policy and terms, in the app and public | `https://www.fitr8.com/privacy`, `/terms`; linked from login, Profile, website footer    |
| Purpose strings                                 | Camera and photo library only; microphone permission removed (`app.json`)                |
| Encryption export question                      | `usesNonExemptEncryption: false` (standard HTTPS only)                                   |

## 1. Accounts (once)

- **Apple Developer Program** ($99/year): developer.apple.com/programs. Individual ≈ 1–2 days;
  organisation needs a D-U-N-S number.
- **Google Play Console** ($25 once): play.google.com/console, with identity verification.

## 2. Sign in with Apple setup (once, before the first iOS build)

1. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → `com.fitr8.app` → enable
   **Sign in with Apple** (EAS creates the identifier on the first build if it doesn't exist).
2. **Keys** → new key → **Sign in with Apple** → primary App ID `com.fitr8.app` → download
   `AuthKey_<KEY_ID>.p8` (downloadable once).
3. Production API settings (Cloud Run → Edit & deploy new revision; keep the key in Secret Manager):

| Variable            | Value                                          |
| ------------------- | ---------------------------------------------- |
| `APPLE_CLIENT_ID`   | `com.fitr8.app`                                |
| `APPLE_TEAM_ID`     | your 10-character Team ID (Membership details) |
| `APPLE_KEY_ID`      | the key's 10-character id                      |
| `APPLE_PRIVATE_KEY` | contents of the `.p8` file (Secret Manager)    |

With `APPLE_CLIENT_ID` set the API refuses to boot in production without the other three
(account deletion must be able to revoke Apple sign-ins). `GET /api/auth/providers` then returns
`apple: true` and the iOS app shows **Continue with Apple**.

## 3. Build and submit

```bash
cd apps/mobile
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios      # → App Store Connect / TestFlight
npx eas-cli@latest submit --platform android  # → Play Console (needs a service account key)
```

EAS manages signing (iOS certificates/profiles, Android keystore). JS-only changes later ship with
`eas update` (the existing `eas-update.yml` workflow); native changes need a new build + review.

## 4. Google Play

1. Create the app (name, default language, app, free).
2. **Closed testing first**: personal developer accounts created after Nov 2023 must run a closed
   test with **≥ 12 testers for 14 continuous days** before applying for production.
3. Store listing (§6), **Data safety** (§7), content rating questionnaire, target audience
   **18+** (or 13+ with the under-18 rules), Health apps declaration (fitness and nutrition, not
   medical), App access (§5).
4. Apply for production → review (usually a few days).

## 5. Reviewer access

- **Apple:** reviewers can tap **Continue with Apple** with their own Apple ID and complete
  onboarding. Add to Review Notes: "Sign in with Apple or Google. After a 4-step onboarding the
  app shows today's targets. Photo meal scanning needs a real meal photo; typing a meal (e.g. '2
  roti, 1 bowl dal') works without one. Free accounts get 3 photo scans a day."
- **Google Play (App access):** create a Google account just for reviewers (e.g.
  `fitr8.review@gmail.com`, no 2-step verification, strong password), sign in once in the app and
  finish onboarding, then enter its email and password under App content → App access with the
  same notes as above. Keep it free of personal data.

## 6. Store listing (draft)

- **Name** (30): `FITR8: Calories & Workouts`
- **Apple subtitle** (30): `Snap meals. Hit your goal.`
- **Play short description** (80): `Snap your meal, see calories and macros, and get a training plan built for your goal.`
- **Keywords** (Apple, 100): `calorie counter,macro tracker,food diary,protein,diet,meal,gym,workout,weight loss,fitness,india`
- **Category:** Health & Fitness
- **Description:**

  > FITR8 turns your goal into daily calories, protein, carbs and fat, and helps you hit them.
  >
  > • Snap your plate: FITR8 finds the foods and portions, you confirm, it's logged. Unsure items are flagged for you to check.
  > • Type a meal in a line, scan a packaged food's barcode, or photograph its nutrition label.
  > • A weekly training plan for the gym, home or anywhere, with targets for every set.
  > • Water target and reminders, weekly check-ins, and a plan that adjusts to your real trend.
  > • An AI coach that knows your plan and your day.
  >
  > Built for Indian meals: roti, dal, rice, sabzi and more. FITR8 gives general fitness guidance, not medical advice.

- **Screenshots:** iPhone 6.9" (1320 × 2868) and Android phone; Today, photo scan, confirm, workout,
  progress. Play also needs a 1024 × 500 feature graphic.
- **Support URL:** `https://www.fitr8.com` · **Privacy policy URL:** `https://www.fitr8.com/privacy`

## 7. Privacy answers (from what the code collects)

Same facts as `/privacy`. Nothing is used for tracking or advertising; nothing is sold.

| Data                                                                     | Collected | Linked to user | Purpose                               |
| ------------------------------------------------------------------------ | --------- | -------------- | ------------------------------------- |
| Name, email, user id (Google/Apple)                                      | Yes       | Yes            | App functionality, account management |
| Health & fitness (body stats, goal, food, water, workouts, medical flag) | Yes       | Yes            | App functionality                     |
| Photos (meals, labels; only ones the user takes or picks)                | Yes       | Yes            | App functionality                     |
| Other user content (typed meals, coach messages)                         | Yes       | Yes            | App functionality                     |
| Location, contacts, microphone, ads id                                   | No        | –              | –                                     |
| Analytics / crash SDKs                                                   | None      | –              | –                                     |

- Play Data safety: data is **encrypted in transit**; users can **request deletion** (in-app);
  transfers to service providers (OpenAI, Google Cloud, Cloudflare, Vercel) are processing on our
  behalf, not "sharing".
- Apple App Privacy: "Data Linked to You" for the rows above; **Data Used to Track You: none**.

## 8. Before submitting

- [ ] Privacy policy and terms reviewed by you (and ideally a lawyer); FAQ/landing claims signed off.
- [ ] Production API has the Apple settings (§2); `GET https://www.fitr8.com/api/auth/providers` → `apple: true`.
- [ ] Google OAuth consent screen **published** (Testing mode caps sign-in at 100 test users).
- [ ] Reviewer Google account created and onboarded (§5).
- [ ] Test on a real iPhone via TestFlight: Continue with Apple, Google, photo scan, delete account.
