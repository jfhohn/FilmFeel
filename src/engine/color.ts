/**
 * Color space math: gamut conversion matrices and perceptual color models.
 *
 * A "gamut" is the set of colors a color space can represent, defined by the
 * chromaticity of its red/green/blue primaries plus a white point. Converting
 * between gamuts is a 3×3 matrix multiply on linear RGB.
 *
 * Matrices are DERIVED from published chromaticities rather than hardcoded,
 * so the test suite can verify them against known references.
 */

export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export type Vec3 = readonly [number, number, number];

export interface Chromaticities {
  r: readonly [number, number];
  g: readonly [number, number];
  b: readonly [number, number];
  white: readonly [number, number];
}

/** Apple Wide Gamut — Apple Log 2's primaries (white paper, Sept 2025). */
export const APPLE_WIDE_GAMUT: Chromaticities = {
  r: [0.725, 0.301],
  g: [0.221, 0.814],
  b: [0.068, -0.076],
  white: [0.3127, 0.329],
};

/** Rec.709 / sRGB primaries, D65 white. */
export const REC709: Chromaticities = {
  r: [0.64, 0.33],
  g: [0.3, 0.6],
  b: [0.15, 0.06],
  white: [0.3127, 0.329],
};

export function mat3Mul(a: Mat3, b: Mat3): Mat3 {
  const m = new Array<number>(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      m[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return m as unknown as Mat3;
}

export function mat3MulVec(m: Mat3, v: Vec3): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function mat3Inverse(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const det = a * A + d * B + g * C;
  const s = 1 / det;
  return [
    A * s, B * s, C * s,
    (f * g - d * i) * s, (a * i - c * g) * s, (c * d - a * f) * s,
    (d * h - e * g) * s, (b * g - a * h) * s, (a * e - b * d) * s,
  ];
}

/**
 * Build the linear-RGB → XYZ matrix for a set of primaries (standard method:
 * scale each primary's XYZ so the white point sums to white's XYZ at Y=1).
 */
export function rgbToXyzMatrix(ch: Chromaticities): Mat3 {
  const xyzOf = ([x, y]: readonly [number, number]): Vec3 => [x / y, 1, (1 - x - y) / y];
  // Columns are the un-scaled primary vectors.
  const [rx, ry, rz] = xyzOf(ch.r);
  const [gx, gy, gz] = xyzOf(ch.g);
  const [bx, by, bz] = xyzOf(ch.b);
  const P: Mat3 = [rx, gx, bx, ry, gy, by, rz, gz, bz];
  const W = xyzOf(ch.white);
  const S = mat3MulVec(mat3Inverse(P), W);
  return [
    P[0] * S[0], P[1] * S[1], P[2] * S[2],
    P[3] * S[0], P[4] * S[1], P[5] * S[2],
    P[6] * S[0], P[7] * S[1], P[8] * S[2],
  ];
}

/** Linear Apple Wide Gamut → linear Rec.709 (both D65, no adaptation needed). */
export const AWG_TO_REC709: Mat3 = mat3Mul(
  mat3Inverse(rgbToXyzMatrix(REC709)),
  rgbToXyzMatrix(APPLE_WIDE_GAMUT),
);

/** Linear Rec.709 → linear Apple Wide Gamut. */
export const REC709_TO_AWG: Mat3 = mat3Inverse(AWG_TO_REC709);

// ---------------------------------------------------------------------------
// Oklab — a perceptual color space where Euclidean distance ≈ perceived
// difference. We analyze and match looks here, not in raw RGB.
// (Björn Ottosson, 2020. Input: linear sRGB/Rec.709.)
// ---------------------------------------------------------------------------

export function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

export function oklabToLinearRgb(L: number, a: number, bb: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// ---------------------------------------------------------------------------
// CIE Lab + ΔE2000 — the industry-standard measure of color difference,
// used by acceptance criterion 3. Input: linear Rec.709, D65.
// ---------------------------------------------------------------------------

function fLab(t: number): number {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

const REC709_TO_XYZ = rgbToXyzMatrix(REC709);
const D65: Vec3 = mat3MulVec(REC709_TO_XYZ, [1, 1, 1]);

export function linearRgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [X, Y, Z] = mat3MulVec(REC709_TO_XYZ, [r, g, b]);
  const fx = fLab(X / D65[0]);
  const fy = fLab(Y / D65[1]);
  const fz = fLab(Z / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 color difference between two Lab colors. */
export function deltaE00(lab1: Vec3, lab2: Vec3): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const Cb7 = Math.pow(Cb, 7);
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : ((Math.atan2(b1, a1p) / rad) + 360) % 360;
  const h2p = C2p === 0 ? 0 : ((Math.atan2(b2, a2p) / rad) + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
      Math.pow(dCp / SC, 2) +
      Math.pow(dHp / SH, 2) +
      RT * (dCp / SC) * (dHp / SH),
  );
}
