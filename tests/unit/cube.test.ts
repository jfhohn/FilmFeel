/**
 * Criterion 1 — exported .cube is spec-compliant 33³.
 * Verified by a strict parser/validator that must ALSO parse Apple's two
 * official .cube files cleanly (the cross-check that our validator agrees
 * with what Resolve accepts). Final Resolve import is a manual human step.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../../src/engine/analyze.ts";
import { buildLookTransform } from "../../src/engine/match.ts";
import { bakeLut, exportFilename, parseCube, serializeCube } from "../../src/engine/lut.ts";
import { ASSETS, loadImage } from "./helpers.ts";

function makeRealLut(size = 33) {
  const ref = loadImage("photos/projector.png", "rec709", 128);
  const src = loadImage("log-frames/street-dusk_applelog2.png", "applelog2", 128);
  const t = buildLookTransform("applelog2", analyze(src), analyze(ref), 1);
  return bakeLut(t, size, "FilmFeel Test Look");
}

describe("criterion 1: .cube export", () => {
  const lut = makeRealLut();
  const text = serializeCube(lut);

  it("is a 33³ LUT with finite values in [0,1]", () => {
    expect(lut.size).toBe(33);
    expect(lut.data.length).toBe(33 ** 3 * 3);
    for (const v of lut.data) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("serializes and re-parses identically (round-trip)", () => {
    const parsed = parseCube(text);
    expect(parsed.is3D).toBe(true);
    expect(parsed.size).toBe(33);
    expect(parsed.title).toBe("FilmFeel Test Look");
    expect(parsed.domainMin).toEqual([0, 0, 0]);
    expect(parsed.domainMax).toEqual([1, 1, 1]);
    let maxErr = 0;
    for (let i = 0; i < lut.data.length; i++) {
      maxErr = Math.max(maxErr, Math.abs(parsed.data[i] - lut.data[i]));
    }
    expect(maxErr).toBeLessThan(1e-6); // 6-decimal serialization
  });

  it("validator accepts Apple's official 3D LUT (65³)", () => {
    const cube = parseCube(
      readFileSync(join(ASSETS, "Apple_Log_2_LUTs", "AppleLog2ToRec709-v1.0.cube"), "utf8"),
    );
    expect(cube.is3D).toBe(true);
    expect(cube.size).toBe(65);
    expect(cube.data.length).toBe(65 ** 3 * 3);
  });

  it("validator accepts Apple's official 1D LUT (4096)", () => {
    const cube = parseCube(
      readFileSync(join(ASSETS, "Apple_Log_2_LUTs", "AppleLogToLin-v1.0.cube"), "utf8"),
    );
    expect(cube.is3D).toBe(false);
    expect(cube.size).toBe(4096);
  });

  it("validator rejects malformed cubes", () => {
    expect(() => parseCube("LUT_3D_SIZE 2\n0 0 0\n")).toThrow(/entries/);
    expect(() => parseCube("FROBNICATE 3\n")).toThrow(/unknown keyword/);
    expect(() => parseCube("LUT_3D_SIZE 2\n" + "0 0 NaN\n".repeat(8))).toThrow(/non-finite/);
    expect(() => parseCube("0 0 0\n")).toThrow(/missing/);
  });

  it("export filename follows the PRD pattern", () => {
    expect(exportFilename("neon noir.jpg", "applelog2")).toBe("FilmFeel_NeonNoir_AppleLog2_33.cube");
    expect(exportFilename("IMG_4021.dng", "rec709")).toBe("FilmFeel_IMG4021_Rec709_33.cube");
    expect(exportFilename("", "applelog2")).toBe("FilmFeel_Look_AppleLog2_33.cube");
  });
});
