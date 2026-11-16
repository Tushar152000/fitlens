import type { Metadata } from "next";
import { AnalyticsChoice } from "@/components/analytics";
import { CONTACT_EMAIL } from "../_components/faq";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — FITR8",
  description:
    "What FITR8 collects, how it is used, which service providers process it, and how to access or delete your data.",
};

/** Linked from the website, sign-in, onboarding and account settings. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="13 November 2026"
      intro={
        <p className="!mt-0 !text-lg">
          FITR8 helps you track food, water, workouts and fitness progress. Some of this information
          is personal and health-related. This policy explains what we collect, why we use it, which
          providers help us run FITR8, and the choices available to you. We do not sell personal
          data or use it for targeted advertising.
        </p>
      }
    >
      <h2>1. Who provides FITR8</h2>
      <p>
        FITR8 is provided by Fitr8 Health &amp; Wellness Pvt. Ltd. (“FITR8”, “we”, “us”). Our
        correspondence address is House No-61, Gali No-2, Near Narayan Farm House, Akash Nagar,
        Ghaziabad, India. For privacy questions, requests or complaints, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Account and sign-in information</h3>
      <ul>
        <li>
          Name, email address and profile image provided by Google or Apple, or information you
          provide during account setup.
        </li>
        <li>Google or Apple account identifiers used to authenticate your FITR8 account.</li>
      </ul>
      <h3>Profile, health and fitness information</h3>
      <ul>
        <li>Date of birth, sex, height, weight and any body measurements you choose to enter.</li>
        <li>
          Activity level, fitness goal, diet preference, training experience, equipment, workout
          frequency and time zone.
        </li>
        <li>
          Injuries or medical information you choose to tell us, including information relevant to
          safer goal calculations.
        </li>
      </ul>
      <h3>Information you create in FITR8</h3>
      <ul>
        <li>
          Meal photos, nutrition-label photos, typed meal descriptions, scanned barcodes, foods,
          portions and nutrition values you confirm.
        </li>
        <li>
          Water entries, workout details, sets, repetitions, weights, weigh-ins and body
          measurements.
        </li>
        <li>Messages you send to the AI coach and the coach’s responses.</li>
        <li>Your reminder preferences and other settings.</li>
      </ul>
      <h3>Device and security information</h3>
      <ul>
        <li>
          Session and sign-in records, app or browser version, security events and a shortened IP
          address used to protect accounts and investigate abuse. Sign-in events are retained for up
          to 90 days.
        </li>
        <li>
          Essential sign-in cookies on the website. No advertising SDKs or advertising cookies.
        </li>
        <li>
          <b>Usage analytics (Google Analytics):</b> which pages and screens are used and coarse
          product events such as “signed in”, “finished onboarding”, “logged a meal” (with how it
          was logged, e.g. photo or barcode), “messaged the coach” and “started FITR8 Pro”, plus
          device, app version and approximate location derived from your IP address. Events are
          linked to a random FITR8 account ID, never your name or email, and never include health
          values such as weight, calories, measurements, meal contents, photos or coach messages. On
          the website, analytics cookies are set only if you allow them in the cookie banner. In the
          app, analytics is collected without the device advertising ID.
        </li>
        <li>
          Camera or photo-library access only when you choose to capture or select an image. The
          mobile app configuration blocks microphone recording and does not request location or
          contacts access. Local reminders may use your device’s notification permission.
        </li>
      </ul>

      <h2>3. Why we use this information</h2>
      <ul>
        <li>Create and secure your account and provide sign-in across your devices.</li>
        <li>
          Calculate and display fitness targets, meal and workout plans, hydration guidance and
          progress summaries.
        </li>
        <li>
          Analyse meal or nutrition-label images and text, look up barcode products, and provide
          AI-coach responses.
        </li>
        <li>Save your logs, show your history, and support your use of FITR8 features.</li>
        <li>
          Operate subscriptions and entitlements if paid plans are enabled, prevent misuse,
          troubleshoot issues and respond to support requests.
        </li>
      </ul>
      <p>
        We use information for the purposes described here and do not sell it or use it to build
        advertising profiles. You can stop using FITR8 and request account deletion as described
        below.
      </p>

      <h2>4. Service providers and data transfers</h2>
      <p>
        We use service providers to operate specific parts of FITR8. Depending on the feature and
        production configuration, these may include:
      </p>
      <ul>
        <li>
          <b>AI model providers (OpenAI or Anthropic):</b> meal and nutrition-label images, meal
          descriptions and AI-coach messages may be sent to the provider selected for the service,
          to generate food estimates or coach responses. The active provider can depend on our
          deployment configuration.
        </li>
        <li>
          <b>Google Cloud:</b> application servers and database infrastructure.
        </li>
        <li>
          <b>Cloudflare R2:</b> private storage for meal and label images.
        </li>
        <li>
          <b>Vercel:</b> website hosting, if that hosting option is used for the deployment.
        </li>
        <li>
          <b>Google and Apple:</b> account authentication.
        </li>
        <li>
          <b>Google Analytics (Google Analytics 4 and Firebase Analytics):</b> usage analytics as
          described in section 2, when enabled for the deployment.
          <AnalyticsChoice />
        </li>
        <li>
          <b>Open Food Facts:</b> barcode numbers are queried to retrieve packaged-food information.
          We do not intentionally send your account profile with that lookup.
        </li>
        <li>
          <b>RevenueCat, Apple and Google Play:</b> subscription status and purchase-related
          identifiers may be processed when in-app purchases are enabled.
        </li>
        <li>
          <b>Expo:</b> mobile app update delivery and related app infrastructure.
        </li>
      </ul>
      <p>
        Providers process information to supply their services to FITR8. Some providers may process
        information outside India. Their own privacy and security terms also apply to the processing
        they perform. We do not control their independent practices; check their current terms for
        details about retention and model-training settings.
      </p>

      <h2>5. Food estimates and health guidance</h2>
      <p>
        AI-generated food recognition and portion estimates can be inaccurate. You can review and
        correct detected foods and portions before confirming a meal. FITR8 provides general fitness
        and nutrition information, not medical diagnosis or treatment. Do not rely on an AI estimate
        as a substitute for advice from a qualified healthcare professional.
      </p>

      <h2>6. How long information is kept</h2>
      <p>
        We retain account information and logs while your account remains active, unless a longer
        period is required for security, legal or operational reasons. Sign-in events are retained
        for up to 90 days; expired sessions and one-time sign-in codes are removed through scheduled
        cleanup. Where infrastructure backups are maintained, deleted information may remain in
        protected backups until they are overwritten under the applicable backup-rotation schedule.
      </p>

      <h2>7. Access, export, correction and deletion</h2>
      <ul>
        <li>
          <b>View and correct:</b> you can view and edit profile details and supported logs in the
          app or website.
        </li>
        <li>
          <b>Export:</b> the current in-product CSV export includes confirmed meal items and
          weigh-ins. It does not currently include every category of account information or every
          log. Contact us if you need help with another request.
        </li>
        <li>
          <b>Delete:</b> you can request account deletion from Profile. The account’s database
          records are deleted and the service attempts to remove associated photos from storage. If
          photo-storage cleanup fails, some files may take longer to remove; contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> so we can investigate.
        </li>
        <li>
          <b>Other requests and consent:</b> contact us to request access, correction, deletion help
          or to withdraw consent where consent is the basis for processing. Some features may no
          longer work if you withdraw consent for information they need. We may ask for information
          to verify your request.
        </li>
      </ul>

      <h2>8. Security</h2>
      <p>
        FITR8 uses encrypted connections, hashed session tokens, access-controlled photo links and
        account-scoped access checks. No online service can guarantee absolute security. Please
        protect the email or identity-provider account you use to sign in and contact us promptly if
        you believe your account has been accessed without permission.
      </p>

      <h2>9. Children and teenagers</h2>
      <p>
        FITR8 is not designed for children under 13. Users under 18 should use FITR8 only with the
        involvement and permission of a parent or guardian. Certain goal calculations are restricted
        for users under 18 or where a medical flag is present.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy as FITR8’s features, providers or legal requirements change. We
        will update the date above and, where appropriate, provide an in-app notice for material
        changes. Please review this page periodically.
      </p>
    </LegalPage>
  );
}
