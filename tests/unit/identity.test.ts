/**
 * Criterion 2 — identity round-trip: matching an image to itself yields a
 * near-identity LUT. Agreed epsilon: max per-channel deviation ≤ 0.01.
 */
import { describe, expect, it } from "vitest";
import { analyze } from "../../src/engine/analyze.ts";
import { buildLookTransform } from "../../src/engine/match.ts";
import { bakeLut } from "../../src/engine/lut.ts";
import { gradeEncodedImage, loadImage, meanDeltaE, displayEncode, encodeAppleLog2 } from "./helpers.ts";

const EPSILON = 0.01;

describe("criterion 2: identity round-trip", () => {
  it.each(["projector.png", "portrait-warm.png", "moraine-lake.png", "forest.png"])(
    "Rec.709 self-match is near-identity at every LUT node (%s)",
    (photo) => {
      const img = loadImage(`photos/${photo}`, "rec709", 192);
      const stats = analyze(img);
      const t = buildLookTransform("rec709", stats, stats, 1);
      const lut = bakeLut(t, 33);
      let maxDev = 0;
      let i = 0;
      for (let b = 0; b < 33; b++)
        for (let g = 0; g < 33; g++)
          for (let r = 0; r < 33; r++) {
            maxDev = Math.max(
              maxDev,
              Math.abs(lut.data[i++] - r / 32),
              Math.abs(lut.data[i++] - g / 32),
              Math.abs(lut.data[i++] - b / 32),
            );
          }
      expect(maxDev).toBeLessThanOrEqual(EPSILON);
    },
  );

  it("Apple Log 2 self-match reproduces the original image through the LUT", () => {
    // Footage: synthetic log frame of a photo. Reference: the photo itself.
    // Grading the footage must give back the photo (the LUT bakes in log→709).
    const photo = loadImage("photos/street-dusk.png", "rec709", 192);
    const logEncoded = encodeAppleLog2(photo);
    const logLinear = loadImage("log-frames/street-dusk_applelog2.png", "applelog2", 192);
    const t = buildLookTransform("applelog2", analyze(logLinear), analyze(photo), 1);
    const lut = bakeLut(t, 33);
    const graded = gradeEncodedImage(lut, logEncoded);
    const expected = displayEncode(photo);
    // Trilinear interpolation through the log curve adds small error; ΔE00
    // under 1 is well below a visible difference.
    expect(meanDeltaE(graded, expected)).toBeLessThan(1);
  });

  it("strength 0 is the pure format conversion (no look)", () => {
    const ref = loadImage("photos/confetti.png", "rec709", 128);
    const src = loadImage("photos/forest.png", "rec709", 128);
    const t = buildLookTransform("rec709", analyze(src), analyze(ref), 0);
    const lut = bakeLut(t, 17);
    let maxDev = 0;
    let i = 0;
    for (let b = 0; b < 17; b++)
      for (let g = 0; g < 17; g++)
        for (let r = 0; r < 17; r++) {
          maxDev = Math.max(
            maxDev,
            Math.abs(lut.data[i++] - r / 16),
            Math.abs(lut.data[i++] - g / 16),
            Math.abs(lut.data[i++] - b / 16),
          );
        }
    expect(maxDev).toBeLessThanOrEqual(EPSILON);
  });
});
