"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import type { StaffMemberDto } from "@fitr8/contracts";
import { STAFF_ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@fitr8/domain/staff";
import { adminApi } from "@/lib/admin/api";
import { cn } from "@/lib/cn";
import { dangerButton, Field, inputClass, smallButton } from "./ui";

/** What each role means, section by section (one line per section as more are added). */
const ROLE_HELP: Record<StaffRole, string> = {
  ADMIN: "Everything in every section, including the team",
  EDITOR:
    "Runs content: on the blog, publishes and edits every post, manages categories, tags and redirects",
  AUTHOR: "Contributes: on the blog, writes drafts that an editor publishes",
};

/** The FITR8 staff: invite by Google email, change roles, remove. Read-only for non-admins. */
export function TeamManager({
  initial,
  selfId,
  canManage,
}: {
  initial: StaffMemberDto[];
  selfId: string;
  canManage: boolean;
}) {
  const [list, setList] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("AUTHOR");
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const m = await adminApi<StaffMemberDto>("/staff", {
        method: "POST",
        json: { email, role, name: name || undefined },
      });
      setList((l) => [...l, m]);
      setEmail("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't invite.");
    }
  }

  async function changeRole(m: StaffMemberDto, next: StaffRole) {
    setError(null);
    try {
      const saved = await adminApi<StaffMemberDto>(`/staff/${m.id}`, {
        method: "PATCH",
        json: { role: next },
      });
      setList((l) => l.map((x) => (x.id === m.id ? saved : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the role.");
    }
  }

  async function remove(m: StaffMemberDto) {
    if (
      !window.confirm(
        `Remove ${m.name} from the team? Their work stays (blog posts keep no author).`,
      )
    )
      return;
    setError(null);
    try {
      await adminApi(`/staff/${m.id}`, { method: "DELETE" });
      setList((l) => l.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove.");
    }
  }

  return (
    <>
      {canManage ? (
        <form
          onSubmit={invite}
          className="mb-6 grid gap-3 rounded-card border border-line bg-surface p-4 md:grid-cols-[1.3fr_1fr_160px_auto] md:items-end"
        >
          <Field label="Google email" htmlFor="tm-email">
            <input
              id="tm-email"
              type="email"
              required
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
            />
          </Field>
          <Field label="Name (optional)" htmlFor="tm-name">
            <input
              id="tm-name"
              maxLength={80}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="tm-role">
            <select
              id="tm-role"
              className={inputClass}
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={cn(smallButton, "h-12")}>
            <UserPlus className="size-4" aria-hidden />
            Invite
          </button>
          <p className="text-[13px] text-ink-3 md:col-span-4">
            They sign in at /admin with that Google account. {ROLE_HELP[role]}.
          </p>
        </form>
      ) : (
        <p className="mb-4 text-[14px] text-ink-2">
          Only admins can invite people or change roles.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-[14px] font-semibold text-caution-text">
          {error}
        </p>
      )}
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {list.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {m.name}
                {m.id === selfId && <span className="ml-2 text-[12px] text-ink-3">(you)</span>}
                {!m.joined && (
                  <span className="ml-2 rounded-full bg-caution-soft px-2 py-0.5 text-[11px] font-bold text-caution-text">
                    Invited
                  </span>
                )}
                {m.fixed && (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                    Set in ADMIN_EMAILS
                  </span>
                )}
              </p>
              <p className="truncate text-[12px] text-ink-3">{m.email}</p>
            </div>
            {canManage && !m.fixed ? (
              <>
                <select
                  aria-label={`Role for ${m.name}`}
                  className={cn(inputClass, "h-10 w-36")}
                  value={m.role}
                  onChange={(e) => changeRole(m, e.target.value as StaffRole)}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={dangerButton}
                  onClick={() => remove(m)}
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <span className="text-[14px] font-semibold text-ink-2">
                {STAFF_ROLE_LABELS[m.role]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
