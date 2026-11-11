#!/usr/bin/env bash
# Read-only pre-release check: is everything the Deploy workflow and the apps need actually in place?
# Changes nothing. Run after `gcloud auth login` (and `gh auth login`):
#
#   PROJECT_ID=fitlens-prod infra/release-check.sh
#   LIVE_ONLY=1 PUBLIC_URL=https://www.fitr8.com API_PUBLIC_URL=https://api.fitr8.com infra/release-check.sh
#     (just the live web + API checks: no gcloud/gh needed; also works against the local stack)
#
# Checks GitHub variables/secrets, Secret Manager, IAM, Cloud SQL, Cloud Run, the API load balancer,
# DNS, and the live web + API. ✅ ok · ⚠️ works but worth a look · ❌ must be fixed (exit code 1).
# What it can't see (Google OAuth console, Vercel and EAS settings) is listed at the end: docs/RELEASE.md.
# `cond && report || report`: the report helpers always succeed, so this is a safe if/else.
# shellcheck disable=SC2015
set -uo pipefail

LIVE_ONLY="${LIVE_ONLY:-}"
[ "$LIVE_ONLY" = 1 ] || : "${PROJECT_ID:?set PROJECT_ID, e.g. fitlens-prod}"
REGION="${REGION:-asia-south1}"
SQL_INSTANCE="${SQL_INSTANCE:-fitlens-db}"
SERVICE="${SERVICE:-fitlens-api}"
REPO="${GITHUB_REPO:-}"
# Filled from GitHub variables below; LIVE_ONLY takes them from the environment.
PUBLIC_URL="${PUBLIC_URL:-}"
API_PUBLIC_URL="${API_PUBLIC_URL:-}"
APPLE_CLIENT_ID="${APPLE_CLIENT_ID:-}"

FAILS=0
WARNS=0
ok() { printf '  \033[32m✅\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠️ \033[0m %s\n' "$*"; WARNS=$((WARNS + 1)); }
bad() { printf '  \033[31m❌\033[0m %s\n' "$*"; FAILS=$((FAILS + 1)); }
section() { printf '\n\033[1m%s\033[0m\n' "$*"; }
g() { gcloud --project="$PROJECT_ID" "$@" 2>/dev/null; }

if [ "$LIVE_ONLY" != 1 ]; then
[ -n "$REPO" ] || REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)"
section "Tools"
if command -v gcloud >/dev/null && [ -n "$(gcloud config get account 2>/dev/null)" ]; then
  ok "gcloud signed in as $(gcloud config get account 2>/dev/null)"
else
  bad "gcloud not signed in: gcloud auth login"
fi
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1 && [ -n "$REPO" ]; then
  ok "gh signed in; repository $REPO"
  HAVE_GH=1
else
  bad "gh not signed in (gh auth login), or GITHUB_REPO unknown"
  HAVE_GH=0
fi
if g projects describe "$PROJECT_ID" >/dev/null; then
  ok "project $PROJECT_ID reachable"
else
  bad "project $PROJECT_ID not reachable with this account (ask the owner for access)"
  echo
  echo "Stopping: nothing else can be checked without the project."
  exit 1
fi

# ---------- GitHub ----------
var() { [ "$HAVE_GH" = 1 ] && gh variable get "$1" --repo "$REPO" 2>/dev/null; }
section "GitHub repository variables"
if [ "$HAVE_GH" = 1 ]; then
  for v in GCP_PROJECT_ID GCP_REGION GCP_WIF_PROVIDER GCP_DEPLOYER_SA GCP_RUNTIME_SA GCP_SQL_CONNECTION \
    S3_BUCKET PUBLIC_URL API_PUBLIC_URL AUTH_COOKIE_DOMAIN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
    value="$(var "$v")"
    if [ -n "$value" ]; then ok "$v = $value"; else bad "$v is not set"; fi
  done
  for v in AI_PROVIDER API_MIN_INSTANCES APPLE_CLIENT_ID REVENUECAT_ENABLED PAYWALL_ENABLED; do
    value="$(var "$v")"
    if [ -n "$value" ]; then ok "$v = $value"; else warn "$v not set (default applies)"; fi
  done
  section "GitHub repository secrets (names only)"
  secrets="$(gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null)"
  for s in VERCEL_TOKEN EXPO_TOKEN; do
    if grep -qx "$s" <<<"$secrets"; then ok "$s present"; else bad "$s missing (Settings → Secrets → Actions)"; fi
  done
fi
PUBLIC_URL="${PUBLIC_URL:-$(var PUBLIC_URL)}"
API_PUBLIC_URL="${API_PUBLIC_URL:-$(var API_PUBLIC_URL)}"
APPLE_CLIENT_ID="$(var APPLE_CLIENT_ID)"
REVENUECAT_ENABLED="$(var REVENUECAT_ENABLED)"
PAYWALL_ENABLED="$(var PAYWALL_ENABLED)"
AI_PROVIDER="$(var AI_PROVIDER)"
AI_PROVIDER="${AI_PROVIDER:-openai}"

# ---------- Secret Manager ----------
section "Secret Manager (the API's secrets)"
RUNTIME_SA="fitlens-api@$PROJECT_ID.iam.gserviceaccount.com"
required=(DATABASE_URL AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY)
if [ "$AI_PROVIDER" = anthropic ]; then required+=(ANTHROPIC_API_KEY); else required+=(OPENAI_API_KEY); fi
[ -n "$APPLE_CLIENT_ID" ] && required+=(APPLE_TEAM_ID APPLE_KEY_ID APPLE_PRIVATE_KEY)
[ "$REVENUECAT_ENABLED" = true ] && required+=(REVENUECAT_SECRET_KEY REVENUECAT_WEBHOOK_AUTH)
for s in "${required[@]}"; do
  if [ -z "$(g secrets versions list "$s" --filter=state=ENABLED --limit=1 --format='value(name)')" ]; then
    bad "$s: no enabled version"
  elif g secrets get-iam-policy "$s" --format=json | grep -q "serviceAccount:$RUNTIME_SA"; then
    ok "$s (readable by the API)"
  else
    bad "$s exists but the API's service account can't read it (re-run infra/gcp/setup.sh)"
  fi
done
[ -z "$APPLE_CLIENT_ID" ] && warn "Sign in with Apple off (APPLE_CLIENT_ID unset): needed before an iOS App Store release"
if [ "$PAYWALL_ENABLED" = true ] && [ "$REVENUECAT_ENABLED" != true ]; then
  bad "PAYWALL_ENABLED=true without RevenueCat: the API will refuse to boot"
fi

# ---------- Cloud SQL ----------
section "Cloud SQL"
sql="$(g sql instances describe "$SQL_INSTANCE" --format='value(state,settings.tier,settings.backupConfiguration.enabled,settings.backupConfiguration.pointInTimeRecoveryEnabled,databaseVersion)')"
if [ -z "$sql" ]; then
  bad "instance $SQL_INSTANCE not found"
else
  read -r state tier backups pitr version <<<"$sql"
  [ "$state" = RUNNABLE ] && ok "$SQL_INSTANCE $version is running" || bad "$SQL_INSTANCE state $state"
  case "$tier" in
    db-f1-micro | db-g1-small) warn "tier $tier is shared-core (no SLA): setup.sh moves it to db-custom-1-3840" ;;
    *) ok "tier $tier (dedicated core)" ;;
  esac
  [ "$backups" = True ] && ok "daily backups on" || bad "backups off"
  [ "$pitr" = True ] && ok "point-in-time recovery on" || warn "point-in-time recovery off"
fi

# ---------- Cloud Run ----------
section "Cloud Run ($SERVICE)"
svc="$(g run services describe "$SERVICE" --region="$REGION" --format=json)"
if [ -z "$svc" ]; then
  bad "service not deployed yet (push to main or run the Deploy workflow)"
else
  ready="$(jq -r '.status.conditions[] | select(.type=="Ready") | .status' <<<"$svc")"
  [ "$ready" = True ] && ok "latest revision ready" || bad "service not ready"
  min="$(jq -r '.spec.template.metadata.annotations["autoscaling.knative.dev/minScale"] // "0"' <<<"$svc")"
  [ "$min" -ge 1 ] 2>/dev/null && ok "min instances $min (no cold starts)" || warn "min instances $min: first requests after idle wait for a cold start"
  envs="$(jq -r '.spec.template.spec.containers[0].env[]? | .name' <<<"$svc")"
  for e in API_PUBLIC_URL AUTH_COOKIE_DOMAIN PUBLIC_URL; do
    grep -qx "$e" <<<"$envs" && ok "$e set on the service" || bad "$e not set on the service (redeploy after setting the variable)"
  done
  if grep -qx REDIS_URL <<<"$envs"; then
    warn "REDIS_URL is set: meal analysis is queued, so a worker service (APP_ROLE=worker) must be running"
  fi
fi

# ---------- Load balancer + DNS ----------
API_HOST="$(printf '%s' "$API_PUBLIC_URL" | sed -E 's#^https?://##; s#[:/].*$##')"
section "API domain ($API_HOST)"
lb_ip="$(g compute addresses describe fitlens-api-ip --global --format='value(address)')"
cert="$(g compute ssl-certificates describe fitlens-api-cert --global --format='value(managed.status)')"
[ -n "$lb_ip" ] && ok "load balancer IP $lb_ip" || bad "no load balancer: run infra/gcp/api-domain.sh"
case "$cert" in
  ACTIVE) ok "certificate ACTIVE" ;;
  "") bad "no certificate (infra/gcp/api-domain.sh)" ;;
  *) bad "certificate $cert (needs the DNS record; can take up to an hour after DNS resolves)" ;;
esac
if [ -n "$API_HOST" ]; then
  resolved="$(getent ahostsv4 "$API_HOST" 2>/dev/null | awk 'NR==1{print $1}')"
  if [ -z "$resolved" ]; then
    bad "$API_HOST does not resolve: add an A record → $lb_ip"
  elif [ -n "$lb_ip" ] && [ "$resolved" != "$lb_ip" ]; then
    bad "$API_HOST resolves to $resolved, not the load balancer $lb_ip"
  else
    ok "$API_HOST → $resolved"
  fi
fi

fi # LIVE_ONLY

# ---------- Live ----------
section "Live checks"
if [ -n "$API_PUBLIC_URL" ]; then
  health="$(curl -fsS -m 15 "$API_PUBLIC_URL/api/health" 2>/dev/null)"
  [[ "$health" == *'"db":"ok"'* ]] && ok "$API_PUBLIC_URL/api/health → $health" || bad "API health failed: ${health:-no response}"
  providers="$(curl -fsS -m 15 "$API_PUBLIC_URL/api/auth/providers" 2>/dev/null)"
  [[ "$providers" == *'"google":true'* ]] && ok "Google sign-in on" || bad "Google sign-in off: $providers"
  if [ -n "$APPLE_CLIENT_ID" ]; then
    [[ "$providers" == *'"apple":true'* ]] && ok "Sign in with Apple on" || bad "Apple configured but the API reports it off"
  fi
  [[ "$providers" == *'"dev":false'* ]] && ok "dev sign-in off" || bad "dev sign-in is ON in production"
  redirect="$(curl -s -o /dev/null -m 15 -w '%{redirect_url}' "$API_PUBLIC_URL/api/auth/google")"
  if [[ "$redirect" == *"redirect_uri=$(printf '%s' "$API_PUBLIC_URL/api/auth/callback/google" | sed 's#:#%3A#g; s#/#%2F#g')"* ]]; then
    ok "Google returns to $API_PUBLIC_URL/api/auth/callback/google (must be listed in the Google OAuth client)"
  else
    bad "Google redirect URI isn't the API's: $(grep -o 'redirect_uri=[^&]*' <<<"$redirect" || echo "${redirect:-no redirect}")"
  fi
  if [ -n "$PUBLIC_URL" ]; then
    cors="$(curl -s -o /dev/null -D - -m 15 -X OPTIONS "$API_PUBLIC_URL/api/me" \
      -H "Origin: $PUBLIC_URL" -H "Access-Control-Request-Method: GET")"
    if grep -qi "access-control-allow-origin: $PUBLIC_URL" <<<"$cors" && grep -qi "access-control-allow-credentials: true" <<<"$cors"; then
      ok "CORS lets $PUBLIC_URL call the API with cookies"
    else
      bad "CORS doesn't allow $PUBLIC_URL with credentials"
    fi
  fi
fi
if [ -n "$PUBLIC_URL" ]; then
  login="$(curl -fsS -m 20 "$PUBLIC_URL/login" 2>/dev/null)"
  if [ -n "$API_PUBLIC_URL" ] && [[ "$login" == *"$API_PUBLIC_URL/api/auth/google"* ]]; then
    ok "web is built against $API_PUBLIC_URL (NEXT_PUBLIC_API_URL)"
  else
    bad "web's sign-in link doesn't point at $API_PUBLIC_URL: set NEXT_PUBLIC_API_URL in Vercel and redeploy"
  fi
  code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$PUBLIC_URL/api/health")"
  [ "$code" = 404 ] && ok "web has no /api of its own" || warn "$PUBLIC_URL/api/health → $code (an old web deploy still proxying?)"
fi

section "Can't be checked from here (docs/RELEASE.md)"
echo "  • Google OAuth client lists $API_PUBLIC_URL/api/auth/callback/google"
echo "  • Vercel project env NEXT_PUBLIC_API_URL=$API_PUBLIC_URL (Production)"
echo "  • EAS environment variables per profile (EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY)"
echo "  • RevenueCat webhook → $API_PUBLIC_URL/api/billing/revenuecat with the REVENUECAT_WEBHOOK_AUTH value"
echo "  • eas.json submit.production (App Store Connect app id, Play service account) before store submits"

echo
if [ "$FAILS" -gt 0 ]; then
  printf '\033[31m%d problem(s)\033[0m, %d warning(s). Fix the ❌ items, then run this again.\n' "$FAILS" "$WARNS"
  exit 1
fi
printf '\033[32mReady to release.\033[0m %d warning(s).\n' "$WARNS"
