/**
 * Transfer functions (tone curves) for the formats FilmFeel understands.
 *
 * A "transfer function" maps between scene light (linear — doubling the number
 * means doubling the photons) and the encoded pixel values stored in a file.
 * Log footage looks flat and gray because its curve packs a huge dynamic range
 * into 0–1; we must undo it (linearize) before any color math.
 *
 * Apple Log 2 uses the *Apple Log transfer function* (Apple Log 2 White Paper,
 * September 2025, Part 028-00834 v1.1): a log curve that transitions smoothly
 * into a parabola near black to preserve sensor noise below zero.
 */

// Constants exactly as published in the white paper.
export const APPLE_LOG = {
  R0: -0.05641088, // scene value where the curve bottoms out
  Rt: 0.01, // scene value where parabola hands off to the log segment
  c: 47.28711236, // parabola steepness
  beta: 0.00964052,
  gamma: 0.08550479,
  delta: 0.69336945,
} as const;

/** Encoded value at the parabola→log junction: c·(Rt−R0)² */
export const APPLE_LOG_PT =
  APPLE_LOG.c * (APPLE_LOG.Rt - APPLE_LOG.R0) * (APPLE_LOG.Rt - APPLE_LOG.R0);

/**
 * Official reference points from the white paper (scene reflectance → encoded
 * float). The paper's table also lists 10-bit full-range codes (154, 500,
 * 697, 1023) alongside the floats — quoted here to 6 decimal places.
 */
export const APPLE_LOG_TEST_VECTORS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.150477],
  [0.18, 0.488272],
  [0.9, 0.681687],
  [12.0, 1.0],
];

/** Scene-linear reflectance → Apple Log encoded signal. */
export function appleLogEncode(R: number): number {
  const { R0, Rt, c, beta, gamma, delta } = APPLE_LOG;
  if (R >= Rt) return gamma * Math.log2(R + beta) + delta;
  if (R >= R0) return c * (R - R0) * (R - R0);
  return 0;
}

/** Apple Log encoded signal → scene-linear reflectance (the inverse). */
export function appleLogDecode(P: number): number {
  const { R0, c, beta, gamma, delta } = APPLE_LOG;
  if (P >= APPLE_LOG_PT) return Math.pow(2, (P - delta) / gamma) - beta;
  if (P >= 0) return Math.sqrt(P / c) + R0;
  return R0;
}

/**
 * Scene → display tone map for log footage. Log holds ~12 stops above middle
 * gray; an SDR display holds one "1.0". Following the shape of Apple's own
 * Log2→Rec709 rendering (measured from their official LUT: scene 1.0 →
 * ~0.85 display, 12× speculars get the top ~15%), we keep a linear section
 * and roll the rest off with a long smooth tanh shoulder. A long shoulder is
 * also what keeps the baked LUT lattice smooth — a knee pinched near 1.0
 * concentrates curvature inside one grid cell and shows up as banding.
 * Identity below the knee; C² smooth at it (tanh has zero 2nd derivative at 0).
 */
export const TONE_KNEE = 0.4;

export function toneMapScene(S: number): number {
  if (S <= TONE_KNEE) return S;
  return TONE_KNEE + (1 - TONE_KNEE) * Math.tanh((S - TONE_KNEE) / (1 - TONE_KNEE));
}

/**
 * Soft floor for out-of-gamut negatives (ACES-style input gamut compression,
 * per channel). Decoding extreme LUT grid corners produces "imaginary" colors
 * with channels several units negative; perceptual color math is unstable out
 * there and bakes chaos into the LUT lattice. Map (−∞, 0) smoothly into
 * (−0.05, 0): identity for every real color, slope 1 at the join (C¹), bounded
 * below — downstream math then operates on a compact, well-behaved domain.
 */
export function softFloor(c: number): number {
  return c >= 0 ? c : -0.05 * Math.tanh(-c / 0.05);
}

/**
 * sRGB transfer (what JPEG/PNG photos and browser canvases use).
 * "Display-linear" here means light emitted by the monitor.
 */
export function srgbDecode(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function srgbEncode(v: number): number {
  if (v <= 0) return 0;
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}
