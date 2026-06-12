/**
 * Generates the deterministic test assets:
 *   checker    — 24-patch color checker chart (classic Macbeth sRGB values)
 *   gradients  — smooth ramps for the banding test + visual checks
 *   synthlog   — Apple Log 2 versions of the photos in test-assets/photos/
 *                (inverse-encoded with the white paper transfer function, so
 *                ground truth is exact: decode(synth) == original by math)
 *
 * Run: node scripts/generate-test-assets.ts [checker|gradients|synthlog|all]
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng, decodePng, toRgb, type RawImage } from "./png.ts";
import { appleLogEncode, srgbDecode } from "../src/engine/transfer.ts";
import { mat3MulVec, REC709_TO_AWG } from "../src/engine/color.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test-assets", "generated");
const photosDir = join(root, "test-assets", "photos");
const logDir = join(root, "test-assets", "log-frames");

/** Classic ColorChecker 24 patch sRGB values (row-major, 4 rows × 6 cols). */
export const COLOR_CHECKER_SRGB: ReadonlyArray<readonly [number, number, number]> = [
  [115, 82, 68], [194, 150, 130], [98, 122, 157], [87, 108, 67], [133, 128, 177], [103, 189, 170],
  [214, 126, 44], [80, 91, 166], [193, 90, 99], [94, 60, 108], [157, 188, 64], [224, 163, 46],
  [56, 61, 150], [70, 148, 73], [175, 54, 60], [231, 199, 31], [187, 86, 149], [8, 133, 161],
  [243, 243, 242], [200, 200, 200], [160, 160, 160], [122, 122, 121], [85, 85, 85], [52, 52, 52],
];

function makeChecker(): RawImage {
  const patch = 96;
  const gap = 8;
  const cols = 6;
  const rows = 4;
  const width = cols * patch + (cols + 1) * gap;
  const height = rows * patch + (rows + 1) * gap;
  const data = new Uint8Array(width * height * 3).fill(16); // near-black surround
  for (let p = 0; p < 24; p++) {
    const [r, g, b] = COLOR_CHECKER_SRGB[p];
    const col = p % cols;
    const row = Math.floor(p / cols);
    const x0 = gap + col * (patch + gap);
    const y0 = gap + row * (patch + gap);
    for (let y = y0; y < y0 + patch; y++)
      for (let x = x0; x < x0 + patch; x++) {
        const i = (y * width + x) * 3;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
  }
  return { width, height, channels: 3, data };
}

function makeGradients(): Record<string, RawImage> {
  const w = 1024;
  const h = 576;
  const gray = new Uint8Array(w * h * 3);
  const shadow = new Uint8Array(w * h * 3);
  const radial = new Uint8Array(w * h * 3);
  const duotone = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const t = x / (w - 1);
      // full ramp
      const v = Math.round(t * 255);
      gray[i] = gray[i + 1] = gray[i + 2] = v;
      // shadows only (0–25%): where banding shows first
      const sv = Math.round(t * 64);
      shadow[i] = shadow[i + 1] = shadow[i + 2] = sv;
      // radial spotlight
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const rv = Math.round(Math.max(0, 1 - Math.hypot(dx, dy)) * 235 + 10);
      radial[i] = radial[i + 1] = radial[i + 2] = rv;
      // teal→amber sweep (color gradient stresses chroma smoothness)
      duotone[i] = Math.round(20 + t * 215);
      duotone[i + 1] = Math.round(90 + Math.sin(t * Math.PI) * 60);
      duotone[i + 2] = Math.round(235 - t * 215);
    }
  }
  const img = (data: Uint8Array): RawImage => ({ width: w, height: h, channels: 3, data });
  return {
    "gradient-gray": img(gray),
    "gradient-shadow": img(shadow),
    "gradient-radial": img(radial),
    "gradient-duotone": img(duotone),
  };
}

/**
 * sRGB photo → synthetic Apple Log 2 frame.
 * Treat display-linear as scene-linear (a fine assumption for test purposes —
 * what matters is that ground truth is mathematically exact and invertible).
 */
function synthesizeLogFrame(src: RawImage): RawImage {
  const rgb = toRgb(src);
  const out = new Uint8Array(rgb.data.length);
  for (let i = 0; i < rgb.width * rgb.height; i++) {
    const r = srgbDecode(rgb.data[i * 3] / 255);
    const g = srgbDecode(rgb.data[i * 3 + 1] / 255);
    const b = srgbDecode(rgb.data[i * 3 + 2] / 255);
    const [ar, ag, ab] = mat3MulVec(REC709_TO_AWG, [r, g, b]);
    out[i * 3] = Math.round(Math.min(1, Math.max(0, appleLogEncode(ar))) * 255);
    out[i * 3 + 1] = Math.round(Math.min(1, Math.max(0, appleLogEncode(ag))) * 255);
    out[i * 3 + 2] = Math.round(Math.min(1, Math.max(0, appleLogEncode(ab))) * 255);
  }
  return { width: rgb.width, height: rgb.height, channels: 3, data: out };
}

const what = process.argv[2] ?? "all";
mkdirSync(outDir, { recursive: true });

if (what === "checker" || what === "all") {
  writeFileSync(join(outDir, "color-checker.png"), encodePng(makeChecker()));
  console.log("wrote color-checker.png");
}
if (what === "gradients" || what === "all") {
  for (const [name, img] of Object.entries(makeGradients())) {
    writeFileSync(join(outDir, `${name}.png`), encodePng(img));
    console.log(`wrote ${name}.png`);
  }
}
if (what === "synthlog" || what === "all") {
  mkdirSync(logDir, { recursive: true });
  let n = 0;
  for (const f of readdirSync(photosDir).filter((f) => f.endsWith(".png"))) {
    const src = decodePng(readFileSync(join(photosDir, f)));
    writeFileSync(join(logDir, f.replace(".png", "_applelog2.png")), encodePng(synthesizeLogFrame(src)));
    n++;
  }
  console.log(`synthesized ${n} Apple Log 2 frames`);
}
