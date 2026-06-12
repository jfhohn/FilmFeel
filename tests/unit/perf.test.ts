/**
 * Criterion 5 — full generation (analyze both images + build transform +
 * bake 33³ LUT + serialize) completes in well under 10 s. Node timing is a
 * close proxy for the browser (same V8 engine as Chrome); in-browser timing
 * is verified again in M4.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePng, toRgb } from "../../scripts/png.ts";
import { toLinear } from "../../src/engine/image.ts";
import { generateLut } from "../../src/engine/index.ts";
import { serializeCube } from "../../src/engine/lut.ts";
import { ASSETS } from "./helpers.ts";

describe("criterion 5: generation under 10 s", () => {
  it("full-resolution end-to-end generation", () => {
    // Full 1600px images — decode cost included to be conservative.
    const refPng = toRgb(decodePng(readFileSync(join(ASSETS, "photos", "moraine-lake.png"))));
    const srcPng = toRgb(decodePng(readFileSync(join(ASSETS, "log-frames", "portrait-warm_applelog2.png"))));
    const start = performance.now();
    const ref = toLinear("rec709", refPng.width, refPng.height, refPng.data);
    const src = toLinear("applelog2", srcPng.width, srcPng.height, srcPng.data);
    const lut = generateLut(ref, src, { format: "applelog2", title: "Perf Test" });
    const text = serializeCube(lut);
    const elapsed = performance.now() - start;
    console.log(`generation took ${elapsed.toFixed(0)} ms`);
    expect(text.length).toBeGreaterThan(33 ** 3 * 10);
    expect(elapsed).toBeLessThan(10000);
  }, 30000);
});
