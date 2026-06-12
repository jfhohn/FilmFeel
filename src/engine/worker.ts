/**
 * Generation runs in a Web Worker so the main thread stays at 60fps during
 * the developing animation. Input: raw RGBA pixels of both images. Output:
 * two LUTs — base conversion (strength 0) and full look (strength 1).
 */
import { analyze } from "./analyze.ts";
import { buildLookTransform } from "./match.ts";
import { bakeLut } from "./lut.ts";
import type { ImageF32, InputFormat } from "./image.ts";
import { decodePixel } from "./image.ts";

export interface GenerateRequest {
  kind: "generate";
  format: InputFormat;
  reference: { width: number; height: number; pixels: Uint8ClampedArray }; // RGBA
  footage: { width: number; height: number; pixels: Uint8ClampedArray }; // RGBA
}

export interface GenerateResponse {
  kind: "result";
  base: { size: number; data: Float32Array };
  look: { size: number; data: Float32Array };
  elapsedMs: number;
}

function rgbaToLinear(format: InputFormat, width: number, height: number, rgba: Uint8ClampedArray): ImageF32 {
  const data = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = decodePixel(format, rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255);
    data[i * 3] = r;
    data[i * 3 + 1] = g;
    data[i * 3 + 2] = b;
  }
  return { width, height, data };
}

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const msg = e.data;
  if (msg.kind !== "generate") return;
  const start = performance.now();
  const ref = rgbaToLinear("rec709", msg.reference.width, msg.reference.height, msg.reference.pixels);
  const src = rgbaToLinear(msg.format, msg.footage.width, msg.footage.height, msg.footage.pixels);
  const refStats = analyze(ref);
  const srcStats = analyze(src);
  const look = bakeLut(buildLookTransform(msg.format, srcStats, refStats, 1), 33, "FilmFeel Look");
  const base = bakeLut(buildLookTransform(msg.format, srcStats, srcStats, 0), 33, "FilmFeel Base");
  const res: GenerateResponse = {
    kind: "result",
    base: { size: base.size, data: base.data },
    look: { size: look.size, data: look.data },
    elapsedMs: performance.now() - start,
  };
  (self as unknown as Worker).postMessage(res, [base.data.buffer, look.data.buffer]);
};
