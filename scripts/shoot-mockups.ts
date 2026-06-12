/** Screenshot the design mockups (and later, app states) with Playwright. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "design", "screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

for (const name of ["a-light-table", "b-console", "c-safelight"]) {
  await page.goto(pathToFileURL(join(root, "design", "mockups", `${name}.html`)).href);
  await page.waitForTimeout(600); // fonts + images
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  console.log(`shot ${name}`);
}
await browser.close();
