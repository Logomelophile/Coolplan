import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const base = process.env.SPC_TEST_URL || 'http://127.0.0.1:5173';
const out = new URL('../test-results/',import.meta.url);
const outputPath = name => fileURLToPath(new URL(name,out));
await mkdir(out,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const report = {checks:[],errors,products:[],views:[],memory:[],performance:null};
try {
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#toggle-explode').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#toggle-explode').disabled,{timeout:60000});
  await page.screenshot({path:outputPath('demo-desktop.png'),fullPage:true});
  await page.locator('[data-locale="en"]').click();
  assert.match(await page.locator('#explode-label').innerText(),/Explore/);
  await page.locator('#toggle-explode').click();
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.spc-label:visible').count(),4);
  await page.screenshot({path:outputPath('demo-exploded.png'),fullPage:true});
  report.checks.push('Demo renders, switches locale, and opens four labelled layers.');
  await page.goto(`${base}/tests/harness.html`,{waitUntil:'networkidle'});
  await page.evaluate(()=>window.ready);
  assert.equal(await page.evaluate(()=>window.viewer.diagnostics.webgl),true);
  const ids = await page.evaluate(()=>window.products.map(p=>p.id));
  for (const id of ids) {
    await page.evaluate(async id=>{await window.viewer.setProduct(id);window.viewer.setView('perspective34');},id);
    await page.waitForTimeout(800);
    const data = await page.evaluate(()=>window.viewer.diagnostics);
    assert.equal(data.productId,id);
    assert.ok(Math.abs(data.bounds[0]-122)<0.0001);
    assert.ok(Math.abs(data.bounds[1]-0.53)<0.0001);
    assert.ok(Math.abs(data.bounds[2]-18)<0.0001);
    await page.screenshot({path:outputPath(`${id}.png`)});
    report.products.push(data);
  }
  await page.evaluate(()=>window.viewer.setProduct('light-natural-oak'));
  for (const view of ['front','perspective34','stacked','closeup','back','exploded','profile']) {
    await page.evaluate(view=>window.viewer.setView(view),view);
    await page.waitForTimeout(850);
    await page.screenshot({path:outputPath(`view-${view}.png`)});
    report.views.push(await page.evaluate(()=>window.viewer.diagnostics));
  }
  await page.evaluate(()=>{window.viewer.setExplode(1,'stair');window.viewer.setLocale('th');});
  await page.waitForTimeout(850);
  assert.equal(await page.locator('.spc-label:visible').count(),4);
  await page.locator('.spc-label').first().hover();
  assert.equal(await page.locator('.spc-label[data-selected="true"]').count(),1);
  await page.screenshot({path:outputPath('stair-thai.png')});
  await page.evaluate(()=>window.viewer.setLayerVisible('core',false));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.spc-label:visible').count(),3);
  report.checks.push('Seven products preserve dimensions; seven presets, stair mode, Thai labels, hover selection and layer hiding work.');
  await page.evaluate(()=>window.viewer.setView('perspective34'));
  for (let cycle=0;cycle<2;cycle++) {
    for (const id of [ids[1],ids[0]]) {
      await page.evaluate(id=>window.viewer.setProduct(id),id);
      await page.waitForTimeout(550);
      report.memory.push(await page.evaluate(()=>window.viewer.diagnostics.memory));
    }
  }
  assert.equal(report.memory[0].textures,report.memory.at(-1).textures);
  assert.equal(report.memory[1].geometries,report.memory.at(-1).geometries);
  report.checks.push('Repeated product changes return to stable GPU texture and geometry counts.');
  const screenshot = await page.evaluate(()=>window.viewer.screenshot());
  assert.ok(screenshot.startsWith('data:image/png;base64,'));
  await page.waitForTimeout(2500);
  report.performance = await page.evaluate(()=>{
    const canvas=document.querySelector('canvas');const gl=canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {...window.viewer.diagnostics,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent};
  });
  await page.setViewportSize({width:390,height:700});
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.querySelector('canvas').clientWidth),390);
  report.checks.push('Resize and screenshot export pass.');
  await page.evaluate(()=>window.viewer.dispose());
  assert.equal(await page.locator('#host canvas').count(),0);
  report.checks.push('Dispose removes the canvas.');
  await page.goto(`${base}/examples/react/`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('canvas'),{timeout:30000});
  await page.waitForTimeout(1000);
  await page.screenshot({path:outputPath('react-mobile.png'),fullPage:true});
  report.checks.push('React wrapper mounts.');
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!document.querySelector('#toggle-explode').disabled,{timeout:60000});
  await page.screenshot({path:outputPath('demo-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  report.checks.push('Mobile demo has no horizontal overflow.');
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(new URL('browser-report.json',out),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
