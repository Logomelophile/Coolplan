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
  await page.locator('#layer-slider').fill('72');
  await page.locator('#layer-slider').dispatchEvent('input');
  assert.equal((await state()).viewer.explode, .72);
  await page.locator('#layers-toggle').click(); assert.equal((await state()).progress, 0);
  await page.locator('#layers-toggle').click(); assert.equal((await state()).progress, 1);
  await escapeExpanded('hero-expand', 'hero-3d-shell', 'hero-fullscreen-close');
  check('Hero: wheel scrolls the page and advances the story; actual drag changes camera; slider, layer toggle and fullscreen Escape work.');

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
  await page.waitForTimeout(180);
  assert.notEqual(await logoTransform(), moving, 'Customer logos move continuously');
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
    const title = document.querySelector('.experience-dashboard-heading').getBoundingClientRect();
    return { logoBottom: logos.bottom, titleTop: title.top, titleBottom: title.bottom, height: innerHeight, text: document.querySelector('.experience-dashboard-heading h2').getAttribute('aria-label') };
  });
  assert.ok(handoff.titleBottom < handoff.height, 'The opening typed headline is readable as the customer strip passes');
  assert.equal(handoff.text.replace(/\s+/g, ''), 'เบื้องหลังความสมบูรณ์แบบของโครงการชั้นนำ');
  await page.screenshot({ path: outputPath('client-logos-desktop.png') });
  check('Authentic customer logos load, loop before the experience intro, and can be paused and resumed.');

  assert.deepEqual(await page.locator('#featured .featured-item').evaluateAll(items => items.map(item => item.id)), ['project-cafe', 'project-office', 'project-narasiri']);
  const featureIds = ['cafe', 'office', 'narasiri', 'warranty'];
  for (const id of featureIds) {
    const selector = id === 'warranty' ? '#installation-warranty' : `#project-${id}`;
    const target = await page.locator(selector).evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, travel: el.offsetHeight - innerHeight }));
    const seekFeature = async progress => {
      await page.evaluate(({ top, travel, progress }) => scrollTo({ top: top + travel * progress, behavior: 'instant' }), { ...target, progress });
      await page.waitForFunction(({ id, progress }) => {
        const value = window.websiteDemo.diagnostics.experience.featured.find(item => item.id === id);
        return value && Math.abs(value.progress - progress) < .01 && !value.animating;
      }, { id, progress });
    };
    await seekFeature(.8);
    await page.waitForFunction(selector => [...document.querySelectorAll(`${selector} img`)].every(img => img.complete && img.naturalWidth > 0), selector);
    const endTransform = await page.locator(`${selector} .featured-photo-2`).evaluate(el => getComputedStyle(el).transform);
    await page.screenshot({ path: outputPath(`featured-${id}-desktop.png`) });
    await seekFeature(.2);
    assert.notEqual(await page.locator(`${selector} .featured-photo-2`).evaluate(el => getComputedStyle(el).transform), endTransform, `${id}: photo motion rewinds with scroll`);
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
  assert.match(await page.locator('#installation-warranty').innerText(), /รับประกันการติดตั้ง 10 ปี/);
  assert.match(await page.locator('#installation-warranty').innerText(), /เปลี่ยนให้ฟรี/);
  check('Café, Office and Narasiri appear in order, each has multiple loaded photos and reversible scroll motion, followed by the 10-year installation warranty and team photos.');

  // Showcase gallery: pinned scroll moves the track and the counter; herringbone section lays its pattern and the CTA switches the simulator.
  const showcaseTop = await page.evaluate(() => document.getElementById('showcase').getBoundingClientRect().top + scrollY);
  const showcaseHeight = await page.evaluate(() => document.getElementById('showcase').offsetHeight);
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), showcaseTop);
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
  const introTop = await page.evaluate(() => document.getElementById('experience-intro').getBoundingClientRect().top + scrollY);
  const introHeight = await page.evaluate(() => document.querySelector('.experience-scroll').offsetHeight);
  await page.evaluate(({ top, height }) => scrollTo({ top: top + (height - innerHeight) * .12, behavior: 'instant' }), { top: introTop, height: introHeight });
  await page.waitForFunction(() => { const i = window.websiteDemo.diagnostics.experience?.intro; return i && !i.animating && Math.abs(i.progress - .12) < .01; });
  const introEarly = await page.evaluate(() => window.websiteDemo.diagnostics.experience.intro);
  assert.equal(introEarly.panels, 3);
  assert.ok(introEarly.typed[0] > introEarly.typed[1] && introEarly.typed[0] < 1, 'Head and sub type at staggered rates');
  const earlyTitle = await page.locator('.experience-typed').allInnerTexts();
  assert.equal(await page.locator('.experience-era strong').innerText(), '2005');
  const originalEra = await page.locator('.experience-era strong').elementHandle();
  const originalFirstPhoto = await page.locator('.experience-pile-photo').first().elementHandle();
  assert.ok(await page.locator('.experience-era strong').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= 88, 'The opening 2005 is a large visual element');
  const earlyArcs = await page.locator('.experience-ring-arc').evaluateAll(arcs => arcs.map(arc => parseFloat(getComputedStyle(arc).strokeDashoffset)));
  assert.equal(earlyArcs.length, 3);
  assert.equal(await page.locator('.experience-title-line').count(), 2);
  await page.evaluate(({ top, height }) => scrollTo({ top: top + (height - innerHeight) * .97, behavior: 'instant' }), { top: introTop, height: introHeight });
  await page.waitForFunction(() => { const i = window.websiteDemo.diagnostics.experience?.intro; return i && !i.animating && i.counter === 175900 && i.active === 2; });
  assert.equal(await page.locator('.experience-counter strong').innerText(), '175,900');
  assert.deepEqual(await page.locator('.experience-typed').allInnerTexts(), ['เบื้องหลังความสมบูรณ์แบบ', 'ของโครงการชั้นนำ']);
  assert.notEqual(earlyTitle.join(''), (await page.locator('.experience-typed').allInnerTexts()).join(''), 'Actual text grows with scroll');
  assert.equal(await page.locator('.experience-year-end span').innerText(), '2026');
  assert.equal((await state()).experience.intro.year, 2026);
  assert.equal((await state()).experience.intro.timeline, 1);
  assert.equal(await originalEra.evaluate(el => el === document.querySelector('.experience-era strong')), true, 'The opening year keeps the same DOM node');
  const yearDock = await page.evaluate(() => {
    const year = document.querySelector('.experience-era strong').getBoundingClientRect();
    const anchor = document.querySelector('.experience-era-anchor').getBoundingClientRect();
    return {distance:Math.hypot(year.x + year.width / 2 - anchor.x - anchor.width / 2,year.y + year.height / 2 - anchor.y - anchor.height / 2),opacity:getComputedStyle(document.querySelector('.experience-era')).opacity,start:document.querySelector('.experience-era-anchor').textContent};
  });
  assert.ok(yearDock.distance < 1 && yearDock.opacity === '1' && yearDock.start === '', 'The original 2005 docks at the line start without a duplicate or fade');
  assert.match(await page.locator('.experience-stat.is-active .experience-stat-label').innerText(), /รับประกันการติดตั้ง/);
  const fullArcs = await page.locator('.experience-ring-arc').evaluateAll(arcs => arcs.map(arc => parseFloat(getComputedStyle(arc).strokeDashoffset)));
  assert.ok(fullArcs.every((offset, index) => offset <= earlyArcs[index]) && fullArcs[2] < earlyArcs[2] - 80, 'Circular gauges visibly fill as the page advances');
  assert.deepEqual(await page.locator('.experience-ring-value strong').allInnerTexts(), ['21', '175,900+', '10']);
  assert.equal(await page.locator('.experience-milestone-node').count(), 3);
  const timelinePresentation = await page.evaluate(() => {
    const line = document.querySelector('.experience-years-track').getBoundingClientRect();
    return { left: line.left, right: line.right, width: innerWidth, stroke: parseFloat(getComputedStyle(document.querySelector('.experience-ring-arc')).strokeWidth) };
  });
  assert.ok(timelinePresentation.left <= 28 && timelinePresentation.right >= timelinePresentation.width - 28 && timelinePresentation.stroke >= 12, 'The timeline spans the screen and dashboard tubes are thicker');
  const pileLayout = await page.evaluate(() => {
    const dashboard = document.querySelector('.experience-dashboard').getBoundingClientRect();
    const pile = document.querySelector('.experience-photo-pile').getBoundingClientRect();
    const photos = [...document.querySelectorAll('.experience-pile-photo[data-story="2"]')].map(photo => photo.getBoundingClientRect());
    const retained = [...document.querySelectorAll('.experience-pile-photo')].every(photo => getComputedStyle(photo).opacity === '1');
    return { leftDashboard: dashboard.right < pile.left, bounded: photos.every(r => r.left >= pile.left - 1 && r.right <= pile.right + 1 && r.top >= pile.top - 1 && r.bottom <= pile.bottom + 1), overlapping: photos.some((r,i) => photos.slice(i+1).some(s => Math.min(r.right,s.right)>Math.max(r.left,s.left)+20 && Math.min(r.bottom,s.bottom)>Math.max(r.top,s.top)+20)), retained };
  });
  assert.ok(pileLayout.leftDashboard && pileLayout.bounded && pileLayout.overlapping, 'The photo pile stays inside its frame beside the left dashboard');
  assert.ok(pileLayout.retained, 'Earlier photos remain fully visible after their miniatures dock');
  assert.equal(await originalFirstPhoto.evaluate(el => el.isConnected && el === document.querySelector('.experience-pile-photo')), true, 'The original photographs move continuously instead of being replaced by snapshots');
  assert.deepEqual((await state()).experience.intro.archived.slice(0,2), [1,1]);
  assert.ok((await state()).experience.intro.archived[2] < .02);
  assert.equal(await page.locator('.experience-pile-photo img').count(), 9);
  assert.deepEqual(await page.locator('.experience-pile-photo').evaluateAll(photos => ['0','1','2'].map(group => photos.filter(photo => photo.dataset.story === group).length)), [3,3,3]);
  await page.waitForFunction(() => [...document.querySelectorAll('.experience-pile-photo img')].every(img => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: outputPath('experience-dashboard-desktop.png') });
  await page.locator('.experience-milestone-node').nth(1).click();
  await page.waitForFunction(() => { const d=window.websiteDemo.diagnostics.experience.intro;return d.active===1&&Math.abs(d.progress-.7)<.01&&!d.animating; });
  assert.match(await page.locator('.experience-milestone-copy[aria-hidden="false"]').innerText(), /บ้านเดี่ยว Narasiri.*Origin.*Regent Home/s);
  await page.locator('#experience-evidence').evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.proof>.99&&!d.animating;});
  assert.equal(await page.locator('.experience-checks li.is-checked').count(), 4);
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => window.websiteDemo.diagnostics.experience.intro.marqueeRunning);
  const projectTrack = page.locator('.experience-projects-track');
  const projectTransform = await projectTrack.evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(180);
  assert.notEqual(await projectTrack.evaluate(el => getComputedStyle(el).transform), projectTransform, 'Restored project names scroll continuously');
  await page.locator('.experience-projects-toggle').click();
  const pausedProjects = await projectTrack.evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(180);
  assert.equal(await projectTrack.evaluate(el => getComputedStyle(el).transform), pausedProjects, 'Project marquee can be paused');
  await page.locator('.experience-projects-toggle').click();
  await page.screenshot({ path: outputPath('experience-evidence-desktop.png') });
  await page.evaluate(({ top, height }) => scrollTo({ top: top + (height - innerHeight) * .25, behavior: 'instant' }), { top: introTop, height: introHeight });
  await page.waitForFunction(() => { const i = window.websiteDemo.diagnostics.experience?.intro; return i && !i.animating && i.active === 0 && i.counter < 175900; });
  assert.ok(await page.locator('.experience-ring-arc').last().evaluate(arc => parseFloat(getComputedStyle(arc).strokeDashoffset)) > fullArcs[2] + 80, 'Circular gauges rewind with scroll');
  assert.ok((await state()).experience.intro.year < 2026 && (await state()).experience.intro.timeline < 1, 'Year line rewinds with the area counter');
  assert.equal(await page.locator('.experience-checks li.is-checked').count(), 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.story-rail')).display), 'none');
  assert.equal(await page.locator('#trust,.trust-ring').count(), 0, 'The lower duplicate dashboard is removed');
  await page.evaluate(() => document.getElementById('collections').scrollIntoView({ block: 'start', behavior: 'instant' }));
  assert.equal((await state()).collections.visible, 8);
  await page.locator('[data-family="lvt"]').click();
  assert.equal((await state()).collections.visible, 2);
  await page.locator('[data-family="all"]').click();
  await page.locator('[data-series="herringbone"] .collection-expand').click();
  assert.equal((await state()).collections.expanded, 'herringbone');
  await page.locator('[data-series="laminate-8"] .collection-estimate').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.pricing.rowIndex === 8);
  await page.locator('#estimate-sqm').fill('30');
  await page.locator('#estimate-sqm').dispatchEvent('input');
  const estimate = (await state()).pricing;
  assert.equal(estimate.sqm, 30);
  assert.equal(estimate.total, 30 * 650 + 30 * 100 + 2500, 'laminate 8 mm for 30 m² includes the small-area travel fee');
  assert.match(await page.locator('#estimate-total').innerText(), /25,000/);
  assert.equal(await page.locator('#packages .packages-cta').count(), 3);
  assert.match(await page.locator('#packages').innerText(), /550,000/);
  const pricingOrder = await page.evaluate(() => {
    const specs = document.querySelector('#package-specs');
    const packages = document.querySelector('.pricing-package-stage');
    const calculator = document.querySelector('#estimate-calculator');
    const table = document.querySelector('#packages table');
    return { specsFirst: Boolean(specs.compareDocumentPosition(packages) & Node.DOCUMENT_POSITION_FOLLOWING), packagesFirst: Boolean(packages.compareDocumentPosition(calculator) & Node.DOCUMENT_POSITION_FOLLOWING), columns: table.querySelectorAll('thead th').length };
  });
  assert.ok(pricingOrder.specsFirst && pricingOrder.packagesFirst && pricingOrder.columns === 4, 'The visual spec selector comes before the restored three-package table, followed by the calculator');
  await page.screenshot({ path: outputPath('pricing-desktop.png'), fullPage: false });
  check('The full-width purple/orange timeline types the head/sub, introduces a large 2005, counts orange gauges and piles three real photos per milestone; controls, project names and proof boxes work reversibly.');

  await page.locator('[data-spec-thickness="4"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.pricing.rowIndex === 0);
  assert.equal((await state()).pricing.spec.thicknessMm, 4);
  assert.equal((await state()).pricing.spec.pattern, 'straight');
  const priceWithoutFoam = (await state()).pricing.total;
  await page.locator('[data-spec-foam="true"]').click();
  assert.equal((await state()).pricing.spec.foam, true);
  assert.equal((await state()).pricing.total, priceWithoutFoam, 'Foam requests do not invent an extra charge');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#package-model-foam')).opacity === '1');
  await page.locator('[data-spec-pattern="herringbone"]').click();
  await page.waitForFunction(() => window.websiteDemo.diagnostics.pricing.rowIndex === 4);
  assert.equal((await state()).pricing.spec.thicknessMm, 5, 'Herringbone selects a supported 5 mm model');
  assert.equal(await page.locator('[data-spec-thickness="5"]').getAttribute('aria-pressed'), 'true');
  const firstSpecImage = await page.locator('#package-model-texture').getAttribute('href');
  await page.locator('[data-spec-shade="1"]').click();
  const selectedSpec = (await state()).pricing.spec;
  assert.notEqual(await page.locator('#package-model-texture').getAttribute('href'), firstSpecImage);
  assert.equal(await page.locator('#package-model-texture').getAttribute('href'), selectedSpec.image);
  assert.match(await page.locator('#package-selected-spec').innerText(), /5 มม.*ลายก้างปลา.*โฟม/);
  assert.equal((await state()).pricing.total, 30 * 940 + 2500, 'Selected model uses the catalogue herringbone rate');
  assert.match(await page.locator('#packages').innerText(), /23,700/);
  await page.locator('.packages-cta').first().click();
  assert.equal(await page.locator('#contact-dialog').evaluate(dialog => dialog.open), true);
  const selectedContext = await page.locator('#contact-selection').innerText();
  assert.ok(selectedContext.includes(selectedSpec.code) && selectedContext.includes('แพ็กเกจ 30') && selectedContext.includes('โฟม'));
  const quoteEmail = new URL(await page.locator('#contact-dialog a[href^="mailto:"]').getAttribute('href'));
  assert.ok(quoteEmail.searchParams.get('body').includes(selectedSpec.code), 'Quote email draft retains the selected finish without sending it');
  await page.keyboard.press('Escape');
  await page.locator('#package-specs').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: outputPath('package-specs-desktop.png') });
  check('Visual spec picker changes thickness, foam model, pattern and real catalogue finishes; valid combinations update the calculator and selected specs carry into package enquiries.');

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

  // Regression: a small in-app browser used to collapse the entire story to its final static state.
  for (const viewport of [{width:622,height:532},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion:'no-preference' });
    const anchored = new URL(url); anchored.hash = 'experience-intro';
    // A new document avoids a pending same-document hash jump racing the wheel fixture.
    anchored.searchParams.set('motion-viewport', `${viewport.width}x${viewport.height}`);
    await initialize(anchored.href);
    const short = await page.evaluate(() => {
      const scroll = document.querySelector('.experience-scroll'), stage = document.querySelector('.experience-sticky');
      const top = scroll.getBoundingClientRect().top + scrollY;
      scrollTo({top,behavior:'instant'});
      return {travel:scroll.offsetHeight-stage.offsetHeight,position:getComputedStyle(stage).position};
    });
    assert.equal(short.position, 'sticky');
    assert.ok(short.travel > viewport.height * 4, 'Short windows retain an actual scroll timeline');
    await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.mode==='scroll'&&d.progress<.005&&!d.animating;});
    const opening = await page.locator('.experience-typed').allInnerTexts();
    await page.mouse.move(viewport.width * .5,viewport.height * .5);
    await page.mouse.wheel(0,short.travel*.16);
    await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.progress>.14&&d.progress<.18&&!d.animating;});
    assert.notDeepEqual(await page.locator('.experience-typed').allInnerTexts(),opening,'Real wheel input types the headline and subline');
    await page.screenshot({path:outputPath(`typing-short-${viewport.width}x${viewport.height}.png`)});
    await page.mouse.wheel(0,short.travel*.32);
    await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.progress>.46&&d.progress<.50&&!d.animating;});
    const firstStop=(await state()).experience.intro;
    assert.ok(firstStop.photos.slice(0,3).every(p=>p>0)&&firstStop.photos.slice(3).every(p=>p===0));
    assert.ok(firstStop.counters[0]>0&&firstStop.counters[0]<21,'The active dashboard number counts up');
    const drawnLine=await page.locator('.experience-years-fill').evaluate(el=>getComputedStyle(el).transform);
    await page.mouse.wheel(0,short.travel*.22);
    await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.active===1&&Math.abs(d.progress-.7)<.02&&!d.animating;});
    assert.ok((await state()).experience.intro.photos.slice(3,6).every(p=>p>0),'The second milestone adds three photos');
    assert.equal(await page.locator('.experience-stat.is-active:not(.is-docked)').count(),1,'The active gauge keeps the large stage');
    assert.equal(await page.locator('.experience-stat.is-docked').count(),1,'The previous gauge remains as a miniature');
    assert.equal(await page.locator('.experience-pile-photo[data-story="0"]').evaluateAll(items=>items.every(el=>getComputedStyle(el).opacity==='1')),true,'All three previous photos remain visible');
    const miniature = await page.locator('.experience-stat.is-docked .experience-ring').evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(miniature > 28 && miniature < 36,'The completed ring shrinks into a readable timeline miniature');
    const miniatureSpacing = await page.evaluate(() => {
      const ring=document.querySelector('.experience-stat.is-docked .experience-ring').getBoundingClientRect();
      const label=document.querySelectorAll('.experience-milestone-node span')[1].getBoundingClientRect();
      const scene=document.querySelector('.experience-scene').getBoundingClientRect();
      return {gap:ring.top-label.bottom,photosClear:[...document.querySelectorAll('.experience-pile-photo[data-story="0"]')].every(el=>el.getBoundingClientRect().bottom<scene.top+4)};
    });
    assert.ok(miniatureSpacing.gap>4&&miniatureSpacing.photosClear,'Docked gauges clear their timeline labels and photos stay above the next story');
    assert.notEqual(await page.locator('.experience-years-fill').evaluate(el=>getComputedStyle(el).transform),drawnLine,'The line draws progressively with wheel input');
    await page.screenshot({path:outputPath(`motion-short-${viewport.width}x${viewport.height}.png`)});
    await page.mouse.wheel(0,short.travel*.29);
    await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.progress>.97&&!d.animating;});
    assert.ok((await state()).experience.intro.photos.slice(6).every(p=>p>.99),'The third milestone completes its three-photo stack');
    assert.equal((await state()).experience.intro.counter,175900);
    await page.mouse.wheel(0,-short.travel*.5);
    await page.waitForFunction(() => {const d=window.websiteDemo.diagnostics.experience.intro;return d.active===0&&d.progress<.52&&!d.animating;});
    assert.ok((await state()).experience.intro.counter<175900,'Reverse wheel input rewinds the story in the short window');
    await noOverflow();
  }
  check('Real mouse-wheel input animates typing, the original 2005, rising numbers and three photos per milestone in 622×532 and 844×390 windows; previous gauges and photos shrink into persistent timeline miniatures and reverse.');

  await page.setViewportSize({ width: 390, height: 844 });
  await initialize();
  report.mobile = await noOverflow();
  await page.screenshot({ path: outputPath('homepage-mobile.png') });
  for (const selector of ['#client-logos', '#experience-intro', '#project-cafe', '#project-office', '#project-narasiri', '#installation-warranty', '#package-specs', '#pricing', '#estimate-calculator']) {
    await page.locator(selector).evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForFunction(selector => {
      const section = document.querySelector(selector);
      return [...section.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0)
        && [...section.querySelectorAll('.featured-photo')].every(photo => Number(getComputedStyle(photo).opacity) > .99);
    }, selector);
    const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(width.document <= width.viewport + 1, `${selector}: mobile document overflows`);
    if (selector === '#experience-intro') {
      const headline = await page.locator('.experience-title-line').evaluateAll(lines => lines.map(line => ({ height: line.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(line).lineHeight) })));
      assert.ok(headline.every(line => line.height < line.lineHeight * 1.2), 'Mobile dashboard title uses exactly two lines');
    }
    await page.screenshot({ path: outputPath(`${selector.slice(1)}-mobile.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.client-logos-track')).animationName === 'none' && [...document.querySelectorAll('.featured-photo,.featured-photo img')].every(item => getComputedStyle(item).transform === 'none'));
  assert.equal(await page.locator('.client-logos-track').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await logoGroups.last().isVisible(), false);
  assert.equal(await page.locator('.client-logos-toggle').isVisible(), false);
  assert.equal(await page.locator('#installation-warranty .featured-photo').count(), 3);
  assert.deepEqual(await page.locator('.experience-ring-value strong').allInnerTexts(), ['21', '175,900+', '10']);
  await page.screenshot({ path: outputPath('warranty-reduced-motion-mobile.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  check('New project stories and warranty fit mobile; reduced motion stops the ribbon and presents static photo layouts.');
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
  report.failed = { message: error.message, stack: error.stack, motion: await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, logos: window.websiteDemo?.diagnostics.clientLogos, intro: window.websiteDemo?.diagnostics.experience?.intro, viewport: {width:innerWidth,height:innerHeight,y:scrollY}, scrollTop:document.querySelector('.experience-scroll')?.getBoundingClientRect().top, featured: window.websiteDemo?.diagnostics.experience?.featured })).catch(() => null) };
  await page.screenshot({ path: outputPath('failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(outputPath('browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
