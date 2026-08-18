import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './sequence-playback.js';
import { LyraSequencePlayback } from './sequence-playback.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-sequence-playback', 'index');
expectStaleAttribute('lr-sequence-playback', 'length');

it('registers only the explicit sequence-playback identity and removes the generic v8 surface', async () => {
  expect(customElements.get('lr-sequence-playback')).to.equal(LyraSequencePlayback);
  expect(customElements.get('lr-playback')).to.equal(undefined);

  const el = await fixture<LyraSequencePlayback>(html`
    <lr-sequence-playback length="8" index="4" item-count="3" current-index="1">
    </lr-sequence-playback>
  `);
  expect('length' in el).to.be.false;
  expect('index' in el).to.be.false;
  expect(el.itemCount).to.equal(3);
  expect(el.currentIndex).to.equal(1);

  let genericSteps = 0;
  el.addEventListener('lr-step', () => genericSteps += 1);
  const sequenceStep = oneEvent(el, 'lr-sequence-step');
  el.next();
  expect((await sequenceStep).detail).to.deep.equal({ currentIndex: 2 });
  expect(genericSteps).to.equal(0);
});

it('does not leak an untracked duplicate timer chain when play() is called synchronously from a lr-sequence-step listener during tick()', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="1000" interval-ms="20"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  let reentered = false;
  el.addEventListener('lr-sequence-step', () => {
    // Simulate a consumer that reacts to every step by synchronously
    // restarting playback (e.g. debouncing a pause/resume toggle). This
    // fires from inside the in-flight tick()'s own setTimeout callback.
    if (!reentered) {
      reentered = true;
      el.pause();
      el.play();
    }
  });

  el.play();
  // Let the reentrant pause()+play() cycle above happen on the very first
  // tick, then explicitly pause from the outside.
  await aTimeout(25);
  el.pause();
  const indexAfterPause = el.currentIndex;

  // If a second, untracked setTimeout chain leaked out of the reentrant
  // pause()+play() cycle, the index keeps climbing here even though pause()
  // (and disconnectedCallback()) believe playback is fully stopped.
  await aTimeout(150);
  expect(el.currentIndex).to.equal(indexAfterPause);
});

it('does not schedule a tick when an lr-play listener pauses reentrantly', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="10" interval-ms="20"></lr-sequence-playback>`)) as LyraSequencePlayback;
  el.addEventListener('lr-play', () => el.pause());
  el.play();
  await aTimeout(60);
  expect(el.playing).to.be.false;
  expect(el.currentIndex).to.equal(0);
});

it('advances the index on each tick and wraps when loop is true', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="3" interval-ms="20"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  const playEvent = oneEvent(el, 'lr-play');
  el.play();
  await playEvent;
  await aTimeout(35);
  el.pause();
  expect(el.currentIndex).to.be.greaterThan(0);
});

it('stops at the last index when loop is false and not-looping is reached', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="2" interval-ms="20" current-index="1"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  el.loop = false;
  el.play();
  await aTimeout(30);
  expect(el.playing).to.be.false;
  expect(el.currentIndex).to.equal(1);
});

it('stops at the last index when loop="false" is set as a plain HTML attribute', async () => {
  // Regression test: `loop` defaults `true`, and Lit's default presence-based `type: Boolean`
  // converter cannot distinguish an absent attribute from the literal string "false" -- only a
  // `true`-aware converter parses the literal attribute form correctly.
  const el = (await fixture(
    html`<lr-sequence-playback item-count="2" interval-ms="20" current-index="1" loop="false"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  expect(el.loop).to.be.false;
  el.play();
  await aTimeout(30);
  expect(el.playing).to.be.false;
  expect(el.currentIndex).to.equal(1);
});

it('no-ops play() when length <= 1', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="1"></lr-sequence-playback>`)) as LyraSequencePlayback;
  el.play();
  expect(el.playing).to.be.false;
});

it('resolves reflected playing after all initial attributes regardless of source order', async () => {
  const playingFirst = (await fixture(
    html`<lr-sequence-playback playing item-count="3" interval-ms="1000"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  const lengthFirst = (await fixture(
    html`<lr-sequence-playback item-count="3" playing interval-ms="1000"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;

  expect(playingFirst.playing).to.be.true;
  expect(playingFirst.hasAttribute('playing')).to.be.true;
  expect(lengthFirst.playing).to.be.true;
  expect(lengthFirst.hasAttribute('playing')).to.be.true;

  playingFirst.pause();
  lengthFirst.pause();

  const invalid = (await fixture(html`<lr-sequence-playback playing item-count="1"></lr-sequence-playback>`)) as LyraSequencePlayback;
  await invalid.updateComplete;
  expect(invalid.playing).to.be.false;
  expect(invalid.hasAttribute('playing')).to.be.false;
});

it('atomically rejects impossible post-mount playing writes in both IDL and attribute form', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="1"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;

  el.playing = true;
  expect(el.playing).to.be.false;
  expect(el.hasAttribute('playing')).to.be.false;

  el.setAttribute('playing', '');
  expect(el.playing).to.be.false;
  expect(el.hasAttribute('playing')).to.be.false;

  el.itemCount = 3;
  await el.updateComplete;
  expect(el.playing).to.be.false;
  expect(el.hasAttribute('playing')).to.be.false;
});

it('next()/previous()/goTo() emit lr-sequence-step without starting playback', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="5" current-index="2"></lr-sequence-playback>`)) as LyraSequencePlayback;
  let detail: { currentIndex: number } | undefined;
  el.addEventListener('lr-sequence-step', (e) => (detail = (e as CustomEvent).detail));
  el.next();
  expect(el.currentIndex).to.equal(3);
  expect(detail!.currentIndex).to.equal(3);
  el.previous();
  expect(el.currentIndex).to.equal(2);
  el.goTo(4);
  expect(el.currentIndex).to.equal(4);
  expect(el.playing).to.be.false;
});

it('auto-pauses on disconnect', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="3" interval-ms="20"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  el.play();
  el.remove();
  expect(el.playing).to.be.false;
});

it('schedules and cancels timers in the current owner window across iframe adoption', async () => {
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true }),
  );
  document.body.append(iframe);
  await loaded;
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const originalMainSetTimeout = window.setTimeout;
  const originalMainClearTimeout = window.clearTimeout;
  const originalFrameSetTimeout = frameWindow.setTimeout;
  const originalFrameClearTimeout = frameWindow.clearTimeout;
  const mainTimerIds = new Set<number>();
  const frameTimerIds = new Set<number>();
  let mainCancellations = 0;
  let frameCancellations = 0;
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = originalMainSetTimeout.call(window, handler, timeout, ...args);
    if (timeout === 1000) mainTimerIds.add(id);
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined && mainTimerIds.has(id)) mainCancellations += 1;
    originalMainClearTimeout.call(window, id);
  }) as typeof window.clearTimeout;
  frameWindow.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = originalFrameSetTimeout.call(frameWindow, handler, timeout, ...args);
    if (timeout === 1000) frameTimerIds.add(id);
    return id;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((id?: number) => {
    if (id !== undefined && frameTimerIds.has(id)) frameCancellations += 1;
    originalFrameClearTimeout.call(frameWindow, id);
  }) as typeof frameWindow.clearTimeout;
  let el: LyraSequencePlayback | undefined;

  try {
    el = await fixture<LyraSequencePlayback>(html`
      <lr-sequence-playback item-count="3" interval-ms="1000"></lr-sequence-playback>
    `);
    el.play();
    expect(mainTimerIds.size, 'the initial timer belongs to the main window').to.equal(1);
    frameDocument.body.append(frameDocument.adoptNode(el));
    expect(mainCancellations, 'adoption cancels the source-window timer').to.equal(1);

    el.play();
    expect(frameTimerIds.size, 'the adopted timer belongs to the iframe window').to.equal(1);
    el.remove();
    expect(frameCancellations, 'disconnect cancels the iframe-window timer').to.equal(1);
  } finally {
    el?.remove();
    window.setTimeout = originalMainSetTimeout;
    window.clearTimeout = originalMainClearTimeout;
    frameWindow.setTimeout = originalFrameSetTimeout;
    frameWindow.clearTimeout = originalFrameClearTimeout;
    iframe.remove();
  }
});

it('auto-pauses when the element becomes hidden', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="3" interval-ms="20"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  el.play();
  await el.updateComplete;
  expect(el.playing).to.be.true;
  el.hidden = true;
  await el.updateComplete;
  expect(el.playing).to.be.false;
  expect(getComputedStyle(el).display).to.equal('none');
});

it('auto-pauses when length is externally reduced to <= 1 while playing', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="3" interval-ms="20"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  el.play();
  await el.updateComplete;
  expect(el.playing).to.be.true;

  el.itemCount = 1;
  await el.updateComplete;

  expect(el.playing).to.be.false;
  // The play button must not be left as the only control that could stop a
  // still-running timer — confirm the timer actually stopped, not just the
  // `playing` flag, by waiting well past interval-ms and checking the index
  // never advances again.
  const indexAfterPause = el.currentIndex;
  await aTimeout(60);
  expect(el.currentIndex).to.equal(indexAfterPause);
});

it('re-clamps index into range when length shrinks to a value still > 1', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="10" current-index="9"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  expect(el.currentIndex).to.equal(9);

  el.itemCount = 3;
  await el.updateComplete;

  expect(el.currentIndex).to.be.lessThan(3);
  expect(el.currentIndex).to.be.at.least(0);
});

it('goTo() never produces a negative index when length is at its default (0)', async () => {
  const el = (await fixture(html`<lr-sequence-playback></lr-sequence-playback>`)) as LyraSequencePlayback;
  expect(el.itemCount).to.equal(0);

  el.goTo(0);

  expect(el.currentIndex).to.be.at.least(0);
});

it('does not leak a literal "NaN" into the rendered slider max when length is non-finite, even before the next update flushes', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;

  el.itemCount = NaN;
  // goTo() reads the `maxIndex` getter synchronously, before willUpdate()
  // has had a chance to run and normalize `length` back to a finite value --
  // this isolates the getter's own guard from the willUpdate self-heal below.
  el.goTo(5);

  expect(Number.isNaN(el.currentIndex)).to.be.false;
  await el.updateComplete;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  expect(slider.max).to.not.equal('NaN');
});

it('self-heals a non-finite length back to a finite value on the next update', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;

  el.itemCount = NaN;
  await el.updateComplete;

  expect(Number.isFinite(el.itemCount)).to.be.true;
});

it('self-heals a non-finite index back to a valid value on the next update, without requiring length to also change', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="5" current-index="2"></lr-sequence-playback>`)) as LyraSequencePlayback;

  el.currentIndex = NaN;
  await el.updateComplete;

  // Before the fix, `next()`/`previous()` compare `index`/`length` directly
  // and stay permanently bricked once `index` is NaN (NaN comparisons are
  // always false), with nothing to ever recover them.
  expect(Number.isFinite(el.currentIndex)).to.be.true;
  el.next();
  expect(el.currentIndex).to.be.greaterThan(0);
});

it('normalizes non-finite, negative, fractional, and oversized navigation values', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3.9" current-index="2.9"></lr-sequence-playback>`)) as LyraSequencePlayback;
  expect(el.itemCount).to.equal(3);
  el.goTo(Number.NaN);
  expect(el.currentIndex).to.equal(0);

  el.itemCount = Number.POSITIVE_INFINITY;
  el.currentIndex = Number.NEGATIVE_INFINITY;
  el.goTo(Number.POSITIVE_INFINITY);
  expect(el.currentIndex).to.equal(0);
  await el.updateComplete;
  expect(el.itemCount).to.equal(0);
  expect(el.currentIndex).to.equal(0);

  el.itemCount = Number.MAX_VALUE;
  await el.updateComplete;
  expect(Number.isSafeInteger(el.itemCount)).to.be.true;
});

it('re-reads interval-ms fresh instead of baking the original value into the timer for the whole play session', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="100" interval-ms="30"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  el.play();

  // First tick has fired (~30ms in) but not the second (~60ms in).
  await aTimeout(45);
  expect(el.currentIndex).to.equal(1);

  // Slow playback down drastically right after the first tick. The second
  // tick was already scheduled at the old cadence, so it still lands
  // (~60ms in); the *following* reschedule is what must pick up the change.
  el.intervalMs = 3000;

  // Under the old `setInterval`-baked-at-play()-time behavior this window
  // would let several more 30ms ticks land (index climbing well past 2);
  // fixed, only the already-in-flight second tick fires and then playback
  // stalls at the new, much longer cadence.
  await aTimeout(200);
  expect(el.currentIndex).to.equal(2);

  el.pause();
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  await expect(el).to.be.accessible();
});

it('keeps host naming on the host while every nested playback control owns its purpose name', async () => {
  const el = (await fixture(
    html`<lr-sequence-playback item-count="3" aria-label="Timeline playback"></lr-sequence-playback>`,
  )) as LyraSequencePlayback;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
  const position = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  expect(el.getAttribute('aria-label')).to.equal('Timeline playback');
  expect(base.hasAttribute('role')).to.equal(false);
  expect(base.hasAttribute('aria-label')).to.equal(false);
  expect(button.getAttribute('aria-label')).to.equal('Play');
  expect(position.getAttribute('aria-label')).to.equal('Playback position');
  await expect(el).to.be.accessible();

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(true);
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(base.hasAttribute('role')).to.equal(false);
  expect(base.hasAttribute('aria-label')).to.equal(false);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(base.hasAttribute('role')).to.equal(false);
  expect(base.hasAttribute('aria-label')).to.equal(false);
  expect(button.getAttribute('aria-label')).to.equal('Play');
  expect(position.getAttribute('aria-label')).to.equal('Playback position');
});

it('renders the play/pause button content as an SVG icon, not a literal glyph, and swaps it with `playing`', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const button = () => el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  expect((button().querySelector('svg')) != null).to.equal(true);
  expect(button().textContent).to.not.include('▶');
  expect(button().textContent).to.not.include('❚❚');
  const playMarkup = button().innerHTML;

  el.playing = true;
  await el.updateComplete;

  expect((button().querySelector('svg')) != null).to.equal(true);
  expect(button().innerHTML).to.not.equal(playMarkup);
});

it('shows the disabled affordance (opacity + not-allowed cursor) on the play button when length <= 1', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="1"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  expect(button.disabled).to.be.true;
  const style = getComputedStyle(button);
  expect(style.opacity).to.equal('0.5');
  expect(style.cursor).to.equal('not-allowed');
});

it('shows a focus ring on the play button when it receives keyboard/programmatic focus', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  button.focus();
  await el.updateComplete;

  const style = getComputedStyle(button);
  expect(style.outlineStyle).to.equal('solid');
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('forwards public focus and blur to the play button', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('play-button');
  el.blur();
  expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
});

it('forwards host click() to the play button', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  el.click();
  expect(el.playing).to.be.true;
  el.click();
  expect(el.playing).to.be.false;
});

it('relays one native focus/blur pair with payload and fires no prefixed alias', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  const related = document.createElement('button');
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  const sequence: string[] = [];
  el.addEventListener('focus', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('focus');
  });
  el.addEventListener('blur', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('blur');
  });
  el.addEventListener('lr-focus', () => {
    aliases.push('lr-focus');
  });
  el.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
  });

  slider.dispatchEvent(new FocusEvent('focus', {
    bubbles: true,
    composed: true,
    relatedTarget: related,
    view: window,
  }));
  slider.dispatchEvent(new FocusEvent('blur', {
    bubbles: true,
    composed: true,
    relatedTarget: related,
    view: window,
  }));

  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(nativeEvents.every((event) => event.relatedTarget === related)).to.be.true;
  expect(sequence).to.deep.equal(['focus', 'blur']);
  expect(aliases, 'lr-focus/lr-blur compatibility aliases must not fire').to.deep.equal([]);
});

it('toggles playback when the rendered play-button is clicked', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
  const playEvent = oneEvent(el, 'lr-play');

  button.click();
  await playEvent;
  expect(el.playing).to.be.true;

  const pauseEvent = oneEvent(el, 'lr-pause');
  button.click();
  await pauseEvent;
  expect(el.playing).to.be.false;
});

it('jumps to the input value when the rendered slider fires an input event', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="5" current-index="0"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  const stepEvent = oneEvent(el, 'lr-sequence-step');

  // The native range exposes the same one-based ordinal announced by aria-valuetext.
  slider.value = '4';
  slider.dispatchEvent(new Event('input'));

  const { detail } = await stepEvent;
  expect(el.currentIndex).to.equal(3);
  expect(detail.currentIndex).to.equal(3);
});

it('disables the rendered slider when length <= 1', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="1"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  expect(slider.disabled).to.be.true;
  const style = getComputedStyle(slider);
  expect(style.opacity).to.equal('0.5');
  expect(style.cursor).to.equal('not-allowed');
});

it('shows a focus ring on the slider when it receives keyboard/programmatic focus', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  slider.focus();
  await el.updateComplete;

  const style = getComputedStyle(slider);
  expect(style.outlineStyle).to.equal('solid');
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('starts the real timer when `playing` is set directly, not just via play()', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3" interval-ms="20"></lr-sequence-playback>`)) as LyraSequencePlayback;
  el.playing = true;
  await aTimeout(35);
  expect(el.currentIndex).to.be.greaterThan(0);
});

it('stops the real timer when `playing` is set to false directly, not just via pause()', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="5" interval-ms="20"></lr-sequence-playback>`)) as LyraSequencePlayback;
  el.play();
  await aTimeout(15);
  el.playing = false;
  const indexAfterStop = el.currentIndex;
  await aTimeout(60);
  expect(el.currentIndex).to.equal(indexAfterStop);
});

it('clamps a non-positive interval-ms instead of hammering a zero-delay tick loop', async () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(html`<lr-sequence-playback item-count="1000" interval-ms="0"></lr-sequence-playback>`)) as LyraSequencePlayback;
    el.play();
    await aTimeout(50);
    // With no clamp this would have ticked dozens/hundreds of times already;
    // clamped to a sane minimum, only a handful of ticks land in 50ms.
    expect(el.currentIndex).to.be.lessThan(20);
    expect(calls).to.have.length(1);
    expect(calls[0][0]).to.contain('below the 16ms floor');
    el.pause();
  } finally {
    console.warn = originalWarn;
  }
});

it('warns with a reason that matches the actual cause: "below the Xms floor" for a merely-small value, "non-finite" for NaN', async () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    // 12 (not 10, which many earlier tests already used) so this assertion
    // does not depend on being the first test in the file to warn about it --
    // the warning is deduplicated per distinct value, not globally.
    const small = (await fixture(
      html`<lr-sequence-playback item-count="5" interval-ms="12"></lr-sequence-playback>`,
    )) as LyraSequencePlayback;
    small.play();
    small.pause();

    const invalid = (await fixture(
      html`<lr-sequence-playback item-count="5" interval-ms="NaN"></lr-sequence-playback>`,
    )) as LyraSequencePlayback;
    invalid.play();
    invalid.pause();

    const huge = (await fixture(
      html`<lr-sequence-playback item-count="5" interval-ms="${Number.MAX_VALUE}"></lr-sequence-playback>`,
    )) as LyraSequencePlayback;
    huge.play();
    huge.pause();

    expect(calls.map(([message]) => message)).to.deep.equal([
      '<lr-sequence-playback> interval-ms (12) is below the 16ms floor; clamping to 16ms.',
      '<lr-sequence-playback> interval-ms (NaN) is non-finite; clamping to 16ms.',
      `<lr-sequence-playback> interval-ms (${Number.MAX_VALUE}) is above the 2147483647ms ceiling; clamping to 2147483647ms.`,
    ]);
  } finally {
    console.warn = originalWarn;
  }
});

it('derives the play/pause icon size from --lr-icon-button-size via a token, not a bare literal', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  // Default rendering is unchanged from the pre-refactor bare 0.875rem (14px)
  // literal.
  expect(getComputedStyle(button).fontSize).to.equal('14px');

  // Overriding the icon-button-size token must move the icon size with it --
  // proof the icon size is now backed by a design token instead of a bare
  // literal that can never respond to it.
  el.style.setProperty('--lr-icon-button-size', '100px');
  await el.updateComplete;
  expect(getComputedStyle(button).fontSize).to.equal('35px');
});

it('gives the play/pause button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLElement;

  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');
});

it('gives the enabled range slider a pointer cursor and rendered hover and pressed affordances', async () => {
  // Asserted against the rendered result rather than the stylesheet text, because a stylesheet can
  // carry a rule that never applies -- which is exactly what happened here before: the slider's ink
  // is drawn by the UA from accent-color, so nothing about the previous brightness filter could be
  // proven by matching source. Pressed is checked against hover, not against rest, so an :active
  // rule that merely duplicates :hover fails.
  const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  expect(slider.disabled, 'the fixture renders an enabled slider').to.be.false;
  expect(getComputedStyle(slider).cursor).to.equal('pointer');

  const resting = getComputedStyle(slider).accentColor;
  const rect = slider.getBoundingClientRect();
  const centre: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  try {
    await sendMouse({ type: 'move', position: centre });
    const hovered = getComputedStyle(slider).accentColor;
    expect(hovered, 'hover moves the slider ink off its resting accent').to.not.equal(resting);

    await sendMouse({ type: 'down' });
    const pressed = getComputedStyle(slider).accentColor;
    expect(pressed, 'pressed is a further step, not a repeat of hover').to.not.equal(hovered);
    await sendMouse({ type: 'up' });
  } finally {
    await resetMouse();
  }
});

describe('play-button pressed paint', () => {
  /** Resolves a declaration in the playback shadow root, where the design tokens are available. */
  function resolvedInShadow(el: LyraSequencePlayback, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function press(button: HTMLElement): Promise<void> {
    const rect = button.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await sendMouse({ type: 'down' });
  }

  it('keeps the prior active play-button border and background defaults during a real mouse press', async () => {
    const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
    const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

    try {
      await press(button);
      const style = getComputedStyle(button);
      expect(style.backgroundColor).to.equal(
        resolvedInShadow(
          el,
          'background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
          'background-color',
        ),
      );
      expect(style.borderTopColor).to.equal(
        resolvedInShadow(el, 'border-top-color: var(--lr-color-brand)', 'border-top-color'),
      );
    } finally {
      await resetMouse();
      el.pause();
    }
  });

  it('inherits active play-button paint from an ancestor during a real mouse press', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        style="
          --lr-sequence-playback-play-button-active-bg: rgb(7, 8, 9);
          --lr-sequence-playback-play-button-active-border-color: rgb(10, 11, 12);
        "
      >
        <lr-sequence-playback item-count="3"></lr-sequence-playback>
      </div>
    `);
    const el = wrapper.querySelector('lr-sequence-playback') as LyraSequencePlayback;
    const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

    try {
      await press(button);
      const style = getComputedStyle(button);
      expect(style.backgroundColor).to.equal('rgb(7, 8, 9)');
      expect(style.borderTopColor).to.equal('rgb(10, 11, 12)');
    } finally {
      await resetMouse();
      el.pause();
    }
  });
});

it('chains willUpdate() to super.willUpdate() so a mixin layered under LyraElement would still run', async () => {
  // No shared mixin actually overrides willUpdate() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself --
  // the exact hook a future mixin would extend -- and confirm it actually fires.
  const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'willUpdate');
  const original = (LitElement.prototype as unknown as { willUpdate?: (changed: PropertyValues) => void })
    .willUpdate;
  let called = false;
  (LitElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void }).willUpdate = function (
    this: LitElement,
    changed: PropertyValues,
  ) {
    called = true;
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { willUpdate: unknown }).willUpdate = original;
    } else {
      delete (LitElement.prototype as unknown as { willUpdate?: unknown }).willUpdate;
    }
  }
});

describe('slider hover specificity', () => {
  it('a ::part(slider):hover override wins without needing !important', async () => {
    // The internal hover rule wraps its extra pseudo-classes in :where(...) so its specificity
    // stays at (0,1,0) -- below a consumer's own ::part(slider):hover ((0,1,1)) -- rather than
    // the (0,3,0) an unwrapped [part='slider']:hover:not(:disabled) would have, which would beat
    // that consumer override and force !important. Same regression this library already fixed for
    // <lr-attachment-trigger>.
    const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
    const internalSheet = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .find((text) => text.includes(':hover') && /\[part=['"]?slider['"]?\]/.test(text));
    expect(internalSheet).to.contain(':where(');
  });
});

describe('string localization', () => {
  function playButton(el: LyraSequencePlayback): HTMLButtonElement {
    return el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
  }
  function slider(el: LyraSequencePlayback): HTMLInputElement {
    return el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  }

  it('defaults the play/pause button and slider aria-labels to English', async () => {
    const el = (await fixture(html`<lr-sequence-playback item-count="3"></lr-sequence-playback>`)) as LyraSequencePlayback;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Play');
    expect(slider(el).getAttribute('aria-label')).to.equal('Playback position');

    el.play();
    await el.updateComplete;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Pause');
  });

  it('announces the slider position as a localized step count rather than a bare index', async () => {
    const el = (await fixture(
      html`<lr-sequence-playback item-count="10" current-index="3" lang="ar-EG"></lr-sequence-playback>`,
    )) as LyraSequencePlayback;
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('Step ٤ of ١٠');
    expect(slider(el).min).to.equal('1');
    expect(slider(el).max).to.equal('10');
    expect(slider(el).value).to.equal('4');

    el.next();
    await el.updateComplete;
    expect(slider(el).getAttribute('aria-valuetext')).to.equal('Step ٥ of ١٠');

    const translated = (await fixture(html`
      <lr-sequence-playback
        item-count="3"
        .strings=${{ playbackStepPosition: 'Étape {index} sur {total}' }}
      ></lr-sequence-playback>
    `)) as LyraSequencePlayback;
    expect(slider(translated).getAttribute('aria-valuetext')).to.equal('Étape 1 sur 3');
  });

  it('honors a strings override for play/pause/playbackPosition', async () => {
    const el = (await fixture(html`
      <lr-sequence-playback
        item-count="3"
        .strings=${{ play: 'Lire', pause: 'Pause', playbackPosition: 'Position de lecture' }}
      ></lr-sequence-playback>
    `)) as LyraSequencePlayback;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Lire');
    expect(slider(el).getAttribute('aria-label')).to.equal('Position de lecture');

    el.play();
    await el.updateComplete;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Pause');
  });
});
