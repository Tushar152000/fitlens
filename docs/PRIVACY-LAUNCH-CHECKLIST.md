# FITR8 privacy and legal launch checklist

The public `/privacy` and `/terms` pages were updated against the current source tree on 10 November 2026. This checklist records facts that code inspection cannot verify. Do not treat the website copy as legal sign-off.

## Confirm with the company owner before public launch

- [ ] **Legal entity:** confirm the exact registered company name and legal form. The current source says `Fitr8 Health & Wellness Pvt. Ltd.`; replace it consistently if the registered entity differs.
- [ ] **Registered/correspondence address:** verify the Ghaziabad address in the privacy page and footer, and decide whether a registered office or correspondence address should be published.
- [ ] **Privacy contact:** verify `ask@fitr8.com` is monitored, access-controlled and able to handle access, correction, deletion, consent-withdrawal and complaint requests. Assign a responsible privacy/grievance contact internally; do not publish a person's name until confirmed.
- [ ] **Production AI provider:** confirm whether production uses OpenAI or Anthropic, which models are enabled, what inputs are sent (including photos and coach messages), and the provider's current API retention/training terms. Keep the policy and store declarations aligned with the deployed configuration.
- [ ] **Infrastructure:** confirm actual production providers and regions for API, database, object storage, website hosting, logs, backups and app updates. Remove any provider from the public notice if it is not used; add any missing provider.
- [ ] **Backups and retention:** document database, object-storage, logs and support-ticket retention periods, including backup rotation and deletion timelines. The repository confirms 90-day auth-event retention but does not establish the production backup schedule.
- [ ] **Deletion reliability:** `UsersService.deleteAccount()` deletes database rows and then attempts photo deletion; photo deletion failures are logged but do not fail the account-deletion request. Add retry/alerting and verify orphaned photos are eventually purged before claiming complete immediate deletion.
- [ ] **Export completeness:** current CSV export contains confirmed meal items and weigh-ins, not every account field or every log. Decide whether to expand it to a complete export or keep the limitation explicit in the policy and UI.
- [ ] **Subscriptions:** if Pro is enabled, confirm RevenueCat, Apple and Google Play data flows, retention, cancellation instructions and the final subscription disclosure.
- [ ] **Age and health safeguards:** have a qualified reviewer assess the under-18 experience, health-related profile fields, calorie and macro calculations, injury handling and all health claims.
- [ ] **Consent and rights journey:** test how a person is informed, gives/withdraws consent, contacts FITR8, verifies a request and receives a response. The public email address alone does not prove the operational process exists.
- [ ] **Legal review:** have Indian counsel review the Privacy Policy, Terms, consumer/subscription wording and applicable DPDP Act/Rules obligations before launch.

## Source-backed implementation notes

- Account sign-in uses Google and Apple; account records are database-backed.
- Meal/label photos are stored through the S3-compatible storage adapter. AI extraction and coach calls can use OpenAI or Anthropic depending on `AI_PROVIDER`.
- Barcode lookups use Open Food Facts. Subscription processing is implemented through RevenueCat when configured.
- Google Analytics (2026-11-13): web GA4 loads only after cookie-banner consent and only when `GA_MEASUREMENT_ID` in `apps/web/src/lib/ga-id.ts` is set; the app uses Firebase Analytics only in builds with the Firebase config files, without the advertising ID. Events never carry health values (`packages/contracts/src/analytics.ts`, `docs/ANALYTICS.md`). No advertising SDKs. The mobile app blocks Android microphone recording. Web camera capture requests video only (`audio: false`).
- Auth-event cleanup retains sign-in events for 90 days. This is not the same as a general user-data or backup-retention schedule.

## India data-protection reference

Review the notified [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) and the [MeitY DPDP Rules page](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025). The Rules have phased commencement dates; counsel should map the requirements and effective dates to FITR8's launch and processing activities.
