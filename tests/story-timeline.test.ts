import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStory, STORY_END, STORY_STEPS, STORY_UNIT } from '../src/website/storyTimeline';

test('story offers six distinct finishes, a 5 mm introduction, four layers and a complete final stop', () => {
  assert.equal(STORY_STEPS.length, 12);
  assert.deepEqual(STORY_STEPS.slice(0, 6).map(step => step.finish), [0, 1, 2, 3, 4, 5]);
  assert.match(STORY_STEPS[6].description, /5\s*มม\./);
  assert.ok(STORY_END > 11, 'Final details need a reading interval before the pinned section releases.');
  assert.ok(STORY_UNIT > 0 && STORY_UNIT <= 1, 'Each reading stop should require less than one viewport of native scroll.');
  assert.equal(sampleStory(6).profile, 1, 'The 5 MM stop presents the assembled profile edge.');
  assert.equal(sampleStory(6).explode, 0, 'An assembled thickness dimension cannot measure exploded gaps.');
  assert.equal(sampleStory(11).profile, 0, 'Full layer overview returns from the temporary side profile.');
  for (let step = 0; step < STORY_STEPS.length; step++) {
    const frame = sampleStory(step);
    assert.equal(frame.step, step);
    assert.equal(frame.finishIndex, Math.min(step, 5));
    const visible = frame.labelsVisible.filter(opacity => opacity > .5).length;
    assert.equal(visible, Math.max(0, Math.min(4, step - 6)), `Stop ${step} must expose the correct cumulative layer descriptions.`);
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
      const appearance = frame.from + (frame.to - frame.from) * frame.mix;
      const priorAppearance = prior.from + (prior.to - prior.from) * prior.mix;
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
});
