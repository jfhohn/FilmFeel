/**
 * Perceptual look analysis. We describe an image's "look" as a small set of
 * statistics computed in Oklab, where L is lightness and (a, b) carry color.
 * These are the attributes the PRD names: tonal curve, white balance,
 * palette, saturation distribution — NOT raw histograms.
 */
import { linearRgbToOklab } from "./color.ts";
import { downsample, type ImageF32 } from "./image.ts";

export const QUANTILES = 33;

export interface LookStats {
  /** Lightness at QUANTILES evenly spaced quantiles (the tonal curve). */
  lQuantiles: Float64Array;
  /** Mean of a/b — the overall color cast (white balance + palette lean). */
  meanA: number;
  meanB: number;
  /** Std-dev of a/b — how spread the palette is around the cast. */
  stdA: number;
  stdB: number;
  /** Chroma (saturation) at quantiles, for matching saturation distribution. */
  cQuantiles: Float64Array;
  /**
   * Color cast per lightness band (shadows / mids / highlights) — captures
   * split-toning, e.g. teal shadows with warm highlights. Gaussian-weighted
   * means around BAND_CENTERS, plus the total weight for shrinkage.
   */
  bandA: [number, number, number];
  bandB: [number, number, number];
  bandW: [number, number, number];
}

export const BAND_CENTERS = [0.15, 0.5, 0.85] as const;
export const BAND_SIGMA = 0.16;

export function bandWeight(L: number, band: number): number {
  const d = (L - BAND_CENTERS[band]) / BAND_SIGMA;
  return Math.exp(-0.5 * d * d);
}

function quantilesOf(sorted: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(sorted.length - 1, lo + 1);
    out[i] = sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  return out;
}

export function analyze(img: ImageF32): LookStats {
  const s = downsample(img, 256);
  const n = s.width * s.height;
  const L = new Float64Array(n);
  const A = new Float64Array(n);
  const B = new Float64Array(n);
  const C = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [l, a, b] = linearRgbToOklab(s.data[i * 3], s.data[i * 3 + 1], s.data[i * 3 + 2]);
    L[i] = l;
    A[i] = a;
    B[i] = b;
    C[i] = Math.hypot(a, b);
  }
  let meanA = 0;
  let meanB = 0;
  const bandA: [number, number, number] = [0, 0, 0];
  const bandB: [number, number, number] = [0, 0, 0];
  const bandW: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    meanA += A[i];
    meanB += B[i];
    for (let k = 0; k < 3; k++) {
      const w = bandWeight(L[i], k);
      bandA[k] += A[i] * w;
      bandB[k] += B[i] * w;
      bandW[k] += w;
    }
  }
  meanA /= n;
  meanB /= n;
  for (let k = 0; k < 3; k++) {
    if (bandW[k] > 0) {
      bandA[k] /= bandW[k];
      bandB[k] /= bandW[k];
    } else {
      bandA[k] = meanA;
      bandB[k] = meanB;
    }
    bandW[k] /= n;
  }
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    varA += (A[i] - meanA) ** 2;
    varB += (B[i] - meanB) ** 2;
  }
  const stdA = Math.sqrt(varA / n);
  const stdB = Math.sqrt(varB / n);
  const lSorted = L.slice().sort();
  const cSorted = C.slice().sort();
  return {
    lQuantiles: quantilesOf(lSorted, QUANTILES),
    meanA,
    meanB,
    stdA,
    stdB,
    cQuantiles: quantilesOf(cSorted, QUANTILES),
    bandA,
    bandB,
    bandW,
  };
}

/**
 * Look descriptors (criterion 3): the reference's "palette targets" expressed
 * as concrete Oklab colors a grade is supposed to hit —
 *  - five tonal anchors: the lightness at the 5/25/50/75/95% quantiles,
 *    carrying the color cast at that lightness (split-tone aware);
 *  - three saturation anchors: the chroma at the 25/50/75% quantiles.
 * These are distribution statistics, so they are content-independent: any
 * footage graded toward the reference can reach them.
 */
export function lookDescriptors(stats: LookStats): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const q of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    const L = stats.lQuantiles[Math.round(q * (QUANTILES - 1))];
    let wSum = 0;
    let a = 0;
    let b = 0;
    for (let k = 0; k < 3; k++) {
      const w = bandWeight(L, k);
      a += stats.bandA[k] * w;
      b += stats.bandB[k] * w;
      wSum += w;
    }
    out.push([L, a / wSum, b / wSum]);
  }
  for (const q of [0.25, 0.5, 0.75]) {
    const c = stats.cQuantiles[Math.round(q * (QUANTILES - 1))];
    out.push([0.6, c, 0]);
  }
  return out;
}

/**
 * Palette descriptors for the UI's match readout: k chroma-weighted cluster
 * centers in Oklab matched by hue, plus shadow (5%) and highlight (95%)
 * lightness anchors.
 */
export interface PaletteTargets {
  /** [L, a, b] cluster centers sorted by hue angle. */
  clusters: Array<[number, number, number]>;
  shadow: number;
  highlight: number;
}

export function paletteTargets(img: ImageF32, k = 4): PaletteTargets {
  const s = downsample(img, 192);
  const n = s.width * s.height;
  const pts: Array<[number, number, number, number]> = []; // L, a, b, weight
  const L = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [l, a, b] = linearRgbToOklab(s.data[i * 3], s.data[i * 3 + 1], s.data[i * 3 + 2]);
    L[i] = l;
    const c = Math.hypot(a, b);
    pts.push([l, a, b, 0.02 + c]); // small floor so neutrals still count
  }
  // k-means with chroma weights, deterministic seeding along the hue circle
  let centers: Array<[number, number, number]> = [];
  for (let i = 0; i < k; i++) {
    const ang = (i / k) * Math.PI * 2;
    centers.push([0.5, Math.cos(ang) * 0.08, Math.sin(ang) * 0.08]);
  }
  for (let iter = 0; iter < 12; iter++) {
    const sum: Array<[number, number, number, number]> = centers.map(() => [0, 0, 0, 0]);
    for (const [l, a, b, w] of pts) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (centers[c][0] - l) ** 2 + (centers[c][1] - a) ** 2 + (centers[c][2] - b) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      sum[best][0] += l * w;
      sum[best][1] += a * w;
      sum[best][2] += b * w;
      sum[best][3] += w;
    }
    centers = sum.map(([sl, sa, sb, sw], c) => (sw > 0 ? [sl / sw, sa / sw, sb / sw] : centers[c]));
  }
  centers.sort((p, q) => Math.atan2(p[2], p[1]) - Math.atan2(q[2], q[1]));
  const lSorted = L.slice().sort();
  return {
    clusters: centers,
    shadow: lSorted[Math.floor(0.05 * (n - 1))],
    highlight: lSorted[Math.floor(0.95 * (n - 1))],
  };
}
