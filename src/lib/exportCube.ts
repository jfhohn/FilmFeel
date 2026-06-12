/** Export the graded look as a .cube download, honoring the strength slider. */
import { serializeCube, exportFilename, type Lut3D } from "../engine/lut.ts";
import type { InputFormat } from "../engine/image.ts";

/**
 * The strength slider blends base↔look in display space — exactly a per-node
 * lerp of the two baked LUTs, so export at any strength is instant.
 */
export function lutAtStrength(base: Lut3D, look: Lut3D, strength: number, title: string): Lut3D {
  if (strength >= 1) return { ...look, title };
  const data = new Float32Array(look.data.length);
  for (let i = 0; i < data.length; i++) {
    data[i] = base.data[i] + (look.data[i] - base.data[i]) * strength;
  }
  return { size: look.size, data, title };
}

export function downloadCube(base: Lut3D, look: Lut3D, strength: number, lookName: string, format: InputFormat): string {
  const filename = exportFilename(lookName, format);
  const title = `FilmFeel — ${lookName || "Look"} (${Math.round(strength * 100)}%)`;
  const text = serializeCube(lutAtStrength(base, look, strength, title));
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return filename;
}
