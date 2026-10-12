import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const url = process.env.SPC_WEBSITE_URL || 'http://127.0.0.1:5185/website/';
const output = new URL('../test-results/website/', import.meta.url);
const photoPath = fileURLToPath(new URL('../public/room/references/room-original.png', import.meta.url));
await mkdir(output, { recursive: true });
const outputPath = name => fileURLToPath(new URL(name, output));
const report = { url, checks: [], errors: [], failed: null, desktop: null, mobile: null };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1122, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => report.errors.push({ type: 'pageerror', message: error.message }));
page.on('console', message => { if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text() }); });
page.on('response', response => { if (response.status() >= 400) report.errors.push({ type: 'http', status: response.status(), url: response.url() }); });

const state = () => page.evaluate(() => ({ ...window.websiteDemo.state, ...window.websiteDemo.diagnostics }));
const check = message => { report.checks.push(message); console.log(`PASS ${message}`); };
const previewHash = () => page.locator('#room-preview canvas').evaluate(canvas => {
  const context = canvas.getContext('2d');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  const stride = Math.max(4, Math.floor(pixels.length / 4096 / 4) * 4);
  for (let i = 0; i < pixels.length; i += stride) hash = Math.imul(hash ^ pixels[i] ^ (pixels[i + 1] << 8) ^ (pixels[i + 2] << 16), 16777619);
  return hash >>> 0;
});
async function initialize() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.websiteDemo?.ready));
  await page.evaluate(() => window.websiteDemo.ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.websiteDemo.diagnostics.viewer?.layerCount === 4 && window.websiteDemo.diagnostics.viewer.calls > 0);
  const value = await state();
  assert.equal(value.viewer.webgl, true);
  assert.equal(value.preview.ready, true);
  assert.equal(value.preview.failed, false);
}
async function noOverflow() {
  const value = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, hero: document.getElementById('hero').getBoundingClientRect().toJSON(), products: document.getElementById('product-grid').getBoundingClientRect().toJSON(), preview: document.getElementById('room-preview-shell').getBoundingClientRect().toJSON() }));
  assert.ok(value.document <= value.viewport + 1, `Document overflows: ${JSON.stringify(value)}`);
  for (const key of ['hero', 'products', 'preview']) {
    assert.ok(value[key].left >= -1 && value[key].right <= value.viewport + 1, `${key} is outside viewport: ${JSON.stringify(value[key])}`);
  }
  return value;
}
async function escapeExpanded(openId, shellId, closeId) {
  await page.locator(`#${openId}`).click();
  await page.waitForFunction(id => document.getElementById(id).classList.contains('is-expanded'), shellId);
  assert.equal(await page.locator(`#${shellId}`).getAttribute('role'), 'dialog');
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  assert.equal(await page.locator(`#${closeId}`).isVisible(), true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(id => !document.getElementById(id).classList.contains('is-expanded'), shellId);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.equal(await page.evaluate(id => document.activeElement?.id === id, openId), true);
}
async function uploadAndReset(label) {
  await page.locator('#room-file').setInputFiles(photoPath);
  await page.waitForFunction(() => window.websiteDemo.diagnostics.preview.uploaded && !window.websiteDemo.diagnostics.preview.floorSelected);
  assert.match(await page.locator('#preview-hint').innerText(), /0\/4/);
  const canvas = page.locator('#room-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rectangle = await canvas.boundingBox();
  assert.ok(rectangle);
  // All four points lie in the unobstructed floor portion, clear of canvas controls.
  for (const [x, y] of [[.28, .65], [.72, .65], [.80, .89], [.20, .89]]) {
    await page.mouse.click(rectangle.x + rectangle.width * x, rectangle.y + rectangle.height * y);
  }
  await page.waitForFunction(() => window.websiteDemo.diagnostics.preview.floorSelected);
  assert.equal((await state()).preview.floorCorners, 4);
  await page.locator('#compare-toggle').click();
  assert.equal((await state()).preview.compare, true);
  await page.screenshot({ path: outputPath(`${label}-upload-four-corners.png`), fullPage: true });
  await canvas.focus();
  await page.keyboard.press('Escape');
  assert.equal((await state()).preview.floorCorners, 0);
  assert.equal((await state()).preview.floorSelected, false);
  await page.locator('#reset-upload').click();
  assert.equal((await state()).preview.uploaded, false);
  assert.equal(await page.locator('#reset-upload').isVisible(), false);
  assert.equal(await page.locator('#sample-tab').getAttribute('aria-pressed'), 'true');
  check(`${label}: local photo upload, four floor corners, comparison, Escape reset and return to sample room.`);
}

try {
  await initialize();
  report.desktop = await noOverflow();
  await page.screenshot({ path: outputPath('homepage-desktop.png') });
  check('Desktop 1122px: built homepage renders with WebGL, four material layers, ready room photo and no horizontal overflow.');

  const heroCanvas = page.locator('#hero-viewer canvas');
  const heroRect = await heroCanvas.boundingBox();
  assert.ok(heroRect);
  const initial = await page.evaluate(() => ({ progress: window.websiteDemo.story?.progress ?? window.websiteDemo.state.progress }));
  await page.mouse.move(heroRect.x + heroRect.width * .6, heroRect.y + heroRect.height * .45);
  await page.mouse.wheel(0, 180);
  await page.waitForFunction(progress => scrollY > 0 && (window.websiteDemo.story?.progress ?? window.websiteDemo.state.progress) > progress, initial.progress);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => scrollY === 0);
  const beforeOrbit = (await state()).viewer.cameraPosition;
  const startX = heroRect.x + heroRect.width * .48, startY = heroRect.y + heroRect.height * .42;
  await page.mouse.move(startX, startY); await page.mouse.down();
  await page.mouse.move(startX + 85, startY + 35, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction(before => window.websiteDemo.diagnostics.viewer.cameraPosition.some((value, index) => Math.abs(value - before[index]) > .01), beforeOrbit);
  await page.locator('#layer-slider').fill('72');
  await page.locator('#layer-slider').dispatchEvent('input');
  assert.equal((await state()).viewer.explode, .72);
  await page.locator('#layers-toggle').click(); assert.equal((await state()).progress, 0);
  await page.locator('#layers-toggle').click(); assert.equal((await state()).progress, 1);
  await escapeExpanded('hero-expand', 'hero-3d-shell', 'hero-fullscreen-close');
  check('Hero: wheel scrolls the page and advances the story; actual drag changes camera; slider, layer toggle and fullscreen Escape work.');

  assert.equal(await page.locator('#product-grid .product-card').count(), 6);
  const originalHash = await previewHash();
  await page.locator('[data-filter="4"]').click();
  assert.equal(await page.locator('#product-grid .product-card').count(), 1);
  await page.locator('[data-product="4"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.viewer.productId === 'greige-oak');
  assert.equal((await state()).preview.finish, 4);
  assert.notEqual(await previewHash(), originalHash);
  await page.locator('[data-filter="5"]').click();
  assert.equal(await page.locator('#product-grid .product-card').count(), 1);
  await page.locator('[data-product="5"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.viewer.productId === 'dark-walnut-brown');
  assert.equal((await state()).preview.finish, 5);
  await page.locator('[data-filter="0"]').click();
  assert.equal(await page.locator('#product-grid .product-card').count(), 6);
  check('Color filters narrow the catalog; Grey Oak and Walnut selection update both the 3D product and actual room image pixels.');

  await page.locator('#all-rooms').click();
  assert.equal(await page.locator('#room-gallery').evaluate(dialog => dialog.open), true);
  assert.equal(await page.locator('#gallery-grid [data-room]').count(), 7);
  await page.locator('#gallery-grid [data-room="2"]').click();
  assert.equal(await page.locator('#room-gallery').evaluate(dialog => dialog.open), false);
  assert.equal((await state()).preview.room, 2);
  await page.locator('#next-room').click(); assert.equal((await state()).preview.room, 3);
  await page.locator('#previous-room').click(); assert.equal((await state()).preview.room, 2);
  const roomHash = await previewHash();
  await page.locator('[data-view="3"]').click(); assert.equal((await state()).preview.view, 3);
  assert.notEqual(await previewHash(), roomHash);
  await page.locator('#compare-toggle').click(); assert.equal((await state()).preview.compare, true);
  assert.equal(await page.locator('#compare-toggle').getAttribute('aria-pressed'), 'true');
  await escapeExpanded('preview-expand', 'room-preview-shell', 'preview-close');
  check('Room gallery, previous/next, view crop, comparison and preview fullscreen Escape work.');
  await uploadAndReset('desktop');

  await page.locator('#main-navigation [data-contact-open]').click();
  assert.equal(await page.locator('#contact-dialog').evaluate(dialog => dialog.open), true);
  assert.equal(await page.locator('#contact-dialog a[href^="tel:"]').getAttribute('href'), 'tel:+66846707551');
  assert.match(await page.locator('#contact-dialog a[href^="mailto:"]').getAttribute('href'), /^mailto:coolplanworkshop@gmail\.com\?subject=/);
  assert.match(await page.locator('#contact-dialog').innerText(), /คุณคะน้า/);
  await page.keyboard.press('Escape');
  check('Contact dialog displays the named contact and correct phone/email link destinations; no external call or email is opened.');

  await page.setViewportSize({ width: 390, height: 844 });
  await initialize();
  report.mobile = await noOverflow();
  await page.screenshot({ path: outputPath('homepage-mobile.png') });
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.locator('#main-navigation [data-contact-open]').click();
  assert.equal(await page.locator('#contact-dialog').evaluate(dialog => dialog.open), true);
  await page.keyboard.press('Escape');
  await escapeExpanded('hero-expand', 'hero-3d-shell', 'hero-fullscreen-close');
  await page.locator('[data-filter="4"]').click(); await page.locator('[data-product="4"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.viewer.productId === 'greige-oak');
  assert.equal((await state()).preview.finish, 4);
  await escapeExpanded('preview-expand', 'room-preview-shell', 'preview-close');
  await uploadAndReset('mobile');
  await noOverflow();
  check('Mobile 390px: menu/contact, product selection, hero and room fullscreen, upload controls fit and work without horizontal overflow.');

  await page.evaluate(() => { window.websiteDemo.dispose(); window.websiteDemo.dispose(); });
  assert.equal(await page.locator('#hero-viewer canvas,#room-preview canvas,.hero-room-floor-canvas').count(), 0);
  assert.equal((await state()).disposed, true);
  check('Repeated homepage disposal removes the 3D scene, hero room and preview canvases without errors.');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failed = { message: error.message, stack: error.stack };
  await page.screenshot({ path: outputPath('failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(outputPath('browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
