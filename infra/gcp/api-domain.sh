#!/usr/bin/env bash
# One-time: serve the API at its own domain (e.g. https://api.fitr8.com) through a global external
# HTTPS load balancer in front of Cloud Run. Cloud Run's built-in domain mapping is not available in
# asia-south1 (and is a preview feature), so this is the supported way. Idempotent: re-running skips
# what exists.
#
#   PROJECT_ID=fitlens-prod DOMAIN=api.fitr8.com infra/gcp/api-domain.sh
#
# Afterwards:
#   1. DNS: an A record for $DOMAIN → the IP printed at the end (in Vercel DNS for fitr8.com).
#   2. Wait for the certificate: gcloud compute ssl-certificates describe fitlens-api-cert --global
#      (status ACTIVE; usually 15–60 min after DNS resolves).
#   3. GitHub repo variables: API_PUBLIC_URL=https://$DOMAIN, AUTH_COOKIE_DOMAIN=.fitr8.com.
#   4. Google OAuth client: add https://$DOMAIN/api/auth/callback/google.
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
: "${DOMAIN:?set DOMAIN, e.g. api.fitr8.com}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-fitlens-api}"
g() { gcloud --project="$PROJECT_ID" "$@"; }
exists() { "$@" >/dev/null 2>&1; }

g services enable compute.googleapis.com

exists g compute addresses describe fitlens-api-ip --global ||
  g compute addresses create fitlens-api-ip --global --ip-version=IPV4

exists g compute network-endpoint-groups describe fitlens-api-neg --region="$REGION" ||
  g compute network-endpoint-groups create fitlens-api-neg --region="$REGION" \
    --network-endpoint-type=serverless --cloud-run-service="$SERVICE"

# Serverless NEG backends take no protocol/port name (the load balancer talks to Cloud Run itself).
exists g compute backend-services describe fitlens-api-backend --global ||
  g compute backend-services create fitlens-api-backend --global --load-balancing-scheme=EXTERNAL_MANAGED
g compute backend-services describe fitlens-api-backend --global --format='value(backends[].group)' |
  grep -q "/networkEndpointGroups/fitlens-api-neg" ||
  g compute backend-services add-backend fitlens-api-backend --global \
    --network-endpoint-group=fitlens-api-neg --network-endpoint-group-region="$REGION"

exists g compute url-maps describe fitlens-api-lb --global ||
  g compute url-maps create fitlens-api-lb --global --default-service=fitlens-api-backend

exists g compute ssl-certificates describe fitlens-api-cert --global ||
  g compute ssl-certificates create fitlens-api-cert --global --domains="$DOMAIN"

exists g compute target-https-proxies describe fitlens-api-https --global ||
  g compute target-https-proxies create fitlens-api-https --global \
    --url-map=fitlens-api-lb --ssl-certificates=fitlens-api-cert

exists g compute forwarding-rules describe fitlens-api-https-rule --global ||
  g compute forwarding-rules create fitlens-api-https-rule --global \
    --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM \
    --address=fitlens-api-ip --target-https-proxy=fitlens-api-https --ports=443

IP="$(g compute addresses describe fitlens-api-ip --global --format='value(address)')"
echo
echo "Load balancer ready. DNS: A record  $DOMAIN  →  $IP"
echo "Then set repo variables API_PUBLIC_URL=https://$DOMAIN and AUTH_COOKIE_DOMAIN, and add"
echo "https://$DOMAIN/api/auth/callback/google to the Google OAuth client."
