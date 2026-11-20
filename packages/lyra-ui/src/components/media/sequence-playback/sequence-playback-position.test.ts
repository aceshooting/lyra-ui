import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { probeTimers } from '../../../../test/timer-probe.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { createSimulationClock } from '../../../simulation-clock.js';
import { createTimeIndex } from '../../../time-index.js';
import { bindSequencePlayback } from '../../../sequence-time-binding.js';
import '../../lr-sequence-playback.js';
import type { LyraSequencePlayback } from './sequence-playback.class.js';

expectLocaleFallback('ar-EG', ['play', 'playbackPosition', 'playbackStepPosition']);

function slider(el: LyraSequencePlayback): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>('[part="slider"]')!;
}

function valueText(el: LyraSequencePlayback): string | undefined {
  return el.shadowRoot!.querySelector('[part="value"]')?.textContent ?? undefined;
}

function record(el: LyraSequencePlayback): string[] {
  const events: string[] = [];
  for (const name of ['lr-play', 'lr-pause', 'lr-sequence-step']) {
    el.addEventListener(name, () => events.push(`${name}:${el.currentIndex}`));
  }
  return events;
}

describe('non-looping replay', () => {
  for (const start of ['play', 'toggle', 'click'] as const) {
    it(`restarts from the final item before ${start} observers and advances on the next tick`, async () => {
      const el = await fixture<LyraSequencePlayback>(html`
        <lr-sequence-playback item-count="3" current-index="2" interval-ms="30" without-loop></lr-sequence-playback>
      `);
      const events = record(el);
      el[start]();
      expect(el.currentIndex).to.equal(0);
      expect(el.playing).to.equal(true);
      expect(events).to.deep.equal(['lr-play:0', 'lr-sequence-step:0']);
      const tick = oneEvent(el, 'lr-sequence-step');
      expect((await tick).detail).to.deep.equal({ currentIndex: 1 });
      el.pause();
    });
  }

  it('keeps repeated play calls idempotent, including a synchronous play listener', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" interval-ms="30" without-loop></lr-sequence-playback>
    `);
    const events = record(el);
    el.addEventListener('lr-play', () => el.play());
    el.play();
    el.play();
    expect(events).to.deep.equal(['lr-play:0', 'lr-sequence-step:0']);
    expect(el.currentIndex).to.equal(0);
    el.pause();
  });

  it('lets a play listener pause without a stale reset step or timer', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" interval-ms="20" without-loop></lr-sequence-playback>
    `);
    const events = record(el);
    el.addEventListener('lr-play', () => el.pause());
    const probe = probeTimers((delay) => delay === 20);
    try {
      el.play();
      expect(events).to.deep.equal(['lr-play:0', 'lr-pause:0']);
      expect(probe.pending(), 'a retired start schedules no tick').to.deep.equal([]);
    } finally {
      probe.restore();
    }
    expect(el.currentIndex).to.equal(0);
    expect(el.playing).to.equal(false);
    expect(events).to.deep.equal(['lr-play:0', 'lr-pause:0']);
  });

  it('lets a play listener seek without overwriting its manual step', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" without-loop></lr-sequence-playback>
    `);
    const events = record(el);
    el.addEventListener('lr-play', () => el.goTo(1));
    el.play();
    expect(el.currentIndex).to.equal(1);
    expect(el.playing).to.equal(false);
    expect(events).to.deep.equal(['lr-play:0', 'lr-pause:0', 'lr-sequence-step:1']);
  });

  it('does not duplicate a reset step after a play listener manually steps away and back', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" interval-ms="30" without-loop></lr-sequence-playback>
    `);
    const events = record(el);
    el.addEventListener('lr-play', () => { el.next(); el.previous(); });
    el.play();
    expect(events).to.deep.equal(['lr-play:0', 'lr-sequence-step:1', 'lr-sequence-step:0']);
    const tick = oneEvent(el, 'lr-sequence-step');
    expect((await tick).detail).to.deep.equal({ currentIndex: 1 });
    el.pause();
  });

  it('retires the outer reset when a play listener pauses and starts a newer playback', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" interval-ms="30" without-loop></lr-sequence-playback>
    `);
    const events = record(el);
    const probe = probeTimers((delay) => delay === 30);
    try {
      el.addEventListener('lr-play', () => { el.pause(); el.play(); }, { once: true });
      el.play();
      expect(events).to.deep.equal(['lr-play:0', 'lr-pause:0', 'lr-play:0']);
      const tick = oneEvent(el, 'lr-sequence-step');
      expect((await tick).detail).to.deep.equal({ currentIndex: 1 });
      el.pause();
      const stopped = events.length;
      expect(probe.pending(), 'neither the retired outer start nor the paused newer start leaks a timer').to.deep.equal([]);
      expect(events.length).to.equal(stopped);
      expect(el.currentIndex).to.equal(1);
    } finally {
      probe.restore();
    }
  });

  it('keeps a start running across a synchronous DOM move', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" interval-ms="20" without-loop></lr-sequence-playback>
    `);
    const parent = el.parentNode!;
    const events = record(el);
    el.addEventListener('lr-play', () => { el.remove(); parent.append(el); }, { once: true });
    el.play();
    expect(events).to.deep.equal(['lr-play:0', 'lr-sequence-step:0']);
    const tick = oneEvent(el, 'lr-sequence-step');
    expect((await tick).detail).to.deep.equal({ currentIndex: 1 });
    expect(el.playing).to.equal(true);
    el.pause();
  });

  it('does not emit a stale standalone reset after a play listener attaches a clock', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" without-loop></lr-sequence-playback>
    `);
    const clock = createSimulationClock({ range: [0, 1000], instant: 500 });
    let release: (() => void) | undefined;
    const events = record(el);
    try {
      el.addEventListener('lr-play', () => {
        release = bindSequencePlayback(el, clock, createTimeIndex([0, 500, 1000]));
      }, { once: true });
      el.play();
      expect(el.currentIndex).to.equal(1);
      expect(el.playing).to.equal(false);
      expect(events).to.deep.equal(['lr-play:0']);
      expect(clock.snapshot.instant).to.equal(500);
    } finally {
      release?.();
      clock.dispose();
    }
  });

  it('leaves looping starts and degenerate sequences unchanged', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="2" interval-ms="30"></lr-sequence-playback>
    `);
    const events = record(el);
    el.play();
    expect(el.currentIndex).to.equal(2);
    expect(events).to.deep.equal(['lr-play:2']);
    const tick = oneEvent(el, 'lr-sequence-step');
    expect((await tick).detail).to.deep.equal({ currentIndex: 0 });
    el.pause();
    for (const count of [0, 1]) {
      const empty = await fixture<LyraSequencePlayback>(html`
        <lr-sequence-playback .itemCount=${count} without-loop></lr-sequence-playback>
      `);
      const emptyEvents = record(empty);
      empty.play(); empty.toggle(); empty.click();
      expect(empty.playing).to.equal(false);
      expect(empty.currentIndex).to.equal(0);
      expect(emptyEvents).to.deep.equal([]);
    }
  });

  it('keeps next and previous playing while goTo pauses, including an equal-index seek', async () => {
    const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="4"></lr-sequence-playback>`);
    el.play();
    const events = record(el);
    el.next(); expect(el.playing).to.equal(true);
    el.previous(); expect(el.playing).to.equal(true);
    el.goTo(0); expect(el.playing).to.equal(false);
    expect(events).to.deep.equal(['lr-sequence-step:1', 'lr-sequence-step:0', 'lr-pause:0', 'lr-sequence-step:0']);
  });

  it('leaves restart and looping authority with a bound source clock', async () => {
    const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback without-loop></lr-sequence-playback>`);
    const clock = createSimulationClock({ range: [0, 1000], instant: 1000 });
    const release = bindSequencePlayback(el, clock, createTimeIndex([0, 500, 1000]));
    try {
      el.play();
      expect(clock.snapshot.instant).to.equal(1000);
      expect(el.currentIndex).to.equal(2);
      el.pause();
      el.toggle();
      expect(clock.snapshot.instant).to.equal(1000);
      expect(el.currentIndex).to.equal(2);
    } finally {
      release();
      clock.dispose();
    }
  });
});

describe('playback position formatting', () => {
  it('preserves the native ordinal and compact DOM when both options are unset', async () => {
    const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="5" current-index="2"></lr-sequence-playback>`);
    expect(el.withValue).to.equal(false);
    expect(el.valueFormatter).to.equal(undefined);
    expect(slider(el).min).to.equal('1');
    expect(slider(el).max).to.equal('5');
    expect(slider(el).value).to.equal('3');
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('Step 3 of 5');
    expect(el.shadowRoot!.querySelectorAll('[part="value"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[aria-live], [role="status"]').length).to.equal(0);
    expect(el.playing).to.equal(false);
    const events = record(el);
    await el.updateComplete;
    expect(events).to.deep.equal([]);
  });

  it('formats zero-based indices once per render and shares literal text with the optional readout', async () => {
    const calls: number[] = [];
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" current-index="1" with-value
        .valueFormatter=${(index: number) => { calls.push(index); return `<frame ${index}>`; }}
      ></lr-sequence-playback>
    `);
    expect(calls).to.deep.equal([1]);
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('<frame 1>');
    expect(valueText(el)).to.equal('<frame 1>');
    expect(el.shadowRoot!.querySelectorAll('[part="value"] frame').length).to.equal(0);
    const readout = el.shadowRoot!.querySelector('[part="value"]')!;
    expect(readout.getAttribute('aria-hidden')).to.equal('true');
    expect(readout.hasAttribute('aria-live')).to.equal(false);
    calls.length = 0;
    el.next(); await el.updateComplete;
    expect(calls).to.deep.equal([2]);
    expect(valueText(el)).to.equal('<frame 2>');
    expect(slider(el).value).to.equal('3');
    el.withValue = false; await el.updateComplete;
    expect(valueText(el)).to.equal(undefined);
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('<frame 2>');
  });

  it('uses localized ordinal fallback for nullish results and preserves explicit empty text', async () => {
    const el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="10" current-index="3" lang="ar-EG" with-value
        .valueFormatter=${() => null}
      ></lr-sequence-playback>
    `);
    expect(valueText(el)).to.equal('Step ٤ of ١٠');
    expect(slider(el).getAttribute('aria-valuetext')).to.equal(valueText(el));
    el.strings = { playbackStepPosition: 'Étape {index} sur {total}' };
    el.valueFormatter = () => undefined; await el.updateComplete;
    expect(valueText(el)).to.equal('Étape ٤ sur ١٠');
    el.valueFormatter = () => ''; await el.updateComplete;
    expect(valueText(el)).to.equal('');
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('');
    el.valueFormatter = undefined; await el.updateComplete;
    expect(valueText(el)).to.equal('Étape ٤ sur ١٠');
  });

  it('falls back silently when an untyped formatter result is invalid or throws', async () => {
    const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="3" current-index="1" with-value></lr-sequence-playback>`);
    el.valueFormatter = (() => 42) as unknown as (index: number) => string;
    await el.updateComplete;
    expect(valueText(el)).to.equal('Step 2 of 3');
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('Step 2 of 3');
    el.valueFormatter = () => { throw new Error('unavailable'); };
    await el.updateComplete;
    expect(valueText(el)).to.equal('Step 2 of 3');
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('Step 2 of 3');
  });

  it('discards a self-invalidating formatter result without retrying it indefinitely', async () => {
    const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback item-count="4" with-value></lr-sequence-playback>`);
    let calls = 0;
    el.valueFormatter = index => {
      calls += 1;
      el.currentIndex = 2;
      el.itemCount = 3;
      el.requestUpdate();
      return `stale ${index}`;
    };
    await el.updateComplete;
    await el.updateComplete;
    expect(calls).to.equal(1);
    expect(slider(el).value).to.equal('3');
    expect(slider(el).max).to.equal('3');
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('Step 3 of 3');
    expect(valueText(el)).to.equal('Step 3 of 3');
    el.valueFormatter = index => `Frame ${index}`;
    await el.updateComplete;
    expect(valueText(el)).to.equal('Frame 2');
  });

  it('keeps a long RTL readout within 320px and preserves keyboard range selection and focus', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="inline-size: 320px;">
        <lr-sequence-playback item-count="3" current-index="1" with-value style="inline-size: 100%;"
          .valueFormatter=${(index: number) => `الإطار ${index}: ${'تفاصيل'.repeat(50)}`}
        ></lr-sequence-playback>
      </div>
    `);
    const el = wrapper.querySelector<LyraSequencePlayback>('lr-sequence-playback')!;
    const input = slider(el);
    await focusByKeyboard(input);
    await sendKeys({ press: 'ArrowLeft' });
    await el.updateComplete;
    expect(el.currentIndex).to.equal(2);
    expect(input.value).to.equal('3');
    expect(slider(el) === input).to.equal(true);
    expect(el.shadowRoot!.activeElement === input).to.equal(true);
    expect(valueText(el)).to.equal(el.valueFormatter!(2));
    const bounds = wrapper.getBoundingClientRect();
    const readout = el.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!;
    const valueBounds = readout.getBoundingClientRect();
    expect(valueBounds.width).to.be.greaterThan(0);
    expect(valueBounds.height).to.be.greaterThan(0);
    expect(valueBounds.left).to.be.at.least(bounds.left - 1);
    expect(valueBounds.right).to.be.at.most(bounds.right + 1);
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
    await expect(el).to.be.accessible();
  });
});
