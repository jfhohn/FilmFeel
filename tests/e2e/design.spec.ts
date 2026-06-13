/**
 * D2 — style audit: only values from the defined design scales may appear in
 * computed styles (8px spacing grid, radius scale 0/4/8/16/full, the two
 * shadow tokens, the two typefaces, the defined type scale).
 * D4 — slider performance: a scripted 2-second drag must produce no frame
 * longer than two vsyncs (no visible jank).
 * Chromium-only: computed-style serialization and rAF timing are
 * engine-consistent there; cross-browser behavior is covered by flow.spec.
 */
import { test, expect, type Page } from "@playwright/test";

test.skip(({ browserName }) => browserName !== "chromium", "audit runs on chromium");

function waitForPhase(page: Page, phase: string, timeout = 45000) {
  return page.waitForFunction(
    (p) => (window as unknown as { __filmfeel?: { phase: string } }).__filmfeel?.phase === p,
    phase,
    { timeout },
  );
}

interface Violation {
  selector: string;
  property: string;
  value: string;
}

test("D2: computed styles use only design-token values", async ({ page }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");
  const violations = await page.evaluate(() => {
    const SPACING = new Set([0, 1, 8, 16, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 256]);
    const RADII = new Set([0, 4, 8, 16, 9999]);
    const FONT_SIZES = new Set([12, 14, 16, 20, 28, 40, 64]);
    const LINE_HEIGHTS = new Set([16, 20, 24, 28, 36, 48, 72]);
    // The two shadow tokens as individual layers. Tailwind's shadow utilities
    // prepend zero-size ring placeholder layers and ring-1 adds a 1px hairline
    // ring — both are non-shadows; the audit checks the REAL shadow layers.
    const SHADOW_TOKENS = [
      "0px 1px 2px 0px|0px 2px 8px 0px", // low
      "0px 4px 16px 0px|0px 16px 48px 0px", // high
    ];
    const realShadowLayers = (shadow: string): string[] =>
      shadow === "none"
        ? []
        : shadow
            .split(/,(?![^(]*\))/)
            .map((s) => s.trim())
            .filter((s) => !/0px 0px 0px 0px$/.test(s)) // ring placeholders
            .filter((s) => !/0px 0px 0px [12]px$/.test(s)); // hairline rings/focus
    const shadowOk = (shadow: string): boolean => {
      const layers = realShadowLayers(shadow).map((s) => s.replace(/rgba?\([^)]*\)\s*/, ""));
      if (layers.length === 0) return true;
      return SHADOW_TOKENS.includes(layers.join("|"));
    };
    const out: Array<{ selector: string; property: string; value: string }> = [];
    const px = (v: string) => Math.round(parseFloat(v) || 0);
    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      (el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : "") +
      (el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : "");

    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (el.closest("svg")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;

      for (const prop of ["margin-top", "margin-bottom", "margin-left", "margin-right", "padding-top", "padding-bottom", "padding-left", "padding-right", "row-gap", "column-gap"] as const) {
        const raw = cs.getPropertyValue(prop);
        if (raw === "normal" || raw === "" ) continue;
        const v = Math.abs(px(raw));
        // margins from centering (auto) compute to element-specific px — skip auto
        const specified = (el as HTMLElement).style.getPropertyValue(prop);
        if (specified === "auto") continue;
        if (!SPACING.has(v)) out.push({ selector: describe(el), property: prop, value: raw });
      }

      for (const prop of ["border-top-left-radius", "border-bottom-right-radius"] as const) {
        const raw = cs.getPropertyValue(prop);
        if (raw.includes("%")) continue; // 50% circles are radius-full equivalents
        if (!RADII.has(px(raw))) out.push({ selector: describe(el), property: prop, value: raw });
      }

      const fs = px(cs.fontSize);
      if (!FONT_SIZES.has(fs)) out.push({ selector: describe(el), property: "font-size", value: cs.fontSize });
      if (cs.lineHeight !== "normal" && !LINE_HEIGHTS.has(px(cs.lineHeight))) {
        out.push({ selector: describe(el), property: "line-height", value: cs.lineHeight });
      }
      const fam = cs.fontFamily;
      if (!fam.includes("Satoshi") && !fam.includes("JetBrains Mono")) {
        out.push({ selector: describe(el), property: "font-family", value: fam });
      }

      if (!shadowOk(cs.boxShadow)) {
        out.push({ selector: describe(el), property: "box-shadow", value: cs.boxShadow });
      }
    }
    return out as Violation[];
  });
  if (violations.length) console.table(violations.slice(0, 30));
  expect(violations).toEqual([]);
});

test("D4: slider drag has no frame over two vsyncs", async ({ page }) => {
  await page.goto("/");
  await waitForPhase(page, "graded");
  const viewer = page.getByTestId("viewer");
  const box = (await viewer.boundingBox())!;

  // start collecting rAF deltas
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __collect: boolean };
    w.__frames = [];
    w.__collect = true;
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      if (w.__collect) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // scripted 2-second drag back and forth
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  for (let pass = 0; pass < 4; pass++) {
    const from = pass % 2 === 0 ? 0.15 : 0.85;
    const to = pass % 2 === 0 ? 0.85 : 0.15;
    for (let i = 0; i <= 30; i++) {
      const x = box.x + box.width * (from + ((to - from) * i) / 30);
      await page.mouse.move(x, box.y + box.height / 2);
      await page.waitForTimeout(16);
    }
  }
  await page.mouse.up();

  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __collect: boolean };
    w.__collect = false;
    return w.__frames;
  });
  // ignore warmup
  const samples = frames.slice(5);
  const worst = Math.max(...samples);
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  console.log(`frames=${samples.length} avg=${avg.toFixed(1)}ms worst=${worst.toFixed(1)}ms`);
  expect(samples.length).toBeGreaterThan(60);
  expect(avg).toBeLessThan(20); // ~60fps average
  expect(worst).toBeLessThan(34); // no frame over 2 vsyncs = zero visible jank
});
