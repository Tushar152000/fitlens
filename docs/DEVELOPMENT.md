# Local development

Everything you need to run FITR8 (API, web app, mobile app) on your machine. No accounts are needed: sign-in, AI and storage all work offline-style locally. Commands run from the repo root.

## 1. One-time setup

### Prerequisites

| Tool                          | Version                       | Check                         | Install                                                                       |
| ----------------------------- | ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| Node.js                       | **22** (from `.nvmrc`)        | `node -v`                     | [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`                        |
| pnpm                          | 10 (pinned in `package.json`) | `pnpm -v`                     | `nvm use && corepack enable` (ships with Node)                                |
| Docker + Compose              | any recent                    | `docker compose version`      | [docker.com](https://docs.docker.com/get-docker/), and make sure it's running |
| Expo Go _(phone only)_        | latest                        | —                             | Play Store / App Store                                                        |
| Android SDK _(emulator only)_ | —                             | see [§5](#5-android-emulator) | —                                                                             |

Node 23 and other odd-numbered versions break Prisma. Run `nvm use` in **every new terminal**, or make 22 your default once with `nvm alias default 22`.

### Install and bootstrap

```bash
git clone <repo> && cd fitlens
nvm use
corepack enable          # once per Node install: provides the right pnpm
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` sets up and repairs the local environment, and is safe to re-run any time:

- creates `.env` from `.env.example` and generates `AUTH_SECRET`
- picks free ports for Postgres, Redis and MinIO if the defaults are taken (and updates the URLs in `.env`)
- starts the Docker services, applies migrations, seeds foods and exercises
- points the mobile app at your laptop (`apps/mobile/.env`) and picks a Metro port

It never overwrites a value you set.

## 2. Daily use

| You want                                 | Run                                                      | Then                                                                |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| **Everything** (API, web, emulator, app) | `pnpm start:all`                                         | The app opens in the Android emulator. Web at http://localhost:3000 |
| API + web only                           | `pnpm dev`                                               | Open http://localhost:3000                                          |
| App on your phone                        | `pnpm dev` (terminal 1), `pnpm dev:mobile` (terminal 2)  | Scan the QR code with Expo Go, on the same Wi-Fi                    |
| App on the emulator                      | `pnpm dev` (terminal 1), `pnpm dev:android` (terminal 2) | Opens in the emulator                                               |
| **Stop everything**                      | `pnpm stop:all`                                          | Servers, Expo, emulator and Docker stop. Data is kept               |

- **`pnpm start:all`:**
  - writes API and web logs to `.dev/servers.log` (`tail -f .dev/servers.log`); only errors and warnings show in the terminal
  - `Ctrl+C` stops the servers and Expo
  - the emulator stays open for next time (`pnpm stop:all` closes it)
- **Every start command first:** checks Node, starts Docker if needed, applies new migrations, and stops your own leftover dev servers on the app's ports. So after a reboot or a `git pull`, just run the command again.
- **Signing in locally:** tap **"Sign in with email (dev)"** on web or in the app and enter any email. No Google account is needed. See [§4](#4-sign-in-locally) for real Google sign-in.
- **Reloading the app:** press `r` in the Expo terminal, or `Ctrl+M` in the emulator (shake the phone) for the dev menu.

## 3. How the local stack fits together

```
Phone / emulator (Expo Go)                 Your laptop
  app code   ◄──────────────────  Metro bundler :METRO_PORT (pnpm dev:mobile)
  API calls  ──http://<LAN-IP>:3000──►  Next.js web :3000 ──/api/*──►  Nest API :4000 ──► Postgres · Redis · MinIO (Docker)
Browser ───────────http://localhost:3000──┘
```

- The app calls the **web server** (`EXPO_PUBLIC_API_URL`), which forwards `/api/*` to the API, the same as production. The browser uses a session cookie, the app a bearer token, and the API treats both the same.
- **Ports:**
  - web **3000**, API **4000** (`PORT`), Metro **`METRO_PORT`** (8081, or the first port not owned by another user)
  - Docker: Postgres 5432, Redis 6379, MinIO 9000 (console 9001), moved automatically if taken
- **Environments:** locally `APP_ENV=local`: dev sign-in on, mock AI, http allowed. Staging and production are strict; see `docs/DEPLOY.md` and the README "Environments" table.

## 4. Sign-in locally

| Method                       | Web (laptop)                                   | Phone / emulator       |
| ---------------------------- | ---------------------------------------------- | ---------------------- |
| **Sign in with email (dev)** | ✓                                              | ✓                      |
| **Continue with Google**     | ✓ at http://localhost:3000 _(not your LAN IP)_ | Needs a tunnel (below) |

**Google on web:**

1. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`.
2. Make sure the OAuth client lists the redirect URI `http://localhost:3000/api/auth/callback/google`.
3. If the consent screen is in Testing mode, add your account as a test user.

**Google on a phone:** Google won't redirect to `localhost` or private IPs, so give your laptop a public https address:

1. `cloudflared tunnel --url http://localhost:3000` prints `https://<name>.trycloudflare.com`.
2. Set `PUBLIC_URL` in `.env` and `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to it.
3. Add `https://<name>.trycloudflare.com/api/auth/callback/google` to the OAuth client.
4. Restart `pnpm dev` and Expo.

To test with Google only, set `AUTH_DEV_LOGIN="false"` in `.env`.

## 5. Android emulator

`pnpm start:all` / `pnpm dev:android` create a **"fitlens"** emulator on first use (Pixel 8, newest installed Android, 4 GB RAM, laptop keyboard enabled) and boot it. `pnpm emulator` just boots it. The first boot takes about 2 minutes; later ones about 20 seconds.

You need an Android SDK with the emulator. The scripts use the first of `ANDROID_HOME`, `ANDROID_SDK_ROOT` or `~/Android/Sdk` that has one, so an old system SDK doesn't get in the way. Install with Android Studio, or without it (Linux, about 5.5 GB):

```bash
mkdir -p ~/Android/Sdk/cmdline-tools && cd /tmp
# Current link: developer.android.com/studio → "Command line tools only"
curl -LO https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
unzip -q commandlinetools-linux-*_latest.zip && mv cmdline-tools ~/Android/Sdk/cmdline-tools/latest
yes | ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses
~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "emulator" "system-images;android-36;google_apis;x86_64"
```

On Linux, hardware acceleration needs KVM (`ls -l /dev/kvm` must be readable and writable by you). On Apple Silicon, install the `arm64-v8a` image instead of `x86_64`.

## 6. Common tasks

| Task                                              | Command                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Run every check CI runs                           | `pnpm check` (needs Docker for the e2e tests)                 |
| Format                                            | `pnpm format`                                                 |
| New migration after editing `schema.prisma`       | `pnpm db:migrate -- --name <change>`                          |
| Re-seed foods and exercises                       | `pnpm db:seed`                                                |
| Browse the database                               | `pnpm db:studio`                                              |
| Reset the local database (**deletes local data**) | `pnpm stop:all && docker compose down -v && pnpm bootstrap`   |
| Real AI instead of mock                           | `.env`: `AI_PROVIDER="anthropic"` and `ANTHROPIC_API_KEY="…"` |

## 7. Troubleshooting

| Symptom                                                        | Cause                                                                     | Fix                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found`                                      | corepack not enabled for this Node version                                | `nvm use && corepack enable`                                                                              |
| `✗ Node 22 is required` / Prisma errors about the Node version | Wrong Node in this terminal                                               | `nvm use`                                                                                                 |
| `Port … is held by another user or a system service`           | Something outside your user owns the port; the scripts never kill it      | Free it, or for Metro set another `METRO_PORT` in `.env`                                                  |
| `Docker is installed but not running`                          | Docker daemon stopped                                                     | Start Docker (Linux: `sudo systemctl start docker`)                                                       |
| App says "Couldn't reach FITR8"                                | Phone not on the same Wi-Fi, laptop IP changed, or `pnpm dev` not running | Open `http://<LAN-IP>:3000` in the phone's browser to test; `pnpm bootstrap` updates the IP               |
| QR code won't open on the phone                                | Network blocks device-to-laptop traffic (guest/office Wi-Fi)              | `pnpm dev:mobile --tunnel` (tunnels Metro only; the API still needs the same network or a tunnel, see §4) |
| `expo-notifications … removed from Expo Go`                    | Expo Go on Android can't load notifications                               | Handled: reminders are off in Expo Go on Android. Use a development build to test them                    |
| Google: `redirect_uri_mismatch`                                | The OAuth client doesn't list the callback for this address               | Add it (§4)                                                                                               |
| Google: "Access blocked"                                       | Consent screen in Testing mode                                            | Add your account as a test user                                                                           |
| `No Android SDK with an emulator found`                        | SDK missing, or still installing                                          | §5                                                                                                        |
| Emulator boots but is very slow                                | No hardware acceleration                                                  | Check `/dev/kvm` (Linux), or close other VMs                                                              |
| Login page shows a Google error from the API                   | Message comes from the sign-in check that failed                          | See `docs/ARCHITECTURE.md` §3.6; full details in the API logs                                             |

If something else breaks, `pnpm bootstrap` repairs most local setup issues, and `.dev/servers.log` has the API and web logs.
