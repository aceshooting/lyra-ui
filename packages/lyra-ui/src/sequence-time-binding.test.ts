import { expect, fixture, html } from '@open-wc/testing';
import './components/media/sequence-playback/sequence-playback.js';
import type { LyraSequencePlayback } from './components/media/sequence-playback/sequence-playback.class.js';
import { createSimulationClock } from './simulation-clock.js';
import { createTimeIndex } from './time-index.js';
import { bindSequencePlayback, SequenceTimeBindingError } from './sequence-time-binding.js';

it('projects actual shared time silently and emits one synchronous manual step after pause', async () => {
  const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="8" current-index="4"></lr-sequence-playback>`);
  const clock = createSimulationClock({ range: [100, 1000], instant: 200 });
  const events: string[] = [];
  for (const name of ['lr-play', 'lr-pause', 'lr-sequence-step']) el.addEventListener(name, () => events.push(name));
  const release = bindSequencePlayback(el, clock, createTimeIndex([100, 200, 1000]));
  expect(el.itemCount).to.equal(3); expect(el.currentIndex).to.equal(1); expect(events).to.deep.equal([]);
  clock.play(); expect(el.playing).to.equal(true);
  events.length = 0; el.goTo(1);
  expect(events).to.deep.equal(['lr-pause', 'lr-sequence-step']);
  expect(el.currentIndex).to.equal(1);
  events.length = 0; el.next(); expect(el.currentIndex).to.equal(2); expect(events).to.deep.equal(['lr-sequence-step']);
  events.length = 0; el.next(); expect(events).to.deep.equal([]);
  release(); await el.updateComplete;
  expect(el.itemCount).to.equal(8); expect(el.currentIndex).to.equal(4); expect(el.playing).to.equal(false);
  expect(events).to.deep.equal([]); clock.dispose();
});

it('keeps range-clamped indices honest and releases one control without pausing another', async () => {
  const first = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback></lr-sequence-playback>`);
  const second = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback></lr-sequence-playback>`);
  const clock = createSimulationClock({ range: [1000, 2000], instant: 1000 });
  const index = createTimeIndex([0, 3000]);
  bindSequencePlayback(first, clock, index); bindSequencePlayback(second, clock, index);
  first.goTo(1); expect(clock.snapshot.instant).to.equal(2000); expect(first.currentIndex).to.equal(0);
  clock.seek(1000); clock.play(); expect(second.playing).to.equal(true);
  first.hidden = true; await first.updateComplete;
  expect(clock.snapshot.playing).to.equal(true); expect(second.playing).to.equal(true);
  clock.dispose(); await second.updateComplete;
  expect(second.itemCount).to.equal(0); expect(second.playing).to.equal(false);
  expect(() => second.pause()).not.to.throw();
});

it('rejects unsupported and overlapping owners without disturbing state and honors preabort', async () => {
  const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`);
  const clock = createSimulationClock({ range: [0, 100], instant: 0 });
  const index = createTimeIndex([0, 100]);
  expect(() => bindSequencePlayback(document.createElement('div'), clock, index)).to.throw(SequenceTimeBindingError);
  const abort = new AbortController(); abort.abort();
  bindSequencePlayback(el, clock, index, { signal: abort.signal }); expect(el.itemCount).to.equal(3);
  const release = bindSequencePlayback(el, clock, index);
  expect(() => bindSequencePlayback(el, clock, index)).to.throw(SequenceTimeBindingError);
  release(); const newer = bindSequencePlayback(el, clock, index); release();
  expect(el.itemCount).to.equal(2); newer(); clock.dispose();
});

it('restores pending standalone normalization silently without timer revival', async () => {
  const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="8" current-index="7"></lr-sequence-playback>`);
  el.itemCount = 2;
  const clock = createSimulationClock({ range: [0, 1], instant: 0 });
  let steps = 0; el.addEventListener('lr-sequence-step', () => steps++);
  const release = bindSequencePlayback(el, clock, createTimeIndex([0, 1])); release();
  await el.updateComplete;
  expect(el.currentIndex).to.equal(1); expect(steps).to.equal(0); expect(el.playing).to.equal(false);
  clock.dispose();
});

it('defers a reentrant same-index manual action once without an immediate duplicate step', async () => {
  const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback></lr-sequence-playback>`);
  let frame: (() => void) | undefined;
  const clock = createSimulationClock({ range: [0, 100], instant: 0 }, { scheduler: {
    monotonicNow: () => 0, epochNow: () => 0,
    requestFrame: callback => { frame = callback; return callback; }, cancelFrame: () => { frame = undefined; },
  } });
  bindSequencePlayback(el, clock, createTimeIndex([0, 100]));
  let steps = 0; el.addEventListener('lr-sequence-step', () => steps++);
  clock.subscribe(value => { if (value.instant === 10) el.goTo(0); });
  clock.seek(10); expect(steps).to.equal(0);
  frame?.(); expect(steps).to.equal(1); expect(clock.snapshot.instant).to.equal(0);
  clock.dispose();
});

it('preserves a reentrant attachment acquired during clock catch-up and revalidates host state', async () => {
  const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="8"></lr-sequence-playback>`);
  let mono = 0;
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: {
    monotonicNow: () => mono, epochNow: () => 0, requestFrame: () => 1, cancelFrame: () => undefined,
  } });
  let innerRelease: (() => void) | undefined;
  clock.subscribe(value => {
    if (value.instant === 100 && !innerRelease) innerRelease = bindSequencePlayback(el, clock, createTimeIndex([0, 100, 1000]));
  });
  clock.play(); mono = 100;
  expect(() => bindSequencePlayback(el, clock, createTimeIndex([0, 1000]))).to.throw(SequenceTimeBindingError);
  expect(el.itemCount).to.equal(3);
  expect(() => bindSequencePlayback(el, clock, createTimeIndex([0, 1000]))).to.throw(SequenceTimeBindingError);
  innerRelease?.(); expect(el.itemCount).to.equal(8); clock.dispose();

  const target = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="4"></lr-sequence-playback>`);
  mono = 0;
  const other = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: {
    monotonicNow: () => mono, epochNow: () => 0, requestFrame: () => 1, cancelFrame: () => undefined,
  } });
  other.subscribe(value => { if (value.instant === 100) target.hidden = true; });
  other.play(); mono = 100;
  expect(() => bindSequencePlayback(target, other, createTimeIndex([0, 1000]))).to.throw(SequenceTimeBindingError);
  expect(target.itemCount).to.equal(4);
  // Failed outer installation must leave neither a binding marker nor a retained
  // subscription that projects into this control after it becomes available again.
  target.hidden = false;
  other.seek(200); expect(target.itemCount).to.equal(4);
  const recovered = bindSequencePlayback(target, other, createTimeIndex([0, 1000]));
  expect(target.itemCount).to.equal(2); recovered(); expect(target.itemCount).to.equal(4);
  other.dispose();
});
