# FitLens mobile (Expo) — `@fitlens/mobile`

The React Native app for FitLens, one workspace of the pnpm + Turborepo monorepo. It is UI only: every
screen calls the same `/api/*` routes as the web app, served by `apps/api` (see `docs/ARCHITECTURE.md`).

- Expo SDK 57, Expo Router (`src/app` = screens), TanStack Query for data.
- UI follows `docs/DESIGN.md`; tokens are in `src/lib/theme.ts`, components in `src/components/ui`.
- Request types and the coach stream events come from `@fitlens/contracts` (`packages/contracts`).
  Response shapes the contracts package doesn't define yet live in `src/lib/types*.ts`.
- A few pure modules are copied from the web app and must stay in step: `src/lib/format.ts`,
  `onboarding-draft.ts`, `meal-rows.ts`, `barcode.ts`, `label.ts` (each says where it came from).

## Monorepo notes

- Install once from the repo root: `pnpm install`. Never run `npm install` here — there is no
  `package-lock.json`; the lockfile is the root `pnpm-lock.yaml`. Add Expo packages with
  `npx expo install <pkg>` from this folder so versions match the SDK.
- The root `.npmrc` sets `node-linker=hoisted`, so everything resolves from the root `node_modules`.
- Metro: Expo detects the workspace and sets `watchFolders` / `nodeModulesPaths` itself;
  `metro.config.js` only stops it watching the sibling apps.
- `@fitlens/contracts` is consumed from its build output (`packages/contracts/dist`). Build it after a
  fresh clone or a contracts change: `pnpm turbo run build --filter=@fitlens/contracts` (or `pnpm build`).

## Run it

From the repo root:

```sh
pnpm dev:api        # API on http://localhost:4000 (needs pnpm infra:up, see the root README)
pnpm dev:mobile     # Expo dev server for this app (same as `pnpm start` in apps/mobile)
```

Point the app at a server in `apps/mobile/.env` (git-ignored):

| Variable              | Value                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Origin of the API, no trailing slash. Unset = the deployed site. Local API from a phone on the same Wi-Fi: `http://<your-computer-ip>:4000`; web preview: `http://localhost:4000`. |

- Phone: install **Expo Go**, run `pnpm dev:mobile`, scan the QR code.
- Browser preview for quick checks: `pnpm --filter @fitlens/mobile web`. The API allows CORS from
  `http://localhost:8081` (`CORS_ORIGINS` in the root `.env`).
- Google sign-in needs the deployed https site; local is mainly for the browser preview.
- `EXPO_PUBLIC_*` values are inlined at bundle time: restart Expo with `--clear` after changing them.

## Sign-in

The app opens `GET /api/mobile/start` in the system browser (Google sign-in on the web), gets a
one-time code back on `fitlens://auth` (or `exp://…/--/auth` in Expo Go), and trades it plus a PKCE
verifier at `POST /api/mobile/token` for a session token. The token is stored in the Keychain /
Keystore and sent as `Authorization: Bearer …` (`src/lib/api.ts`).

## Coach chat

`src/app/coach.tsx` (opened from "Ask your coach" on Today) posts to `POST /api/coach/chat` and reads
the `text/event-stream` reply with `apiStream()` in `src/lib/api.ts`, which uses `fetch` from
`expo/fetch` because React Native's global fetch can't stream. The open thread's id is kept in secure
storage (`src/lib/coach-store.ts`) so reopening continues it; "New chat" starts a fresh one.

## Builds and updates (EAS)

Run EAS from this folder (`apps/mobile`); it uploads the whole workspace and installs with pnpm
(Node and pnpm versions are pinned in `eas.json` → `build.base`).

```sh
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview     # APK + install link for testers
npx eas-cli@latest build -p ios --profile production      # needs an Apple Developer account
npx eas-cli@latest submit -p ios                          # App Store Connect, then TestFlight
npx eas-cli@latest update --channel preview -m "Fix …"    # JS-only fix over the air, no rebuild
```

- Build profiles set `EXPO_PUBLIC_API_URL` in `eas.json`; OTA updates use the channel of the build.
- **Android:** `preview` makes an APK anyone with the link can install. Play Store needs an AAB
  (`production`) and a Google Play developer account.
- **iOS:** ship through TestFlight.
- `runtimeVersion` follows the app version: bump `version` in `app.json` when native code or config
  changes, or old builds will receive updates they can't run.

## Checks

```sh
cd apps/mobile
npx tsc --noEmit && npx expo lint && npx expo-doctor
```

From the root, `pnpm typecheck` / `pnpm lint` include this app.
