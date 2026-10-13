/**
 * Onboarding and sign-in button styles. A plain module on purpose: server components (login, plan,
 * get the app, /home) import these, and a string exported from a "use client" file reaches the
 * server as a client reference, not as the string.
 *
 * Each export is complete: use one per element. `cn()` only joins classes (no conflict merging), so
 * combining two of these would leave both colour sets fighting.
 */

/** Shared shape: full-width 54 px pill that lifts on hover and presses into its shadow. */
const pill =
  "inline-flex h-[54px] w-full shrink-0 items-center justify-center gap-2 rounded-full px-6 font-semibold transition-[transform,box-shadow,background-color] duration-150 hover:-translate-0.5 active:translate-1 disabled:translate-0 disabled:opacity-70";

/** Primary: brand purple with the hard deep-purple offset. */
export const onboardingButton = `${pill} bg-fitr8 text-white shadow-hard hover:bg-brand-hover hover:shadow-hard-hover active:shadow-hard-press disabled:shadow-hard`;

/** "Continue with Google": white with a hairline border and the same offset. */
export const googleButton = `${pill} bg-white text-fitr8-ink shadow-[inset_0_0_0_1px_var(--color-line-strong),6px_6px_0_var(--color-fitr8-deep)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong),8px_8px_0_var(--color-fitr8-deep)] active:shadow-[inset_0_0_0_1px_var(--color-line-strong),2px_2px_0_var(--color-fitr8-deep)]`;
