/**
 * 3D LUT baking, .cube serialization/parsing, and CPU application.
 *
 * A 3D LUT is a cube of sample points: for every combination of (R, G, B)
 * input values on a 33×33×33 grid, it stores the output color. Colors between
 * grid points are interpolated. The .cube text format (originally Adobe's) is
 * what DaVinci Resolve, Premiere and Final Cut all import.
 *
 * Convention: red index varies fastest — `data[(b*N*N + g*N + r) * 3]`.
 */
import type { LookTransform } from "./match.ts";

export interface Lut3D {
  size: number;
  /** size³ RGB triples, red fastest. */
  data: Float32Array;
  title: string;
}

export function bakeLut(transform: LookTransform, size = 33, title = "FilmFeel Look"): Lut3D {
  const data = new Float32Array(size * size * size * 3);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const [or, og, ob] = transform.apply(r / (size - 1), g / (size - 1), b / (size - 1));
        data[i++] = or;
        data[i++] = og;
        data[i++] = ob;
      }
  const lut = { size, data, title };
  smoothLut(lut);
  return lut;
}

/**
 * Adaptive lattice smoothing: a [¼ ½ ¼] tent filter applied per axis, but only
 * where local curvature (second difference) is excessive — i.e. only at kinks
 * (gamut-clip edges, extreme look stretches) that would interpolate as visible
 * band edges. A tent filter reproduces linear data exactly, so near-identity
 * LUTs pass through untouched and gentle curves are barely changed.
 */
export function smoothLut(lut: Lut3D, passes = 2, tau = 0.1): void {
  const N = lut.size;
  const strides = [3, N * 3, N * N * 3]; // r, g, b axis strides (red fastest)
  for (let pass = 0; pass < passes; pass++) {
    for (const stride of strides) {
      const src = lut.data.slice();
      for (let idx = 0; idx < src.length; idx++) {
        // position along this axis for this element
        const axisPos = Math.floor(idx / stride) % N;
        if (axisPos === 0 || axisPos === N - 1) continue;
        const lo = src[idx - stride];
        const mid = src[idx];
        const hi = src[idx + stride];
        const curvature = Math.abs(lo - 2 * mid + hi);
        if (curvature <= tau) continue;
        const w = Math.min(1, (curvature - tau) / tau);
        lut.data[idx] = mid + w * (0.25 * lo + 0.25 * hi - 0.5 * mid);
      }
    }
  }
}

export function serializeCube(lut: Lut3D): string {
  const lines: string[] = [
    `TITLE "${lut.title.replace(/"/g, "'")}"`,
    "",
    `LUT_3D_SIZE ${lut.size}`,
    "",
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
    "",
  ];
  const n = lut.size ** 3;
  for (let i = 0; i < n; i++) {
    lines.push(
      `${lut.data[i * 3].toFixed(6)} ${lut.data[i * 3 + 1].toFixed(6)} ${lut.data[i * 3 + 2].toFixed(6)}`,
    );
  }
  return lines.join("\n") + "\n";
}

export interface ParsedCube {
  title: string;
  is3D: boolean;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array;
}

/**
 * Strict .cube parser — also serves as the criterion-1 validator. Throws with
 * a precise message on any spec violation. Handles both 1D and 3D LUTs so it
 * can be cross-checked against Apple's official files.
 */
export function parseCube(text: string): ParsedCube {
  let title = "";
  let size3 = 0;
  let size1 = 0;
  const domainMin: [number, number, number] = [0, 0, 0];
  const domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];
  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].trim();
    if (line === "" || line.startsWith("#")) continue;
    const fail = (msg: string): never => {
      throw new Error(`.cube line ${ln + 1}: ${msg}`);
    };
    if (/^TITLE\b/.test(line)) {
      const m = line.match(/^TITLE\s+"(.*)"\s*$/);
      if (!m) fail("malformed TITLE");
      else title = m[1];
    } else if (/^LUT_3D_SIZE\b/.test(line)) {
      const m = line.match(/^LUT_3D_SIZE\s+(\d+)\s*$/);
      if (!m) fail("malformed LUT_3D_SIZE");
      else size3 = parseInt(m[1], 10);
      if (size3 < 2 || size3 > 256) fail(`LUT_3D_SIZE ${size3} outside 2–256`);
    } else if (/^LUT_1D_SIZE\b/.test(line)) {
      const m = line.match(/^LUT_1D_SIZE\s+(\d+)\s*$/);
      if (!m) fail("malformed LUT_1D_SIZE");
      else size1 = parseInt(m[1], 10);
    } else if (/^DOMAIN_(MIN|MAX)\b/.test(line)) {
      const m = line.match(/^DOMAIN_(MIN|MAX)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s*$/);
      if (!m) fail("malformed DOMAIN line");
      else {
        const tgt = m[1] === "MIN" ? domainMin : domainMax;
        for (let i = 0; i < 3; i++) tgt[i] = parseFloat(m[2 + i]);
      }
    } else if (/^[-+\d.]/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length !== 3) fail(`expected 3 values, got ${parts.length}`);
      for (const p of parts) {
        const v = Number(p);
        if (!Number.isFinite(v)) fail(`non-finite value "${p}"`);
        values.push(v);
      }
    } else {
      fail(`unknown keyword "${line.split(/\s+/)[0]}"`);
    }
  }
  if (size3 && size1) throw new Error(".cube declares both 1D and 3D size");
  if (!size3 && !size1) throw new Error(".cube missing LUT_3D_SIZE / LUT_1D_SIZE");
  const expected = (size3 ? size3 ** 3 : size1) * 3;
  if (values.length !== expected)
    throw new Error(`.cube has ${values.length / 3} entries, expected ${expected / 3}`);
  return {
    title,
    is3D: !!size3,
    size: size3 || size1,
    domainMin,
    domainMax,
    data: Float32Array.from(values),
  };
}

/** Apply a 3D LUT to one RGB triple with trilinear interpolation (mirrors the GPU path). */
export function sampleLut3D(lut: Lut3D | ParsedCube, r: number, g: number, b: number): [number, number, number] {
  const N = lut.size;
  const at = (ri: number, gi: number, bi: number, ch: number) =>
    lut.data[(bi * N * N + gi * N + ri) * 3 + ch];
  const scale = N - 1;
  const rf = Math.min(1, Math.max(0, r)) * scale;
  const gf = Math.min(1, Math.max(0, g)) * scale;
  const bf = Math.min(1, Math.max(0, b)) * scale;
  const r0 = Math.min(N - 2, Math.floor(rf));
  const g0 = Math.min(N - 2, Math.floor(gf));
  const b0 = Math.min(N - 2, Math.floor(bf));
  const tr = rf - r0;
  const tg = gf - g0;
  const tb = bf - b0;
  const out: [number, number, number] = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c000 = at(r0, g0, b0, ch);
    const c100 = at(r0 + 1, g0, b0, ch);
    const c010 = at(r0, g0 + 1, b0, ch);
    const c110 = at(r0 + 1, g0 + 1, b0, ch);
    const c001 = at(r0, g0, b0 + 1, ch);
    const c101 = at(r0 + 1, g0, b0 + 1, ch);
    const c011 = at(r0, g0 + 1, b0 + 1, ch);
    const c111 = at(r0 + 1, g0 + 1, b0 + 1, ch);
    const c00 = c000 + (c100 - c000) * tr;
    const c10 = c010 + (c110 - c010) * tr;
    const c01 = c001 + (c101 - c001) * tr;
    const c11 = c011 + (c111 - c011) * tr;
    const c0 = c00 + (c10 - c00) * tg;
    const c1 = c01 + (c11 - c01) * tg;
    out[ch] = c0 + (c1 - c0) * tb;
  }
  return out;
}

/** Export filename per PRD: FilmFeel_LookName_AppleLog2_33.cube */
export function exportFilename(lookName: string, format: "applelog2" | "rec709", size = 33): string {
  const words = lookName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const clean = words.length
    ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join("")
    : "Look";
  const fmt = format === "applelog2" ? "AppleLog2" : "Rec709";
  return `FilmFeel_${clean}_${fmt}_${size}.cube`;
}
