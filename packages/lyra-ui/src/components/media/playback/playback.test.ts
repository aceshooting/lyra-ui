import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './playback.js';
import type { LyraPlayback } from './playback.js';
import { styles } from './playback.styles.js';

it('does not leak an untracked duplicate timer chain when play() is called synchronously from a lr-step listener during tick()', async () => {
  const el = (await fixture(
    html`<lr-playback length="1000" interval-ms="20"></lr-playback>`,
  )) as LyraPlayback;
  let reentered = false;
  el.addEventListener('lr-step', () => {
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
  const indexAfterPause = el.index;

  // If a second, untracked setTimeout chain leaked out of the reentrant
  // pause()+play() cycle, the index keeps climbing here even though pause()
  // (and disconnectedCallback()) believe playback is fully stopped.
  await aTimeout(150);
  expect(el.index).to.equal(indexAfterPause);
});

it('advances the index on each tick and wraps when loop is true', async () => {
  const el = (await fixture(
    html`<lr-playback length="3" interval-ms="20"></lr-playback>`,
  )) as LyraPlayback;
  const playEvent = oneEvent(el, 'lr-play');
  el.play();
  await playEvent;
  await aTimeout(35);
  el.pause();
  expect(el.index).to.be.greaterThan(0);
});

it('stops at the last index when loop is false and not-looping is reached', async () => {
  const el = (await fixture(
    html`<lr-playback length="2" interval-ms="20" index="1"></lr-playback>`,
  )) as LyraPlayback;
  el.loop = false;
  el.play();
  await aTimeout(30);
  expect(el.playing).to.be.false;
  expect(el.index).to.equal(1);
});

it('no-ops play() when length <= 1', async () => {
  const el = (await fixture(html`<lr-playback length="1"></lr-playback>`)) as LyraPlayback;
  el.play();
  expect(el.playing).to.be.false;
});

it('next()/previous()/goTo() emit lr-step without starting playback', async () => {
  const el = (await fixture(html`<lr-playback length="5" index="2"></lr-playback>`)) as LyraPlayback;
  let detail: { index: number } | undefined;
  el.addEventListener('lr-step', (e) => (detail = (e as CustomEvent).detail));
  el.next();
  expect(el.index).to.equal(3);
  expect(detail!.index).to.equal(3);
  el.previous();
  expect(el.index).to.equal(2);
  el.goTo(4);
  expect(el.index).to.equal(4);
  expect(el.playing).to.be.false;
});

it('auto-pauses on disconnect', async () => {
  const el = (await fixture(
    html`<lr-playback length="3" interval-ms="20"></lr-playback>`,
  )) as LyraPlayback;
  el.play();
  el.remove();
  expect(el.playing).to.be.false;
});

it('auto-pauses when the element becomes hidden', async () => {
  const el = (await fixture(
    html`<lr-playback length="3" interval-ms="20"></lr-playback>`,
  )) as LyraPlayback;
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
    html`<lr-playback length="3" interval-ms="20"></lr-playback>`,
  )) as LyraPlayback;
  el.play();
  await el.updateComplete;
  expect(el.playing).to.be.true;

  el.length = 1;
  await el.updateComplete;

  expect(el.playing).to.be.false;
  // The play button must not be left as the only control that could stop a
  // still-running timer — confirm the timer actually stopped, not just the
  // `playing` flag, by waiting well past interval-ms and checking the index
  // never advances again.
  const indexAfterPause = el.index;
  await aTimeout(60);
  expect(el.index).to.equal(indexAfterPause);
});

it('re-clamps index into range when length shrinks to a value still > 1', async () => {
  const el = (await fixture(
    html`<lr-playback length="10" index="9"></lr-playback>`,
  )) as LyraPlayback;
  expect(el.index).to.equal(9);

  el.length = 3;
  await el.updateComplete;

  expect(el.index).to.be.lessThan(3);
  expect(el.index).to.be.at.least(0);
});

it('goTo() never produces a negative index when length is at its default (0)', async () => {
  const el = (await fixture(html`<lr-playback></lr-playback>`)) as LyraPlayback;
  expect(el.length).to.equal(0);

  el.goTo(0);

  expect(el.index).to.be.at.least(0);
});

it('does not leak a literal "NaN" into the rendered slider max when length is non-finite, even before the next update flushes', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;

  el.length = NaN;
  // goTo() reads the `maxIndex` getter synchronously, before willUpdate()
  // has had a chance to run and normalize `length` back to a finite value --
  // this isolates the getter's own guard from the willUpdate self-heal below.
  el.goTo(5);

  expect(Number.isNaN(el.index)).to.be.false;
  await el.updateComplete;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  expect(slider.max).to.not.equal('NaN');
});

it('self-heals a non-finite length back to a finite value on the next update', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;

  el.length = NaN;
  await el.updateComplete;

  expect(Number.isFinite(el.length)).to.be.true;
});

it('self-heals a non-finite index back to a valid value on the next update, without requiring length to also change', async () => {
  const el = (await fixture(html`<lr-playback length="5" index="2"></lr-playback>`)) as LyraPlayback;

  el.index = NaN;
  await el.updateComplete;

  // Before the fix, `next()`/`previous()` compare `index`/`length` directly
  // and stay permanently bricked once `index` is NaN (NaN comparisons are
  // always false), with nothing to ever recover them.
  expect(Number.isFinite(el.index)).to.be.true;
  el.next();
  expect(el.index).to.be.greaterThan(0);
});

it('normalizes non-finite, negative, fractional, and oversized navigation values', async () => {
  const el = (await fixture(html`<lr-playback length="3.9" index="2.9"></lr-playback>`)) as LyraPlayback;
  expect(el.length).to.equal(3);
  el.goTo(Number.NaN);
  expect(el.index).to.equal(0);

  el.length = Number.POSITIVE_INFINITY;
  el.index = Number.NEGATIVE_INFINITY;
  el.goTo(Number.POSITIVE_INFINITY);
  expect(el.index).to.equal(0);
  await el.updateComplete;
  expect(el.length).to.equal(0);
  expect(el.index).to.equal(0);

  el.length = Number.MAX_VALUE;
  await el.updateComplete;
  expect(Number.isSafeInteger(el.length)).to.be.true;
});

it('re-reads interval-ms fresh instead of baking the original value into the timer for the whole play session', async () => {
  const el = (await fixture(
    html`<lr-playback length="100" interval-ms="30"></lr-playback>`,
  )) as LyraPlayback;
  el.play();

  // First tick has fired (~30ms in) but not the second (~60ms in).
  await aTimeout(45);
  expect(el.index).to.equal(1);

  // Slow playback down drastically right after the first tick. The second
  // tick was already scheduled at the old cadence, so it still lands
  // (~60ms in); the *following* reschedule is what must pick up the change.
  el.intervalMs = 3000;

  // Under the old `setInterval`-baked-at-play()-time behavior this window
  // would let several more 30ms ticks land (index climbing well past 2);
  // fixed, only the already-in-flight second tick fires and then playback
  // stalls at the new, much longer cadence.
  await aTimeout(200);
  expect(el.index).to.equal(2);

  el.pause();
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
  await expect(el).to.be.accessible();
});

it('renders the play/pause button content as an SVG icon, not a literal glyph, and swaps it with `playing`', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
  const button = () => el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  expect(button().querySelector('svg')).to.exist;
  expect(button().textContent).to.not.include('▶');
  expect(button().textContent).to.not.include('❚❚');
  const playMarkup = button().innerHTML;

  el.playing = true;
  await el.updateComplete;

  expect(button().querySelector('svg')).to.exist;
  expect(button().innerHTML).to.not.equal(playMarkup);
});

it('shows the disabled affordance (opacity + not-allowed cursor) on the play button when length <= 1', async () => {
  const el = (await fixture(html`<lr-playback length="1"></lr-playback>`)) as LyraPlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  expect(button.disabled).to.be.true;
  const style = getComputedStyle(button);
  expect(style.opacity).to.equal('0.5');
  expect(style.cursor).to.equal('not-allowed');
});

it('shows a focus ring on the play button when it receives keyboard/programmatic focus', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  button.focus();
  await el.updateComplete;

  const style = getComputedStyle(button);
  expect(style.outlineStyle).to.equal('solid');
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('forwards public focus and blur to the play button', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('play-button');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('bridges internal control focus and blur as bubbling, composed host events', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  const focusPromise = oneEvent(el, 'focus');
  slider.focus();
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;

  const blurPromise = oneEvent(el, 'blur');
  slider.blur();
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
});

it('toggles playback when the rendered play-button is clicked', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
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
  const el = (await fixture(html`<lr-playback length="5" index="0"></lr-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  const stepEvent = oneEvent(el, 'lr-step');

  slider.value = '3';
  slider.dispatchEvent(new Event('input'));

  const { detail } = await stepEvent;
  expect(el.index).to.equal(3);
  expect(detail.index).to.equal(3);
});

it('disables the rendered slider when length <= 1', async () => {
  const el = (await fixture(html`<lr-playback length="1"></lr-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  expect(slider.disabled).to.be.true;
  const style = getComputedStyle(slider);
  expect(style.opacity).to.equal('0.5');
  expect(style.cursor).to.equal('not-allowed');
});

it('shows a focus ring on the slider when it receives keyboard/programmatic focus', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  slider.focus();
  await el.updateComplete;

  const style = getComputedStyle(slider);
  expect(style.outlineStyle).to.equal('solid');
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('starts the real timer when `playing` is set directly, not just via play()', async () => {
  const el = (await fixture(html`<lr-playback length="3" interval-ms="20"></lr-playback>`)) as LyraPlayback;
  el.playing = true;
  await aTimeout(35);
  expect(el.index).to.be.greaterThan(0);
});

it('stops the real timer when `playing` is set to false directly, not just via pause()', async () => {
  const el = (await fixture(html`<lr-playback length="5" interval-ms="20"></lr-playback>`)) as LyraPlayback;
  el.play();
  await aTimeout(15);
  el.playing = false;
  const indexAfterStop = el.index;
  await aTimeout(60);
  expect(el.index).to.equal(indexAfterStop);
});

it('clamps a non-positive interval-ms instead of hammering a zero-delay tick loop', async () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(html`<lr-playback length="1000" interval-ms="0"></lr-playback>`)) as LyraPlayback;
    el.play();
    await aTimeout(50);
    // With no clamp this would have ticked dozens/hundreds of times already;
    // clamped to a sane minimum, only a handful of ticks land in 50ms.
    expect(el.index).to.be.lessThan(20);
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
      html`<lr-playback length="5" interval-ms="12"></lr-playback>`,
    )) as LyraPlayback;
    small.play();
    small.pause();

    const invalid = (await fixture(
      html`<lr-playback length="5" interval-ms="NaN"></lr-playback>`,
    )) as LyraPlayback;
    invalid.play();
    invalid.pause();

    const huge = (await fixture(
      html`<lr-playback length="5" interval-ms="${Number.MAX_VALUE}"></lr-playback>`,
    )) as LyraPlayback;
    huge.play();
    huge.pause();

    expect(calls.length).to.equal(3);
    expect(calls[0][0]).to.contain('(12)');
    expect(calls[0][0]).to.contain('below the 16ms floor');
    expect(calls[1][0]).to.contain('(NaN)');
    expect(calls[1][0]).to.contain('non-finite');
    expect(calls[2][0]).to.contain('above the 2147483647ms ceiling');
  } finally {
    console.warn = originalWarn;
  }
});

it('derives the play/pause icon size from --lr-icon-button-size via a token, not a bare literal', async () => {
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
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
  const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLElement;

  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');
});

it('gives the enabled range slider a pointer cursor and a hover affordance matching the play button', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='slider'\]\s*\{[^}]*cursor:\s*pointer/);
  expect(css).to.match(/\[part='slider'\]:hover:not\(:disabled\)\s*\{[^}]*filter:\s*brightness\(var\(--lr-hover-brightness\)\)/);
});

describe('string localization', () => {
  function playButton(el: LyraPlayback): HTMLButtonElement {
    return el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
  }
  function slider(el: LyraPlayback): HTMLInputElement {
    return el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  }

  it('defaults the play/pause button and slider aria-labels to English', async () => {
    const el = (await fixture(html`<lr-playback length="3"></lr-playback>`)) as LyraPlayback;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Play');
    expect(slider(el).getAttribute('aria-label')).to.equal('Playback position');

    el.play();
    await el.updateComplete;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Pause');
  });

  it('honors a strings override for play/pause/playbackPosition', async () => {
    const el = (await fixture(html`
      <lr-playback
        length="3"
        .strings=${{ play: 'Lire', pause: 'Pause', playbackPosition: 'Position de lecture' }}
      ></lr-playback>
    `)) as LyraPlayback;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Lire');
    expect(slider(el).getAttribute('aria-label')).to.equal('Position de lecture');

    el.play();
    await el.updateComplete;
    expect(playButton(el).getAttribute('aria-label')).to.equal('Pause');
  });
});
