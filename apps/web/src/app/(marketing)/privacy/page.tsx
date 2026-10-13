import type { Metadata } from "next";
import { CONTACT_EMAIL } from "../_components/faq";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — FITR8",
  description: "What FITR8 collects, why, who processes it, and how to export or delete it.",
};

/** Linked from the stores, the app's sign-in and Profile screens, onboarding and the footer. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="14 October 2026"
      intro={
        <p className="!mt-0 !text-lg">
          FITR8 helps you track food, water, workouts and progress. To do that we need some personal
          and health-related information. This policy explains what we collect, why, who helps us
          process it, and how you can see, export or delete it. We don’t sell your data and we don’t
          show ads.
        </p>
      }
    >
      <h2>Who we are</h2>
      <p>
        FITR8 is provided by Fitr8 Health &amp; Wellness Pvt. Ltd., House No-61, Gali No-2, Near
        Narayan Farm House, Akash Nagar, Ghaziabad, India (“FITR8”, “we”). For any privacy question
        or request, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>
      <h3>Your account</h3>
      <ul>
        <li>
          Name, email address and profile photo from Google, or name and email (which may be a
          private Apple relay address) from Sign in with Apple.
        </li>
        <li>An identifier from Google or Apple that links your sign-in to your FITR8 account.</li>
      </ul>
      <h3>About you and your goal</h3>
      <ul>
        <li>
          Sex, date of birth, height, weight, and optionally waist, neck and hip measurements.
        </li>
        <li>
          Activity level, diet type, training experience, where and how often you train, injuries
          you tell us about, and whether you have a medical condition, are pregnant or are under 18.
        </li>
        <li>Your goal, target and date, and your time zone.</li>
      </ul>
      <h3>What you log</h3>
      <ul>
        <li>
          Meals: photos of your plate or of nutrition labels you choose to take or pick, text you
          type, barcodes you scan, and the foods, portions and nutrition you confirm.
        </li>
        <li>Water, workouts (sets, reps and weights), weigh-ins and body measurements.</li>
        <li>Messages you send to the AI coach and its replies.</li>
        <li>Reminder settings.</li>
      </ul>
      <h3>Technical information</h3>
      <ul>
        <li>
          For each signed-in device: a session record with the browser or app version and a
          shortened IP address, so you can see and sign out devices. Sign-in events are kept for up
          to 90 days for security.
        </li>
        <li>
          The website sets only the cookies needed to sign you in. We use no analytics, advertising
          or tracking cookies or SDKs.
        </li>
        <li>
          The app uses your camera and photos only when you choose to, and schedules reminders on
          your device. It does not access your location, contacts or microphone.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To calculate your daily targets, water target and training plan.</li>
        <li>To recognise foods and portions in your photos and text, and to run the AI coach.</li>
        <li>To show your history and progress, and adjust your plan each week.</li>
        <li>To keep your account secure and the service working.</li>
        <li>To reply when you contact us.</li>
      </ul>
      <p>
        We process your health-related information because you give it to us to use the app. You can
        withdraw that consent at any time by deleting your account.
      </p>

      <h2>Who processes it for us</h2>
      <p>We share data only with providers that run parts of the service for us:</p>
      <ul>
        <li>
          <b>AI provider (currently OpenAI):</b> meal and label photos, meal text and coach messages
          are sent to produce food estimates and coach replies. We don’t allow it to train its
          models on your data.
        </li>
        <li>
          <b>Google Cloud (Mumbai, India):</b> our servers and database.
        </li>
        <li>
          <b>Cloudflare R2:</b> private storage for your photos.
        </li>
        <li>
          <b>Vercel:</b> hosts the website.
        </li>
        <li>
          <b>Google and Apple:</b> sign-in. <b>Expo:</b> delivers app updates.
        </li>
        <li>
          <b>Open Food Facts:</b> receives the barcode numbers you scan (no personal information) to
          look up products.
        </li>
      </ul>
      <p>
        Some of these providers may process data outside India. We don’t sell your data, share it
        with advertisers or data brokers, or use it for advertising.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account exists. When you delete your account, we delete your
        account, profile, logs, coach conversations and photos, and revoke Sign in with Apple if you
        used it. Database backups are kept for a limited time and then overwritten.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <b>See and correct:</b> your profile and logs are in the app, and you can edit your plan
          at any time.
        </li>
        <li>
          <b>Export:</b> download your data as a CSV file from Profile.
        </li>
        <li>
          <b>Delete:</b> delete your account from Profile in the app or on the website. It takes
          effect immediately.
        </li>
        <li>
          <b>Ask us:</b> email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for any other
          request, including a complaint. We reply within 30 days.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Data travels over encrypted connections. Sign-in sessions are stored only as one-way hashes,
        photos are private and reached only through short-lived links, and access to our systems is
        limited to the people who run FITR8.
      </p>

      <h2>Children</h2>
      <p>
        FITR8 is not for children under 13. If you are under 18, FITR8 won’t set a calorie deficit
        for you, and you should use it with a parent or guardian’s permission.
      </p>

      <h2>Health information</h2>
      <p>
        FITR8 gives general fitness guidance, not medical advice. AI food estimates can be wrong;
        you confirm every item before it’s logged.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we’ll tell you in the app before it takes
        effect. The date at the top shows the latest version.
      </p>
    </LegalPage>
  );
}
