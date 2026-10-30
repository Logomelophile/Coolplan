import {verifyRedesign} from './website-redesign-checks.mjs';
import {verifyOrbit} from './website-orbit-checks.mjs';
import {verifyInstallation} from './website-installation-checks.mjs';
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
async function initialize(targetUrl = url) {
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.websiteDemo?.ready));
  await page.evaluate(() => window.websiteDemo.ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.websiteDemo.diagnostics.viewer?.layerCount === 5 && window.websiteDemo.diagnostics.viewer.calls > 0);
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
  // Automatic detection runs in a worker (first run downloads the model); it ends in 'auto' or falls back to 'manual'.
  await page.waitForFunction(() => { const p = window.websiteDemo.diagnostics.preview; return p.uploaded && (p.stage === 'auto' || p.stage === 'manual'); }, null, { timeout: 180000 });
  const scanned = (await state()).preview;
  report[`${label}Scan`] = { stage: scanned.stage, coverage: scanned.coverage, horizonY: scanned.horizonY, horizonConfidence: scanned.horizonConfidence, backend: scanned.backend, segmentMs: scanned.segmentMs, segmentTimings: scanned.segmentTimings, cameraHeight: scanned.cameraHeight, scanError: scanned.scanError };
  if (scanned.stage === 'auto') {
    assert.ok(scanned.coverage > .05, `auto floor coverage ${scanned.coverage}`);
    assert.equal(scanned.floorSelected, true);
    assert.equal(await page.locator('#visualizer-tools').isVisible(), true);
    await page.locator('#compare-toggle').click();
    assert.equal((await state()).preview.compare, true);
    await page.screenshot({ path: outputPath(`${label}-upload-auto.png`), fullPage: false });
    // Edge tools live in a collapsed "ปรับขอบพื้น" panel; open it first.
    if (await page.locator('#visualizer-refinement').count() && !await page.locator('#visualizer-refinement').evaluate(element => element.open)) await page.locator('#visualizer-refinement summary').click();
    await page.locator('#tool-brush-add').click();
    assert.equal((await state()).preview.tool, 'brush-add');
    await page.locator('#tool-horizon').click();
    assert.equal((await state()).preview.tool, 'horizon');
    await page.locator('#tool-horizon').click();
    await page.locator('#tool-manual').click();
  } else {
    console.warn(`${label}: automatic detection unavailable (${scanned.scanError}); manual path only.`);
  }
  await page.waitForFunction(() => { const p = window.websiteDemo.diagnostics.preview; return p.stage === 'manual' && !p.floorSelected; });
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
  check(`${label}: local photo upload, automatic floor detection or manual fallback, tools, four floor corners, comparison, Escape reset and return to sample room.`);
}

try {
  await initialize();
  report.desktop = await noOverflow();
  await page.screenshot({ path: outputPath('homepage-desktop.png') });
  check('Desktop 1122px: built homepage renders with WebGL, five material layers, ready room photo and no horizontal overflow.');

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
  assert.equal(await page.locator('#hero .hero-3d-tools').isVisible(), false);
  assert.equal(await page.locator('#hero .hero-3d-hint').isVisible(), false);
  assert.equal(await page.locator('#hero .hero-3d-tools').evaluate(el => el.inert), true);
  check('Hero: wheel advances the automatic five-layer story and drag rotates the camera; internal adjustment controls stay hidden and unfocusable.');

  await page.locator('#client-logos').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => window.websiteDemo.diagnostics.clientLogos?.running);
  assert.equal(await page.locator('#client-logos-title').innerText(), 'Our Customer');
  const customerHeading = await page.locator('#client-logos-title').evaluate(el => ({ center: el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2, size: parseFloat(getComputedStyle(el).fontSize), sectionHeight: el.closest('section').offsetHeight, viewport: innerWidth }));
  assert.ok(Math.abs(customerHeading.center - customerHeading.viewport / 2) < 2 && customerHeading.size <= 22 && customerHeading.sectionHeight < 240, 'Customer heading is small, centred and compact');
  const logoGroups = page.locator('.client-logos-group');
  assert.equal(await logoGroups.count(), 2);
  assert.ok(await logoGroups.first().locator('img').count() >= 10, 'Customer strip contains authentic logo images');
  assert.equal(await logoGroups.last().getAttribute('aria-hidden'), 'true');
  await page.waitForFunction(() => [...document.querySelectorAll('.client-logos-group img')].every(img => img.complete && img.naturalWidth > 0));
  const logoTransform = () => page.locator('.client-logos-track').evaluate(el => getComputedStyle(el).transform);
  const moving = await logoTransform();
  await page.waitForFunction(previous => getComputedStyle(document.querySelector('.client-logos-track')).transform !== previous, moving);
  assert.notEqual(await logoTransform(), moving, 'Customer logos move continuously');
  await page.locator('.client-logos-window').hover();
  const hovered = await logoTransform();
  await page.waitForFunction(previous => getComputedStyle(document.querySelector('.client-logos-track')).transform !== previous, hovered);
  assert.notEqual(await logoTransform(), hovered, 'Hover does not pause the customer ribbon');
  await page.locator('.client-logos-window').focus();
  assert.equal(await page.locator('.client-logos-track').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
  await page.locator('.client-logos-toggle').click();
  assert.equal(await page.locator('.client-logos-toggle').getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(100);
  const paused = await logoTransform();
  await page.waitForTimeout(180);
  assert.equal(await logoTransform(), paused, 'Pause control freezes the logo ribbon');
  await page.locator('.client-logos-toggle').click();
  assert.equal(await page.locator('.client-logos-toggle').getAttribute('aria-pressed'), 'false');
  await page.locator('#client-logos').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const handoff = await page.evaluate(() => {
    const logos = document.querySelector('#client-logos').getBoundingClientRect();
    const title = document.querySelector('.orbit-heading').getBoundingClientRect();
    return { logoBottom: logos.bottom, titleTop: title.top, titleBottom: title.bottom, height: innerHeight, text: document.querySelector('.orbit-heading h2').getAttribute('aria-label') };
  });
  assert.ok(handoff.titleBottom < handoff.height, 'The opening typed headline is readable as the customer strip passes');
  assert.equal(handoff.text.replace(/\s+/g, ''), 'เบื้องหลังความสมบูรณ์แบบของโครงการชั้นนำ');
  await page.screenshot({ path: outputPath('client-logos-desktop.png') });
  check('Authentic customer logos load, loop before the experience intro, and can be paused and resumed.');
  await verifyOrbit(page,{state,check,outputPath});

  assert.deepEqual(await page.locator('#featured .featured-item').evaluateAll(items => items.map(item => item.id)), ['project-cafe', 'project-office']);
  const featureIds = ['cafe', 'office'];
  for (const id of featureIds) {
    const selector = id === 'warranty' ? '#installation-warranty' : `#project-${id}`;
    const target = await page.locator(selector).evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, travel: el.offsetHeight - innerHeight }));
    const seekFeature = async progress => {
      await page.evaluate(({ top, travel, progress }) => scrollTo({ top: top + (travel + innerHeight * .45) * progress - innerHeight * .45, behavior: 'instant' }), { ...target, progress });
      await page.waitForFunction(({ id, progress }) => {
        const value = window.websiteDemo.diagnostics.experience.featured.find(item => item.id === id);
        return value && Math.abs(value.progress - progress) < .01 && !value.animating;
      }, { id, progress });
    };
    await seekFeature(.8);
    await page.waitForFunction(selector => [...document.querySelectorAll(`${selector} img`)].every(img => img.complete && img.naturalWidth > 0), selector);
    assert.ok(await page.locator(`${selector} .featured-photo img`).evaluateAll(images => images.every(img => Math.abs(img.clientWidth / img.clientHeight - img.naturalWidth / img.naturalHeight) < .015 && getComputedStyle(img).objectFit === 'contain')), `${id}: project photographs retain their full source shape`);
    const endTransform = await page.locator(`${selector} .featured-photo-2`).evaluate(el => getComputedStyle(el).transform);
    await page.screenshot({ path: outputPath(`featured-${id}-desktop.png`) });
    await seekFeature(.12);
    assert.notEqual(await page.locator(`${selector} .featured-photo-2`).evaluate(el => getComputedStyle(el).transform), endTransform, `${id}: photo motion rewinds with scroll`);
    await seekFeature(.65);
    const photoBounds = await page.locator(selector).evaluate(section => {
      const media = section.querySelector('.featured-media').getBoundingClientRect();
      const copy = section.querySelector('.featured-copy').getBoundingClientRect();
      return [...section.querySelectorAll('.featured-photo')].map(photo => {
        const rect = photo.getBoundingClientRect();
        return { bounded: rect.left >= media.left - 1 && rect.right <= media.right + 1 && rect.top >= media.top - 1 && rect.bottom <= media.bottom + 1, clearOfCopy: rect.right <= copy.left || rect.left >= copy.right || rect.bottom <= copy.top || rect.top >= copy.bottom };
      });
    });
    assert.ok(photoBounds.every(photo => photo.bounded && photo.clearOfCopy), `${id}: photos stay in the frame, clear of text`);
    if (id === 'office') {
      const photo = page.locator(`${selector} .featured-photo-2`);
      const before = await photo.boundingBox();
      await page.mouse.move(before.x + before.width * .5, before.y + before.height * .5);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width * .5 - 90, before.y + before.height * .5 - 65, { steps: 10 });
      await page.mouse.up();
      const moved = await photo.boundingBox();
      assert.ok(Math.hypot(moved.x - before.x, moved.y - before.y) > 20, 'Mouse drag changes photo position');
      assert.equal(await photo.getAttribute('aria-pressed'), 'true');
      const z = await page.locator(`${selector} .featured-photo`).evaluateAll(photos => photos.map(photo => Number(getComputedStyle(photo).zIndex)));
      assert.ok(z[1] > z[0], 'The clicked photo remains in front');
      await page.keyboard.press('Home');
      const reset = await photo.boundingBox();
      assert.ok(Math.hypot(reset.x - before.x, reset.y - before.y) < 2, 'Keyboard Home resets the dragged position');
      await photo.focus();
      await page.keyboard.press('ArrowLeft');
      assert.ok((await photo.boundingBox()).x < reset.x - 5, 'Keyboard arrows move the selected photo');
      await page.keyboard.press('Home');
    }
  }
  assert.match(await page.locator('#installation-warranty').innerText(), /รับประกันติดตั้ง 10 ปี/);
  assert.match(await page.locator('#installation-warranty').innerText(), /เปลี่ยนให้ฟรี/);
  await verifyInstallation(page,{state,check,outputPath});

  // Showcase gallery: pinned scroll moves the track and the counter; herringbone section lays its pattern and the CTA switches the simulator.
  const showcaseTop = await page.evaluate(() => document.getElementById('showcase').getBoundingClientRect().top + scrollY);
  const showcaseHeight = await page.evaluate(() => document.getElementById('showcase').offsetHeight);
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), showcaseTop);
  const galleryHeading = await page.locator('#showcase').evaluate(section => {
    const stage = section.querySelector('.showcase-sticky').getBoundingClientRect();
    const heading = section.querySelector('.showcase-heading h2').getBoundingClientRect();
    return { top: heading.top - stage.top, bottom: heading.bottom - stage.top, height: stage.height };
  });
  assert.ok(galleryHeading.top >= 0 && galleryHeading.bottom < galleryHeading.height, 'The portfolio heading is fully inside its frame after the warranty section');
  await page.waitForTimeout(400);
  const showcaseStart = await page.evaluate(() => window.websiteDemo.diagnostics.showcase);
  assert.equal(showcaseStart.frames, 4);
  await page.evaluate(({ top, height }) => scrollTo({ top: top + (height - innerHeight) * .6, behavior: 'instant' }), { top: showcaseTop, height: showcaseHeight });
  await page.waitForFunction(() => window.websiteDemo.diagnostics.showcase.progress > .5 && window.websiteDemo.diagnostics.showcase.trackX < -500);
  const showcaseMid = await page.evaluate(() => window.websiteDemo.diagnostics.showcase);
  assert.ok(showcaseMid.active > showcaseStart.active, `active frame advanced ${showcaseStart.active} -> ${showcaseMid.active}`);
  assert.match(await page.locator('#showcase-counter').innerText(), /\d\d \/ 04/);
  await page.evaluate(() => document.getElementById('herringbone').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForFunction(() => { const h = window.websiteDemo.diagnostics.herringbone; return h && h.visible && h.laid >= h.planks * .5; }, null, { timeout: 15000 });
  await page.locator('[data-shade="CPW-KH5-735"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.herringbone.shade === 'CPW-KH5-735');
  assert.equal(await page.locator('[data-shade="CPW-KH5-735"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#herringbone-cta').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.preview.pattern === 'herringbone');
  assert.equal(await page.locator('[data-pattern="herringbone"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-pattern="straight"]').click();
  await page.screenshot({ path: outputPath('showcase-desktop.png'), fullPage: false });
  check(`Showcase gallery (${showcaseMid.mode}) advances frames with scroll; herringbone section lays its pattern, switches shades and its CTA selects the herringbone lay-up.`);

  // The short headline is always readable; native scroll drives the dashboard and background count.
  await verifyRedesign(page,{initialize,state,check,outputPath,url,noOverflow});


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
  assert.equal(await page.locator('#contact-selection').isVisible(), false, 'A general contact enquiry clears the prior package selection');
  await page.keyboard.press('Escape');
  check('Contact dialog displays the named contact and correct phone/email link destinations; no external call or email is opened.');

  await page.setViewportSize({ width: 390, height: 844 });
  await initialize();
  report.mobile = await noOverflow();
  await page.screenshot({ path: outputPath('homepage-mobile.png') });
  for (const selector of ['#client-logos', '#experience-intro', '#project-cafe', '#project-office', '#installation-warranty', '#package-specs', '#pricing', '#estimate-calculator']) {
    await page.locator(selector).evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForFunction(selector => {
      const section = document.querySelector(selector);
      return [...section.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0)
;
    }, selector);
    const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(width.document <= width.viewport + 1, `${selector}: mobile document overflows`);
    if (selector === '#experience-intro') {
      const headline = await page.locator('.orbit-title-line').evaluateAll(lines => lines.map(line => ({ height: line.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(line).lineHeight) })));
      assert.ok(headline.every(line => line.height < line.lineHeight * 1.2), 'Mobile dashboard title uses exactly two lines');
    }
    await page.screenshot({ path: outputPath(`${selector.slice(1)}-mobile.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.client-logos-track')).animationName === 'none' && [...document.querySelectorAll('.featured-photo,.featured-photo img')].every(item => getComputedStyle(item).transform === 'none'));
  assert.equal(await page.locator('.client-logos-track').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await logoGroups.last().isVisible(), false);
  assert.equal(await page.locator('.client-logos-toggle').isVisible(), false);
  assert.equal(await page.locator('#installation-warranty .featured-photo').count(), 10);
  assert.deepEqual(await page.locator('.experience-ring-value strong').allInnerTexts(), ['21', '175,000', '10']);
  await page.screenshot({ path: outputPath('warranty-reduced-motion-mobile.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  check('New project stories and warranty fit mobile; reduced motion stops the ribbon and presents static photo layouts.');
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.locator('#main-navigation [data-contact-open]').click();
  assert.equal(await page.locator('#contact-dialog').evaluate(dialog => dialog.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#hero .hero-3d-tools').isVisible(), false);
  await page.locator('[data-filter="4"]').click(); await page.locator('[data-product="4"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.viewer.productId === 'greige-oak');
  assert.equal((await state()).preview.finish, 4);
  await escapeExpanded('preview-expand', 'room-preview-shell', 'preview-close');
  await uploadAndReset('mobile');
  await noOverflow();
  check('Mobile 390px: menu/contact, product selection, room fullscreen and upload controls work; hero adjustments stay hidden without horizontal overflow.');

  await page.evaluate(() => { window.websiteDemo.dispose(); window.websiteDemo.dispose(); });
  assert.equal(await page.locator('#hero-viewer canvas,#room-preview canvas,.hero-room-floor-canvas').count(), 0);
  assert.equal((await state()).disposed, true);
  check('Repeated homepage disposal removes the 3D scene, hero room and preview canvases without errors.');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failed = { message: error.message, stack: error.stack, motion: await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, logos: window.websiteDemo?.diagnostics.clientLogos, orbit:window.websiteDemo?.diagnostics.experience?.orbit, classes:document.querySelector('#experience-intro')?.className, intro: window.websiteDemo?.diagnostics.experience?.intro, viewport: {width:innerWidth,height:innerHeight,y:scrollY}, scrollTop:document.querySelector('.experience-scroll')?.getBoundingClientRect().top, featured: window.websiteDemo?.diagnostics.experience?.featured })).catch(() => null) };
  await page.screenshot({ path: outputPath('failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(outputPath('browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
