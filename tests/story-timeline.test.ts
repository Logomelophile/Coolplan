import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStory, DETAIL_STOP, STORY_END, STORY_FINISHES, STORY_LAST, STORY_STEPS, STORY_UNIT } from '../src/website/storyTimeline';

test('story offers four distinct finishes, a 5 mm introduction, four layers and a complete final stop', () => {
  assert.equal(STORY_STEPS.length, 10);
  assert.deepEqual(STORY_STEPS.slice(0, DETAIL_STOP).map(step => step.finish), [...STORY_FINISHES]);
  assert.deepEqual([...STORY_FINISHES], [0, 3, 4, 5], 'Warm Taupe Oak and Golden Honey Oak are left out of the opening scroll.');
  assert.match(STORY_STEPS[DETAIL_STOP].description, /5\s*มม\./);
  assert.ok(STORY_END > STORY_LAST, 'Final details need a reading interval before the pinned section releases.');
  assert.ok(STORY_UNIT > 0 && STORY_UNIT <= 1, 'Each reading stop should require less than one viewport of native scroll.');
  assert.equal(sampleStory(DETAIL_STOP - 1).detail, 0, 'The last finish stop is still the overview framing.');
  assert.equal(sampleStory(DETAIL_STOP).detail, 1, 'The enlargement completes exactly at the 5 MM stop.');
  assert.equal(sampleStory(DETAIL_STOP).profile, 1, 'The 5 MM stop presents the assembled profile edge.');
  assert.equal(sampleStory(DETAIL_STOP).explode, 0, 'An assembled thickness dimension cannot measure exploded gaps.');
  assert.equal(sampleStory(STORY_LAST).profile, 0, 'Full layer overview returns from the temporary side profile.');
  for (let step = 0; step < STORY_STEPS.length; step++) {
    const frame = sampleStory(step);
    assert.equal(frame.step, step);
    assert.equal(frame.finishIndex, STORY_STEPS[step].finish);
    const visible = frame.labelsVisible.filter(opacity => opacity > .5).length;
    assert.equal(visible, Math.max(0, Math.min(4, step - DETAIL_STOP)), `Stop ${step} must expose the correct cumulative layer descriptions.`);
  }
});

test('color, enlargement and layer progress remain bounded, finite and exactly reversible', () => {
  const forward = Array.from({ length: 2401 }, (_, index) => sampleStory(STORY_END * index / 2400));
  for (const [index, frame] of forward.entries()) {
    assert.ok(Object.values(frame).filter(value => typeof value === 'number').every(Number.isFinite));
    assert.ok(frame.from >= 0 && frame.from <= 5 && frame.to >= 0 && frame.to <= 5);
    assert.ok(frame.finishIndex === frame.from || frame.finishIndex === frame.to);
    for (const key of ['mix', 'detail', 'zoom', 'profile', 'explode', 'explosion', 'thickness', 'intro'] as const) {
      assert.ok(frame[key] >= 0 && frame[key] <= 1, `${key} leaves its physical range at ${frame.progress}`);
      if (index && key !== 'mix') assert.ok(Math.abs(frame[key] - forward[index - 1][key]) < .035, `${key} jumps at ${frame.progress}`);
    }
    if (index) {
      const prior = forward[index - 1];
      // Blend position along the story's own colour stops, independent of product numbering.
      const stops: readonly number[] = STORY_FINISHES;
      const appearance = stops.indexOf(frame.from) + (stops.indexOf(frame.to) - stops.indexOf(frame.from)) * frame.mix;
      const priorAppearance = stops.indexOf(prior.from) + (stops.indexOf(prior.to) - stops.indexOf(prior.from)) * prior.mix;
      assert.ok(Math.abs(appearance - priorAppearance) < .035, `Visible finish blend jumps at ${frame.progress}`);
    }
    assert.ok(frame.labelsVisible.every(opacity => opacity >= 0 && opacity <= 1));
    if (index) frame.labelsVisible.forEach((opacity, layer) => assert.ok(opacity >= forward[index - 1].labelsVisible[layer], 'Forward scrolling cannot hide a layer already explained.'));
  }
  for (let index = forward.length - 1; index >= 0; index--) assert.deepEqual(sampleStory(STORY_END * index / 2400), forward[index]);
  assert.equal(sampleStory(STORY_END).complete, true);
  assert.deepEqual(sampleStory(STORY_END).labelsVisible, [1, 1, 1, 1]);
  assert.equal(sampleStory(STORY_END).explode, 1);
  assert.equal(sampleStory(STORY_END).zoom, 1);
});

test('invalid and out-of-range scroll inputs cannot produce missing finish indices or invalid geometry', () => {
  assert.deepEqual(sampleStory(-5), sampleStory(0));
  assert.deepEqual(sampleStory(100), sampleStory(STORY_END));
  for (const value of [NaN, Infinity, -Infinity]) assert.deepEqual(sampleStory(value), sampleStory(0));
  for (const value of [-5, 100, NaN]) assert.ok(STORY_FINISHES.includes(sampleStory(value).finishIndex as (typeof STORY_FINISHES)[number]));
});
