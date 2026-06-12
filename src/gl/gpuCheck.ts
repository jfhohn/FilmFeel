/**
 * Self-check: render a synthetic frame through the real WebGL pipeline and
 * compare every pixel against the CPU engine's trilinear LUT sampling.
 * Exposed on window for the Playwright verification suite (M3/M4).
 */
import { LutRenderer } from "./LutRenderer.ts";
import { sampleLut3D, type Lut3D } from "../engine/lut.ts";

export interface GpuCheckResult {
  maxErr: number;
  meanErr: number;
  samples: number;
}

export async function gpuCheck(base: Lut3D, look: Lut3D, strength: number): Promise<GpuCheckResult> {
  const N = 36; // synthetic frame: N×N pixels sweeping the RGB cube
  const canvas = document.createElement("canvas");
  canvas.width = N;
  canvas.height = N;
  canvas.style.width = `${N}px`;
  canvas.style.height = `${N}px`;
  // keep offscreen
  canvas.style.position = "fixed";
  canvas.style.left = "-10000px";
  document.body.appendChild(canvas);

  const src = new Uint8ClampedArray(N * N * 4);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < N * N; i++) {
    src[i * 4] = Math.floor(rnd() * 256);
    src[i * 4 + 1] = Math.floor(rnd() * 256);
    src[i * 4 + 2] = Math.floor(rnd() * 256);
    src[i * 4 + 3] = 255;
  }
  const imageData = new ImageData(src, N, N);
  const bmp = await createImageBitmap(imageData);

  const r = new LutRenderer(canvas, 1); // 1:1 pixels so GL samples exact texel centers
  r.setFootage(bmp, N, N);
  r.setLuts(base, look);
  r.render({ split: 0, strength, reveal: 1, time: 0 });

  const gl = canvas.getContext("webgl2")!;
  const w = canvas.width;
  const h = canvas.height;
  const out = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);

  // Compare against CPU at pixel centers. The canvas may be DPR-scaled, so map
  // each source pixel to its block and read the block center.
  const sx = w / N;
  const sy = h / N;
  let maxErr = 0;
  let sum = 0;
  let count = 0;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = (y * N + x) * 4;
      const er = src[i] / 255;
      const eg = src[i + 1] / 255;
      const eb = src[i + 2] / 255;
      const cpuBase = sampleLut3D(base, er, eg, eb);
      const cpuLook = sampleLut3D(look, er, eg, eb);
      const cpu = cpuBase.map((v, c) => v + (cpuLook[c] - v) * strength);
      // readPixels is bottom-up
      const px = Math.floor((x + 0.5) * sx);
      const py = h - 1 - Math.floor((y + 0.5) * sy);
      const o = (py * w + px) * 4;
      for (let c = 0; c < 3; c++) {
        const err = Math.abs(out[o + c] / 255 - Math.min(1, Math.max(0, cpu[c])));
        maxErr = Math.max(maxErr, err);
        sum += err;
        count++;
      }
    }
  }
  r.dispose();
  bmp.close();
  canvas.remove();
  return { maxErr, meanErr: sum / count, samples: count };
}
