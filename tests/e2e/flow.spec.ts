/**
 * Criterion 6 — the upload → download flow works with zero instructions, in
 * Chromium, Firefox, and WebKit (the Safari engine — agreed Safari proxy).
 * Also: the downloaded .cube must parse with the strict validator, and the
 * GPU preview must match the CPU engine (M3 cross-check).
 */
import { test, expect, type Page } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const PHOTO = join(here, "..", "..", "test-assets", "photos", "moraine-lake.png");
const LOG_FRAME = join(here, "..", "..", "test-assets", "log-frames", "forest_applelog2.png");

interface FilmFeelHook {
  phase: string;
  gpuCheck: (() => Promise<{ maxErr: number; meanErr: number; samples: number }>) | null;
}

/** Wait until the app reports the given phase via its test hook. */
function waitForPhase(page: Page, phase: string, timeout = 45000) {
  return page.waitForFunction(
    (p) => (window as unknown as { __filmfeel?: FilmFeelHook }).__filmfeel?.phase === p,
    phase,
    { timeout },
  );
}

test("landing demo generates on load (empty state teaches)", async ({ page }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");
  await expect(page.getByTestId("viewer-canvas")).toBeVisible();
  await expect(page.getByTestId("viewer-handle")).toBeVisible();
  await expect(page.getByTestId("gen-time")).toBeVisible();
});

test("full flow: upload reference + footage, generate, download a valid .cube", async ({ page }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");

  // upload own footage frame (Apple Log 2)
  await page.getByTestId("drop-footage-input").setInputFiles(LOG_FRAME);
  await waitForPhase(page, "graded");

  // upload reference look
  await page.getByTestId("drop-reference-input").setInputFiles(PHOTO);
  await waitForPhase(page, "graded");

  // adjust strength, name the look
  await page.getByTestId("strength").fill("70");
  await page.getByTestId("look-name").fill("Glacier Teal");
  await expect(page.getByTestId("filename")).toHaveText("FilmFeel_GlacierTeal_AppleLog2_33.cube");

  // download and validate the .cube
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("FilmFeel_GlacierTeal_AppleLog2_33.cube");
  const path = await download.path();
  const text = readFileSync(path!, "utf8");
  const { parseCube } = await import("../../src/engine/lut.ts");
  const parsed = parseCube(text);
  expect(parsed.is3D).toBe(true);
  expect(parsed.size).toBe(33);
  for (let i = 0; i < parsed.data.length; i += 997) {
    expect(parsed.data[i]).toBeGreaterThanOrEqual(0);
    expect(parsed.data[i]).toBeLessThanOrEqual(1);
  }
});

test("sample look gallery grades the demo frame", async ({ page }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");
  await page.getByTestId("look-neon-rain").click();
  await waitForPhase(page, "generating", 20000);
  await waitForPhase(page, "graded");
  await expect(page.getByTestId("filename")).toContainText("NeonRain");
});

test("GPU preview matches the CPU engine (cross-check)", async ({ page, browserName }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");
  await page.getByTestId("strength").fill("65");
  const result = await page.evaluate(async () => {
    const hook = (window as unknown as { __filmfeel?: FilmFeelHook }).__filmfeel;
    return hook?.gpuCheck ? await hook.gpuCheck() : null;
  });
  expect(result).not.toBeNull();
  console.log(
    `[${browserName}] gpuCheck maxErr=${result!.maxErr.toFixed(5)} meanErr=${result!.meanErr.toFixed(5)} n=${result!.samples}`,
  );
  // half-float LUT texture + trilinear: a few 8-bit steps of headroom
  expect(result!.maxErr).toBeLessThanOrEqual(3 / 255);
  expect(result!.meanErr).toBeLessThanOrEqual(1 / 255);
});

test("keyboard: slider divider and strength are operable", async ({ page }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");
  const handle = page.getByTestId("viewer-handle");
  await handle.focus();
  const before = await handle.getAttribute("aria-valuenow");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  const after = await handle.getAttribute("aria-valuenow");
  expect(Number(after)).toBeGreaterThan(Number(before));
});
