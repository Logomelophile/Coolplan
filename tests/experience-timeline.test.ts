import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANY } from '../src/website/catalog';
import { experienceFrame, EXPERIENCE_END_YEAR } from '../src/website/experienceTimeline';

test('experience opens with readable head copy and ends with a complete year line and proof', () => {
  const first = experienceFrame(0), last = experienceFrame(1);
  assert.ok(first.head > 0 && first.head < 1);
  assert.equal(first.sub, 0);
  assert.equal(first.counter, 0);
  assert.equal(first.year, 2005);
  assert.equal(last.head, 1);
  assert.equal(last.sub, 1);
  assert.equal(last.year, EXPERIENCE_END_YEAR);
  assert.equal(last.year, 2026);
  assert.equal(last.counter, COMPANY.totalSqm);
  assert.deepEqual([...last.rings, ...last.panels, ...last.checks], Array(10).fill(1));
  assert.equal(last.marquee, 1);
  assert.equal(last.era, 1, 'The original 2005 remains visible after docking');
  assert.equal(last.eraDock, 1);
  assert.deepEqual(last.archived, [1, 1, 1]);
});

test('the year marker and delivered area follow the same clock and reverse exactly', () => {
  const forward = Array.from({ length: 101 }, (_, i) => experienceFrame(i / 100));
  forward.forEach((frame, i) => {
    assert.equal(frame.counter, Math.round(COMPANY.totalSqm * frame.timeline));
    assert.equal(frame.year, COMPANY.since + Math.round(COMPANY.years * frame.timeline));
    if (i) assert.ok(frame.counter >= forward[i - 1].counter && frame.year >= forward[i - 1].year);
  });
  for (let i = 100; i >= 0; i--) assert.deepEqual(experienceFrame(i / 100), forward[i]);
});

test('milestones reveal their photo groups before the separate project proof enters', () => {
  const early = experienceFrame(.02), typed = experienceFrame(.34), middle = experienceFrame(.74, 0), late = experienceFrame(1, .5);
  assert.ok(early.head > experienceFrame(0).head);
  assert.equal(early.sub, 0);
  assert.equal(typed.head, 1);
  assert.equal(typed.sub, 1);
  assert.equal(middle.panels[0], 1);
  assert.equal(middle.panels[1], 1);
  assert.equal(middle.panels[2], 0);
  assert.equal(middle.milestones[0], 1);
  assert.equal(middle.milestones[1], 1);
  assert.equal(middle.milestones[2], 0);
  assert.deepEqual(middle.photos.slice(0, 3), [1, 1, 1]);
  assert.deepEqual(middle.photos.slice(6), [0, 0, 0]);
  assert.equal(middle.photos.length, 9);
  assert.deepEqual(experienceFrame(.54).photos.slice(0, 3), [1, 1, 1]);
  assert.ok(experienceFrame(.54).photos.slice(3).every(value => value === 0));
  assert.deepEqual(experienceFrame(.76).photos.slice(3, 6), [1, 1, 1]);
  assert.ok(experienceFrame(.76).photos.slice(6).every(value => value === 0));
  assert.equal(middle.marquee, 0);
  assert.deepEqual(middle.checks, [0, 0, 0, 0]);
  assert.equal(late.marquee, 1);
  assert.ok(late.checks[0] > late.checks[1] && late.checks[1] > late.checks[2]);
  for (const value of [-2, NaN, Infinity, ...Array.from({ length: 501 }, (_, i) => i / 500), 2]) {
    const frame = experienceFrame(value);
    for (const fraction of [frame.head, frame.sub, frame.dock, frame.era, frame.eraDock, frame.timeline, frame.timelineReveal, frame.marquee, ...frame.rings, ...frame.panels, ...frame.checks, ...frame.milestones, ...frame.photos, ...frame.story, ...frame.archived]) assert.ok(Number.isFinite(fraction) && fraction >= 0 && fraction <= 1);
  }
});

test('each completed dashboard and photo group docks continuously and reverses with scroll', () => {
  const before = experienceFrame(.54), first = experienceFrame(.64), second = experienceFrame(.86);
  assert.deepEqual(before.archived, [0, 0, 0]);
  assert.deepEqual(first.archived, [1, 0, 0]);
  assert.deepEqual(second.archived, [1, 1, 0]);
  for (const point of [.56, .78]) {
    const a = experienceFrame(point - .0001), b = experienceFrame(point + .0001);
    a.archived.forEach((amount, i) => assert.ok(Math.abs(amount - b.archived[i]) < .01, 'Changing the active story never cuts its geometry'));
  }
  assert.equal(experienceFrame(.29).era, 1);
  assert.equal(experienceFrame(.4).eraDock, 1);
});
