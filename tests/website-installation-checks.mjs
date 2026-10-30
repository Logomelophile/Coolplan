import assert from 'node:assert/strict';
export async function verifyInstallation(page,{state,check,outputPath}){
 const seek=async progress=>{await page.locator('#installation-warranty').evaluate((e,progress)=>{const travel=e.offsetHeight-innerHeight;scrollTo({top:e.getBoundingClientRect().top+scrollY+progress*(travel+innerHeight*.45)-innerHeight*.45,behavior:'instant'});},progress);await page.waitForFunction(progress=>{const d=window.websiteDemo.diagnostics.experience.featured.find(d=>d.id==='warranty');return Math.abs(d.progress-progress)<.002&&!d.animating;},progress);};
 await seek(.85);await page.waitForFunction(()=>[...document.querySelectorAll('#installation-warranty img')].every(i=>i.complete&&i.naturalWidth));
 assert.equal(await page.locator('#installation-warranty').evaluate(e=>e.closest('#featured')===null),true,'The scene is outside the padded featured container');
 const fullBleed=await page.locator('.installation-stage').evaluate(e=>{const r=e.getBoundingClientRect();return r.left===0&&Math.abs(r.width-innerWidth)<1&&getComputedStyle(e).borderRadius==='0px';});assert.ok(fullBleed,'White background fills the viewport without a rounded frame');
 assert.equal(await page.locator('.installation-care strong').innerText(),'10');assert.equal(await page.locator('.installation-preparation').count(),0,'Preparation and warranty are one scene');
 const bounds=await page.evaluate(()=>{const c=document.querySelector('.installation-story .featured-copy').getBoundingClientRect(),s=document.querySelector('.installation-stage').getBoundingClientRect();return {inside:c.top>=s.top&&c.bottom<=s.bottom,clear:[...document.querySelectorAll('.installation-story .featured-photo')].every(e=>{const r=e.getBoundingClientRect(),i=e.querySelector('img');return (r.right<c.left||r.left>c.right||r.bottom<c.top||r.top>c.bottom)&&Math.abs(i.clientWidth/i.clientHeight-i.naturalWidth/i.naturalHeight)<.015;})};});assert.ok(bounds.inside&&bounds.clear,'All installation copy fits one screen and photos stay outside its center');
 assert.equal(await page.locator('.installation-methods button').evaluateAll(es=>es.every(e=>Number(e.style.getPropertyValue('--method-reveal'))===1)),true);
 await page.locator('.installation-motion-toggle').click();assert.equal(await page.locator('#installation-warranty').evaluate(e=>e.classList.contains('photos-paused')),true);
 const photo=page.locator('#installation-warranty .featured-photo-2'),before=await photo.boundingBox();await photo.focus();await page.keyboard.press('ArrowDown');assert.ok((await photo.boundingBox()).y>before.y+5);await page.keyboard.press('Home');
 assert.equal(await photo.getAttribute('aria-pressed'),'true');
 const frozen=await photo.evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(100);assert.equal(await photo.evaluate(e=>getComputedStyle(e).transform),frozen);
 await page.screenshot({path:outputPath('installation-surrounding-cards-desktop.png')});
 await page.locator('.installation-motion-toggle').click();await page.waitForFunction(before=>getComputedStyle(document.querySelector('#installation-warranty .featured-photo-2')).transform!==before,frozen);
 await page.locator('[data-install-step="0"]').click();await page.waitForFunction(()=>{const d=window.websiteDemo.diagnostics.experience.featured.find(d=>d.id==='warranty');return Math.abs(d.progress-.34)<.01&&!d.animating;});assert.equal(await page.locator('[data-install-step="0"]').getAttribute('aria-pressed'),'true');
 await seek(.85);assert.equal((await state()).experience.featured.find(d=>d.id==='warranty').photos,10);
 check('A full-bleed installation collage centers four service/warranty tiles, ten floating technician/interior photographs and two architectural artwork studies.');
}
