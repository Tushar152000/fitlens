"use client";

import { Camera, Flashlight, FlashlightOff, Hash, ScanText, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { normalizeBarcode } from "@/lib/barcode";
import { cn } from "@/lib/cn";
import { useCamera } from "@/lib/client/use-camera";
import type { MealType } from "@/lib/format";
import { ModeTabs } from "../mode-tabs";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** Native BarcodeDetector when the browser has it; else the ZXing WebAssembly ponyfill, loaded lazily. */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
    .BarcodeDetector;
  if (Native) {
    try {
      return new Native({ formats: FORMATS });
    } catch {
      // some browsers expose the class but not these formats
    }
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

export function BarcodeScreen({ mealType }: { mealType: MealType }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state: camera, track } = useCamera(videoRef);
  const [code, setCode] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  const torchSupported = Boolean(
    track && "getCapabilities" in track && (track.getCapabilities() as { torch?: boolean }).torch,
  );
  const productHref = (c: string) => `/log/barcode/${c}?meal=${mealType}`;

  // Scan a few times a second until one valid code is read (one code = one lookup).
  useEffect(() => {
    if (camera !== "live" || code) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        return;
      }
      const tick = async () => {
        const video = videoRef.current;
        if (stopped || !video) return;
        try {
          for (const r of await detector.detect(video)) {
            const valid = normalizeBarcode(r.rawValue);
            if (valid) {
              navigator.vibrate?.(40);
              setCode(valid);
              return;
            }
          }
        } catch {
          // frame not ready yet
        }
        timer = setTimeout(tick, 250);
      };
      tick();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [camera, code]);

  async function toggleTorch() {
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      // not supported on this camera
    }
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const valid = normalizeBarcode(typed);
    if (!valid)
      return setTypedError("That number doesn't look right. Check the digits under the bars.");
    router.push(productHref(valid));
  }

  const status = code
    ? "Barcode read"
    : camera === "unavailable"
      ? "Camera isn't available — type the number instead"
      : "Line up the barcode inside the box";

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <div className="flex items-center justify-between px-3 pt-3">
        <Link
          href="/today"
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-6" />
        </Link>
        <p className="text-[15px] font-semibold">Scan barcode</p>
        {torchSupported ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torch}
            aria-label={torch ? "Turn torch off" : "Turn torch on"}
            className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          >
            {torch ? <FlashlightOff className="size-6" /> : <Flashlight className="size-6" />}
          </button>
        ) : (
          <span className="size-11" />
        )}
      </div>

      <div className="relative mx-5 mt-4 aspect-[3/4] overflow-hidden rounded-card bg-white/5">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera preview"
          className={cn("size-full object-cover", camera !== "live" && "invisible")}
        />
        {camera === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
            <Camera className="size-8 text-white/60" aria-hidden />
            <p className="text-[13px] text-white/70">
              Allow camera access, or type the number printed under the barcode.
            </p>
          </div>
        )}
        {/* Wide scan box; the huge spread shadow dims everything around it. */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-6 top-1/2 h-32 -translate-y-1/2 rounded-[18px] border-[3px] shadow-[0_0_0_999px_rgb(23_24_28_/_0.55)] transition-colors duration-200",
            code ? "border-protein-soft" : "border-white/90",
          )}
        >
          {!code && camera === "live" && (
            <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-brand-glow shadow-[0_0_12px_2px_rgb(232_119_46_/_0.7)] motion-reduce:animate-none" />
          )}
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "absolute inset-x-0 bottom-5 mx-auto w-fit rounded-full px-4 py-2 text-[13px] font-semibold",
            code ? "bg-protein text-white" : "bg-ink/75",
          )}
        >
          {status}
          {code && <span className="ml-1 tabular-nums opacity-80">· {code}</span>}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-5 pt-5">
        {code ? (
          <>
            <Button asChild>
              <Link href={productHref(code)}>See product</Link>
            </Button>
            <Button
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setCode(null)}
            >
              Scan another
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setTypeOpen(true)}
            >
              <Hash className="size-5" aria-hidden />
              Type the number
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              <Link href={`/log/label?meal=${mealType}`}>
                <ScanText className="size-5" aria-hidden />
                Scan the label
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <ModeTabs current="barcode" mealType={mealType} />
      </div>

      <Sheet open={typeOpen} onClose={() => setTypeOpen(false)} title="Type the barcode number">
        <form suppressHydrationWarning onSubmit={submitTyped} className="flex flex-col gap-3">
          <label htmlFor="barcode-number" className="text-[13px] font-semibold text-ink-2">
            The 8, 12 or 13 digits under the bars
          </label>
          <input
            suppressHydrationWarning
            id="barcode-number"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setTypedError(null);
            }}
            placeholder="8901719110023"
            className="h-[52px] rounded-input border border-line-strong bg-surface px-4 text-lg font-semibold tracking-wider tabular-nums outline-none focus:border-ink"
          />
          {typedError && (
            <p role="alert" className="text-[13px] font-semibold text-ink">
              {typedError}
            </p>
          )}
          <Button type="submit">Find product</Button>
        </form>
      </Sheet>
    </div>
  );
}
