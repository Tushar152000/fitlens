"use client";

import { CONTACT_MESSAGE_MAX } from "@fitr8/contracts";
import { ArrowRight, CircleCheck, Loader2, Mail, MapPin } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FieldError } from "@/components/ui/field-error";
import { api, ApiError } from "@/lib/client/api";
import {
  COMPANY_NAME,
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  type ContactErrors,
  type ContactFields,
  validateContact,
} from "./contact";
import { CopyEmail } from "./copy-email";
import { ctaArrow, hardButton } from "./cta";
import { PillWord } from "./section-head";

const input =
  "w-full rounded-input border border-line-strong bg-surface px-4 text-base outline-none placeholder:text-ink-3/60 focus:border-ink aria-invalid:border-caution";

/**
 * The /contact page body: the address on the left, a short form on the right.
 * Send posts to POST /api/contact, which emails the team (Reply-To = the visitor); on success the
 * form is replaced by a thank-you card.
 */
export function ContactSection() {
  const id = useId();
  const [fields, setFields] = useState<ContactFields>({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const set =
    (k: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((f) => ({ ...f, [k]: e.target.value }));
      if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
    };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    const found = validateContact(fields);
    setErrors(found);
    const first = (Object.keys(found) as (keyof ContactFields)[])[0];
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setStatus("sending");
    setFailure(null);
    try {
      await api("/api/contact", {
        method: "POST",
        json: { ...fields, website: honeypot.current?.value || undefined },
      });
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setFailure(
        err instanceof ApiError
          ? err.message
          : `We couldn’t send your message. Please try again, or email us at ${CONTACT_EMAIL}.`,
      );
    }
  }

  function reset() {
    setFields({ name: "", email: "", message: "" });
    setStatus("idle");
  }

  const field = (k: keyof ContactFields) => ({
    id: `${id}-${k}`,
    name: k,
    value: fields[k],
    onChange: set(k),
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${id}-${k}-error` : undefined,
  });

  return (
    <section aria-labelledby="contact-heading" className="bg-white py-16 sm:py-24">
      <div className="mx-auto grid max-w-[1300px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-10">
        <div>
          <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-fitr8 uppercase">
            Contact us
          </p>
          <h1
            id="contact-heading"
            className="max-w-[12em] text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[48px]"
          >
            Questions? <PillWord>Write to us.</PillWord>
          </h1>
          <p className="mt-4 max-w-[30em] text-[17px] text-ink-2">
            Feedback, a problem with your account, or something you’d like FITR8 to do. Send us a
            message and we’ll get back to you as soon as we can.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-fitr8 text-white shadow-hard-sm">
                <Mail className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-2">
                <p className="font-semibold">Email us directly</p>
                <CopyEmail />
              </div>
            </div>
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-fitr8 text-white shadow-hard-sm">
                <MapPin className="size-5" aria-hidden />
              </span>
              <div className="text-[15px] text-ink-2">
                <p className="font-semibold text-fitr8-ink">{COMPANY_NAME}</p>
                <address className="mt-1 not-italic">{CONTACT_ADDRESS}</address>
              </div>
            </div>
          </div>
        </div>

        {status === "sent" ? (
          <div
            role="status"
            className="flex flex-col items-start gap-4 self-start rounded-[24px] bg-fitr8-lilac-soft p-6 sm:p-9"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-fitr8 text-white shadow-hard-sm">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <h3 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">
              Thanks, {fields.name.trim().split(/\s+/)[0]}. Your message is on its way.
            </h3>
            <p className="max-w-[30em] text-[17px] text-ink-2">
              We’ll reply to {fields.email.trim()} as soon as we can.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-2 inline-flex h-11 items-center rounded-full bg-white px-5 text-[15px] font-semibold shadow-[0_0_0_1px_var(--color-line)] transition-colors hover:text-fitr8"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={submit}
            className="relative flex flex-col gap-5 self-start rounded-[24px] bg-fitr8-lilac-soft p-6 sm:p-9"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-name`} className="text-[15px] font-semibold">
                  Your name
                </label>
                <input {...field("name")} autoComplete="name" className={`${input} h-[52px]`} />
                {errors.name && <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-email`} className="text-[15px] font-semibold">
                  Your email
                </label>
                <input
                  {...field("email")}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={`${input} h-[52px]`}
                />
                {errors.email && <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`${id}-message`} className="text-[15px] font-semibold">
                  Message
                </label>
                <span className="text-[13px] text-ink-3" aria-hidden>
                  {fields.message.length}/{CONTACT_MESSAGE_MAX}
                </span>
              </div>
              <textarea
                {...field("message")}
                rows={6}
                maxLength={CONTACT_MESSAGE_MAX}
                placeholder="How can we help?"
                className={`${input} resize-y py-3`}
              />
              {errors.message && (
                <FieldError id={`${id}-message-error`}>{errors.message}</FieldError>
              )}
            </div>
            {/* Honeypot: hidden from people and screen readers; bots that fill it are dropped server-side. */}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor={`${id}-website`}>Website</label>
              <input
                ref={honeypot}
                id={`${id}-website`}
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            {failure && <FieldError>{failure}</FieldError>}
            <button
              type="submit"
              disabled={status === "sending"}
              className={`${hardButton} self-start bg-fitr8 text-white disabled:pointer-events-none disabled:opacity-80`}
            >
              {status === "sending" ? (
                <>
                  Sending…
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                </>
              ) : (
                <>
                  Send message
                  <ArrowRight className={ctaArrow} aria-hidden />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
