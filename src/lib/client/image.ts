export const MAX_SIDE = 1024;

/** Downscale so the longest side is ≤ 1024 px and re-encode as JPEG. Accepts a file or a live <video>. */
export async function compressImage(
  source: Blob | HTMLVideoElement,
  quality = 0.82,
): Promise<Blob> {
  let drawable: CanvasImageSource;
  let width: number;
  let height: number;

  if (source instanceof HTMLVideoElement) {
    drawable = source;
    width = source.videoWidth;
    height = source.videoHeight;
  } else {
    // createImageBitmap applies EXIF orientation by default in current browsers.
    const bitmap = await createImageBitmap(source);
    drawable = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  }
  if (!width || !height) throw new Error("Couldn't read that image");

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image");
  ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  if ("close" in drawable && typeof drawable.close === "function") drawable.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't compress that image"))),
      "image/jpeg",
      quality,
    ),
  );
}
