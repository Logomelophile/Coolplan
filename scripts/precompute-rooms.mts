/**
 * Precomputes floor mattes for the sample rooms (design §5.8).
 *
 * Runs the same browser pipeline the visualizer will use (ONNX Runtime Web,
 * ADE20K semantic segmentation, guided-filter refinement) inside headless
 * Chrome, then writes 8-bit PNG mattes to public/website/rooms/.
 *
 * Usage:  npx tsx scripts/precompute-rooms.mts --model <dir with model.onnx>
 * The model directory is NOT part of the repo. The prototype uses
 * Xenova/segformer-b0-finetuned-ade-512-512 (NVIDIA research licence: fine for
 * generating internal reference mattes, not for shipping in the product); swap
 * in an Apache-2.0 ADE20K model (EfficientViT-Seg) for production use.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { guidedFilter, luminanceOf, resizeMap, sharpenMatte } from '../src/website/visualizer/mask/guidedFilter';
import { SAMPLE_ROOMS } from '../src/website/visualizer/rooms';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const modelDir = resolve(args[args.indexOf('--model') + 1] ?? '');
if (args.indexOf('--model') < 0) throw new Error('Pass --model <directory containing model.onnx>');
const outDir = join(root, 'public', 'website', 'rooms');
const debugDir = args.includes('--debug') ? resolve(args[args.indexOf('--debug') + 1]) : null;
const FLOOR = 3, RUG = 28;
const TARGET_LONG_EDGE = 1024;

const types: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.onnx': 'application/octet-stream', '.html': 'text/html', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const file = url.pathname.startsWith('/model/') ? join(modelDir, url.pathname.slice(7)) : join(root, decodeURIComponent(url.pathname));
    if (url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><meta charset="utf-8"><script src="/node_modules/onnxruntime-web/dist/ort.wasm.min.js"></script><body></body>');
      return;
    }
    const info = await stat(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-length': info.size });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const port = (server.address() as { port: number }).port;

function encodePng(width: number, height: number, gray: Uint8Array | null, rgba: Uint8Array | null): Buffer {
  const channels = gray ? 1 : 4;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * channels + 1)] = 0;
    const source = gray ?? rgba!;
    raw.set(source.subarray(y * width * channels, (y + 1) * width * channels), y * (width * channels + 1) + 1);
  }
  const crc = (buffer: Buffer): number => {
    let c = ~0;
    for (const byte of buffer) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = gray ? 0 : 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
page.on('console', message => { if (message.type() === 'error') console.error('[page]', message.text()); });
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(async () => {
  const ort = (window as unknown as { ort: typeof import('onnxruntime-web') }).ort;
  ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create('/model/model.onnx', { executionProviders: ['wasm'] });
  const image = new Image();
  await new Promise<void>((ok, fail) => { image.onload = () => ok(); image.onerror = () => fail(new Error('sprite failed')); image.src = '/public/website/assets/prototype-home.png'; });
  Object.assign(window, { __session: session, __sprite: image, __ort: ort });
});

await mkdir(outDir, { recursive: true });
if (debugDir) await mkdir(debugDir, { recursive: true });
const summary: Record<string, unknown>[] = [];

for (let index = 0; index < SAMPLE_ROOMS.length; index++) {
  const room = SAMPLE_ROOMS[index];
  const scale = TARGET_LONG_EDGE / Math.max(room.crop.width, room.crop.height);
  const width = Math.round(room.crop.width * scale), height = Math.round(room.crop.height * scale);
  const started = Date.now();
  const result = await page.evaluate(async ({ crop, width, height, FLOOR, RUG }) => {
    const { __session: session, __sprite: sprite, __ort: ort } = window as unknown as { __session: import('onnxruntime-web').InferenceSession; __sprite: HTMLImageElement; __ort: typeof import('onnxruntime-web') };
    // Working image: the crop upscaled with smoothing.
    const work = document.createElement('canvas'); work.width = width; work.height = height;
    const wctx = work.getContext('2d', { willReadFrequently: true })!;
    wctx.imageSmoothingQuality = 'high';
    wctx.drawImage(sprite, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    const pixels = wctx.getImageData(0, 0, width, height).data;
    // Network input: letterbox into 512x512.
    const size = 512, s = size / Math.max(width, height);
    const nw = Math.round(width * s), nh = Math.round(height * s), ox = Math.floor((size - nw) / 2), oy = Math.floor((size - nh) / 2);
    const net = document.createElement('canvas'); net.width = net.height = size;
    const nctx = net.getContext('2d', { willReadFrequently: true })!;
    nctx.fillStyle = '#7f7f7f'; nctx.fillRect(0, 0, size, size);
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(work, 0, 0, width, height, ox, oy, nw, nh);
    const data = nctx.getImageData(0, 0, size, size).data;
    const mean = [.485, .456, .406], std = [.229, .224, .225];
    const input = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) for (let c = 0; c < 3; c++) input[c * size * size + i] = (data[i * 4 + c] / 255 - mean[c]) / std[c];
    const t0 = performance.now();
    const output = await session.run({ pixel_values: new ort.Tensor('float32', input, [1, 3, size, size]) });
    const ms = performance.now() - t0;
    const logits = output[Object.keys(output)[0]];
    const [, classes, lh, lw] = logits.dims as number[];
    const values = logits.data as Float32Array;
    // Softmax -> floor + rug probability, then crop the letterbox region.
    const prob = new Float32Array(lw * lh);
    for (let i = 0; i < lw * lh; i++) {
      let max = -Infinity;
      for (let c = 0; c < classes; c++) max = Math.max(max, values[c * lw * lh + i]);
      let sum = 0, floor = 0;
      for (let c = 0; c < classes; c++) { const e = Math.exp(values[c * lw * lh + i] - max); sum += e; if (c === FLOOR || c === RUG) floor += e; }
      prob[i] = floor / sum;
    }
    const rx = Math.round(ox * lw / size), ry = Math.round(oy * lh / size), rw = Math.round(nw * lw / size), rh = Math.round(nh * lh / size);
    const cropped = new Float32Array(rw * rh);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) cropped[y * rw + x] = prob[(y + ry) * lw + (x + rx)];
    return { pixels: Array.from(pixels), prob: Array.from(cropped), pw: rw, ph: rh, ms };
  }, { crop: room.crop, width, height, FLOOR, RUG });

  const rgba = new Uint8ClampedArray(result.pixels);
  const guide = luminanceOf(rgba, width, height);
  const coarse = resizeMap(new Float32Array(result.prob), result.pw, result.ph, width, height);
  const refined = sharpenMatte(guidedFilter(guide, coarse, width, height, { radius: Math.round(width * .006), epsilon: 2e-3 }), .4, .6);
  const gray = new Uint8Array(width * height);
  let coverage = 0;
  for (let i = 0; i < gray.length; i++) { gray[i] = Math.round(refined[i] * 255); coverage += refined[i]; }
  coverage /= gray.length;
  await writeFile(join(outDir, `room-${index}-alpha.png`), encodePng(width, height, gray, null));
  if (debugDir) {
    const overlay = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const a = refined[i] * .55;
      overlay[i * 4] = rgba[i * 4] * (1 - a) + 200 * a;
      overlay[i * 4 + 1] = rgba[i * 4 + 1] * (1 - a) + 60 * a;
      overlay[i * 4 + 2] = rgba[i * 4 + 2] * (1 - a) + 220 * a;
      overlay[i * 4 + 3] = 255;
    }
    await writeFile(join(debugDir, `room-${index}-overlay.png`), encodePng(width, height, null, overlay));
  }
  const entry = { room: index, width, height, inferenceMs: Math.round(result.ms), totalMs: Date.now() - started, coverage: Number(coverage.toFixed(3)) };
  summary.push(entry);
  console.log(JSON.stringify(entry));
}
await writeFile(join(outDir, 'precompute-summary.json'), JSON.stringify({ generated: new Date().toISOString(), model: 'segformer-b0-ade20k (prototype)', rooms: summary }, null, 2));
await browser.close();
server.close();
