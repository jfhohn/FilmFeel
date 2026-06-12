/** Screenshot live app states for the vision-critique loop. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "design", "screenshots", "app");
mkdirSync(outDir, { recursive: true });
const BASE = process.env.APP_URL ?? "http://localhost:5199";

const browser = await chromium.launch({ args: ["--use-gl=angle"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE);
// wait for demo generation to finish
await page.waitForFunction(() => (window as any).__filmfeel?.phase === "graded", undefined, { timeout: 30000 });
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, "01-landing-demo.png") });
console.log("01 landing");

// drag the split to 30%
const viewer = page.getByTestId("viewer");
const box = (await viewer.boundingBox())!;
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "02-split-30.png") });
console.log("02 split");

// pick a gallery look → capture mid-developing and final
await page.getByTestId("look-neon-rain").click();
await page.waitForFunction(() => (window as any).__filmfeel?.phase === "graded", undefined, { timeout: 30000 });
await page.waitForTimeout(900); // mid-reveal
await page.screenshot({ path: join(outDir, "03-developing.png") });
console.log("03 developing");
await page.waitForTimeout(2200);
await page.screenshot({ path: join(outDir, "04-graded-look.png") });
console.log("04 graded");

// strength at 40%
await page.getByTestId("strength").fill("40");
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "05-strength-40.png") });
console.log("05 strength");

// mobile viewport
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "06-mobile.png"), fullPage: true });
console.log("06 mobile");

await browser.close();
