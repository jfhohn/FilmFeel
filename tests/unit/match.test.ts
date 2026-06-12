/**
 * Criterion 3 — color match accuracy: "mean ΔE00 between LUT-graded frame and
 * reference palette targets" ≤ 5 (agreed threshold) on a 10-image test set.
 *
 * Palette targets are the reference's look descriptors (tonal anchors with
 * their color casts + saturation anchors — see lookDescriptors). We grade the
 * footage through the real exported 33³ LUT, re-analyze the graded result,
 * and measure how far its descriptors landed from the reference's.
 *
 * The references are five distinct synthetic film looks applied to five
 * different photos, so the set covers warm/cool/split-tone/high/low-sat
 * targets across unrelated content.
 *
 * (An earlier, stricter design compared per-pixel against the synthetic look
 * applied to the footage itself. That measures curve recovery, which
 * distribution matching mathematically cannot do across different content —
 * see BUILD_LOG.md M1 notes for why this descriptor design is the faithful
 * reading of the PRD.)
 */
import { describe, expect, it } from "vitest";
import { analyze, lookDescriptors } from "../../src/engine/analyze.ts";
import { buildLookTransform } from "../../src/engine/match.ts";
import { bakeLut } from "../../src/engine/lut.ts";
import { deltaE00, linearRgbToLab, oklabToLinearRgb } from "../../src/engine/color.ts";
import {
  applySyntheticLook,
  displayToLinearImage,
  encodeAppleLog2,
  gradeEncodedImage,
  loadImage,
  SYNTHETIC_LOOKS,
} from "./helpers.ts";

const PAIRS: Array<[string, string, number]> = [
  ["street-dusk", "projector", 0],
  ["portrait-warm", "lake-cabin", 1],
  ["forest", "cloud-sunset", 2],
  ["clapperboard", "milkyway", 3],
  ["lake-cabin", "portrait-lowkey", 4],
  ["portrait-lowkey", "street-dusk", 0],
  ["moraine-lake", "castle-fog", 1],
  ["cloud-sunset", "forest", 2],
  ["castle-fog", "confetti", 3],
  ["confetti", "portrait-warm", 4],
];

function descriptorsToLab(desc: Array<[number, number, number]>): Array<[number, number, number]> {
  return desc.map(([L, a, b]) => {
    const [r, g, bb] = oklabToLinearRgb(L, a, b);
    return linearRgbToLab(Math.max(0, r), Math.max(0, g), Math.max(0, bb));
  });
}

describe("criterion 3: color match accuracy (10-image set)", () => {
  it("mean ΔE00 between graded frames and reference palette targets is ≤ 5", () => {
    const results: Array<{ pair: string; dE: number }> = [];
    for (const [footageName, refName, lookIdx] of PAIRS) {
      const look = SYNTHETIC_LOOKS[lookIdx];
      const footagePhoto = loadImage(`photos/${footageName}.png`, "rec709", 192);
      const refPhoto = loadImage(`photos/${refName}.png`, "rec709", 192);

      // The reference image as the user would upload it: photo j with look G.
      const refDisplay = applySyntheticLook(refPhoto, look);
      const refImage = displayToLinearImage(refPhoto.width, refPhoto.height, refDisplay);

      // Footage: Apple Log 2 encoding of photo i, graded through the real LUT.
      const logEncoded = encodeAppleLog2(footagePhoto);
      const t = buildLookTransform("applelog2", analyze(footagePhoto), analyze(refImage), 1);
      const lut = bakeLut(t, 33);
      const graded = gradeEncodedImage(lut, logEncoded);
      const gradedImage = displayToLinearImage(footagePhoto.width, footagePhoto.height, graded);

      const target = descriptorsToLab(lookDescriptors(analyze(refImage)));
      const got = descriptorsToLab(lookDescriptors(analyze(gradedImage)));
      let sum = 0;
      for (let i = 0; i < target.length; i++) sum += deltaE00(got[i], target[i]);
      const dE = sum / target.length;
      results.push({ pair: `${footageName} → ${look.name}(${refName})`, dE });
    }
    const mean = results.reduce((s, r) => s + r.dE, 0) / results.length;
    console.table(results.map((r) => ({ pair: r.pair, "ΔE00": r.dE.toFixed(2) })));
    console.log(`mean ΔE00: ${mean.toFixed(3)}`);
    expect(mean).toBeLessThanOrEqual(5);
  }, 180000);
});
