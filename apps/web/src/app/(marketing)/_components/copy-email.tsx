"use client";

import { Copy } from "lucide-react";
import { useRef, useState } from "react";
import { CONTACT_EMAIL } from "./contact";

/** The contact address as a mailto link plus a Copy button (selects the text without clipboard). */
export function CopyEmail() {
  const [label, setLabel] = useState("Copy");
  const addr = useRef<HTMLAnchorElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setLabel("Copied");
    } catch {
      // No clipboard access: select the address so the user can copy it themselves.
      const range = document.createRange();
      if (addr.current) range.selectNodeContents(addr.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setLabel("Selected");
    }
    window.setTimeout(() => setLabel("Copy"), 1600);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        ref={addr}
        href={`mailto:${CONTACT_EMAIL}`}
        className="rounded-[10px] bg-fitr8-soft px-3 py-2 font-semibold select-all hover:underline"
      >
        {CONTACT_EMAIL}
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-full bg-fitr8 px-3.5 text-sm font-semibold text-white hover:bg-brand-hover"
      >
        <Copy className="size-4" aria-hidden />
        <span aria-live="polite">{label}</span>
      </button>
    </div>
  );
}
