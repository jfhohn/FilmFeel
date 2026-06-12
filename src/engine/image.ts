/**
 * Image representation used by the engine: planar Float32 linear Rec.709 RGB.
 * All analysis and matching happens on these; 8-bit encoded images are
 * converted on the way in.
 */
import { appleLogDecode, softFloor, srgbDecode, srgbEncode, toneMapScene } from "./transfer.ts";
import { AWG_TO_REC709, mat3MulVec } from "./color.ts";

export type InputFormat = "applelog2" | "rec709";

export interface ImageF32 {
  width: number;
  height: number;
  /** Interleaved RGB, display-linear Rec.709, unclamped floats. */
  data: Float32Array;
}

/**
 * Decode one encoded pixel triple to DISPLAY-linear Rec.709.
 * For log input that includes the scene→display tone map, so footage and
 * reference photos live in the same statistical domain before matching.
 */
export function decodePixel(format: InputFormat, r: number, g: number, b: number): [number, number, number] {
  if (format === "applelog2") {
    // Tone map per channel IN CAMERA (Apple Wide Gamut) SPACE, before the
    // gamut matrix — the order every vendor rendering uses. Running the
    // matrix on raw scene values first feeds it exponentially large numbers
    // (scene 12 at the grid corners), producing ±4.0 swings per LUT cell
    // that no smooth shoulder can absorb. With bounded [0,1] inputs the
    // matrix output stays in [−0.3, 1.3]: mildly out of gamut, smooth.
    const lr = toneMapScene(appleLogDecode(r));
    const lg = toneMapScene(appleLogDecode(g));
    const lb = toneMapScene(appleLogDecode(b));
    const [r7, g7, b7] = mat3MulVec(AWG_TO_REC709, [lr, lg, lb]);
    return [softFloor(r7), softFloor(g7), softFloor(b7)];
  }
  return [srgbDecode(r), srgbDecode(g), srgbDecode(b)];
}

/** 8-bit interleaved RGB (encoded) → linear float image. */
export function toLinear(format: InputFormat, width: number, height: number, rgb8: Uint8Array): ImageF32 {
  const data = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = decodePixel(format, rgb8[i * 3] / 255, rgb8[i * 3 + 1] / 255, rgb8[i * 3 + 2] / 255);
    data[i * 3] = r;
    data[i * 3 + 1] = g;
    data[i * 3 + 2] = b;
  }
  return { width, height, data };
}

/** Linear float image → 8-bit sRGB-encoded (for previews/tests). */
export function toSrgb8(img: ImageF32): Uint8Array {
  const out = new Uint8Array(img.width * img.height * 3);
  for (let i = 0; i < img.data.length; i++) {
    out[i] = Math.round(Math.min(1, Math.max(0, srgbEncode(img.data[i]))) * 255);
  }
  return out;
}

/**
 * Box-filter downsample so analysis runs on ~`maxDim`-wide stats images.
 * Statistics barely change below the source resolution but speed improves a lot.
 */
export function downsample(img: ImageF32, maxDim = 256): ImageF32 {
  const scale = Math.max(img.width, img.height) / maxDim;
  if (scale <= 1) return img;
  const w = Math.max(1, Math.round(img.width / scale));
  const h = Math.max(1, Math.round(img.height / scale));
  const data = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 3;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          n++;
        }
      const o = (y * w + x) * 3;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
    }
  }
  return { width: w, height: h, data };
}
