import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const url = process.env.SPC_WEBSITE_URL || 'http://127.0.0.1:5185/website/';
const output = new URL('../test-results/story/', import.meta.url);
await mkdir(output, { recursive: true });
const outputPath = name => fileURLToPath(new URL(name, output));
const report = { url, checks: [], errors: [], samples: [], failed: null };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on('pageerror', error => report.errors.push({ type: 'pageerror', message: error.message }));
page.on('console', message => { if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text() }); });
page.on('response', response => { if (response.status() >= 400) report.errors.push({ type: 'http', status: response.status(), url: response.url() }); });
const check = message => { report.checks.push(message); console.log(`PASS ${message}`); };
const story = () => page.evaluate(() => window.websiteDemo.story);
const productIds = ['light-natural-oak', 'warm-taupe-oak', 'golden-honey-oak', 'whitewashed-ash-oak', 'greige-oak', 'dark-walnut-brown'];
async function initialize() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.websiteDemo?.ready));
  await page.evaluate(() => window.websiteDemo.ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Boolean(window.websiteDemo.story));
}
async function seek(step) {
  await page.evaluate(step => window.websiteDemo.seekStep(step, false), step);
  await page.waitForFunction(step => window.websiteDemo.story.step === step, step);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return story();
}
async function layout() {
  return page.evaluate(() => ({
    scrollY, viewport: { width: innerWidth, height: innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    hero: document.getElementById('hero').getBoundingClientRect().toJSON(),
    rooms: document.getElementById('rooms').getBoundingClientRect().toJSON(),
    finishCards: [...document.querySelectorAll('.story-layer[data-shown="true"]')].map(node => ({ id: node.dataset.layer, box: node.getBoundingClientRect().toJSON() })),
  }));
}
function assertPinned(value, label) {
  assert.ok(Math.abs(value.hero.top) <= 2, `${label}: hero is no longer pinned (${value.hero.top})`);
  assert.ok(Math.abs(value.hero.height - value.viewport.height) <= 3, `${label}: hero does not occupy one viewport`);
  assert.ok(value.documentWidth <= value.viewport.width + 1, `${label}: horizontal document overflow`);
}
async function roomPixels() {
  return page.locator('.hero-room-floor-canvas').evaluateAll(canvases => canvases.flatMap(canvas => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    const { width, height } = canvas;
    const hash = (left, top, regionWidth, regionHeight) => {
      const pixels = ctx.getImageData(Math.round(width * left), Math.round(height * top), Math.max(1, Math.round(width * regionWidth)), Math.max(1, Math.round(height * regionHeight))).data;
      let value = 2166136261;
      const stride = Math.max(4, Math.floor(pixels.length / 4096 / 4) * 4);
      for (let i = 0; i < pixels.length; i += stride) value = Math.imul(value ^ pixels[i] ^ (pixels[i + 1] << 8) ^ (pixels[i + 2] << 16), 16777619);
      return value >>> 0;
    };
    return [{ width, height, floor: hash(.10, .72, .75, .20), upper: hash(.1, .05, .7, .3) }];
  }));
}

try {
  await initialize();
  const initial = await story();
  assert.equal(initial.step, 0);
  assert.equal(await page.locator('button[data-story-step]').count(), 12);
  await page.screenshot({ path: outputPath('desktop-step-00.png') });
  const forward = [];
  for (let step = 0; step < 12; step++) {
    const current = await seek(step);
    const bounds = await layout();
    assertPinned(bounds, `Desktop step ${step}`);
    assert.ok(bounds.rooms.top >= bounds.viewport.height - 2, `Configurator exposed before story completes at step ${step}`);
    const visible = await page.locator('.story-layer[data-shown="true"]').count();
    const expected = Math.max(0, Math.min(4, step - 6));
    assert.equal(visible, expected, `Step ${step}: incorrect number of revealed construction labels`);
    const pixels = await roomPixels();
    const { scene, room } = current.diagnostics;
    assert.equal(scene.webgl, true);
    assert.equal(scene.layerCount, 4);
    assert.equal(scene.cachedModels, 6);
    assert.equal(scene.visibleModels, 1);
    assert.equal(scene.dimensions.thicknessMm, 5);
    assert.ok(Math.abs(scene.layerThicknessSumMm - 5) < 1e-9, 'Physical layer thickness sum must agree with the 5 MM claim.');
    assert.equal(scene.thickness.assembled, true);
    assert.equal(scene.thickness.thicknessMm, 5);
    if (step < 6) {
      assert.equal(scene.productId, productIds[step], `Wrong model finish at step ${step}`);
      assert.equal(room.from, current.frame.from);
      assert.equal(room.to, current.frame.to);
      assert.ok(Math.abs(room.mix - current.frame.mix) < 1e-9, 'Room and material blend must share the same progress.');
    }
    assert.ok(scene.anchors.every(anchor => Number.isFinite(anchor.x) && Number.isFinite(anchor.y)), 'Every projected layer anchor must be finite.');
    forward.push({ current, pixels });
    report.samples.push({ step, frame: current.frame, diagnostics: current.diagnostics, layout: bounds, pixels });
    if ([1, 5, 6, 7, 10, 11].includes(step)) await page.screenshot({ path: outputPath(`desktop-step-${String(step).padStart(2, '0')}.png`) });
  }
  check('Desktop: twelve native scroll stops stay in one pinned viewport; layer details appear progressively and the configurator remains below.');

  const roomHashes = forward.slice(0, 6).map(sample => sample.pixels[0]?.floor);
  assert.ok(roomHashes.every(value => Number.isFinite(value)), 'Room story needs a readable 2D photo canvas.');
  assert.equal(new Set(roomHashes).size, 6, 'Each of six finishes must visibly change floor pixels.');
  assert.equal(new Set(forward.slice(0, 6).map(sample => sample.pixels[0].upper)).size, 1, 'Changing a finish must preserve the upper room photograph.');
  check('All six finishes change actual floor pixels while the upper room photograph stays unchanged.');

  await seek(10);
  const beforeOrbit = (await story()).diagnostics.scene.cameraPosition;
  const modelBounds = await page.locator('#hero-viewer canvas').boundingBox();
  assert.ok(modelBounds);
  const dragX = modelBounds.x + modelBounds.width * .44;
  const dragY = modelBounds.y + modelBounds.height * .55;
  await page.mouse.move(dragX, dragY); await page.mouse.down();
  await page.mouse.move(dragX + 95, dragY + 30, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction(before => window.websiteDemo.story.diagnostics.scene.cameraPosition.some((value, index) => Math.abs(value - before[index]) > .01), beforeOrbit);
  assert.ok((await story()).diagnostics.scene.anchors.every(anchor => Number.isFinite(anchor.x) && Number.isFinite(anchor.y)));
  const paths = await page.locator('[data-leader]').evaluateAll(nodes => nodes.filter(node => node.getAttribute('d') || node.getAttribute('points')).map(node => node.getAttribute('d') || node.getAttribute('points')));
  assert.equal(paths.length, 4);
  assert.ok(paths.every(path => !/NaN|Infinity/.test(path)));
  await page.locator('#hero-reset').click();
  check('Mouse drag still rotates the enlarged 3D sample and all four leader paths retain finite projected endpoints.');

  for (let step = 5; step >= 0; step--) {
    const current = await seek(step);
    assert.deepEqual(current.frame, forward[step].current.frame, `Frame reversibility at step ${step}`);
    assert.deepEqual(await roomPixels(), forward[step].pixels, `Room image reversibility at step ${step}`);
  }
  check('Reverse scrolling restores each finish and timeline frame without accumulating animation drift.');

  const beforeWheel = await layout();
  const canvasBounds = await page.locator('#hero-viewer canvas').boundingBox();
  assert.ok(canvasBounds);
  await page.mouse.move(canvasBounds.x + canvasBounds.width * .45, canvasBounds.y + canvasBounds.height * .45);
  await page.mouse.wheel(0, 240);
  await page.waitForFunction(y => scrollY > y + 100, beforeWheel.scrollY);
  assertPinned(await layout(), 'Wheel over model');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  check('Wheel over the interactive model changes native document scroll without locking the page.');

  await seek(7);
  await page.locator('#story-next').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.websiteDemo.story.step === 8);
  await page.locator('#story-prev').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.websiteDemo.story.step === 7);
  await page.locator('button[data-story-step="11"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.websiteDemo.story.step === 11);
  assert.match(await page.locator('#story-thickness').innerText(), /5\s*MM/i);
  assert.equal(await page.locator('.story-layer[data-shown="true"]').count(), 4);
  check('Keyboard next, previous and direct step buttons reach the complete four-layer, 5 MM explanation.');

  await page.evaluate(() => scrollTo({ top: document.getElementById('floor-story').offsetTop + document.getElementById('floor-story').offsetHeight, behavior: 'instant' }));
  await page.waitForFunction(() => document.getElementById('hero').getBoundingClientRect().top < -innerHeight * .35);
  assert.ok((await layout()).rooms.top < (await layout()).viewport.height);
  await seek(2);
  await page.locator('#story-skip').click();
  await page.waitForFunction(() => document.getElementById('rooms').getBoundingClientRect().top < innerHeight / 2);
  check('After the last step, ordinary scrolling releases the hero; the skip control also reaches the room selector.');

  await page.setViewportSize({ width: 390, height: 844 });
  await initialize();
  for (const step of [0, 5, 6, 7, 8, 9, 10, 11]) {
    await seek(step);
    const value = await layout();
    assertPinned(value, `Mobile step ${step}`);
    for (const label of value.finishCards) {
      assert.ok(label.box.left >= -1 && label.box.right <= value.viewport.width + 1, `Mobile layer ${label.id} escapes the viewport horizontally`);
      assert.ok(label.box.top >= -1 && label.box.bottom <= value.viewport.height + 1, `Mobile layer ${label.id} escapes the viewport vertically`);
    }
    if ([0, 6, 10, 11].includes(step)) await page.screenshot({ path: outputPath(`mobile-step-${String(step).padStart(2, '0')}.png`) });
  }
  check('Mobile 390px: pinned story and every visible layer label stay within the viewport.');

  await seek(0);
  const touchModel = await page.locator('#hero-viewer canvas').boundingBox();
  assert.ok(touchModel);
  const touchX = Math.round(touchModel.x + touchModel.width * .55);
  const touchY = Math.round(touchModel.y + touchModel.height * .7);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
  for (let index = 1; index <= 8; index++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - index * 25 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => scrollY > 50 && window.websiteDemo.story.progress > 0);
  await cdp.detach();
  check('Actual touch input over the mobile model pans the native page and advances the scroll story.');

  await page.setViewportSize({ width: 375, height: 667 });
  await seek(11);
  const compact = await layout();
  assertPinned(compact, 'Compact mobile');
  for (const label of compact.finishCards) assert.ok(label.box.top >= -1 && label.box.bottom <= 668, `Compact mobile layer ${label.id} leaves the viewport`);
  const rail = await page.locator('.story-rail').boundingBox();
  assert.ok(rail && rail.y >= 0 && rail.y + rail.height <= 668, 'Compact mobile navigation must remain reachable inside the pinned viewport.');
  await page.screenshot({ path: outputPath('mobile-compact-step-11.png') });
  check('Compact 375×667 mobile: all layer explanations and native navigation remain visible in the pinned viewport.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await initialize();
  await page.locator('#story-skip').click();
  await page.waitForFunction(() => document.getElementById('rooms').getBoundingClientRect().top < innerHeight / 2);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await seek(11);
  assert.equal((await story()).step, 11);
  await page.locator('#story-next').focus();
  assert.deepEqual(report.errors, []);
  check('Reduced-motion mode supports direct navigation and skip without a scroll trap or browser errors.');
} catch (error) {
  report.failed = { message: error.message, stack: error.stack };
  await page.screenshot({ path: outputPath('failure.png') }).catch(() => {});
  throw error;
} finally {
  await writeFile(outputPath('browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ url, checks: report.checks, errors: report.errors, sampleCount: report.samples.length, failed: report.failed }, null, 2));
  await browser.close();
}
