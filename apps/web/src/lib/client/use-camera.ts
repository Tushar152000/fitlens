"use client";

import { useEffect, useState, type RefObject } from "react";

export type CameraState = "starting" | "live" | "unavailable";

/** Starts the rear camera into `videoRef` and stops it on unmount. Needs HTTPS (or localhost). */
export function useCamera(videoRef: RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<CameraState>("starting");
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);

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
      setTrack(s.getVideoTracks()[0] ?? null);
      setState("live");
    }
    start().catch(() => !cancelled && setState("unavailable"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  return { state, track };
}
