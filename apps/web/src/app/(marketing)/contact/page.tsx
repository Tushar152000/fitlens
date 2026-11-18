import type { Metadata } from "next";
import { ContactSection } from "../_components/contact-section";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

export const metadata: Metadata = {
  title: "Contact us | FITR8",
  description: "Send the FITR8 team a message, or email us directly.",
};

/** /contact: the contact form (POST /api/contact) and address. Linked from the header and footer. */
export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
