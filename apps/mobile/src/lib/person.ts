/**
 * Onboarding step 1 rules, copied from `packages/domain/src/person.ts` (unit-tested there; the app
 * imports workspace packages for types only). Keep the two in step. The server has the final say.
 */

/**
 * Phone numbers typed during onboarding, stored in international (E.164) form: "+" then 8–15
 * digits. Spaces, dashes, dots and brackets are ignored. A bare 10-digit number is taken as Indian
 * (+91), the app's home market; a leading 0 trunk prefix on it is dropped. Anything else needs the
 * country code. Returns null when the input isn't a usable number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!/^\+?[\d\s\-.()]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  if (raw.startsWith("00")) return normalizePhone(`+${digits.slice(2)}`);
  const local = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  return null;
}

/** "+919876543210" → "+91 98765 43210"; other countries stay as stored. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** A country in the phone picker: ISO 3166 code, name, calling code without "+". */
export interface PhoneCountry {
  iso: string;
  name: string;
  dial: string;
}

/** The picker's countries: India first (the home market), then the rest A–Z. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: "IN", name: "India", dial: "91" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "BH", name: "Bahrain", dial: "973" },
  { iso: "BD", name: "Bangladesh", dial: "880" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "HK", name: "Hong Kong", dial: "852" },
  { iso: "ID", name: "Indonesia", dial: "62" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "IT", name: "Italy", dial: "39" },
  { iso: "JP", name: "Japan", dial: "81" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "KW", name: "Kuwait", dial: "965" },
  { iso: "MY", name: "Malaysia", dial: "60" },
  { iso: "MV", name: "Maldives", dial: "960" },
  { iso: "MU", name: "Mauritius", dial: "230" },
  { iso: "NP", name: "Nepal", dial: "977" },
  { iso: "NL", name: "Netherlands", dial: "31" },
  { iso: "NZ", name: "New Zealand", dial: "64" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "OM", name: "Oman", dial: "968" },
  { iso: "PK", name: "Pakistan", dial: "92" },
  { iso: "PH", name: "Philippines", dial: "63" },
  { iso: "QA", name: "Qatar", dial: "974" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "SG", name: "Singapore", dial: "65" },
  { iso: "ZA", name: "South Africa", dial: "27" },
  { iso: "ES", name: "Spain", dial: "34" },
  { iso: "LK", name: "Sri Lanka", dial: "94" },
  { iso: "SE", name: "Sweden", dial: "46" },
  { iso: "CH", name: "Switzerland", dial: "41" },
  { iso: "TH", name: "Thailand", dial: "66" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "US", name: "United States", dial: "1" },
];

export const DEFAULT_PHONE_COUNTRY = "IN";

/** "IN" → "🇮🇳" (two regional-indicator letters). */
export function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const countryOf = (iso: string) => PHONE_COUNTRIES.find((c) => c.iso === iso) ?? PHONE_COUNTRIES[0]!;

/**
 * The number typed after the country picker, as E.164, or null if it isn't valid for that
 * country. India needs a 10-digit mobile (a leading 0 is dropped); elsewhere 4–14 digits, 15 in
 * all with the calling code. A number typed with its own "+" wins over the picker.
 */
export function phoneToE164(iso: string, national: string): string | null {
  const raw = national.trim();
  if (raw.startsWith("+") || raw.startsWith("00")) return normalizePhone(raw);
  if (!/^[\d\s\-.()]+$/.test(raw)) return null;
  const { dial } = countryOf(iso);
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (dial === "91") return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
  return digits.length >= 4 ? normalizePhone(`+${dial}${digits}`) : null;
}

/** Where +1 numbers go when prefilling: the US and Canada share the code. */
const SHARED_DIAL_DEFAULT: Record<string, string> = { "1": "US" };

/**
 * Prefill for the picker from a saved E.164 number: the country with the longest matching calling
 * code (+1 → United States), and the rest as the national number.
 */
export function splitPhone(e164: string | null | undefined): { country: string; national: string } {
  if (!e164?.startsWith("+")) return { country: DEFAULT_PHONE_COUNTRY, national: "" };
  const digits = e164.slice(1);
  const dial = PHONE_COUNTRIES.map((c) => c.dial)
    .filter((d) => digits.startsWith(d))
    .sort((a, b) => b.length - a.length)[0];
  if (!dial) return { country: DEFAULT_PHONE_COUNTRY, national: e164 };
  const country = SHARED_DIAL_DEFAULT[dial] ?? PHONE_COUNTRIES.find((c) => c.dial === dial)!.iso;
  return { country, national: digits.slice(dial.length) };
}

/** Step 1 and PATCH /api/profile/name when another account already has the number. */
export const PHONE_TAKEN =
  "This phone number is already registered with another FITR8 account. Use a different number or leave it empty.";

/** What onboarding step 1 asks: first name, last name (both required) and an optional phone. */
export interface PersonDetails {
  name: string;
  lastName: string;
  /** ISO code chosen in the picker, e.g. "IN". */
  phoneCountry: string;
  /** The number typed after the picker. */
  phone: string;
}

export type PersonProblems = Partial<Record<"name" | "lastName" | "phone", string>>;

/** Step-1 validation shared by the web and the app, with the messages they show. */
export function personProblems(p: PersonDetails): PersonProblems {
  const problems: PersonProblems = {};
  const name = p.name.trim();
  const lastName = p.lastName.trim();
  if (!name) problems.name = "Tell us what to call you";
  else if (name.length > 60) problems.name = "Keep it under 60 characters";
  if (!lastName) problems.lastName = "Add your last name";
  else if (lastName.length > 60) problems.lastName = "Keep it under 60 characters";
  if (p.phone.trim() && !phoneToE164(p.phoneCountry, p.phone))
    problems.phone = "Enter a valid phone number for the country you picked";
  return problems;
}

/**
 * Prefill for step 1 from the account. Google and Apple store the full name in `name` until the
 * user sets their own, so "Asha Rao" splits into "Asha" + "Rao" when there's no last name yet.
 */
export function splitName(
  name: string | null | undefined,
  lastName: string | null | undefined,
): { name: string; lastName: string } {
  const first = (name ?? "").trim();
  if (lastName?.trim()) return { name: first, lastName: lastName.trim() };
  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { name: first, lastName: "" };
  return { name: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]! };
}
