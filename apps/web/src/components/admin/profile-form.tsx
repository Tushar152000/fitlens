"use client";

import { useState } from "react";
import type { BlogAuthorProfileDto } from "@fitr8/contracts";
import { isValidSlug } from "@fitr8/domain/blog";
import { Button } from "@/components/ui";
import { blogApi } from "@/lib/admin/api";
import { SITE_URL } from "@/lib/site-url";
import { ImagePicker } from "./image-picker";
import { Card, Field, inputClass, smallButton, textareaClass } from "./ui";

/** The public author profile: name, photo, bio and links (shown on posts and /blog/author/…). */
export function ProfileForm({ profile: m }: { profile: BlogAuthorProfileDto }) {
  const [v, setV] = useState({
    name: m.name,
    slug: m.slug,
    bio: m.bio ?? "",
    avatar: m.avatar,
    website: m.website ?? "",
    twitter: m.twitter ?? "",
    linkedin: m.linkedin ?? "",
  });
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await blogApi("/profile", {
        method: "PUT",
        json: { ...v, avatar: undefined, avatarId: v.avatar?.id ?? null },
      });
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-[640px]">
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {v.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- library image
            <img src={v.avatar.url} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <div className="grid size-16 place-items-center rounded-full bg-brand text-2xl font-bold text-white">
              {v.name.slice(0, 1)}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className={smallButton} onClick={() => setPicking(true)}>
              {v.avatar ? "Change photo" : "Add a photo"}
            </button>
            {v.avatar && (
              <button
                type="button"
                className={smallButton}
                onClick={() => setV({ ...v, avatar: null })}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <Field label="Name" htmlFor="pf-name">
          <input
            id="pf-name"
            required
            maxLength={80}
            className={inputClass}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </Field>
        <Field
          label="Profile URL"
          htmlFor="pf-slug"
          hint={
            isValidSlug(v.slug)
              ? `${SITE_URL.replace(/^https?:\/\//, "")}/blog/author/${v.slug}`
              : "Lower-case words and hyphens only."
          }
        >
          <input
            id="pf-slug"
            required
            className={inputClass}
            value={v.slug}
            onChange={(e) => setV({ ...v, slug: e.target.value.toLowerCase() })}
          />
        </Field>
        <Field
          label="Bio"
          htmlFor="pf-bio"
          hint="One or two lines: who you are and why readers can trust you (credentials help SEO)."
        >
          <textarea
            id="pf-bio"
            rows={3}
            maxLength={600}
            className={textareaClass}
            value={v.bio}
            onChange={(e) => setV({ ...v, bio: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Website" htmlFor="pf-web">
            <input
              id="pf-web"
              type="url"
              className={inputClass}
              value={v.website}
              placeholder="https://"
              onChange={(e) => setV({ ...v, website: e.target.value })}
            />
          </Field>
          <Field label="X handle" htmlFor="pf-x">
            <input
              id="pf-x"
              maxLength={40}
              className={inputClass}
              value={v.twitter}
              placeholder="@name"
              onChange={(e) => setV({ ...v, twitter: e.target.value })}
            />
          </Field>
          <Field label="LinkedIn URL" htmlFor="pf-li">
            <input
              id="pf-li"
              type="url"
              className={inputClass}
              value={v.linkedin}
              placeholder="https://linkedin.com/in/…"
              onChange={(e) => setV({ ...v, linkedin: e.target.value })}
            />
          </Field>
        </div>
        {msg && (
          <p
            role="status"
            className={
              msg.ok
                ? "text-[14px] font-semibold text-protein"
                : "text-[14px] font-semibold text-caution-text"
            }
          >
            {msg.text}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>
      <ImagePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(a) => setV({ ...v, avatar: a })}
        title="Your photo"
      />
    </Card>
  );
}
