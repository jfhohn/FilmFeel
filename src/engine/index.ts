/**
 * Engine facade — the one call the app makes:
 * reference image + footage frame + format + strength → 33³ LUT.
 */
import { analyze } from "./analyze.ts";
import { buildLookTransform } from "./match.ts";
import { bakeLut, type Lut3D } from "./lut.ts";
import type { ImageF32, InputFormat } from "./image.ts";

export interface GenerateOptions {
  format: InputFormat;
  strength?: number;
  size?: number;
  title?: string;
}

export function generateLut(reference: ImageF32, footage: ImageF32, opts: GenerateOptions): Lut3D {
  const refStats = analyze(reference);
  const srcStats = analyze(footage);
  const transform = buildLookTransform(opts.format, srcStats, refStats, opts.strength ?? 1);
  return bakeLut(transform, opts.size ?? 33, opts.title ?? "FilmFeel Look");
}

export { analyze, paletteTargets } from "./analyze.ts";
export { buildLookTransform, MonotoneSpline, highlightRolloff } from "./match.ts";
export { bakeLut, serializeCube, parseCube, sampleLut3D, exportFilename } from "./lut.ts";
export { toLinear, toSrgb8, downsample, decodePixel } from "./image.ts";
export type { ImageF32, InputFormat } from "./image.ts";
export type { Lut3D, ParsedCube } from "./lut.ts";
export type { LookStats } from "./analyze.ts";
export type { LookTransform } from "./match.ts";
