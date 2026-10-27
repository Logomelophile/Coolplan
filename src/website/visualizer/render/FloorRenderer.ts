import type { Mat3 } from '../geometry/homography';
import { herringboneTile, type FloorPattern } from '../texture/layout';

/**
 * Composites a new floor into a photograph on a single full-image quad:
 * pixel -> floor metres via a homography, staggered plank tiling from an atlas,
 * shading transfer from the original floor, alpha-matted over the photo.
 * WebGL2 when available; a pixel-for-pixel CPU port otherwise (design §5.6).
 */
export interface FloorRenderInputs {
  photo: HTMLCanvasElement | ImageBitmap;
  /** Matte, same size as the photo. Any image source; only the red channel is read. */
  alpha: HTMLCanvasElement;
  /** Shading map canvas (R = detail/2, G = tone/2), same size as the photo. */
  shade: HTMLCanvasElement;
  atlas: HTMLCanvasElement;
  planks: number;
}

export interface FloorRenderParams {
  pattern: FloorPattern;
  /** Pixel (x, y, 1) -> floor metres (s, t). */
  Hinv: Mat3;
  plankSize: [number, number];
  rotation: number;
  /** Fraction of plank length each row is offset by (1/3 for a classic stagger). */
  stagger: number;
  /** Bevel/groove darkness 0..1. */
  grout: number;
  /** How much of the original floor's fine shading is kept, 0..1. */
  detailStrength: number;
  /** Mean linear colour of the original floor, used for a gentle white-balance pull. */
  meanRGB: [number, number, number];
  /** Linear exposure multiplier so very dark/bright décors read correctly. */
  exposure: number;
}

export interface FloorRenderer {
  readonly kind: 'webgl2' | 'cpu';
  readonly canvas: HTMLCanvasElement;
  setInputs(inputs: FloorRenderInputs): void;
  /** Cheap matte-only update (brush strokes) without re-uploading photo, shading or atlas. */
  setAlpha(alpha: HTMLCanvasElement): void;
  render(params: FloorRenderParams): HTMLCanvasElement;
  dispose(): void;
}

export const defaultRenderParams = (Hinv: Mat3, plankSize: [number, number]): FloorRenderParams => ({
  Hinv, plankSize, pattern: 'straight', rotation: 0, stagger: 1 / 3, grout: .24, detailStrength: .35, meanRGB: [.5, .5, .5], exposure: 1,
});

const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){ vUv = aPosition * .5 + .5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uPhoto, uAlpha, uShade, uAtlas;
uniform vec2 uResolution;
uniform mat3 uHinv;
uniform vec2 uPlankSize;
uniform float uRotate, uStagger, uGrout, uDetail, uPlanks, uExposure, uPattern;
uniform vec3 uMeanRGB;
in vec2 vUv;
out vec4 outColor;
vec3 toLinear(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 toSRGB(vec3 c){ return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 photo = texture(uPhoto, vUv).rgb;
  float a = texture(uAlpha, vUv).r;
  if (a < 0.002) { outColor = vec4(photo, 1.0); return; }
  vec3 p = uHinv * vec3(vUv * uResolution, 1.0);
  if (p.z <= 1e-6) { outColor = vec4(photo, 1.0); return; }
  vec2 st = p.xy / p.z;
  float c = cos(uRotate), s = sin(uRotate);
  st = mat2(c, s, -s, c) * st;
  float row = floor(st.y / uPlankSize.y);
  float along = st.x + row * uStagger * uPlankSize.x + hash(vec2(row, 3.7)) * uPlankSize.x;
  float col = floor(along / uPlankSize.x);
  vec2 plankUv = vec2(fract(along / uPlankSize.x), fract(st.y / uPlankSize.y));
  float plank = floor(hash(vec2(row, col)) * uPlanks);
  float plankLength = uPlankSize.x;
  if (uPattern > 0.5) {
    float n = max(2.0, floor(uPlankSize.x / uPlankSize.y + 0.5));
    vec2 grid = st / uPlankSize.y;
    vec2 cell = floor(grid);
    float phase = mod(cell.x + cell.y, 2.0 * n);
    bool horizontal = phase < n;
    vec2 origin = horizontal ? vec2(cell.x - phase, cell.y) : vec2(cell.x, cell.y - phase + n);
    plankUv = horizontal ? vec2((grid.x - origin.x) / n, fract(grid.y)) : vec2((grid.y - origin.y) / n, 1.0 - fract(grid.x));
    plank = floor(hash(origin + vec2(0.0, horizontal ? 0.0 : 97.0)) * uPlanks);
    plankLength = n * uPlankSize.y;
  }
  vec2 atlasUv = vec2(plankUv.x, (plank + clamp(plankUv.y, 0.01, 0.99)) / uPlanks);
  vec3 albedo = toLinear(texture(uAtlas, atlasUv).rgb);
  vec2 d = vec2(min(plankUv.x, 1.0 - plankUv.x) * plankLength, min(plankUv.y, 1.0 - plankUv.y) * uPlankSize.y);
  float edge = min(d.x, d.y);
  float groove = 1.0 - smoothstep(0.0, 0.0012 + fwidth(edge) * 1.5, edge);
  albedo *= 1.0 - uGrout * 0.55 * groove;
  vec2 sh = texture(uShade, vUv).rg * 2.0;
  float detail = mix(1.0, sh.x, uDetail);
  vec3 lit = albedo * sh.y * detail * uExposure;
  float meanLum = max(dot(uMeanRGB, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  vec3 balance = uMeanRGB / meanLum;
  lit *= mix(vec3(1.0), balance, 0.12);
  vec3 linPhoto = toLinear(photo);
  float spec = smoothstep(0.85, 1.0, dot(linPhoto, vec3(0.2126, 0.7152, 0.0722)));
  lit = mix(lit, 1.0 - (1.0 - lit) * (1.0 - linPhoto), spec * 0.12);
  outColor = vec4(mix(photo, toSRGB(lit), a), 1.0);
}`;

class WebGLFloorRenderer implements FloorRenderer {
  readonly kind = 'webgl2' as const;
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly textures: Record<'photo' | 'alpha' | 'shade' | 'atlas', WebGLTexture>;
  private planks = 1;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.canvas = gl.canvas as HTMLCanvasElement;
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('WebGL shader allocation failed');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader) ?? ''}`);
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL program allocation failed');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(program) ?? ''}`);
    this.program = program;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['uPhoto', 'uAlpha', 'uShade', 'uAtlas', 'uResolution', 'uHinv', 'uPlankSize', 'uRotate', 'uStagger', 'uGrout', 'uDetail', 'uPlanks', 'uExposure', 'uMeanRGB', 'uPattern']) {
      this.uniforms.set(name, gl.getUniformLocation(program, name));
    }
    const make = (unit: number, repeat: boolean): WebGLTexture => {
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture allocation failed');
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return texture;
    };
    this.textures = { photo: make(0, false), alpha: make(1, false), shade: make(2, false), atlas: make(3, true) };
    gl.uniform1i(this.uniforms.get('uPhoto')!, 0);
    gl.uniform1i(this.uniforms.get('uAlpha')!, 1);
    gl.uniform1i(this.uniforms.get('uShade')!, 2);
    gl.uniform1i(this.uniforms.get('uAtlas')!, 3);
  }

  setInputs(inputs: FloorRenderInputs): void {
    const gl = this.gl;
    const upload = (unit: number, texture: WebGLTexture, source: TexImageSource, mipmap: boolean): void => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if (mipmap) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
        if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
      }
    };
    this.width = inputs.photo.width;
    this.height = inputs.photo.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    upload(0, this.textures.photo, inputs.photo, false);
    upload(1, this.textures.alpha, inputs.alpha, false);
    upload(2, this.textures.shade, inputs.shade, false);
    upload(3, this.textures.atlas, inputs.atlas, true);
    this.planks = inputs.planks;
  }

  setAlpha(alpha: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.alpha);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, alpha);
  }

  render(params: FloorRenderParams): HTMLCanvasElement {
    if (this.disposed) return this.canvas;
    const gl = this.gl, u = this.uniforms;
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);
    gl.uniform2f(u.get('uResolution')!, this.width, this.height);
    // GLSL mat3 is column-major; Hinv is row-major.
    const h = params.Hinv;
    gl.uniformMatrix3fv(u.get('uHinv')!, false, [h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]]);
    gl.uniform2f(u.get('uPlankSize')!, params.plankSize[0], params.plankSize[1]);
    gl.uniform1f(u.get('uRotate')!, params.rotation + (params.pattern === 'herringbone' ? Math.PI / 4 : 0));
    gl.uniform1f(u.get('uPattern')!, params.pattern === 'herringbone' ? 1 : 0);
    gl.uniform1f(u.get('uStagger')!, params.stagger);
    gl.uniform1f(u.get('uGrout')!, params.grout);
    gl.uniform1f(u.get('uDetail')!, params.detailStrength);
    gl.uniform1f(u.get('uPlanks')!, this.planks);
    gl.uniform1f(u.get('uExposure')!, params.exposure);
    gl.uniform3f(u.get('uMeanRGB')!, params.meanRGB[0], params.meanRGB[1], params.meanRGB[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const texture of Object.values(this.textures)) this.gl.deleteTexture(texture);
    this.gl.deleteProgram(this.program);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width = this.canvas.height = 1;
  }
}

/** Same maths as the shader, on ImageData. Slow but universal. */
class CpuFloorRenderer implements FloorRenderer {
  readonly kind = 'cpu' as const;
  readonly canvas = document.createElement('canvas');
  private photo: Uint8ClampedArray = new Uint8ClampedArray(4);
  private alpha: Uint8ClampedArray = new Uint8ClampedArray(4);
  private shade: Uint8ClampedArray = new Uint8ClampedArray(4);
  private atlas: Uint8ClampedArray = new Uint8ClampedArray(4);
  private atlasWidth = 1;
  private atlasHeight = 1;
  private planks = 1;
  private width = 1;
  private height = 1;

  private read(source: HTMLCanvasElement | ImageBitmap): { data: Uint8ClampedArray; width: number; height: number } {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
  }

  setInputs(inputs: FloorRenderInputs): void {
    const photo = this.read(inputs.photo);
    this.width = photo.width;
    this.height = photo.height;
    this.photo = photo.data;
    this.alpha = this.read(inputs.alpha).data;
    this.shade = this.read(inputs.shade).data;
    const atlas = this.read(inputs.atlas);
    this.atlas = atlas.data;
    this.atlasWidth = atlas.width;
    this.atlasHeight = atlas.height;
    this.planks = inputs.planks;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setAlpha(alpha: HTMLCanvasElement): void { this.alpha = this.read(alpha).data; }

  render(params: FloorRenderParams): HTMLCanvasElement {
    const { width, height } = this;
    const ctx = this.canvas.getContext('2d')!;
    const out = ctx.createImageData(width, height), o = out.data;
    const toLinear = (c: number): number => Math.pow(c / 255, 2.2);
    const toByte = (c: number): number => Math.pow(Math.max(0, c), 1 / 2.2) * 255;
    const hash = (x: number, y: number): number => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const [pl, pw] = params.plankSize, h = params.Hinv;
    const rotation = params.rotation + (params.pattern === 'herringbone' ? Math.PI / 4 : 0);
    const cs = Math.cos(rotation), sn = Math.sin(rotation);
    const meanLum = Math.max(1e-3, params.meanRGB[0] * .2126 + params.meanRGB[1] * .7152 + params.meanRGB[2] * .0722);
    const balance = params.meanRGB.map(c => 1 + (c / meanLum - 1) * .12);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = this.alpha[i] / 255;
      if (a < .002) { o[i] = this.photo[i]; o[i + 1] = this.photo[i + 1]; o[i + 2] = this.photo[i + 2]; o[i + 3] = 255; continue; }
      const px = x + .5, py = y + .5;
      const z = h[6] * px + h[7] * py + h[8];
      if (z <= 1e-6) { o[i] = this.photo[i]; o[i + 1] = this.photo[i + 1]; o[i + 2] = this.photo[i + 2]; o[i + 3] = 255; continue; }
      let s = (h[0] * px + h[1] * py + h[2]) / z, t = (h[3] * px + h[4] * py + h[5]) / z;
      [s, t] = [s * cs - t * sn, s * sn + t * cs];
      const row = Math.floor(t / pw);
      const along = s + row * params.stagger * pl + hash(row, 3.7) * pl;
      const col = Math.floor(along / pl);
      let fu = along / pl - col, fv = t / pw - row;
      let plank = Math.floor(hash(row, col) * this.planks), plankLength = pl;
      if (params.pattern === 'herringbone') {
        const tile = herringboneTile(s, t, pw, pl);
        fu = tile.u; fv = tile.v; plankLength = tile.length;
        plank = Math.floor(hash(tile.idX, tile.idY) * this.planks);
      }
      const ax = Math.min(this.atlasWidth - 1, Math.floor(fu * this.atlasWidth));
      const ay = Math.min(this.atlasHeight - 1, Math.floor((plank + Math.min(.99, Math.max(.01, fv))) / this.planks * this.atlasHeight));
      const ai = (ay * this.atlasWidth + ax) * 4;
      const edge = Math.min(Math.min(fu, 1 - fu) * plankLength, Math.min(fv, 1 - fv) * pw);
      const groove = edge < .0012 ? 1 - edge / .0012 : 0;
      const detail = 1 + (this.shade[i] / 127.5 - 1) * params.detailStrength;
      const tone = this.shade[i + 1] / 127.5;
      const lum = toLinear(this.photo[i]) * .2126 + toLinear(this.photo[i + 1]) * .7152 + toLinear(this.photo[i + 2]) * .0722;
      const highlight = Math.min(1, Math.max(0, (lum - .85) / .15));
      const spec = highlight * highlight * (3 - 2 * highlight);
      for (let c = 0; c < 3; c++) {
        let lit = toLinear(this.atlas[ai + c]) * (1 - params.grout * .55 * groove) * tone * detail * params.exposure * balance[c];
        const lp = toLinear(this.photo[i + c]);
        lit = lit + (1 - (1 - lit) * (1 - lp) - lit) * spec * .12;
        o[i + c] = this.photo[i + c] * (1 - a) + toByte(lit) * a;
      }
      o[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return this.canvas;
  }

  dispose(): void { this.canvas.width = this.canvas.height = 1; }
}

export function createFloorRenderer(prefer: 'auto' | 'cpu' = 'auto'): FloorRenderer {
  if (prefer === 'auto') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
      if (gl) return new WebGLFloorRenderer(gl);
    } catch { /* fall through to the CPU renderer */ }
  }
  return new CpuFloorRenderer();
}
