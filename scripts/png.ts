/**
 * Minimal zero-dependency PNG codec for the test/asset scripts (Node only).
 * Supports 8-bit RGB and RGBA, non-interlaced — which covers every image this
 * project generates or downloads (Unsplash `fm=png` serves 8-bit RGB(A)).
 * Uses node:zlib for compression; everything else is the PNG spec by hand.
 */
import { deflateSync, inflateSync } from "node:zlib";

export interface RawImage {
  width: number;
  height: number;
  channels: 3 | 4;
  /** Row-major, `channels` bytes per pixel. */
  data: Uint8Array;
}

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(...parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  const typeBytes = new TextEncoder().encode(type);
  out.set(typeBytes, 4);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(typeBytes, body));
  return out;
}

export function encodePng(img: RawImage): Uint8Array {
  const { width, height, channels, data } = img;
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 3 ? 2 : 6; // color type
  // raw scanlines with filter byte 0
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 6 });
  const parts = [
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(idat.buffer, idat.byteOffset, idat.length)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buf: Uint8Array): RawImage {
  for (let i = 0; i < 8; i++) if (buf[i] !== SIGNATURE[i]) throw new Error("not a PNG");
  const dv = new DataView(buf.buffer, buf.byteOffset);
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  while (off < buf.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = dv.getUint32(off + 8);
      height = dv.getUint32(off + 12);
      bitDepth = buf[off + 16];
      colorType = buf[off + 17];
      interlace = buf[off + 20];
    } else if (type === "PLTE") palette = body.slice();
    else if (type === "IDAT") idatParts.push(body);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG unsupported");
  const srcCh = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 3 ? 1 : -1;
  if (srcCh === -1) throw new Error(`unsupported color type ${colorType}`);
  const idat = new Uint8Array(idatParts.reduce((s, p) => s + p.length, 0));
  {
    let o = 0;
    for (const p of idatParts) {
      idat.set(p, o);
      o += p.length;
    }
  }
  const raw = inflateSync(idat);
  const stride = width * srcCh;
  const px = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= srcCh ? cur[x - srcCh] : 0;
      const b = prev[x];
      const c = x >= srcCh ? prev[x - srcCh] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`bad filter ${filter}`);
      cur[x] = v & 0xff;
    }
    prev = cur;
  }
  // Normalize to RGB
  if (colorType === 2) return { width, height, channels: 3, data: px };
  if (colorType === 6) return { width, height, channels: 4, data: px };
  const out = new Uint8Array(width * height * 3);
  if (colorType === 0) {
    for (let i = 0; i < width * height; i++) {
      out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = px[i];
    }
  } else {
    if (!palette) throw new Error("paletted PNG missing PLTE");
    for (let i = 0; i < width * height; i++) {
      const p = px[i] * 3;
      out[i * 3] = palette[p];
      out[i * 3 + 1] = palette[p + 1];
      out[i * 3 + 2] = palette[p + 2];
    }
  }
  return { width, height, channels: 3, data: out };
}

/** Convenience: drop alpha so analysis code can assume RGB. */
export function toRgb(img: RawImage): RawImage {
  if (img.channels === 3) return img;
  const out = new Uint8Array(img.width * img.height * 3);
  for (let i = 0; i < img.width * img.height; i++) {
    out[i * 3] = img.data[i * 4];
    out[i * 3 + 1] = img.data[i * 4 + 1];
    out[i * 3 + 2] = img.data[i * 4 + 2];
  }
  return { width: img.width, height: img.height, channels: 3, data: out };
}
