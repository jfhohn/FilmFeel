/**
 * WebGL2 renderer for the before/after preview.
 *
 * The LUT lives on the GPU as a real 3D texture; the fragment shader looks up
 * each footage pixel's graded color with hardware trilinear interpolation —
 * the same math Resolve uses — so dragging the split or strength slider is
 * just a uniform update: 60fps at full resolution.
 *
 * Two LUTs are loaded: the base format conversion (strength 0) and the full
 * look (strength 1). Strength blends between them in the shader, exactly
 * matching the engine's definition of strength.
 *
 * The "film developing" reveal is also a shader effect (uReveal 0→1):
 * the image starts dark and grainy, grain settles, color blooms in.
 */
import type { Lut3D } from "../engine/lut.ts";

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uFootage;
uniform sampler3D uLutBase;
uniform sampler3D uLutLook;
uniform float uSplit;     // 0..1 divider position
uniform float uStrength;  // 0..1 look strength
uniform float uReveal;    // 0..1 developing progress (1 = settled)
uniform float uTime;      // seconds, for animated grain
uniform float uLutSize;
uniform vec2 uCoverScale; // object-fit: cover UV mapping

vec3 sampleLut(sampler3D lut, vec3 c) {
  float n = uLutSize;
  vec3 coord = c * ((n - 1.0) / n) + (0.5 / n);
  return texture(lut, coord).rgb;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 61.7) * 43758.5453);
}

void main() {
  vec2 uv = (vUv - 0.5) * uCoverScale + 0.5;
  vec3 src = texture(uFootage, uv).rgb;
  vec3 base = sampleLut(uLutBase, src);
  vec3 look = sampleLut(uLutLook, src);
  vec3 graded = mix(base, look, uStrength);

  // before/after split: left of divider shows the raw (flat log) source
  vec3 color = vUv.x < uSplit ? src : graded;

  // film developing: dark + grainy -> settled (right side only)
  if (uReveal < 1.0 && vUv.x >= uSplit) {
    float t = uReveal;
    float exposure = smoothstep(0.0, 0.75, t);          // brightness comes up
    float chroma = smoothstep(0.25, 1.0, t);            // color blooms in late
    float grainAmt = (1.0 - smoothstep(0.4, 1.0, t)) * 0.22 + 0.0;
    vec3 dev = graded * exposure;
    float luma = dot(dev, vec3(0.2126, 0.7152, 0.0722));
    dev = mix(vec3(luma), dev, chroma);
    dev += (hash(gl_FragCoord.xy) - 0.5) * grainAmt;
    color = dev;
  }

  outColor = vec4(color, 1.0);
}`;

export class LutRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation> = {};
  private footageTex: WebGLTexture | null = null;
  private lutBaseTex: WebGLTexture | null = null;
  private lutLookTex: WebGLTexture | null = null;
  private lutSize = 33;
  private texAspect = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private pixelRatioOverride?: number,
  ) {
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.program = this.buildProgram(VERT, FRAG);
    gl.useProgram(this.program);
    for (const name of ["uFootage", "uLutBase", "uLutLook", "uSplit", "uStrength", "uReveal", "uTime", "uLutSize", "uCoverScale"]) {
      const loc = gl.getUniformLocation(this.program, name);
      if (loc) this.uniforms[name] = loc;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(this.uniforms.uFootage as WebGLUniformLocation, 0);
    gl.uniform1i(this.uniforms.uLutBase as WebGLUniformLocation, 1);
    gl.uniform1i(this.uniforms.uLutLook as WebGLUniformLocation, 2);
  }

  private buildProgram(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  /** Match the drawing buffer to the displayed size (sharp at any DPR). */
  resize(): void {
    const gl = this.gl;
    const dpr = this.pixelRatioOverride ?? Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  setFootage(source: TexImageSource, width: number, height: number): void {
    const gl = this.gl;
    this.texAspect = width / height;
    this.resize();
    gl.activeTexture(gl.TEXTURE0);
    if (this.footageTex) gl.deleteTexture(this.footageTex);
    this.footageTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.footageTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private uploadLut(unit: number, lut: Lut3D, existing: WebGLTexture | null): WebGLTexture {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (existing) gl.deleteTexture(existing);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, tex);
    const N = lut.size;
    // RGBA16F is linearly filterable in core WebGL2.
    const rgba = new Float32Array(N * N * N * 4);
    for (let i = 0; i < N * N * N; i++) {
      rgba[i * 4] = lut.data[i * 3];
      rgba[i * 4 + 1] = lut.data[i * 3 + 1];
      rgba[i * 4 + 2] = lut.data[i * 3 + 2];
      rgba[i * 4 + 3] = 1;
    }
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, N, N, N, 0, gl.RGBA, gl.FLOAT, rgba);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    return tex;
  }

  setLuts(base: Lut3D, look: Lut3D): void {
    this.lutSize = base.size;
    this.lutBaseTex = this.uploadLut(1, base, this.lutBaseTex);
    this.lutLookTex = this.uploadLut(2, look, this.lutLookTex);
  }

  render(opts: { split: number; strength: number; reveal: number; time: number }): void {
    const gl = this.gl;
    this.resize();
    gl.useProgram(this.program);
    // object-fit: cover — crop the texture to fill the frame without stretching
    const viewAspect = this.canvas.width / Math.max(1, this.canvas.height);
    const ratio = viewAspect / this.texAspect;
    const cover: [number, number] = ratio >= 1 ? [1, 1 / ratio] : [ratio, 1];
    gl.uniform2f(this.uniforms.uCoverScale, cover[0], cover[1]);
    gl.uniform1f(this.uniforms.uSplit, opts.split);
    gl.uniform1f(this.uniforms.uStrength, opts.strength);
    gl.uniform1f(this.uniforms.uReveal, opts.reveal);
    gl.uniform1f(this.uniforms.uTime, opts.time);
    gl.uniform1f(this.uniforms.uLutSize, this.lutSize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.footageTex) gl.deleteTexture(this.footageTex);
    if (this.lutBaseTex) gl.deleteTexture(this.lutBaseTex);
    if (this.lutLookTex) gl.deleteTexture(this.lutLookTex);
    gl.deleteProgram(this.program);
  }
}
