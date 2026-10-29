import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANY } from '../src/website/catalog';
import { experienceFrame, experienceScrollRange, experienceScrollProgress, experienceScrollOffset, EXPERIENCE_TOTAL_SQM, EXPERIENCE_STAGES, EXPERIENCE_GATHER_START, EXPERIENCE_GATHER_END, EXPERIENCE_PHOTO_DURATION } from '../src/website/experienceTimeline';

test('the entry begins empty and types before revealing the year or area total', () => {
    const initial = experienceFrame(0);
    assert.equal(initial.head, 0); assert.equal(initial.sub, 0); assert.equal(initial.era, 0); assert.equal(initial.counterReveal, 0);
    assert.equal(experienceFrame(.14).head, 1); assert.equal(experienceFrame(.18).sub, 1);
    assert.equal(experienceFrame(.18).era, 0); assert.equal(experienceFrame(.235).era, 1); assert.equal(experienceFrame(.3).eraDock, 1);
});
test('native scroll pixels advance and rewind the short title entry before the longer photo story', () => {
    for (const height of [390, 532, 844, 900]) {
        const range = experienceScrollRange(height, height * 10);
        assert.equal(experienceScrollProgress(-range.leadPx, range), 0);
        const first = experienceFrame(experienceScrollProgress(-range.leadPx + 60, range));
        const second = experienceFrame(experienceScrollProgress(-range.leadPx + 120, range));
        assert.ok(first.head > .1 && first.head < 1 && second.head > first.head);
        assert.ok(experienceScrollOffset(.18, range) < 300, 'Typing completes without a long blank scrolling interval');
        for (let i = 0; i <= 100; i++) {
            const p = i / 100;
            assert.ok(Math.abs(experienceScrollProgress(experienceScrollOffset(p, range), range) - p) < 1e-9);
        }
    }
    assert.equal(experienceScrollProgress(0, experienceScrollRange(NaN, 0)), 1);
});
test('the accumulated total increases continuously and finishes at 175,000 during collection', () => {
    let previous = 0;
    for (let i = 0; i <= 1000; i++) {
        const frame = experienceFrame(i / 1000);
        assert.equal(frame.year, COMPANY.since + Math.round(COMPANY.years * frame.timeline));
        assert.ok(frame.counter >= previous && frame.counter <= EXPERIENCE_TOTAL_SQM);
        previous = frame.counter;
    }
    assert.equal(experienceFrame(EXPERIENCE_GATHER_START).counter, 157500);
    assert.ok(experienceFrame(.98).counter > 170000);
    assert.equal(experienceFrame(1).counter, 175000); assert.equal(experienceFrame(1).year, 2026);
    assert.equal(experienceFrame(EXPERIENCE_GATHER_END).counter, 175000, 'Finish the number before the pinned scene releases');
    assert.equal(experienceFrame(EXPERIENCE_GATHER_END).gather, 1);
});
test('every gauge fills and three photos rest before any stage is archived', () => {
    for (const [index, stage] of EXPERIENCE_STAGES.entries()) {
        assert.ok(stage.archive[0] - stage.filled >= .06, 'Reserve a full-size hold');
        stage.photos.slice(1).forEach((next, photo) => {
            assert.ok(next - stage.photos[photo] - EXPERIENCE_PHOTO_DURATION > .01, 'Each photograph rests before the next overlaps it');
            assert.equal(experienceFrame(next - .001).photos[index * 3 + photo], 1);
        });
        const resting = experienceFrame(stage.archive[0] - .01);
        assert.equal(resting.rings[index], 1);
        assert.deepEqual(resting.photos.slice(index * 3, index * 3 + 3), [1, 1, 1]);
        assert.equal(resting.archived[index], 0);
    }
    for (let i = 0; i <= 2000; i++) {
        const frame = experienceFrame(i / 2000);
        frame.archived.forEach((archived, index) => {
            if (archived > 0) {
                assert.equal(frame.rings[index], 1, `Stage ${index} must fill before shrinking`);
                assert.deepEqual(frame.photos.slice(index * 3, index * 3 + 3), [1, 1, 1]);
            }
        });
    }
    assert.deepEqual(experienceFrame(EXPERIENCE_GATHER_START).archived, [1, 1, 1]);
    assert.equal(experienceFrame(EXPERIENCE_GATHER_START).gather, 0);
    assert.equal(experienceFrame(1).gather, 1); assert.deepEqual(experienceFrame(1).rings, [1, 1, 1]);
});
test('every phase stays finite and reversible, including invalid scroll samples', () => {
    for (const input of [-2, NaN, Infinity, ...Array.from({ length: 501 }, (_, i) => i / 500), 2]) {
        const f = experienceFrame(input);
        for (const n of [f.head, f.sub, f.dock, f.era, f.eraDock, f.timeline, f.timelineReveal, f.counterReveal, f.gather, ...f.photos, ...f.archived, ...f.rings, ...f.story])
            assert.ok(Number.isFinite(n) && n >= 0 && n <= 1);
    }
    for (const p of EXPERIENCE_STAGES.flatMap(stage => stage.archive).concat(EXPERIENCE_GATHER_START, EXPERIENCE_GATHER_END)) {
        const a = experienceFrame(p - .00001), b = experienceFrame(p + .00001);
        a.archived.forEach((n, i) => assert.ok(Math.abs(n - b.archived[i]) < .01));
        assert.ok(Math.abs(a.gather - b.gather) < .01);
    }
});
