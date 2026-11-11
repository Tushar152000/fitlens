#!/usr/bin/env bash
# One-time release setup for the GitHub repository admin who also owns the Vercel project.
# The Google Cloud side is done by infra/gcp/setup.sh; this finishes what needs repo-admin and
# Vercel rights. Safe to re-run. Changes nothing in Google Cloud.
#
#   infra/owner-setup.sh          (from the repo)
#   bash owner-setup.sh           (or as a standalone file: no clone needed)
#
# Needs: gh (logged in, admin on the repo), Node 22 (for `npx vercel`), and a Vercel login
# (`npx vercel login`). Optional env: GITHUB_REPO, VERCEL_PROJECT (the project's name in Vercel),
# VERCEL_SCOPE (team slug), API_IP (the load balancer IP, read from gcloud when available).
#
# It sets:
#   GitHub variables  API_PUBLIC_URL, AUTH_COOKIE_DOMAIN, API_MIN_INSTANCES, VERCEL_ORG_ID, VERCEL_PROJECT_ID
#   GitHub secret     VERCEL_TOKEN (you paste it; hidden)
#   Vercel env        NEXT_PUBLIC_API_URL (Production)
#   DNS (optional)    api.fitr8.com A record in Vercel DNS → the API load balancer
# and prints the one step only a browser can do (the Google OAuth redirect URI).
set -euo pipefail

REPO="${GITHUB_REPO:-Tushar152000/fitlens}"
SITE="${SITE:-fitr8.com}"
API_HOST="api.$SITE"
API_URL="https://$API_HOST"
COOKIE_DOMAIN=".$SITE"
# Inside the repo, link apps/web (its .vercel folder is git-ignored); standalone, a scratch folder.
ROOT="$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)"
if [ -d "$ROOT/apps/web" ]; then
  WEB="$ROOT/apps/web"
else
  WEB="${TMPDIR:-/tmp}/fitr8-vercel-link"
  mkdir -p "$WEB"
fi
vercel() { npx --yes vercel@latest "$@" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"}; }

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
ask() { local v; read -rp "$1" v; printf '%s' "$v"; }

step "Checks"
command -v node >/dev/null || die "Node.js is needed (for npx vercel): https://nodejs.org"
if ! command -v gh >/dev/null || ! gh auth status >/dev/null 2>&1; then die "gh is not logged in: gh auth login"; fi
[ "$(gh api "repos/$REPO" --jq .permissions.admin)" = true ] ||
  die "your GitHub account is not an admin of $REPO (variables and secrets need admin)"
echo "GitHub: admin on $REPO"
vercel whoami >/dev/null 2>&1 || die "not logged in to Vercel: npx vercel login"
echo "Vercel: logged in as $(vercel whoami 2>/dev/null | tail -1)"

step "GitHub variables"
gh variable set API_PUBLIC_URL --repo "$REPO" --body "$API_URL"
gh variable set AUTH_COOKIE_DOMAIN --repo "$REPO" --body "$COOKIE_DOMAIN"
gh variable list --repo "$REPO" --json name --jq '.[].name' | grep -qx API_MIN_INSTANCES ||
  gh variable set API_MIN_INSTANCES --repo "$REPO" --body 1
echo "API_PUBLIC_URL=$API_URL  AUTH_COOKIE_DOMAIN=$COOKIE_DOMAIN"

step "Vercel project"
# Links apps/web to the existing Vercel project (writes apps/web/.vercel, which git ignores) to read its ids.
if [ ! -f "$WEB/.vercel/project.json" ]; then
  project="${VERCEL_PROJECT:-$(ask "Vercel project name for the website (as shown in Vercel): ")}"
  [ -n "$project" ] || die "the Vercel project name is required"
  vercel link --yes --cwd "$WEB" --project "$project" >/dev/null
fi
ORG_ID="$(node -p "require('$WEB/.vercel/project.json').orgId")"
PROJECT_ID="$(node -p "require('$WEB/.vercel/project.json').projectId")"
gh variable set VERCEL_ORG_ID --repo "$REPO" --body "$ORG_ID"
gh variable set VERCEL_PROJECT_ID --repo "$REPO" --body "$PROJECT_ID"
echo "VERCEL_ORG_ID=$ORG_ID  VERCEL_PROJECT_ID=$PROJECT_ID"

step "Vercel env NEXT_PUBLIC_API_URL (Production)"
vercel env rm NEXT_PUBLIC_API_URL production --yes --cwd "$WEB" >/dev/null 2>&1 || true
printf '%s' "$API_URL" | vercel env add NEXT_PUBLIC_API_URL production --cwd "$WEB" >/dev/null
echo "NEXT_PUBLIC_API_URL=$API_URL"

step "GitHub secret VERCEL_TOKEN"
if gh secret list --repo "$REPO" --json name --jq '.[].name' | grep -qx VERCEL_TOKEN; then
  echo "VERCEL_TOKEN already set (re-run with RESET_TOKEN=1 to replace it)"
fi
if [ "${RESET_TOKEN:-}" = 1 ] || ! gh secret list --repo "$REPO" --json name --jq '.[].name' | grep -qx VERCEL_TOKEN; then
  echo "Create one at https://vercel.com/account/settings/tokens (scope: the team that owns the project)."
  gh secret set VERCEL_TOKEN --repo "$REPO" # prompts; input is hidden and goes straight to GitHub
fi

step "DNS: $API_HOST"
ip="${API_IP:-}"
if [ -z "$ip" ] && command -v gcloud >/dev/null; then
  ip="$(gcloud compute addresses describe fitlens-api-ip --global --project=fitlens-prod --format='value(address)' 2>/dev/null || true)"
fi
[ -n "$ip" ] || ip="$(ask "API load balancer IP (from infra/gcp/setup.sh): ")"
# getent on Linux, dig on macOS.
current="$( (getent ahostsv4 "$API_HOST" 2>/dev/null || dig +short A "$API_HOST" 2>/dev/null) |
  awk '/^[0-9.]+/{print $1; exit}')"
if [ "$current" = "$ip" ]; then
  echo "$API_HOST already resolves to $ip"
elif [ "$(ask "Add A record $API_HOST → $ip in Vercel DNS for $SITE? [y/N] ")" = y ]; then
  vercel dns add "$SITE" api A "$ip"
else
  echo "Add it wherever $SITE's DNS is hosted: A  api  $ip"
fi

step "One manual step: Google sign-in"
echo "Google Cloud console → APIs & Services → Credentials → the OAuth 2.0 client used by FITR8 →"
echo "Authorised redirect URIs → add:  $API_URL/api/auth/callback/google  → Save."

step "Done"
echo "Check everything (any account with access to fitlens-prod):"
echo "  PROJECT_ID=fitlens-prod infra/release-check.sh"
echo "When every line is ✅, merge the release PR."
