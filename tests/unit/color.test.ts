/**
 * Color math sanity: matrices derived from published chromaticities must hit
 * known reference values; ΔE2000 must reproduce Sharma's published test pairs.
 */
import { describe, expect, it } from "vitest";
import {
  AWG_TO_REC709,
  deltaE00,
  linearRgbToLab,
  linearRgbToOklab,
  mat3MulVec,
  oklabToLinearRgb,
  REC709,
  rgbToXyzMatrix,
} from "../../src/engine/color.ts";

describe("gamut matrices", () => {
  it("Rec.709 → XYZ matches the BT.709 luminance row", () => {
    const m = rgbToXyzMatrix(REC709);
    expect(m[3]).toBeCloseTo(0.2126, 4);
    expect(m[4]).toBeCloseTo(0.7152, 4);
    expect(m[5]).toBeCloseTo(0.0722, 4);
  });

  it("Apple Wide Gamut → Rec.709 maps white to white (both D65)", () => {
    const [r, g, b] = mat3MulVec(AWG_TO_REC709, [1, 1, 1]);
    expect(r).toBeCloseTo(1, 6);
    expect(g).toBeCloseTo(1, 6);
    expect(b).toBeCloseTo(1, 6);
  });

  it("Apple Wide Gamut is wider than Rec.709 (pure AWG red leaves 709 gamut)", () => {
    const [, g, b] = mat3MulVec(AWG_TO_REC709, [1, 0, 0]);
    expect(Math.min(g, b)).toBeLessThan(0);
  });
});

describe("Oklab", () => {
  it("white is (1, 0, 0)", () => {
    const [L, a, b] = linearRgbToOklab(1, 1, 1);
    expect(L).toBeCloseTo(1, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });
  it("matches Ottosson's reference for sRGB red", () => {
    const [L, a, b] = linearRgbToOklab(1, 0, 0);
    expect(L).toBeCloseTo(0.6279, 3);
    expect(a).toBeCloseTo(0.2249, 3);
    expect(b).toBeCloseTo(0.1258, 3);
  });
  it("round-trips", () => {
    const cases: Array<[number, number, number]> = [
      [0.2, 0.5, 0.8],
      [0.01, 0.01, 0.02],
      [0.9, 0.4, 0.1],
      [0, 0, 1],
      [1, 0, 0],
    ];
    for (const rgb of cases) {
      const [L, a, b] = linearRgbToOklab(...rgb);
      const back = oklabToLinearRgb(L, a, b);
      for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(rgb[i], 6);
    }
  });
});

describe("ΔE2000", () => {
  it("reproduces Sharma et al. reference pairs", () => {
    // (Lab1, Lab2, expected ΔE00) from the standard CIEDE2000 test data set.
    const cases: Array<[[number, number, number], [number, number, number], number]> = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
      [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
    ];
    for (const [lab1, lab2, expected] of cases) {
      expect(deltaE00(lab1, lab2)).toBeCloseTo(expected, 3);
    }
  });

  it("identical colors have ΔE 0", () => {
    const lab = linearRgbToLab(0.3, 0.5, 0.2);
    expect(deltaE00(lab, lab)).toBe(0);
  });
});
