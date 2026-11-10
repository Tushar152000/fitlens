import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "../_components/faq";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use — FITR8",
  description: "The terms for using the FITR8 app and website.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="10 November 2026"
      intro={
        <p className="!mt-0 !text-lg">
          These terms apply when you use the FITR8 app or website (the “service”), provided by Fitr8
          Health &amp; Wellness Pvt. Ltd. By creating an account you agree to them. Our{" "}
          <Link href="/privacy">Privacy Policy</Link> explains how we handle your data.
        </p>
      }
    >
      <h2>Not medical advice</h2>
      <p>
        FITR8 gives general fitness and nutrition guidance. It is not medical advice and doesn’t
        diagnose or treat any condition. Talk to a doctor before changing your diet or training,
        especially if you have a medical condition, are pregnant, or take medication. Stop
        exercising and get help if you feel pain, dizziness or shortness of breath.
      </p>

      <h2>Estimates can be wrong</h2>
      <p>
        Calories, macros, portions and targets are estimates. Food recognition uses AI and can make
        mistakes, which is why you confirm items before they’re logged. Product data from barcodes
        comes from Open Food Facts and may be incomplete.
      </p>

      <h2>Who can use FITR8</h2>
      <p>
        You must be at least 13. If you are under 18, you need a parent or guardian’s permission.
        Give accurate information about yourself so your plan is safe for you.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with Google or Apple. Keep that account secure; you’re responsible for what
        happens under your FITR8 account. You can sign out of any device and delete your account at
        any time from Profile.
      </p>

      <h2>Your content</h2>
      <p>
        You own the photos, logs and messages you add. You give us permission to store and process
        them only to run the service for you, as described in the Privacy Policy.
      </p>

      <h2>Fair use</h2>
      <ul>
        <li>
          Don’t misuse the service, try to break or overload it, or access other people’s data.
        </li>
        <li>Don’t upload content that isn’t yours to share or that is illegal or harmful.</li>
        <li>
          Free accounts have daily limits on photo scans and coach messages. We may change limits to
          keep the service running fairly.
        </li>
      </ul>

      <h2>Paid plans and subscriptions</h2>
      <p>
        Paid plans may be offered through the Apple App Store or Google Play. Where available, the
        purchase screen will show the price, billing period, trial (if any) and included features
        before you confirm. Purchases may be processed with the help of RevenueCat and the relevant
        app store. The store through which you subscribed controls payment collection, renewal,
        cancellation and refund handling. You can manage or cancel a subscription through that
        store’s account settings. Deleting your FITR8 account does not necessarily cancel a store
        subscription; cancel it separately with Apple or Google to avoid future charges.
      </p>

      <h2>Changes and availability</h2>
      <p>
        We keep improving FITR8 and may change or remove features. We try to keep the service
        available but can’t promise it will always be uninterrupted. If we change these terms in a
        way that matters, we’ll tell you in the app before they take effect.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using FITR8 and delete your account at any time. We may suspend accounts that
        break these terms.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided “as is”. To the extent the law allows, we aren’t liable for indirect
        losses, or for decisions you make based on estimates or guidance in the app. Nothing in
        these terms limits rights you have under consumer protection law.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of India. Nothing here removes rights you may have
        under applicable consumer-protection or data-protection law. For questions, complaints or
        support, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
