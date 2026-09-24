"use client";

import { Camera, ChevronLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AiLimitSheet, type ScanUsage } from "@/components/ai-limit-sheet";
import { ApiError, api } from "@/lib/client/api";
import { compressImage } from "@/lib/client/image";
import { uploadPhoto } from "@/lib/client/upload";
import { useCamera } from "@/lib/client/use-camera";
import { cn } from "@/lib/cn";
import type { MealType } from "@/lib/format";

/** Labels have small print, so keep more pixels than a plate photo. */
const LABEL_MAX_SIDE = 1600;

export function LabelCamera({
  mealType,
  barcode,
  name,
}: {
  mealType: MealType;
  barcode?: string;
  name?: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { state: camera } = useCamera(videoRef);
  const [phase, setPhase] = useState<"idle" | "uploading" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<ScanUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  async function submit(blob: Blob) {
    setError(null);
    setPhase("uploading");
    try {
      const photoKey = await uploadPhoto(blob);
      setPhase("reading");
      const scan = await api<{ id: string }>("/api/foods/label", {
        method: "POST",
        json: { photoKey, barcode, name },
      });
      router.push(`/log/label/${scan.id}?meal=${mealType}`);
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiError && e.status === 429) {
        setLimit((e.details as ScanUsage | undefined) ?? null);
        setLimitOpen(true);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't read the label. Try again.");
      }
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (camera !== "live" || !video) return fileRef.current?.click();
    try {
      await submit(await compressImage(video, 0.88, LABEL_MAX_SIDE));
    } catch {
      setError("Couldn't take the photo. Try again.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await submit(await compressImage(file, 0.88, LABEL_MAX_SIDE));
    } catch {
      setError("Couldn't read that photo. Try a JPEG or PNG.");
    }
  }

  const busy = phase !== "idle";
  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <div className="flex items-center justify-between px-3 pt-3">
        <Link
          href={
            barcode ? `/log/barcode/${barcode}?meal=${mealType}` : `/log/barcode?meal=${mealType}`
          }
          aria-label="Back"
          className="grid size-11 place-items-center rounded-full hover:bg-white/10"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <p className="text-[15px] font-semibold">Photograph the label</p>
        <span className="size-11" />
      </div>

      <div className="relative mx-5 mt-4 flex-1 overflow-hidden rounded-card bg-white/5">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera preview"
          className={cn(
            "absolute inset-0 size-full object-cover",
            camera !== "live" && "invisible",
          )}
        />
        {camera === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
            <Camera className="size-8 text-white/60" aria-hidden />
            <p className="text-[13px] text-white/70">
              Tap the shutter to take a photo of the label.
            </p>
          </div>
        )}
        {/* Tall frame for the nutrition table. */}
        <div
          aria-hidden
          className="absolute inset-x-10 top-6 bottom-16 rounded-[18px] border-[3px] border-white/90 shadow-[0_0_0_999px_rgb(23_24_28_/_0.5)]"
        />
        <p className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-ink/75 px-3 py-1.5 text-[13px] font-semibold">
          Whole table in frame · per 100 g visible
        </p>
        {busy && (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/75"
          >
            <LoaderCircle className="size-8 animate-spin" aria-hidden />
            <p className="font-semibold">
              {phase === "uploading" ? "Uploading…" : "Reading the label…"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-3 text-center text-[13px] font-semibold text-[#ffb68a]">
          {error}
        </p>
      )}

      <div className="flex justify-center px-5 pt-6 pb-[max(28px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={shoot}
          disabled={busy}
          aria-label="Take photo of label"
          className="grid size-[78px] place-items-center rounded-full border-4 border-white/35 disabled:opacity-50"
        >
          <span className="size-[62px] rounded-full bg-brand-glow transition-transform duration-150 active:scale-95" />
        </button>
      </div>

      <input
        suppressHydrationWarning
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />
      <AiLimitSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        mealType={mealType}
        usage={limit}
      />
    </div>
  );
}
