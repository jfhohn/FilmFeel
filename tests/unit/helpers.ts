/** Shared test utilities: photo loading, CPU LUT grading, synthetic looks. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePng, toRgb } from "../../scripts/png.ts";
import { toLinear, downsample, type ImageF32, type InputFormat } from "../../src/engine/image.ts";
import { linearRgbToOklab, oklabToLinearRgb, linearRgbToLab, deltaE00 } from "../../src/engine/color.ts";
import { srgbDecode, srgbEncode } from "../../src/engine/transfer.ts";
import { sampleLut3D, type Lut3D } from "../../src/engine/lut.ts";

export const ASSETS = join(__dirname, "..", "..", "test-assets");

/** Load a photo (or log frame) as a linear float image, downsampled for speed. */
export function loadImage(relPath: string, format: InputFormat, maxDim = 256): ImageF32 {
  const png = toRgb(decodePng(readFileSync(join(ASSETS, relPath))));
  return downsample(toLinear(format, png.width, png.height, png.data), maxDim);
}

/** Apply a LUT to an ENCODED 8-bit-style image (values 0–1) on the CPU; returns display RGB floats. */
export function gradeEncodedImage(
  lut: Lut3D,
  encoded: Float32Array,
): Float32Array {
  const out = new Float32Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 3) {
    const [r, g, b] = sampleLut3D(lut, encoded[i], encoded[i + 1], encoded[i + 2]);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return out;
}

/** Encode a linear image back to display sRGB floats (no LUT) — comparison baseline. */
export function displayEncode(img: ImageF32): Float32Array {
  const out = new Float32Array(img.data.length);
  for (let i = 0; i < img.data.length; i++) {
    out[i] = Math.min(1, Math.max(0, srgbEncode(img.data[i])));
  }
  return out;
}

/**
 * A parametric film look: tonal S-curve + split-tone cast + saturation scale,
 * applied in Oklab on display-encoded pixels. These are exactly the attributes
 * the product promises to match, so they make a fair ground truth for
 * criterion 3: reference = look(photo j), footage = log(photo i),
 * expected output = look(photo i).
 */
export interface SyntheticLook {
  name: string;
  /** lightness gamma-ish curve: L' = L^g blended s-curve */
  gamma: number;
  contrast: number; // 0..1, s-curve amount
  shadowCast: [number, number]; // Oklab (a, b) added in shadows
  highlightCast: [number, number];
  satScale: number;
}

export const SYNTHETIC_LOOKS: SyntheticLook[] = [
  { name: "TealOrange", gamma: 1.0, contrast: 0.25, shadowCast: [-0.018, -0.022], highlightCast: [0.012, 0.02], satScale: 1.15 },
  { name: "WarmVintage", gamma: 0.92, contrast: 0.1, shadowCast: [0.008, 0.014], highlightCast: [0.006, 0.018], satScale: 0.85 },
  { name: "CoolNoir", gamma: 1.12, contrast: 0.35, shadowCast: [-0.006, -0.02], highlightCast: [-0.004, -0.008], satScale: 0.7 },
  { name: "NeonNight", gamma: 1.05, contrast: 0.2, shadowCast: [0.012, -0.026], highlightCast: [-0.01, 0.006], satScale: 1.3 },
  { name: "FadedFilm", gamma: 0.88, contrast: -0.12, shadowCast: [0.004, 0.01], highlightCast: [0.002, 0.008], satScale: 0.8 },
];

/** Apply a synthetic look to a display-encoded image (returns display floats). */
export function applySyntheticLook(img: ImageF32, look: SyntheticLook): Float32Array {
  const out = new Float32Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 3) {
    const r = Math.max(0, img.data[i]);
    const g = Math.max(0, img.data[i + 1]);
    const bch = Math.max(0, img.data[i + 2]);
    let [L, a, b] = linearRgbToOklab(r, g, bch);
    // tonal: gamma then s-curve around 0.5
    L = Math.pow(Math.min(1.2, Math.max(0, L)), look.gamma);
    L = L + look.contrast * (L - 0.5) * (1 - Math.abs(2 * L - 1));
    // split-tone: smooth blend shadows→highlights by L
    const t = Math.min(1, Math.max(0, (L - 0.2) / 0.6));
    a += look.shadowCast[0] * (1 - t) + look.highlightCast[0] * t;
    b += look.shadowCast[1] * (1 - t) + look.highlightCast[1] * t;
    a *= look.satScale;
    b *= look.satScale;
    const [lr, lg, lb] = oklabToLinearRgb(L, a, b);
    out[i] = Math.min(1, Math.max(0, srgbEncode(Math.max(0, lr))));
    out[i + 1] = Math.min(1, Math.max(0, srgbEncode(Math.max(0, lg))));
    out[i + 2] = Math.min(1, Math.max(0, srgbEncode(Math.max(0, lb))));
  }
  return out;
}

/** Display-encoded float buffer → linear ImageF32 (for re-analysis). */
export function displayToLinearImage(width: number, height: number, display: Float32Array): ImageF32 {
  const data = new Float32Array(display.length);
  for (let i = 0; i < display.length; i++) data[i] = srgbDecode(display[i]);
  return { width, height, data };
}

/** Mean per-pixel ΔE00 between two display-encoded float buffers. */
export function meanDeltaE(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = a.length / 3;
  for (let i = 0; i < a.length; i += 3) {
    const lab1 = linearRgbToLab(srgbDecode(a[i]), srgbDecode(a[i + 1]), srgbDecode(a[i + 2]));
    const lab2 = linearRgbToLab(srgbDecode(b[i]), srgbDecode(b[i + 1]), srgbDecode(b[i + 2]));
    sum += deltaE00(lab1, lab2);
  }
  return sum / n;
}

/** Re-encode a linear image to the Apple Log 2 signal (matches the synth script). */
export function encodeAppleLog2(img: ImageF32): Float32Array {
  // Note: scripts/generate-test-assets.ts writes these to PNG; tests work in
  // floats to avoid double-quantization noise.
  return encodeLogFromLinear(img);
}

import { appleLogEncode } from "../../src/engine/transfer.ts";
import { mat3MulVec, REC709_TO_AWG } from "../../src/engine/color.ts";

function encodeLogFromLinear(img: ImageF32): Float32Array {
  const out = new Float32Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 3) {
    const [ar, ag, ab] = mat3MulVec(REC709_TO_AWG, [img.data[i], img.data[i + 1], img.data[i + 2]]);
    out[i] = Math.min(1, Math.max(0, appleLogEncode(ar)));
    out[i + 1] = Math.min(1, Math.max(0, appleLogEncode(ag)));
    out[i + 2] = Math.min(1, Math.max(0, appleLogEncode(ab)));
  }
  return out;
}
