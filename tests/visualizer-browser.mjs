import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const url = process.env.SPC_WEBSITE_URL || 'http://127.0.0.1:5185/website/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const software = process.env.SPC_SOFTWARE_WEBGL === '1';
const args = ['--enable-webgl', '--ignore-gpu-blocklist', ...(software ? ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])];
const launch = { ...(executablePath ? { executablePath } : { channel: 'chrome' }), headless: true, args };
const output = new URL('../test-results/visualizer/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { url, checks: [], errors: [], failed: null };
const check = message => { report.checks.push(message); console.log(`PASS ${message}`); };
const browser = await chromium.launch(launch);
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => window.websiteDemo.diagnostics.preview);
const canvas = () => page.locator('#room-preview canvas');
async function initialize() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.websiteDemo?.ready));
  await page.evaluate(() => window.websiteDemo.ready);
  await page.locator('#products').scrollIntoViewIfNeeded();
}
async function hash(target = canvas()) {
  return target.evaluate(canvas => {
    const { width, height } = canvas;
    const data = canvas.getContext('2d').getImageData(0, Math.round(height * .7), width, Math.max(1, Math.floor(height * .25))).data;
    let value = 2166136261;
    for (let i = 0; i < data.length; i += 16) value = Math.imul(value ^ data[i] ^ (data[i + 1] << 8) ^ (data[i + 2] << 16), 16777619);
    return value >>> 0;
  });
}
async function openEditor() {
  if (!await page.locator('#visualizer-refinement').evaluate(element => element.open)) await page.locator('#visualizer-refinement summary').click();
}
async function chooseRoom(index) {
  await page.locator(`[data-room="${index}"]`).first().click();
  await page.waitForFunction(index => {
    const state = window.websiteDemo.diagnostics.preview;
    return state.room === index && state.sourceWidth === 1672 && state.sourceHeight === 941 && state.floorSelected;
  }, index);
}
async function furnitureDifference(target = canvas()) {
  return target.evaluate(async (canvas, websiteUrl) => {
    const root = new URL('../', websiteUrl);
    const image = new Image(); image.src = new URL('room/references/room-original.png', root).href; await image.decode();
    const original = document.createElement('canvas'); original.width = canvas.width; original.height = canvas.height;
    const { frame, display } = window.websiteDemo.diagnostics.preview;
    original.getContext('2d').drawImage(image, frame.x, frame.y, frame.width, frame.height, display.x, display.y, display.width, display.height);
    const a = original.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const b = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let maximum = 0;
    // Table top, each visible pedestal, sofa and plant pot: none may be repainted.
    for (const [x, y] of [[1450,365],[1345,442],[1470,485],[1618,470],[1080,300],[770,370]]) {
      const px = Math.round(display.x + (x - frame.x) / frame.width * display.width);
      const py = Math.round(display.y + (y - frame.y) / frame.height * display.height);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let c = 0; c < 3; c++) {
        const i = ((py + dy) * canvas.width + px + dx) * 4 + c;
        maximum = Math.max(maximum, Math.abs(a[i] - b[i]));
      }
    }
    return maximum;
  }, url);
}

try {
  await initialize();
  assert.equal((await state()).renderer, 'webgl2');
  assert.equal((await state()).sourceWidth, 1672);
  const combinations = [];
  for (const pattern of ['straight', 'herringbone']) {
    await page.locator(`[data-pattern="${pattern}"]`).click();
    for (let finish = 0; finish < 6; finish++) {
      await page.locator(`[data-product="${finish}"]`).click();
      assert.equal((await state()).pattern, pattern); assert.equal((await state()).finish, finish);
      assert.equal(await page.locator(`[data-product="${finish}"]`).getAttribute('aria-pressed'), 'true');
      const difference = await furnitureDifference();
      assert.ok(difference <= 2, `${pattern}/${finish} recoloured a furniture pixel (max difference ${difference})`);
      combinations.push(await hash());
    }
    await page.locator('.configurator-grid').screenshot({ path: fileURLToPath(new URL(`${pattern}-desktop.png`, output)) });
  }
  assert.equal(new Set(combinations).size, 12);
  check('All six colours and both laying patterns visibly differ; table, pedestals, sofa and plant pixels stay unchanged.');

  await page.locator('[data-product="0"]').focus(); await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.product), '0');
  check('Keyboard colour selection retains focus.');
  await page.locator('[data-product="5"]').click();
  const before = await hash();
  await openEditor(); await page.locator('#tool-brush-erase').click();
  await canvas().scrollIntoViewIfNeeded();
  const box = await canvas().boundingBox();
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .85);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .43, box.y + box.height * .85, { steps: 8 }); await page.mouse.up();
  await page.locator('#tool-brush-erase').click();
  const erased = await hash(); assert.notEqual(erased, before); assert.equal((await state()).canUndo, true);
  await page.locator('#tool-undo').click(); assert.equal(await hash(), before);
  await page.locator('#tool-redo').click(); assert.equal(await hash(), erased);
  await page.locator('#tool-reset-mask').click(); assert.equal(await hash(), before);
  check('Sample-room edge painting changes pixels; undo, redo and reset restore the correct mask.');

  const downloadEvent = page.waitForEvent('download'); await page.locator('#tool-download').click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /CP-106-herringbone\.jpg$/);
  const bytes = await readFile(await download.path()); assert.ok(bytes.length > 20000);
  const dimensions = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
    const size = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return size;
  }, [...bytes]);
  assert.deepEqual(dimensions, { width: 1672, height: 941 });
  check('Customers can download a full-resolution JPEG labelled with their selected colour and pattern.');

  for (let room = 0; room < 7; room++) {
    await chooseRoom(room);
    assert.ok((await state()).coverage > .25);
    assert.equal((await state()).pattern, 'herringbone');
    await page.locator('#room-preview-shell').screenshot({ path: fileURLToPath(new URL(`room-${room}-herringbone.png`, output)) });
  }
  check('All seven sample rooms use 1672×941 source photos with individual floor contours.');

  await chooseRoom(0); await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await openEditor(); await page.locator('#tool-brush-erase').click(); await canvas().scrollIntoViewIfNeeded();
  assert.equal(await canvas().evaluate(canvas => canvas.style.touchAction), 'none');
  const touchBox = await canvas().boundingBox(); const scrollBefore = await page.evaluate(() => scrollY);
  const cdp = await context.newCDPSession(page);
  const touchX = Math.round(touchBox.x + touchBox.width * .35), touchY = Math.round(touchBox.y + touchBox.height * .8);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX + 25, y: touchY - 5 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) <= 1);
  assert.equal((await state()).canUndo, true);
  await page.locator('#tool-brush-erase').click();
  assert.equal(await canvas().evaluate(canvas => canvas.style.touchAction), 'pan-y');
  await page.locator('#tool-undo').click();
  await page.locator('.configurator-grid').screenshot({ path: fileURLToPath(new URL('mobile.png', output)) });
  check('Mobile controls fit 390px; touch painting edits the floor without scrolling the page.');

  await page.route('**/*vision.worker*', route => route.abort());
  await page.locator('#room-file').setInputFiles(fileURLToPath(new URL('../public/room/references/room-original.png', import.meta.url)));
  await page.waitForFunction(() => window.websiteDemo.diagnostics.preview.stage === 'manual');
  await canvas().scrollIntoViewIfNeeded();
  const uploadBox = await canvas().boundingBox(), uploaded = await state();
  const scale = Math.min(uploadBox.width / uploaded.sourceWidth, uploadBox.height / uploaded.sourceHeight);
  const left = uploadBox.x + (uploadBox.width - uploaded.sourceWidth * scale) / 2;
  const top = uploadBox.y + (uploadBox.height - uploaded.sourceHeight * scale) / 2;
  for (const [x, y] of [[.12,.62],[.68,.62],[.75,.9],[.08,.9]]) await page.mouse.click(left + x * uploaded.sourceWidth * scale, top + y * uploaded.sourceHeight * scale);
  assert.equal((await state()).floorSelected, true);
  const initialScale = await hash();
  await page.locator('#tool-plank-scale').fill('200'); await page.locator('#tool-plank-scale').dispatchEvent('input');
  assert.notEqual(await hash(), initialScale);
  await page.locator('[data-pattern="straight"]').click(); assert.equal((await state()).pattern, 'straight');
  await page.locator('#reset-upload').click(); assert.equal((await state()).uploaded, false);
  check('When AI is unavailable, upload, manual floor selection, pattern changes and plank scaling still work.');

  const fallbackBrowser = await chromium.launch({ ...launch, args: [...args, '--disable-webgl'] });
  try {
    const fallbackPage = await fallbackBrowser.newPage({ viewport: { width: 1200, height: 900 } });
    fallbackPage.setDefaultTimeout(60000);
    fallbackPage.on('pageerror', error => report.errors.push(`CPU fallback: ${error.message}`));
    await fallbackPage.goto(url, { waitUntil: 'networkidle' });
    await fallbackPage.waitForFunction(() => Boolean(window.websiteDemo?.ready));
    await fallbackPage.evaluate(() => window.websiteDemo.ready);
    assert.equal(await fallbackPage.evaluate(() => window.websiteDemo.diagnostics.preview.renderer), 'cpu');
    await fallbackPage.locator('[data-product="5"]').click();
    const fallbackCanvas = fallbackPage.locator('#room-preview canvas');
    const straight = await hash(fallbackCanvas);
    await fallbackPage.locator('[data-pattern="herringbone"]').click();
    assert.notEqual(await hash(fallbackCanvas), straight);
    assert.ok(await furnitureDifference(fallbackCanvas) <= 2);
    check('Browsers without WebGL still render distinct straight/herringbone floors and preserve furniture pixels.');
  } finally { await fallbackBrowser.close(); }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failed = { message: error.message, stack: error.stack };
  await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)) }).catch(() => {});
  throw error;
} finally {
  await writeFile(new URL('browser-report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
