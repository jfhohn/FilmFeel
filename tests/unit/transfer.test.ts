/**
 * Ground-truth tests for the Apple Log transfer function.
 * Oracle 1: the four official reference points published in the white paper.
 * Oracle 2: Apple's own AppleLogToLin-v1.0.cube (4096-point 1D LUT).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appleLogDecode,
  appleLogEncode,
  APPLE_LOG_TEST_VECTORS,
  srgbDecode,
  srgbEncode,
} from "../../src/engine/transfer.ts";
import { parseCube } from "../../src/engine/lut.ts";

const assets = join(__dirname, "..", "..", "test-assets");

describe("Apple Log transfer function", () => {
  it("matches the white paper reference points", () => {
    for (const [scene, encoded] of APPLE_LOG_TEST_VECTORS) {
      expect(appleLogEncode(scene)).toBeCloseTo(encoded, 4);
    }
  });

  it("decode inverts encode across the full range", () => {
    for (let i = 0; i <= 1000; i++) {
      const R = -0.05 + (i / 1000) * 12.05; // R0..1200%
      const P = appleLogEncode(R);
      const back = appleLogDecode(P);
      const expected = Math.max(R, 0.01) === R || R >= -0.05641088 ? R : -0.05641088;
      expect(back).toBeCloseTo(expected, 6);
    }
  });

  it("is continuous at the parabola/log junction", () => {
    const eps = 1e-9;
    expect(appleLogEncode(0.01 - eps)).toBeCloseTo(appleLogEncode(0.01 + eps), 6);
  });

  it("matches Apple's official AppleLogToLin 1D LUT (oracle)", () => {
    const cube = parseCube(
      readFileSync(join(assets, "Apple_Log_2_LUTs", "AppleLogToLin-v1.0.cube"), "utf8"),
    );
    expect(cube.is3D).toBe(false);
    expect(cube.size).toBe(4096);
    let maxErr = 0;
    for (let i = 0; i < cube.size; i++) {
      const P = i / (cube.size - 1);
      const err = Math.abs(appleLogDecode(P) - cube.data[i * 3]);
      maxErr = Math.max(maxErr, err);
    }
    // Relative to a 0–12+ scene range, 1e-4 absolute is far below visibility.
    expect(maxErr).toBeLessThan(1e-4);
  });
});

describe("sRGB transfer", () => {
  it("round-trips", () => {
    for (let i = 0; i <= 255; i++) {
      const v = i / 255;
      expect(srgbEncode(srgbDecode(v))).toBeCloseTo(v, 6);
    }
  });
  it("hits the standard anchors", () => {
    expect(srgbDecode(0)).toBe(0);
    expect(srgbDecode(1)).toBeCloseTo(1, 9);
    expect(srgbDecode(0.5)).toBeCloseTo(0.21404, 4);
  });
});
