"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BlogAdminPostDto } from "@fitr8/contracts";
import { Button } from "@/components/ui";
import { blogApi } from "@/lib/admin/api";
import { cn } from "@/lib/cn";

/** Creates an empty draft and opens it in the editor. */
export function NewPostButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const post = await blogApi<BlogAdminPostDto>("/posts", { method: "POST", json: {} });
      router.push(`/admin/blog/posts/${post.id}`);
    } catch (err) {
      setBusy(false);
      window.alert(err instanceof Error ? err.message : "Couldn't create a post.");
    }
  }
  return (
    <Button onClick={create} disabled={busy} className={cn(compact && "h-10 text-[14px]")}>
      <Plus className="size-5" aria-hidden />
      {busy ? "Creating…" : "New post"}
    </Button>
  );
}
