#!/usr/bin/env bash
# One-time provisioning of the FitLens backend on Google Cloud. Safe to re-run: every step skips what exists.
#
#   PROJECT_ID=fitlens-prod PUBLIC_URL=https://www.fitr8.com infra/gcp/setup.sh
#
# Also sets up the API's own domain (api.<site>, through infra/gcp/api-domain.sh), optional Sign in
# with Apple and RevenueCat secrets, and every GitHub repository variable the Deploy workflow reads.
# Check the result with infra/release-check.sh. Full release runbook: docs/RELEASE.md.
#
# Creates: Artifact Registry repo, Cloud SQL Postgres, Secret Manager secrets, a runtime service account for
# Cloud Run, and a deployer service account that GitHub Actions impersonates through Workload Identity
# Federation (no JSON keys anywhere). The Cloud Run service and migrate job are created by the first Deploy run.
# Meal photos live in Cloudflare R2 (create the bucket and its API token first: docs/DEPLOY.md).
#
# Secrets you supply are read with hidden input and piped straight into Secret Manager: never echoed, never
# written to disk, never passed as command arguments. They can also come from env vars of the same name:
# AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, OPENAI_API_KEY (or ANTHROPIC_API_KEY), S3_ENDPOINT, S3_ACCESS_KEY_ID,
# S3_SECRET_ACCESS_KEY.
#
# Optional (Enter skips at the prompt; re-run later to add): APPLE_TEAM_ID, APPLE_KEY_ID,
# APPLE_PRIVATE_KEY_FILE (path to the AuthKey_<id>.p8), REVENUECAT_SECRET_KEY (enables RevenueCat; the
# webhook password is generated). Read it back with: gcloud secrets versions access latest --secret=<name>
#
# Optional overrides: REGION (asia-south1), GITHUB_REPO, SQL_TIER (db-custom-1-3840: 1 dedicated vCPU,
# 3.75 GB; an existing instance on another tier is moved to it, which restarts it for a few minutes),
# API_DOMAIN (api.<site of PUBLIC_URL>), BUCKET (R2 bucket name, fitlens-meals), BILLING_ACCOUNT,
# YES=1 (skip the confirmation), AI_PROVIDER (openai | anthropic; openai), API_MIN_INSTANCES (1).
# `cond && report || report`: the report helpers always succeed, so this is a safe if/else.
# shellcheck disable=SC2015
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID, e.g. fitlens-prod}"
: "${PUBLIC_URL:?set PUBLIC_URL, the web origin users reach (https://...)}"
REGION="${REGION:-asia-south1}"
GITHUB_REPO="${GITHUB_REPO:-Tushar152000/fitlens}"
SQL_INSTANCE="${SQL_INSTANCE:-fitlens-db}"
SQL_TIER="${SQL_TIER:-db-custom-1-3840}"
BUCKET="${BUCKET:-fitlens-meals}"
AI_PROVIDER="${AI_PROVIDER:-openai}"
API_MIN_INSTANCES="${API_MIN_INSTANCES:-1}"
# www.fitr8.com → site fitr8.com → API at api.fitr8.com, session cookie for .fitr8.com.
WEB_HOST="$(printf '%s' "$PUBLIC_URL" | sed -E 's#^https?://##; s#[:/].*$##')"
SITE="${WEB_HOST#www.}"
API_DOMAIN="${API_DOMAIN:-api.$SITE}"
COOKIE_DOMAIN=".$SITE"
AR_REPO=fitlens
WIF_POOL=github
WIF_PROVIDER=fitlens-repo

# Scope every gcloud call to this project without touching the active gcloud configuration.
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
RUNTIME_SA="fitlens-api@$PROJECT_ID.iam.gserviceaccount.com"
DEPLOYER_SA="fitlens-deployer@$PROJECT_ID.iam.gserviceaccount.com"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
exists() { "$@" >/dev/null 2>&1; }

ACCOUNT="$(gcloud config get account 2>/dev/null)"
[ -n "$ACCOUNT" ] || die "not logged in: run gcloud auth login"
echo "Account: $ACCOUNT"
echo "Project: $PROJECT_ID   Region: $REGION   Repo: $GITHUB_REPO"
echo "(Use another account for this run with CLOUDSDK_CORE_ACCOUNT=you@gmail.com)"
if [ "${YES:-}" != 1 ]; then
  read -rp "Continue? [y/N] " ok
  [ "$ok" = y ] || [ "$ok" = Y ] || exit 1
fi

step "Project and billing"
if ! exists gcloud projects describe "$PROJECT_ID"; then
  gcloud projects create "$PROJECT_ID" --name=FitLens
fi
if [ -n "${BILLING_ACCOUNT:-}" ]; then
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" >/dev/null
fi
[ "$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)')" = True ] ||
  die "billing is off. Link it: gcloud billing accounts list, then re-run with BILLING_ACCOUNT=<id>"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

step "APIs"
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com

step "Service accounts"
exists gcloud iam service-accounts describe "$RUNTIME_SA" ||
  gcloud iam service-accounts create fitlens-api --display-name="FitLens API (Cloud Run runtime)"
exists gcloud iam service-accounts describe "$DEPLOYER_SA" ||
  gcloud iam service-accounts create fitlens-deployer --display-name="FitLens deployer (GitHub Actions)"

step "Artifact Registry"
exists gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" ||
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION"

step "Cloud SQL (first run takes ~10 minutes)"
if ! exists gcloud sql instances describe "$SQL_INSTANCE"; then
  # Public IP with no authorised networks: only the Cloud SQL connector (IAM-checked) can reach it.
  # Backups at 21:00 UTC = 02:30 IST.
  gcloud sql instances create "$SQL_INSTANCE" --region="$REGION" --database-version=POSTGRES_17 \
    --edition=ENTERPRISE --tier="$SQL_TIER" --storage-size=10 --storage-auto-increase \
    --backup-start-time=21:00 --enable-point-in-time-recovery --deletion-protection
else
  CURRENT_TIER="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(settings.tier)')"
  if [ "$CURRENT_TIER" != "$SQL_TIER" ]; then
    echo "Moving $SQL_INSTANCE from $CURRENT_TIER to $SQL_TIER (restarts the database for a few minutes)"
    gcloud sql instances patch "$SQL_INSTANCE" --tier="$SQL_TIER" --quiet
  fi
  [ "$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(settings.backupConfiguration.pointInTimeRecoveryEnabled)')" = True ] ||
    gcloud sql instances patch "$SQL_INSTANCE" --enable-point-in-time-recovery --quiet
fi
exists gcloud sql databases describe fitlens --instance="$SQL_INSTANCE" ||
  gcloud sql databases create fitlens --instance="$SQL_INSTANCE"
SQL_CONNECTION="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')"

secret_exists() { exists gcloud secrets describe "$1"; }
put_secret() {
  if secret_exists "$1"; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else
    printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null
  fi
  echo "secret $1 stored"
}
# Value from an env var of the same name, else a prompt; without a terminal it is skipped (re-run to add it).
ask_secret() {
  secret_exists "$1" && { echo "secret $1 exists"; return; }
  local value="${!1:-}"
  if [ -z "$value" ] && [ -t 0 ]; then
    read -rsp "$2: " value
    echo
    [ -n "$value" ] || die "$1 is required"
  fi
  if [ -z "$value" ]; then
    echo "secret $1 SKIPPED (no terminal): re-run this script to add it before the first deploy"
    return
  fi
  put_secret "$1" "$value"
}

step "Database user"
if ! secret_exists DATABASE_URL; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  if gcloud sql users list --instance="$SQL_INSTANCE" --format='value(name)' | grep -qx fitlens; then
    gcloud sql users set-password fitlens --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
  else
    gcloud sql users create fitlens --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
  fi
  # Cloud Run mounts the instance as a unix socket under /cloudsql (pg and Prisma both read ?host=).
  put_secret DATABASE_URL "postgresql://fitlens:$DB_PASSWORD@localhost/fitlens?host=/cloudsql/$SQL_CONNECTION"
else
  echo "secret DATABASE_URL exists"
fi

step "Cloudflare R2 (meal photos)"
ask_secret S3_ENDPOINT "R2 S3 endpoint (https://<account-id>.r2.cloudflarestorage.com)"
ask_secret S3_ACCESS_KEY_ID "R2 access key ID"
ask_secret S3_SECRET_ACCESS_KEY "R2 secret access key"

step "App secrets"
secret_exists AUTH_SECRET && echo "secret AUTH_SECRET exists" || put_secret AUTH_SECRET "$(openssl rand -base64 33)"
ask_secret AUTH_GOOGLE_ID "Google OAuth client ID"
ask_secret AUTH_GOOGLE_SECRET "Google OAuth client secret"
if [ "$AI_PROVIDER" = anthropic ]; then
  AI_KEY=ANTHROPIC_API_KEY
  ask_secret ANTHROPIC_API_KEY "Anthropic API key (sk-ant-...)"
else
  AI_KEY=OPENAI_API_KEY
  ask_secret OPENAI_API_KEY "OpenAI API key (sk-...)"
fi

# Optional: stored when given (env var or prompt), skipped with Enter. Never required by this script.
ask_optional_secret() {
  secret_exists "$1" && { echo "secret $1 exists"; return; }
  local value="${!1:-}"
  if [ -z "$value" ] && [ -t 0 ]; then
    read -rsp "$2 (Enter to skip): " value
    echo
  fi
  if [ -n "$value" ]; then put_secret "$1" "$value"; else echo "secret $1 skipped"; fi
}

step "Sign in with Apple (optional; required for the iOS App Store)"
ask_optional_secret APPLE_TEAM_ID "Apple Team ID"
ask_optional_secret APPLE_KEY_ID "Sign in with Apple key ID"
if ! secret_exists APPLE_PRIVATE_KEY; then
  key_file="${APPLE_PRIVATE_KEY_FILE:-}"
  if [ -z "$key_file" ] && [ -t 0 ]; then read -rp "Path to AuthKey_<id>.p8 (Enter to skip): " key_file; fi
  if [ -n "$key_file" ]; then
    [ -f "$key_file" ] || die "no such file: $key_file"
    gcloud secrets create APPLE_PRIVATE_KEY --replication-policy=automatic --data-file="$key_file" >/dev/null
    echo "secret APPLE_PRIVATE_KEY stored"
  else
    echo "secret APPLE_PRIVATE_KEY skipped"
  fi
else
  echo "secret APPLE_PRIVATE_KEY exists"
fi

step "RevenueCat / FITR8 Pro (optional)"
ask_optional_secret REVENUECAT_SECRET_KEY "RevenueCat secret API key (sk_...)"
if secret_exists REVENUECAT_SECRET_KEY && ! secret_exists REVENUECAT_WEBHOOK_AUTH; then
  # The Authorization header RevenueCat sends with each webhook: paste it into RevenueCat once.
  put_secret REVENUECAT_WEBHOOK_AUTH "$(openssl rand -hex 32)"
  echo "  RevenueCat → Integrations → Webhooks → Authorization header: read it with"
  echo "  gcloud secrets versions access latest --secret=REVENUECAT_WEBHOOK_AUTH --project=$PROJECT_ID"
fi

APPLE_ON=false
secret_exists APPLE_TEAM_ID && secret_exists APPLE_KEY_ID && secret_exists APPLE_PRIVATE_KEY && APPLE_ON=true
REVENUECAT_ON=false
secret_exists REVENUECAT_SECRET_KEY && secret_exists REVENUECAT_WEBHOOK_AUTH && REVENUECAT_ON=true

step "IAM"
SECRETS=(DATABASE_URL AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET "$AI_KEY" S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY)
OPTIONAL_SECRETS=(APPLE_TEAM_ID APPLE_KEY_ID APPLE_PRIVATE_KEY REVENUECAT_SECRET_KEY REVENUECAT_WEBHOOK_AUTH)
for s in "${SECRETS[@]}" "${OPTIONAL_SECRETS[@]}"; do
  secret_exists "$s" || continue
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$RUNTIME_SA" \
    --role=roles/secretmanager.secretAccessor >/dev/null
done
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/cloudsql.client --condition=None >/dev/null
# The deployer creates/updates the service and job (run.admin also lets it make the service public),
# runs them as the runtime account, and pushes images.
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOYER_SA" \
  --role=roles/run.admin --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOYER_SA" --role=roles/iam.serviceAccountUser >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location="$REGION" \
  --member="serviceAccount:$DEPLOYER_SA" --role=roles/artifactregistry.writer >/dev/null
echo "roles granted"

step "GitHub Actions → Workload Identity Federation"
exists gcloud iam workload-identity-pools describe "$WIF_POOL" --location=global ||
  gcloud iam workload-identity-pools create "$WIF_POOL" --location=global --display-name="GitHub Actions"
exists gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --workload-identity-pool="$WIF_POOL" --location=global ||
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
    --workload-identity-pool="$WIF_POOL" --location=global \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref \
    --attribute-condition="assertion.repository == '$GITHUB_REPO' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null
WIF_PROVIDER_NAME="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL/providers/$WIF_PROVIDER"

step "GitHub repository variables"
VARS=(
  "GCP_PROJECT_ID=$PROJECT_ID"
  "GCP_REGION=$REGION"
  "GCP_WIF_PROVIDER=$WIF_PROVIDER_NAME"
  "GCP_DEPLOYER_SA=$DEPLOYER_SA"
  "GCP_RUNTIME_SA=$RUNTIME_SA"
  "GCP_SQL_CONNECTION=$SQL_CONNECTION"
  "S3_BUCKET=$BUCKET"
  "PUBLIC_URL=$PUBLIC_URL"
  "API_PUBLIC_URL=https://$API_DOMAIN"
  "AUTH_COOKIE_DOMAIN=$COOKIE_DOMAIN"
  "AI_PROVIDER=$AI_PROVIDER"
  "API_MIN_INSTANCES=$API_MIN_INSTANCES"
  "APPLE_CLIENT_ID=$([ "$APPLE_ON" = true ] && echo com.fitr8.app)"
  "REVENUECAT_ENABLED=$REVENUECAT_ON"
)
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  for v in "${VARS[@]}"; do
    if [ -n "${v#*=}" ]; then
      gh variable set "${v%%=*}" --repo "$GITHUB_REPO" --body "${v#*=}"
    else
      gh variable delete "${v%%=*}" --repo "$GITHUB_REPO" >/dev/null 2>&1 || true
    fi
  done
  echo "set on $GITHUB_REPO"
else
  echo "Set these under GitHub → Settings → Secrets and variables → Actions → Variables:"
  printf '  %s\n' "${VARS[@]}"
fi

MISSING=()
for s in "${SECRETS[@]}"; do secret_exists "$s" || MISSING+=("$s"); done
if [ "${#MISSING[@]}" -gt 0 ]; then
  step "Not finished"
  echo "Missing secrets: ${MISSING[*]}. Re-run this script in a terminal to enter them."
  exit 1
fi

step "API domain (https://$API_DOMAIN)"
PROJECT_ID="$PROJECT_ID" DOMAIN="$API_DOMAIN" REGION="$REGION" "$(dirname "$0")/api-domain.sh"

step "Done"
echo "Next: the manual items in docs/RELEASE.md (DNS record, Google redirect URI, Vercel and Expo tokens),"
echo "then check everything with:  PROJECT_ID=$PROJECT_ID infra/release-check.sh"
