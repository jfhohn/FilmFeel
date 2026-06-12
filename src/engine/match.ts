/**
 * The look-matching transform — FilmFeel's core.
 *
 * Given the stats of a reference image and of the user's footage, build a
 * smooth function from encoded input pixels to display Rec.709 pixels that
 * makes the footage's distributions match the reference's:
 *
 *   1. linearize input (Apple Log 2 → linear Rec.709, or sRGB decode)
 *   2. tonal curve  — monotone quantile map on Oklab lightness (PCHIP spline)
 *   3. white balance / palette cast — shift Oklab (a, b) means
 *   4. saturation distribution — quantile map on Oklab chroma
 *   5. highlight rolloff + gamut-safe desaturation (never clip to neon)
 *   6. encode for display
 *
 * Every matching step is exactly neutral when reference == footage, which is
 * what makes the identity criterion (2) hold by construction.
 */
import { linearRgbToOklab, oklabToLinearRgb } from "./color.ts";
import { srgbEncode } from "./transfer.ts";
import { decodePixel, type InputFormat } from "./image.ts";
import { bandWeight, type LookStats } from "./analyze.ts";

/** Monotone cubic interpolation (Fritsch–Carlson PCHIP) with linear extension. */
export class MonotoneSpline {
  private xs: number[];
  private ys: number[];
  private ms: number[]; // tangents

  constructor(xsIn: ArrayLike<number>, ysIn: ArrayLike<number>, maxSlope = Infinity) {
    // Collapse duplicate x (flat histogram regions produce repeated quantiles).
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < xsIn.length; i++) {
      const x = xsIn[i];
      const y = ysIn[i];
      if (xs.length && x - xs[xs.length - 1] < 1e-6) {
        ys[ys.length - 1] = (ys[ys.length - 1] + y) / 2;
      } else {
        xs.push(x);
        ys.push(y);
      }
    }
    if (xs.length === 1) {
      xs.push(xs[0] + 1);
      ys.push(ys[0] + 1);
    }
    // Quantile data is sorted in y too; enforce strictly so PCHIP stays monotone.
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1]);
    // Slope limiting (a look decision, not a numerics hack): wildly mismatched
    // image pairs can demand 30× stretches that no smooth LUT can express —
    // they bake as cliffs (banding). Pull targets in until every segment
    // respects maxSlope. The forward pass softens extreme lifts, the backward
    // pass extreme crushes. Identity data (slope 1) is untouched.
    if (Number.isFinite(maxSlope)) {
      for (let i = 1; i < ys.length; i++) {
        ys[i] = Math.min(ys[i], ys[i - 1] + maxSlope * (xs[i] - xs[i - 1]));
      }
      for (let i = ys.length - 2; i >= 0; i--) {
        ys[i] = Math.max(ys[i], ys[i + 1] - maxSlope * (xs[i + 1] - xs[i]));
      }
    }
    const n = xs.length;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    }
    const ms: number[] = [d[0]];
    for (let i = 1; i < n - 1; i++) {
      ms.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    }
    ms.push(d[n - 2]);
    // Fritsch–Carlson monotonicity limiter
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        ms[i] = 0;
        ms[i + 1] = 0;
      } else {
        const a = ms[i] / d[i];
        const b = ms[i + 1] / d[i];
        const s = a * a + b * b;
        if (s > 9) {
          const t = 3 / Math.sqrt(s);
          ms[i] = t * a * d[i];
          ms[i + 1] = t * b * d[i];
        }
      }
    }
    this.xs = xs;
    this.ys = ys;
    this.ms = ms;
  }

  evaluate(x: number): number {
    const { xs, ys, ms } = this;
    const n = xs.length;
    if (x <= xs[0]) return ys[0] + ms[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + ms[n - 1] * (x - xs[n - 1]);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const h = xs[lo + 1] - xs[lo];
    const t = (x - xs[lo]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      ys[lo] * (2 * t3 - 3 * t2 + 1) +
      ms[lo] * h * (t3 - 2 * t2 + t) +
      ys[lo + 1] * (-2 * t3 + 3 * t2) +
      ms[lo + 1] * h * (t3 - t2)
    );
  }
}

export interface LookTransform {
  /** Encoded input triple (0–1) → display Rec.709 triple (0–1). */
  apply(r: number, g: number, b: number): [number, number, number];
  format: InputFormat;
  strength: number;
}

/** Soft highlight shoulder: identity below `s`, asymptote to 1 above. C¹ smooth. */
export function highlightRolloff(x: number, s = 0.99): number {
  return x <= s ? x : s + (1 - s) * Math.tanh((x - s) / (1 - s));
}

/**
 * Gamut mapping in Oklab: if the color has a negative RGB channel, scale its
 * chroma toward the gray axis (binary search) until it fits. Lightness is
 * preserved — far better than projecting to black — and bright out-of-range
 * colors desaturate toward white exactly the way film highlights do.
 */
function gamutMapOklab(L: number, a: number, b: number): [number, number, number] {
  // Tolerance note: constant-L chroma rays to the sRGB blue corner dip a few
  // 1e-4 outside the gamut before re-entering (the Oklab gamut slice is not
  // perfectly star-shaped). Treat shallow excursions as in-gamut and clamp —
  // truly out-of-gamut colors overshoot 100× deeper than this.
  const EPS = 1.5e-3;
  let [r, g, bb] = oklabToLinearRgb(L, a, b);
  if (Math.min(r, g, bb) >= -EPS) return [Math.max(0, r), Math.max(0, g), Math.max(0, bb)];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklabToLinearRgb(L, a * mid, b * mid);
    if (Math.min(rgb[0], rgb[1], rgb[2]) >= -EPS) lo = mid;
    else hi = mid;
  }
  [r, g, bb] = oklabToLinearRgb(L, a * lo, b * lo);
  return [Math.max(0, r), Math.max(0, g), Math.max(0, bb)];
}

function finishOklab(L: number, a: number, bch: number): [number, number, number] {
  let [r, g, b] = gamutMapOklab(Math.max(0, L), a, bch);
  const maxc = Math.max(r, g, b);
  if (maxc > 0.99) {
    const s = highlightRolloff(maxc) / maxc;
    r *= s;
    g *= s;
    b *= s;
  }
  return [
    Math.min(1, Math.max(0, srgbEncode(r))),
    Math.min(1, Math.max(0, srgbEncode(g))),
    Math.min(1, Math.max(0, srgbEncode(b))),
  ];
}

function finishPixel(lr: number, lg: number, lb: number): [number, number, number] {
  // No clamping before Oklab: cube roots extend continuously to negative
  // (out-of-gamut) values, and the gamut mapper resolves them. Clamping here
  // collapses distinct out-of-gamut colors onto one value, baking flat spots
  // with cliff edges into the LUT.
  const [L, a, b] = linearRgbToOklab(lr, lg, lb);
  return finishOklab(L, a, b);
}

export function buildLookTransform(
  format: InputFormat,
  footage: LookStats,
  reference: LookStats,
  strength = 1,
): LookTransform {
  // Max tonal slope 2.2 in Oklab L ≈ a 10× luminance stretch — beyond that a
  // 33³ LUT cannot stay smooth (see BUILD_LOG M1).
  const tonal = new MonotoneSpline(footage.lQuantiles, reference.lQuantiles, 2.2);
  // Chroma map anchored at (0,0): zero saturation stays zero, and the curve
  // approaches it smoothly — extrapolating quantile data below its minimum
  // otherwise explodes the boost ratio for near-neutral colors (banding).
  const chroma = new MonotoneSpline(
    [0, ...footage.cQuantiles],
    [0, ...reference.cQuantiles],
  );
  // Per-band cast deltas (split-tone aware), shrunk toward the global delta
  // when a band has little support in either image.
  const dGlobalA = reference.meanA - footage.meanA;
  const dGlobalB = reference.meanB - footage.meanB;
  const dBandA: number[] = [];
  const dBandB: number[] = [];
  for (let k = 0; k < 3; k++) {
    const support = Math.min(1, Math.min(reference.bandW[k], footage.bandW[k]) / 0.05);
    dBandA.push((reference.bandA[k] - footage.bandA[k]) * support + dGlobalA * (1 - support));
    dBandB.push((reference.bandB[k] - footage.bandB[k]) * support + dGlobalB * (1 - support));
  }

  const apply = (er: number, eg: number, eb: number): [number, number, number] => {
    const [lr, lg, lb] = decodePixel(format, er, eg, eb);
    // base conversion (strength 0): just format conversion + display encode
    const base = finishPixel(lr, lg, lb);
    if (strength <= 0) return base;

    let [L, a, b] = linearRgbToOklab(lr, lg, lb); // unclamped — see finishPixel
    // 2. tonal curve
    L = tonal.evaluate(L);
    // 3. white balance / palette cast, interpolated across lightness bands
    //    (captures split-toning: teal shadows + warm highlights)
    const w0 = bandWeight(L, 0);
    const w1 = bandWeight(L, 1);
    const w2 = bandWeight(L, 2);
    const wSum = w0 + w1 + w2;
    a += (dBandA[0] * w0 + dBandA[1] * w1 + dBandA[2] * w2) / wSum;
    b += (dBandB[0] * w0 + dBandB[1] * w1 + dBandB[2] * w2) / wSum;
    // 4. saturation distribution
    const c1 = Math.hypot(a, b);
    if (c1 > 1e-6) {
      // Soft cap near 4×: imperceptible below 2× (0.4% at ratio 1), prevents
      // saturation explosions on near-neutral pixels from extreme references.
      const raw = chroma.evaluate(c1) / c1;
      const ratio = raw / Math.pow(1 + Math.pow(raw / 4, 4), 0.25);
      a *= ratio;
      b *= ratio;
    }
    const graded = finishOklab(L, a, b);
    if (strength >= 1) return graded;
    return [
      base[0] + (graded[0] - base[0]) * strength,
      base[1] + (graded[1] - base[1]) * strength,
      base[2] + (graded[2] - base[2]) * strength,
    ];
  };

  return { apply, format, strength };
}
