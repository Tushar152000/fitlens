"use client";

import { Camera, Images, Keyboard, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AiLimitSheet } from "@/components/ai-limit-sheet";
import { useOnline } from "@/components/offline-banner";
import { Sheet } from "@/components/sheet";
import { Button, Chip } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { compressImage } from "@/lib/client/image";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/format";

type CameraState = "starting" | "live" | "unavailable";
type Phase = "idle" | "uploading" | "analysing";

export function CameraScreen({
  initialMealType,
  startInTextMode,
}: {
  initialMealType: MealType;
  startInTextMode: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(startInTextMode);
  const [text, setText] = useState("");
  const [limitOpen, setLimitOpen] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("No camera API");
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      if (cancelled) return s.getTracks().forEach((t) => t.stop());
      stream = s;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = s;
      await video.play().catch(() => undefined);
      setCamera("live");
    }
    start().catch(() => !cancelled && setCamera("unavailable"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const busy = phase !== "idle";

  function fail(e: unknown) {
    setPhase("idle");
    if (e instanceof ApiError && e.status === 429) {
      setTextOpen(false);
      setLimitOpen(true);
      return;
    }
    setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
  }

  async function submitPhoto(blob: Blob) {
    setError(null);
    if (!online) return setError("You're offline. Connect and try again.");
    setPhase("uploading");
    try {
      const { key, uploadUrl } = await api<{ key: string; uploadUrl: string }>(
        "/api/meals/upload-url",
        { method: "POST", json: { contentType: "image/jpeg", sizeBytes: blob.size } },
      );
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      }).catch(() => null);
      if (!put?.ok) throw new Error("Upload failed. Check your connection and try again.");
      setPhase("analysing");
      const log = await api<{ id: string }>("/api/meals", {
        method: "POST",
        json: { source: "PHOTO", mealType, photoKey: key },
      });
      router.push(`/log/${log.id}`);
    } catch (e) {
      fail(e);
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (camera !== "live" || !video) return cameraInputRef.current?.click();
    try {
      await submitPhoto(await compressImage(video));
    } catch (e) {
      fail(e);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await submitPhoto(await compressImage(file));
    } catch (err) {
      fail(
        err instanceof ApiError ? err : new Error("Couldn't read that photo. Try a JPEG or PNG."),
      );
    }
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (text.trim().length < 2) return setError("Describe what you ate, e.g. 2 roti, 1 katori dal");
    setPhase("analysing");
    try {
      const log = await api<{ id: string }>("/api/meals", {
        method: "POST",
        json: { source: "TEXT", mealType, text: text.trim() },
      });
      router.push(`/log/${log.id}`);
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Link
          href="/today"
          aria-label="Close"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-6" />
        </Link>
        <div
          role="group"
          aria-label="Meal"
          className="-my-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto py-1"
        >
          {MEAL_TYPES.map((t) => (
            <Chip key={t} tone="dark" selected={t === mealType} onClick={() => setMealType(t)}>
              {MEAL_LABEL[t]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="relative mx-5 mt-4 aspect-[3/4] overflow-hidden rounded-card bg-white/5">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera preview"
          className={`size-full object-cover ${camera === "live" ? "" : "invisible"}`}
        />
        {camera === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
            <Camera className="size-8 text-white/60" aria-hidden />
            <p className="font-semibold">Camera preview isn&apos;t available</p>
            <p className="text-[13px] text-white/70">
              Tap the shutter to take a photo with your camera app, or pick one from your gallery.
            </p>
          </div>
        )}
        <Corners />
        <p className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-ink/70 px-3 py-1.5 text-[13px] font-semibold">
          Shoot from above · whole plate in frame
        </p>
        {busy && (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/75"
          >
            <LoaderCircle className="size-8 animate-spin" aria-hidden />
            <p className="font-semibold">
              {phase === "uploading" ? "Uploading your photo…" : "Reading your plate…"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-3 text-center text-[13px] font-semibold text-[#ffb68a]">
          {error}
        </p>
      )}

      <div className="mt-auto grid grid-cols-3 items-center px-5 pt-6 pb-[max(28px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={busy}
          className="flex flex-col items-center gap-1 justify-self-start text-[12px] font-semibold text-white/85"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-white/12">
            <Images className="size-6" aria-hidden />
          </span>
          Gallery
        </button>
        <button
          type="button"
          onClick={shoot}
          disabled={busy}
          aria-label="Take photo"
          className="grid size-[78px] place-items-center justify-self-center rounded-full border-4 border-white/35 disabled:opacity-50"
        >
          <span className="size-[62px] rounded-full bg-brand-glow transition-transform duration-150 active:scale-95" />
        </button>
        <button
          type="button"
          onClick={() => setTextOpen(true)}
          disabled={busy}
          className="flex flex-col items-center gap-1 justify-self-end text-[12px] font-semibold text-white/85"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-white/12">
            <Keyboard className="size-6" aria-hidden />
          </span>
          Type instead
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />
      <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={onFile} />

      <Sheet
        open={textOpen}
        onClose={() => setTextOpen(false)}
        title={`Type your ${MEAL_LABEL[mealType].toLowerCase()}`}
      >
        <form onSubmit={submitText} className="flex flex-col gap-4">
          <label htmlFor="meal-text" className="sr-only">
            What did you eat?
          </label>
          <textarea
            id="meal-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="2 roti, 1 katori dal, half katori sabzi"
            className="rounded-input border border-line-strong bg-surface p-4 text-base outline-none focus:border-ink"
          />
          {error && textOpen && (
            <p role="alert" className="text-[13px] font-semibold text-brand">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Reading…" : "Find foods"}
          </Button>
        </form>
      </Sheet>

      <AiLimitSheet open={limitOpen} onClose={() => setLimitOpen(false)} mealType={mealType} />
    </div>
  );
}

/** Four L-shaped guides framing the plate. */
function Corners() {
  const base = "absolute size-9 border-white/85";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-5">
      <span className={`${base} top-0 left-0 rounded-tl-2xl border-t-[3px] border-l-[3px]`} />
      <span className={`${base} top-0 right-0 rounded-tr-2xl border-t-[3px] border-r-[3px]`} />
      <span className={`${base} bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]`} />
      <span className={`${base} right-0 bottom-0 rounded-br-2xl border-r-[3px] border-b-[3px]`} />
    </div>
  );
}
