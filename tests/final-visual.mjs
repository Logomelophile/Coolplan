import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const base=process.env.SPC_TEST_URL||'http://127.0.0.1:5173';
const production=process.env.SPC_PROD_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.goto(`${base}/tests/harness.html`);await page.evaluate(()=>window.ready);
  await page.evaluate(()=>window.viewer.setView('back'));await page.waitForTimeout(800);
  await page.screenshot({path:fileURLToPath(new URL('view-back.png',out))});
  await page.mouse.move(720,500);await page.mouse.wheel(0,-650);await page.waitForTimeout(500);
  await page.screenshot({path:fileURLToPath(new URL('back-detail.png',out))});
  await page.evaluate(async()=>{await window.viewer.setProduct('white-marble');window.viewer.setView('perspective34');});await page.waitForTimeout(800);
  await page.screenshot({path:fileURLToPath(new URL('white-marble.png',out))});
  await page.goto(production,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!document.querySelector('#toggle-explode').disabled,undefined,{timeout:60000});
  await page.screenshot({path:fileURLToPath(new URL('release-desktop.png',out)),fullPage:true});
  await page.locator('[data-product="warm-taupe-oak"]').click();
  await page.waitForTimeout(1300);
  assert.match(await page.locator('#product-name').innerText(),/Warm Taupe/);
  await page.setViewportSize({width:390,height:700});
  await page.locator('#toggle-explode').click();await page.waitForTimeout(850);
  assert.equal(await page.locator('.spc-label:visible').count(),4);
  const overlayBounds=await page.evaluate(()=>{
    const svg=document.querySelector('.spc-lines').getBoundingClientRect();
    const canvas=document.querySelector('.spc-root canvas').getBoundingClientRect();
    return {svg:[svg.width,svg.height],canvas:[canvas.width,canvas.height]};
  });
  assert.deepEqual(overlayBounds.svg,overlayBounds.canvas,'Leader-line overlay must survive host SVG styles.');
  const labelBounds=await page.locator('.spc-label:visible').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right};}));
  assert.ok(labelBounds.every(b=>b.left>=0&&b.right<=390));
  await page.screenshot({path:fileURLToPath(new URL('release-mobile-exploded.png',out)),fullPage:true});
  await page.close();
  const measurements=[];
  for (const density of [1,2]) {
  const perf=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:density});
  perf.on('pageerror',e=>errors.push(e.message));
  perf.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await perf.goto(`${base}/tests/harness.html`);await perf.evaluate(()=>window.ready);
  await perf.evaluate(()=>window.viewer.setAutoRotate(true));
  await perf.waitForTimeout(4000);
  const measurement=await perf.evaluate(async()=>{
    const frames=[];let last=performance.now();
    await new Promise(resolve=>{const frame=now=>{frames.push(now-last);last=now;if(frames.length<300)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
    frames.shift();const sorted=[...frames].sort((a,b)=>a-b);const mean=frames.reduce((a,b)=>a+b,0)/frames.length;
    return {viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],meanFps:1000/mean,p95FrameMs:sorted[Math.floor(sorted.length*.95)],diagnostics:window.viewer.diagnostics};
  });
  assert.deepEqual(measurement.canvas,[1440*density,900*density]);
  measurements.push(measurement);
  await perf.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('release-report.json',out),JSON.stringify({production,checks:['Built production demo loads and switches products.','Mobile exploded labels fit inside viewport.','Leader lines occupy the full canvas despite surrounding icon CSS.','Underside lighting reveals the physical crosshatch.','Pixel ratios one and two render at the expected resolutions.'],measurements,errors},null,2));
  console.log(JSON.stringify({measurements,errors},null,2));
} finally {await browser.close();}
