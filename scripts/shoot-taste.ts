/** M5 taste pass: the graded landing at three viewport widths, beauty only. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "design", "screenshots", "taste");
mkdirSync(outDir, { recursive: true });
const BASE = process.env.APP_URL ?? "http://localhost:5199";

const browser = await chromium.launch({ args: ["--use-gl=angle"] });
const sizes: Array<[string, number, number]> = [
  ["desktop-1440", 1440, 900],
  ["tablet-834", 834, 1112],
  ["mobile-390", 390, 844],
];

for (const [name, width, height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(BASE);
  await page.waitForFunction(() => (window as any).__filmfeel?.phase === "graded", undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
  console.log(name);
  await page.close();
}

await browser.close();
