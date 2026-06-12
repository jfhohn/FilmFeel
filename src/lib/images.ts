/** Browser-side image loading: File or URL → pixels for analysis + GL texture. */

export interface LoadedImage {
  name: string;
  /** Object URL (or original URL) for DOM <img> previews. */
  url: string;
  /** Full(ish)-resolution bitmap for the WebGL texture (capped at 2048). */
  bitmap: ImageBitmap;
  /** Downscaled RGBA pixels for the analysis engine (capped at 1024). */
  analysis: { width: number; height: number; pixels: Uint8ClampedArray };
}

async function decodeToBitmap(src: Blob | string): Promise<ImageBitmap> {
  if (typeof src === "string") {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch ${src}: ${res.status}`);
    return createImageBitmap(await res.blob());
  }
  return createImageBitmap(src);
}

function drawScaled(bitmap: ImageBitmap, maxDim: number): { canvas: OffscreenCanvas; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

export async function loadImage(source: File | string, name?: string): Promise<LoadedImage> {
  const raw = await decodeToBitmap(source);
  // GL bitmap (capped to keep texture memory sane on laptops)
  const gl = drawScaled(raw, 2048);
  const bitmap = await createImageBitmap(gl.canvas);
  // analysis pixels
  const an = drawScaled(raw, 1024);
  const ctx = an.canvas.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, an.width, an.height);
  raw.close();
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  return {
    name: name ?? (typeof source === "string" ? source.split("/").pop() ?? "image" : source.name),
    url,
    bitmap,
    analysis: { width: an.width, height: an.height, pixels: data.data },
  };
}
