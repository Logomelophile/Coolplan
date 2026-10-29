import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitFrame,orbitPhotoPose} from '../src/website/orbitTimeline';
import {experienceScrollRange,experienceScrollProgress,experienceScrollOffset} from '../src/website/experienceTimeline';
test('orbit introduction types first, finishes the total and all gauges, then forms the exit wave',()=>{
    assert.equal(orbitFrame(0).head,0);assert.equal(orbitFrame(0).sub,0);
    assert.equal(orbitFrame(.16).sub,1);assert.equal(orbitFrame(.16).stats,0);
    assert.equal(orbitFrame(.62).counter,175000);assert.deepEqual(orbitFrame(.70).rings,[1,1,1]);
    assert.equal(orbitFrame(.70).snake,0);assert.equal(orbitFrame(.90).snake,1);assert.equal(orbitFrame(1).photos,0);
    let total=0;for(let i=0;i<=1000;i++){const f=orbitFrame(i/1000);assert.ok(f.counter>=total&&f.counter<=175000);total=f.counter;}
});
test('the orbit moves with elapsed angle at a fixed scroll position and becomes a single ordered wave',()=>{
    const initial=orbitPhotoPose(0,11,0,.4,1366,900),later=orbitPhotoPose(0,11,.3,.4,1366,900);
    assert.ok(Math.hypot(later.x-initial.x,later.y-initial.y)>50);
    const wave=Array.from({length:11},(_,i)=>orbitPhotoPose(i,11,.9,.9,1366,900));
    wave.slice(1).forEach((p,i)=>assert.ok(p.x>wave[i].x));
    for(let i=0;i<=60;i++) { const p=orbitPhotoPose(0,11,i/60*Math.PI*2,.4,844,390);assert.ok(p.y>50&&p.y<340,'Short landscape screens reserve space for complete portrait frames'); }
    for(const p of [-10,NaN,Infinity,...Array.from({length:101},(_,i)=>i/100),10]){
        const f=orbitFrame(p);assert.ok(Object.values(f).flat().every(Number.isFinite));
        assert.ok(Object.values(orbitPhotoPose(3,11,.7,p,390,844)).every(Number.isFinite));
    }
});
test('the post-orbit timeline begins immediately and retains reversible photo and collection stops',()=>{
    const r=experienceScrollRange(900,9000,true);assert.equal(experienceScrollProgress(0,r),.29);
    for(const p of [.29,.43,.64,.9,.985,1])assert.ok(Math.abs(experienceScrollProgress(experienceScrollOffset(p,r),r)-p)<1e-8);
});
