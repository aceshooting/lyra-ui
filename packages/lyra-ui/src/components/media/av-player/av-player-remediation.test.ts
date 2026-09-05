import { expect, fixture, html } from '@open-wc/testing';
import './av-player.js';
import type { LyraAvCue } from './av-player.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('consumes removed mime-type as absent with null readback and later audio detection recovery', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-av-player']>(html`<lr-av-player mime-type="audio/mpeg"></lr-av-player>`);
  expect(el.shadowRoot!.querySelector('[part="media"]')!.localName).to.equal('audio');
  el.removeAttribute('mime-type');
  await el.updateComplete;
  expect(el.mimeType).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part="media"]')!.localName).to.equal('video');
  el.setAttribute('mime-type', '');
  await el.updateComplete;
  expect(el.mimeType).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="media"]')!.localName).to.equal('video');
  el.setAttribute('mime-type', 'audio/mpeg');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media"]')!.localName).to.equal('audio');
});

it('keeps the unavailable timeline resting paint under hover and press while retaining enabled feedback', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-av-player']>(html`<lr-av-player style="inline-size: 400px; --lr-transition-fast: 0s;"></lr-av-player>`);
  const timeline = el.shadowRoot!.querySelector<HTMLElement>('[part="timeline"]')!;
  const read = (): string[] => { const style = getComputedStyle(timeline); return [style.backgroundColor, style.borderColor]; };
  const settle = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await resetMouse();
  const resting = read();
  expect(timeline.getAttribute('aria-disabled')).to.equal('true');
  try {
    await hoverUntilMatched(timeline, 'unavailable timeline should receive hover');
    await settle();
    expect(read()).to.deep.equal(resting);
    await sendMouse({ type: 'down' });
    await settle();
    expect(read()).to.deep.equal(resting);
    await resetMouse();
    const media = el.shadowRoot!.querySelector<HTMLMediaElement>('[part="media"]')!;
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expect(timeline.getAttribute('aria-disabled')).to.equal('false');
    const enabledRest = read();
    await hoverUntilMatched(timeline, 'enabled timeline should receive hover');
    await settle();
    expect(read()).to.not.deep.equal(enabledRest);
  } finally { await resetMouse(); }
});

for (const count of [128, 256]) {
  it(`bounds omitted-end reconciliation linearly for ${count} admitted cues on public seek and native timeupdate`, async () => {
    const cues: LyraAvCue[] = Array.from({ length: count }, (_, index) => ({ cueId: `cue-${index}`, start: index, text: `Cue ${index}` }));
    const el = await fixture<HTMLElementTagNameMap['lr-av-player']>(html`<lr-av-player kind="audio" .cues=${cues}></lr-av-player>`);
    const media = el.shadowRoot!.querySelector<HTMLMediaElement>('[part="media"]')!;
    Object.defineProperty(media, 'duration', { configurable: true, value: count + 1 });
    Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    // Count effective start reads, rather than use elapsed-time thresholds that vary by engine.
    const internal = el as unknown as { safeCueStart(cue: LyraAvCue): number };
    const original = internal.safeCueStart;
    let reads = 0;
    internal.safeCueStart = function (cue) { reads += 1; return original.call(this, cue); };
    const changes: Array<{ cueId: string | null; index: number }> = [];
    el.addEventListener('lr-cue-change', (event) => changes.push(event.detail));
    try {
      el.seek(count / 2 + 0.5);
      expect(changes.at(-1)).to.deep.equal({ cueId: `cue-${count / 2}`, index: count / 2 });
      expect(reads, 'each reconciliation reads at most a constant number of starts per cue').to.be.at.most(count * 4);
      reads = 0;
      media.currentTime = count - 0.5;
      media.dispatchEvent(new Event('timeupdate'));
      expect(changes.at(-1)).to.deep.equal({ cueId: `cue-${count - 1}`, index: count - 1 });
      expect(reads).to.be.at.most(count * 4);
    } finally { internal.safeCueStart = original; }
  });
}

it('keeps inferred ends chronological through equal starts, explicit overlaps, duration changes and same-task cue replacement', async () => {
  const cues: LyraAvCue[] = [
    { cueId: 'late', start: 20, text: 'Last open' },
    { cueId: 'early', start: 0, text: 'First open' },
    { cueId: 'equal-first', start: 10, text: 'Equal first' },
    { cueId: 'equal-last', start: 10, text: 'Equal last' },
    { cueId: 'overlap', start: 5, end: 25, text: 'Explicit overlap' },
    { cueId: 'equal-first', start: 12, text: 'Duplicate omitted' },
  ];
  const el = await fixture<HTMLElementTagNameMap['lr-av-player']>(html`<lr-av-player kind="audio" .cues=${cues}></lr-av-player>`);
  const media = el.shadowRoot!.querySelector<HTMLMediaElement>('[part="media"]')!;
  let duration = 40;
  Object.defineProperty(media, 'duration', { configurable: true, get: () => duration });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  const changes: Array<{ cueId: string | null; index: number }> = [];
  el.addEventListener('lr-cue-change', (event) => changes.push(event.detail));
  media.dispatchEvent(new Event('loadedmetadata'));
  await el.updateComplete;
  expect(el.cues.map((cue) => cue.cueId)).to.deep.equal(['late', 'early', 'equal-first', 'equal-last', 'overlap']);
  for (const [time, cueId, index] of [[2, 'early', 1], [7, 'overlap', 4], [10, 'equal-last', 3], [21, 'late', 0]] as const) {
    el.seek(time);
    expect(changes.at(-1)).to.deep.equal({ cueId, index });
  }
  duration = 10;
  media.dispatchEvent(new Event('durationchange'));
  el.seek(10);
  expect(changes.at(-1)).to.deep.equal({ cueId: 'equal-last', index: 3 });
  duration = 40;
  media.dispatchEvent(new Event('durationchange'));
  el.seek(21);
  expect(changes.at(-1)).to.deep.equal({ cueId: 'late', index: 0 });
  el.cues = [{ cueId: 'replacement-open', start: 0, text: 'Open' }, { cueId: 'replacement-end', start: 3, end: 4, text: 'Finite' }];
  // The public seek must use the new snapshot before Lit renders the replacement.
  el.seek(5);
  expect(changes.at(-1)).to.deep.equal({ cueId: null, index: -1 });
});
