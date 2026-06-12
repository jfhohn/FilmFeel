/**
 * Criterion 4 — no banding on gradients.
 *
 * Bars are calibrated against Apple's official AppleLog2ToRec709 65³ LUT —
 * the industry-reference behavior that Resolve ships — measured with the SAME
 * metrics (see BUILD_LOG.md M1 for the calibration data):
 *   - gray-ramp luminance reversals: none bigger than one 8-bit display step
 *     (a sub-display-step wiggle cannot render as a band; Apple's LUT shows
 *     ~0.6-step wiggles at the tone-curve shoulder, ours must stay ≤ 1 step);
 *   - consecutive-sample jumps ≤ 2 8-bit steps (posterization detector);
 *   - LUT lattice curvature no worse than Apple's at the same grid spacing
 *     (second differences scale with spacing², so Apple's 65³ value × 4).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../../src/engine/analyze.ts";
import { buildLookTransform } from "../../src/engine/match.ts";
import { bakeLut, parseCube, sampleLut3D, type Lut3D, type ParsedCube } from "../../src/engine/lut.ts";
import { ASSETS, loadImage } from "./helpers.ts";

/** Representative looks: the criterion-3 style pairings users actually make. */
function representativeLuts(): Lut3D[] {
  const pairs: Array<[string, string]> = [
    ["log-frames/street-dusk_applelog2.png", "photos/projector.png"],
    ["log-frames/forest_applelog2.png", "photos/cloud-sunset.png"],
    ["log-frames/portrait-warm_applelog2.png", "photos/milkyway.png"],
  ];
  return pairs.map(([src, ref]) =>
    bakeLut(
      buildLookTransform("applelog2", analyze(loadImage(src, "applelog2", 128)), analyze(loadImage(ref, "rec709", 128)), 1),
      33,
    ),
  );
}

/** Adversarial extreme: darkest image graded to the most saturated one. */
function extremeLookLut(): Lut3D {
  const ref = loadImage("photos/confetti.png", "rec709", 128);
  const src = loadImage("log-frames/portrait-lowkey_applelog2.png", "applelog2", 128);
  return bakeLut(buildLookTransform("applelog2", analyze(src), analyze(ref), 1), 33);
}

function neutralConversionLut(): Lut3D {
  const img = loadImage("photos/lake-cabin.png", "rec709", 128);
  const stats = analyze(img);
  return bakeLut(buildLookTransform("applelog2", stats, stats, 1), 33);
}

function rampMetrics(lut: Lut3D | ParsedCube, steps = 4096): { maxJump: number; maxDrop: number } {
  let maxJump = 0;
  let maxDrop = 0;
  let prev: [number, number, number] | null = null;
  let peakLuma = -Infinity;
  for (let i = 0; i < steps; i++) {
    const v = i / (steps - 1);
    const out = sampleLut3D(lut, v, v, v);
    const luma = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
    maxDrop = Math.max(maxDrop, peakLuma - luma);
    peakLuma = Math.max(peakLuma, luma);
    if (prev) {
      for (let ch = 0; ch < 3; ch++) {
        maxJump = Math.max(maxJump, Math.abs(out[ch] - prev[ch]) * 255);
      }
    }
    prev = out;
  }
  return { maxJump, maxDrop };
}

function maxSecondDiff(lut: Lut3D | ParsedCube): number {
  const N = lut.size;
  const at = (r: number, g: number, b: number, ch: number) => lut.data[(b * N * N + g * N + r) * 3 + ch];
  let worst = 0;
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 1; r < N - 1; r++)
        for (let ch = 0; ch < 3; ch++) {
          worst = Math.max(worst, Math.abs(at(r - 1, g, b, ch) - 2 * at(r, g, b, ch) + at(r + 1, g, b, ch)));
        }
  return worst;
}

const appleLut = parseCube(
  readFileSync(join(ASSETS, "Apple_Log_2_LUTs", "AppleLog2ToRec709-v1.0.cube"), "utf8"),
);

describe("criterion 4: no banding on gradients", () => {
  // Bars from Apple's official LUT measured with the same metrics.
  const appleRamp = rampMetrics(appleLut);
  const appleLattice = maxSecondDiff(appleLut) * 4; // spacing² scaling 65³→33³
  const MARGIN = 1.1;

  it("neutral log→709 conversion: ramp as smooth as Apple's rendering", () => {
    const { maxJump, maxDrop } = rampMetrics(neutralConversionLut());
    expect(maxDrop).toBeLessThanOrEqual(Math.max(1 / 255, appleRamp.maxDrop) * MARGIN);
    expect(maxJump).toBeLessThanOrEqual(2);
  });

  it("representative looks: ramps as smooth as Apple's rendering", () => {
    for (const lut of representativeLuts()) {
      const { maxJump, maxDrop } = rampMetrics(lut);
      expect(maxDrop).toBeLessThanOrEqual(Math.max(1 / 255, appleRamp.maxDrop) * MARGIN);
      expect(maxJump).toBeLessThanOrEqual(2);
    }
  });

  it("lattice curvature of representative looks is in Apple's league", () => {
    expect(maxSecondDiff(neutralConversionLut())).toBeLessThanOrEqual(appleLattice * MARGIN);
    for (const lut of representativeLuts()) {
      expect(maxSecondDiff(lut)).toBeLessThanOrEqual(appleLattice * MARGIN);
    }
  });

  it("adversarial extreme pair degrades gracefully (stress, relaxed bars)", () => {
    // Darkest footage → most saturated reference demands a tonal stretch no
    // smooth 33³ LUT can express exactly; slope limiting keeps it usable.
    const { maxJump, maxDrop } = rampMetrics(extremeLookLut());
    expect(maxDrop).toBeLessThanOrEqual(4 / 255);
    expect(maxJump).toBeLessThanOrEqual(8);
    expect(maxSecondDiff(extremeLookLut())).toBeLessThanOrEqual(appleLattice * 4);
  });
});
