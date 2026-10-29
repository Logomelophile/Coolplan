import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANY } from '../src/website/catalog';
import { experienceFrame } from '../src/website/experienceTimeline';
test('the entry begins empty and types before revealing the original year', () => { const a = experienceFrame(0); assert.equal(a.head, 0); assert.equal(a.sub, 0); assert.equal(a.era, 0); assert.equal(experienceFrame(.14).head, 1); assert.equal(experienceFrame(.18).sub, 1); assert.equal(experienceFrame(.21).era, 1); assert.equal(experienceFrame(.3).eraDock, 1); });
test('years and installed area share one reversible scroll clock', () => { let previous = 0; for (let i = 0; i <= 1000; i++) {
    const frame = experienceFrame(i / 1000);
    assert.equal(frame.counter, Math.round(COMPANY.totalSqm * frame.timeline));
    assert.equal(frame.year, COMPANY.since + Math.round(COMPANY.years * frame.timeline));
    assert.ok(frame.counter >= previous);
    previous = frame.counter;
} assert.equal(experienceFrame(1).counter, 175900); assert.equal(experienceFrame(1).year, 2026); });
test('three photographs per stage arrive, archive and gather without losing their values', () => { assert.deepEqual(experienceFrame(.45).photos.slice(0, 3), [1, 1, 1]); assert.ok(experienceFrame(.45).photos.slice(3).every(n => n === 0)); assert.deepEqual(experienceFrame(.65).photos.slice(3, 6), [1, 1, 1]); assert.deepEqual(experienceFrame(.53).archived, [1, 0, 0]); assert.deepEqual(experienceFrame(.74).archived, [1, 1, 0]); assert.deepEqual(experienceFrame(.91).archived, [1, 1, 1]); assert.equal(experienceFrame(.91).gather, 0); assert.equal(experienceFrame(1).gather, 1); assert.deepEqual(experienceFrame(1).rings, [1, 1, 1]); });
test('every phase stays finite and reversible, including invalid scroll samples', () => { for (const input of [-2, NaN, Infinity, ...Array.from({ length: 501 }, (_, i) => i / 500), 2]) {
    const f = experienceFrame(input);
    for (const n of [f.head, f.sub, f.dock, f.era, f.eraDock, f.timeline, f.timelineReveal, f.gather, ...f.photos, ...f.archived, ...f.rings, ...f.story])
        assert.ok(Number.isFinite(n) && n >= 0 && n <= 1);
} for (const p of [.2, .46, .49, .67, .7, .86, .91, .995]) {
    const a = experienceFrame(p - .00001), b = experienceFrame(p + .00001);
    a.archived.forEach((n, i) => assert.ok(Math.abs(n - b.archived[i]) < .01));
    assert.ok(Math.abs(a.gather - b.gather) < .01);
} });
