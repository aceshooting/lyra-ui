import { expect, fixture, html } from '@open-wc/testing';
import './av-player.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraAvPlayer, LyraAvCue } from './av-player.class.js';

async function mount(cues: readonly LyraAvCue[], duration = 100): Promise<{ element: LyraAvPlayer; media: HTMLMediaElement }> {
  const element = await fixture<LyraAvPlayer>(html`<lr-av-player kind="audio" .cues=${cues}></lr-av-player>`);
  const media = element.shadowRoot!.querySelector<HTMLMediaElement>('[part="media"]')!;
  Object.defineProperty(media, 'duration', { configurable: true, value: duration });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  media.dispatchEvent(new Event('loadedmetadata'));
  await element.updateComplete;
  return { element, media };
}

it('does not traverse the admitted cue snapshot on repeated native ticks or seeks', async () => {
  const cues = Array.from({ length: 10000 }, (_, index) => ({ cueId: `cue-${index}`, start: index, text: '' }));
  const { element, media } = await mount(cues, 10000);
  const internal = element as unknown as { _cues: readonly LyraAvCue[] };
  let reads = 0;
  internal._cues = new Proxy(internal._cues, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) reads += 1;
    return Reflect.get(target, key, receiver);
  } });
  // Allow snapshot-identity invalidation to prepare once, then count only playback work.
  media.dispatchEvent(new Event('timeupdate'));
  reads = 0;
  for (let tick = 0; tick < 100; tick += 1) {
    media.currentTime = 5000 + tick / 1000;
    media.dispatchEvent(new Event('timeupdate'));
  }
  expect(reads, 'admitted cue reads during 100 ticks').to.be.at.most(100);
  const tickReads = reads;
  reads = 0;
  for (const time of [9999, 4, 7000, 2, 9000]) element.seek(time);
  expect(reads, 'admitted cue reads during five backwards/forwards seeks').to.be.at.most(5);
  recordScaleMeasurement('lr-av-player', 'legacy-cue-index@10000', { admittedCues: element.cues.length, ticks: 100, tickReads, seeks: 5, seekReads: reads });
});

it('preserves overlapping, tied, omitted-end and no-active cue transitions and deduplicates events', async () => {
  const { element, media } = await mount([
    { cueId: 'short', start: 10, end: 15, text: '' },
    { cueId: 'long', start: 2, end: 30, text: '' },
    { cueId: 'tie', start: 10, end: 12, text: '' },
    { cueId: 'zero', start: 8, end: 8, text: '' },
    { cueId: 'omitted', start: 40, text: '' },
    { cueId: 'last', start: 50, text: '' },
    { cueId: 'long', start: 60, text: 'duplicate ignored' },
  ]);
  const changes: { cueId: string | null; index: number }[] = [];
  element.addEventListener('lr-cue-change', event => changes.push(event.detail));
  for (const time of [1, 2, 10, 11, 12, 15, 30, 40, 50, 40, 0]) {
    media.currentTime = time;
    media.dispatchEvent(new Event('timeupdate'));
    media.dispatchEvent(new Event('seeked'));
  }
  expect(changes).to.deep.equal([
    { cueId: 'long', index: 1 }, { cueId: 'tie', index: 2 }, { cueId: 'short', index: 0 },
    { cueId: 'long', index: 1 }, { cueId: null, index: -1 }, { cueId: 'omitted', index: 4 },
    { cueId: 'last', index: 5 }, { cueId: 'omitted', index: 4 }, { cueId: null, index: -1 },
  ]);
});

it('rebuilds for duration changes and cue replacement while preserving clamped legacy starts', async () => {
  const { element, media } = await mount([
    { cueId: 'late', start: 30, text: '' }, { cueId: 'earlier', start: 20, text: '' },
    { cueId: 'explicit', start: 40, end: 50, text: '' },
  ], 10);
  const changes: { cueId: string | null; index: number }[] = [];
  element.addEventListener('lr-cue-change', event => changes.push(event.detail));
  element.seek(10);
  Object.defineProperty(media, 'duration', { configurable: true, value: 100 });
  media.dispatchEvent(new Event('durationchange'));
  element.seek(30);
  element.cues = [{ cueId: 'replacement', start: 0, text: '' }];
  await element.updateComplete;
  expect(changes).to.deep.equal([
    { cueId: 'earlier', index: 1 }, { cueId: null, index: -1 },
    { cueId: 'late', index: 0 }, { cueId: 'replacement', index: 0 },
  ]);
});
