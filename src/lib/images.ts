/**
 * Browser-side image loading: File or URL → pixels for analysis + GL texture.
 * Uses plain detached <canvas> elements (not OffscreenCanvas — WebKit lacks
 * it) — a canvas is a valid WebGL texture source in every browser.
 */

export interface LoadedImage {
  name: string;
  /** Object URL (or original URL) for DOM <img> previews. */
  url: string;
  /** Full(ish)-resolution canvas for the WebGL texture (capped at 2048). */
  texture: HTMLCanvasElement;
  width: number;
  height: number;
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

function drawScaled(bitmap: ImageBitmap, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function loadImage(source: File | string, name?: string): Promise<LoadedImage> {
  const raw = await decodeToBitmap(source);
  const texture = drawScaled(raw, 2048);
  const an = drawScaled(raw, 1024);
  const data = an.getContext("2d")!.getImageData(0, 0, an.width, an.height);
  raw.close();
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  return {
    name: name ?? (typeof source === "string" ? source.split("/").pop() ?? "image" : source.name),
    url,
    texture,
    width: texture.width,
    height: texture.height,
    analysis: { width: an.width, height: an.height, pixels: data.data },
  };
}
