import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { prepareLyraWaveform, type LyraPreparedWaveform } from '../../../utilities/data-preparation.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';
import { sendKeys } from '@web/test-runner-commands';
import './av-player.js';
import type { LyraAvPlayer } from './av-player.class.js';

type WaveformPlayer = LyraAvPlayer & { waveform: LyraPreparedWaveform | null };
function envelope(): LyraPreparedWaveform {
  return { revision: 'whole', sampleCount: 100, duration: 10, counts: { sourceCount: 100, validCount: 100, invalidCount: 0 },
    buckets: [{ startIndex: 0, endIndex: 90, maxAmplitude: 0.1 }, { startIndex: 90, endIndex: 100, maxAmplitude: 1 }],
    firstAmplitude: 0.1, lastAmplitude: 0 };
}
async function mount(waveform: LyraPreparedWaveform | null = envelope()): Promise<WaveformPlayer> {
  return fixture<WaveformPlayer>(html`<lr-av-player kind="audio" style="width:400px" .waveform=${waveform}></lr-av-player>`);
}
function metadata(element: WaveformPlayer, duration: number): HTMLMediaElement {
  const media = element.shadowRoot!.querySelector<HTMLMediaElement>('[part="media"]')!;
  Object.defineProperty(media, 'duration', { configurable: true, value: duration });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  media.dispatchEvent(new Event('loadedmetadata'));
  return media;
}
async function paint(element: WaveformPlayer, width = 100, height = 20): Promise<{ calls: number[][]; canvas: HTMLCanvasElement }> {
  const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas');
  expect(canvas !== null, 'prepared waveform canvas').to.equal(true);
  await waitUntil(() => canvas!.width > 0 && (element as unknown as { waveformVisible: boolean }).waveformVisible, 'visible waveform');
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height });
  const context = canvas!.getContext('2d')!;
  const original = context.fillRect;
  const calls: number[][] = [];
  context.fillRect = function (...args) { calls.push(args); original.apply(this, args); };
  try { element.ownerDocument.defaultView!.dispatchEvent(new Event('resize')); }
  finally { context.fillRect = original; }
  return { calls, canvas: canvas! };
}

it('paints the full million-sample duration including late interval energy and retains bounded output', async function () {
  this.timeout(20000);
  let reads = 0, largestRead = 0;
  const waveform = await prepareLyraWaveform({ revision: 'million', count: 1000000, read(start, count) {
    reads += count; largestRead = Math.max(largestRead, count);
    return Array.from({ length: count }, (_, offset) => { const index = start + offset; return index === 500000 ? NaN : index === 999998 ? 1 : 0; });
  } }, { duration: 10, maxBuckets: 1000, batchSize: 8192 });
  const element = await mount(waveform);
  const { calls, canvas } = await paint(element);
  expect(reads).to.equal(1000000); expect(largestRead).to.be.at.most(8192);
  expect(calls.length).to.be.at.most(4096); expect(calls.at(-1)![3]).to.equal(20);
  expect(calls.findIndex(call => call[3] === 20)).to.be.greaterThan(calls.length * 0.9);
  metadata(element, 10); await element.updateComplete;
  element.playbackRate = 1.25; await element.updateComplete;
  const finalPaint = await paint(element, 200);
  expect(reads).to.equal(1000000);
  recordScaleMeasurement('lr-av-player', 'prepared-waveform@1000000:full-duration', {
    sourcePositions: reads, maximumRead: largestRead, retainedBuckets: waveform.buckets.length,
    paintedBars: finalPaint.calls.length, canvasWidth: canvas.width, canvasHeight: canvas.height, domNodes: renderedNodeCount(element),
  });
});

it('projects unequal bucket spans and preserves their maxima instead of substituting a quiet final endpoint', async () => {
  const element = await mount();
  const { calls } = await paint(element);
  expect(calls.length).to.be.greaterThan(2);
  expect(calls.filter(call => call[3] === 20).length).to.be.within(calls.length * 0.09, calls.length * 0.12);
  expect(calls.at(-1)![3]).to.equal(20);
});

it('rejects oversize legacy peaks before reading their prefix and restores the bounded unset route', async () => {
  const element = await mount(null);
  let reads = 0;
  const peaks = new Array<number>(1000000);
  Object.defineProperty(peaks, '0', { get() { reads++; return 1; } });
  element.peaks = peaks; await element.updateComplete;
  expect(reads).to.equal(0); expect(element.peaks.length).to.equal(0);
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
  expect(element.shadowRoot!.textContent).to.include('Waveform data is unavailable');
  element.peaks = [0.25, 0.75]; await element.updateComplete;
  expect(element.peaks).to.deep.equal([0.25, 0.75]);
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(1);
});

it('checks media duration and restores a plain rail for malformed or stale envelopes without legacy fallback', async () => {
  const element = await mount(); element.peaks = [1,1];
  metadata(element, 11); await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
  expect(element.shadowRoot!.textContent).to.include('Waveform data is unavailable');
  metadata(element, 10.0009); await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(1);
  element.waveform = { ...envelope(), buckets: [{ startIndex: 1, endIndex: 100, maxAmplitude: 1 }] };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
});

it('rejects malformed metadata, sparse/accessor buckets and inconsistent endpoints without evaluating accessors', async () => {
  let reads = 0;
  const accessor = { ...envelope() };
  Object.defineProperty(accessor, 'duration', { get() { reads++; return 10; } });
  const bucketAccessor = [{ startIndex: 0, endIndex: 100, maxAmplitude: 1 }];
  Object.defineProperty(bucketAccessor, '0', { get() { reads++; return {}; } });
  const oversized = new Array(65537);
  Object.defineProperty(oversized, '0', { get() { reads++; return {}; } });
  const maskedLength = new Proxy(oversized, { get(target, key) { reads++; return key === 'length' ? 1 : Reflect.get(target, key); } });
  const bad: unknown[] = [accessor,
    { ...envelope(), revision: '' }, { ...envelope(), sampleCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...envelope(), counts: { sourceCount: 100, validCount: 101, invalidCount: 0 } },
    { ...envelope(), buckets: bucketAccessor }, { ...envelope(), buckets: new Array(1) },
    { ...envelope(), buckets: oversized }, { ...envelope(), buckets: maskedLength }, { ...envelope(), duration: Infinity },
    { ...envelope(), firstAmplitude: 0.8 }, { ...envelope(), lastAmplitude: NaN },
    { ...envelope(), buckets: [{ startIndex: 0, endIndex: 50, maxAmplitude: 0.5 }, { startIndex: 49, endIndex: 100, maxAmplitude: 1 }] },
    { ...envelope(), buckets: [{ startIndex: 0, endIndex: 50, maxAmplitude: 0.5 }, { startIndex: 51, endIndex: 100, maxAmplitude: 1 }] },
  ];
  const element = await mount(null);
  element.peaks = [1];
  element.strings = { avPlayerWaveformUnavailable: 'Envelope unavailable' };
  for (const waveform of bad) {
    element.waveform = waveform as LyraPreparedWaveform; await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
    expect(element.shadowRoot!.textContent).to.include('Envelope unavailable');
  }
  expect(reads).to.equal(0);
});

it('admits the exact bucket ceiling and bounds physical columns even with very large canvas allocation', async () => {
  const waveform: LyraPreparedWaveform = { revision: 1, sampleCount: 65536, duration: 10,
    counts: { sourceCount: 65536, validCount: 65536, invalidCount: 0 }, firstAmplitude: 0, lastAmplitude: 0,
    buckets: Array.from({ length: 65536 }, (_, index) => ({ startIndex: index, endIndex: index + 1, maxAmplitude: index === 65534 ? 1 : 0 })),
  };
  const element = await mount(waveform);
  const { calls, canvas } = await paint(element, 100000, 10000);
  expect(canvas.width).to.be.at.most(4096); expect(canvas.height).to.be.at.most(4096);
  expect(canvas.width * canvas.height).to.be.at.most(8388608);
  expect(calls.length).to.be.at.most(4096); expect(calls.at(-1)![3]).to.equal(10000);
});

it('captures bounded immutable snapshots on explicit refresh while presentation and playback bypass legacy input', async () => {
  const source = envelope(); let inspected = 0;
  const waveform = new Proxy(source, { getOwnPropertyDescriptor(target, key) { inspected++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const element = await mount(waveform);
  const initial = await paint(element);
  Object.defineProperty(element, 'peaks', { configurable: true, get() { throw new Error('Legacy peaks read'); } });
  try {
    const afterAdmission = inspected;
    const media = metadata(element, 10); await element.updateComplete;
    element.playbackRate = 1.5; await element.updateComplete;
    media.currentTime = 4; media.dispatchEvent(new Event('timeupdate')); await element.updateComplete;
    await paint(element, 100);
    expect(inspected).to.equal(afterAdmission);
    (source.buckets[0] as { maxAmplitude: number }).maxAmplitude = 0.4;
    expect((await paint(element)).calls[0]![3]).to.equal(initial.calls[0]![3]);
    element.waveform = waveform; await element.updateComplete;
    expect((await paint(element)).calls[0]![3]).to.equal(8);
    (source.buckets[0] as { maxAmplitude: number }).maxAmplitude = 0.6;
    element.requestUpdate(); element.name = 'Changed'; await element.updateComplete;
    expect((await paint(element)).calls[0]![3]).to.equal(12);
  } finally { delete (element as unknown as { peaks?: readonly number[] }).peaks; }
});

it('keeps empty and all-invalid complete sources valid and hides prior legacy admission errors in prepared mode', async () => {
  const element = await mount(null);
  element.peaks = new Array<number>(65537); await element.updateComplete;
  element.waveform = { revision: 0, sampleCount: 0, duration: 0, counts: { sourceCount: 0, validCount: 0, invalidCount: 0 }, buckets: [], firstAmplitude: null, lastAmplitude: null };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  element.waveform = { ...envelope(), counts: { sourceCount: 100, validCount: 0, invalidCount: 100 }, buckets: [{ startIndex: 0, endIndex: 100, maxAmplitude: 0 }], firstAmplitude: null, lastAmplitude: null };
  await element.updateComplete;
  expect((await paint(element)).calls.every(call => call[3] === 1)).to.equal(true);
  element.waveform = null; await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.include('Waveform data is unavailable');
});

it('revokes duration authority on kind/source replacement and follows subsequent metadata and duration changes', async () => {
  const element = await mount(); const media = metadata(element, 11); await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
  element.kind = 'video'; await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(1);
  expect(element.shadowRoot!.querySelector('[part="timeline"]')!.getAttribute('aria-disabled')).to.equal('true');
  media.dispatchEvent(new Event('loadedmetadata')); await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(1);
  const current = metadata(element, 10); await element.updateComplete;
  Object.defineProperty(current, 'duration', { configurable: true, value: 10.002 });
  current.dispatchEvent(new Event('durationchange')); await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
  element.preload = 'none'; element.src = '/fixtures/sample-video.mp4'; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="timeline"]')!.getAttribute('aria-disabled')).to.equal('true');
});

it('keeps native pointer and keyboard seeking on media seconds under RTL with prepared waveform', async () => {
  const element = await mount(); element.dir = 'rtl'; metadata(element, 10); await element.updateComplete;
  const timeline = element.shadowRoot!.querySelector<HTMLElement>('[part="timeline"]')!;
  await paint(element);
  await focusByKeyboard(timeline); await sendKeys({ press: 'End' }); expect(element.currentTime).to.equal(10);
  await sendKeys({ press: 'Home' }); expect(element.currentTime).to.equal(0);
  await sendKeys({ press: 'ArrowRight' }); expect(element.currentTime).to.equal(5);
  const rect = timeline.getBoundingClientRect();
  try {
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width * 0.25), Math.round(rect.top + rect.height / 2)] });
    expect(element.currentTime).to.be.closeTo(2.5, 0.15);
  } finally { await resetMouse(); }
  await expect(element).to.be.accessible();
});

it('repaints prepared intervals after real iframe adoption and reconnect using the new owner canvas', async () => {
  const element = await mount(); await paint(element);
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Waveform owner"></iframe>`);
  const foreign = frame.contentDocument!;
  foreign.body.append(foreign.adoptNode(element)); await element.updateComplete;
  const result = await paint(element);
  expect(result.canvas.ownerDocument === foreign).to.equal(true);
  expect(result.calls.at(-1)![3]).to.equal(20);
  element.remove(); document.body.append(element); await element.updateComplete;
  expect((await paint(element)).calls.at(-1)![3]).to.equal(20);
  element.remove();
});

it('coalesces hidden prepared-input and resize changes into one visible catch-up paint', async () => {
  const element = await mount(); const { canvas } = await paint(element);
  const state = element as unknown as { waveformVisible: boolean };
  element.style.position = 'fixed'; element.style.left = '-10000px';
  await waitUntil(() => !state.waveformVisible, 'offscreen observation');
  const context = canvas.getContext('2d')!;
  const original = context.clearRect;
  let paints = 0;
  context.clearRect = function (...args) { paints++; original.apply(this, args); };
  try {
    element.waveform = { ...envelope(), revision: 'second' }; await element.updateComplete;
    element.waveform = { ...envelope(), revision: 'third' }; await element.updateComplete;
    window.dispatchEvent(new Event('resize'));
    expect(paints).to.equal(0);
    element.style.left = '0px';
    await waitUntil(() => paints > 0, 'visible catch-up');
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(paints).to.equal(1);
  } finally { context.clearRect = original; }
});

for (const throws of [false, true]) {
  it(`keeps the latest waveform when an obsolete capture reassigns${throws ? ' and throws' : ''}`, async () => {
    const element = await mount(); await paint(element);
    const replacement: LyraPreparedWaveform = { ...envelope(), revision: 'replacement',
      buckets: [{ startIndex: 0, endIndex: 100, maxAmplitude: 0.7 }] };
    let reentered = false;
    const obsolete = new Proxy(envelope(), { getOwnPropertyDescriptor(target, key) {
      if (!reentered) {
        reentered = true;
        element.waveform = replacement;
        if (throws) throw new Error('Obsolete capture failed');
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    element.waveform = obsolete;
    await element.updateComplete;
    await element.updateComplete;
    expect(element.waveform === replacement).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    const result = await paint(element);
    expect(result.calls.every(call => call[3] === 14)).to.equal(true);
  });
}
