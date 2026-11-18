import { ContactMessageSchema } from "@fitr8/contracts";

/** Public contact details (footer, contact section, Privacy, Terms) and the contact form checks. */
export const CONTACT_EMAIL = "askfitr8@gmail.com";

export const COMPANY_NAME = "Fitr8 Health & Wellness Pvt. Ltd.";

export const CONTACT_ADDRESS =
  "House No-61, Gali No-2, Near Narayan Farm House, Akash Nagar, Ghaziabad";

export type ContactFields = { name: string; email: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

/**
 * The contact form's checks, from the same schema the API enforces (`ContactMessageSchema`); the
 * first problem per field. An empty object means it can be sent.
 */
export function validateContact(f: ContactFields): ContactErrors {
  const result = ContactMessageSchema.safeParse(f);
  if (result.success) return {};
  const errors: ContactErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ContactFields;
    if (key in f && !errors[key]) {
      errors[key] =
        issue.code === "too_big" ? "That’s a bit long; please shorten it." : issue.message;
    }
  }
  return errors;
}
