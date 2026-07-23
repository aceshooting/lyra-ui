import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { LyraAnimation } from './animation.js';
import './animation.js';

/** Stubs `window.matchMedia('(prefers-reduced-motion: reduce)')` with a
 *  controllable fake `MediaQueryList` so reduced-motion arbitration is
 *  deterministic instead of depending on the ambient CI environment. Mirrors
 *  the identical helper in animated-image.test.ts. Restore via `.restore()`
 *  in a `finally` block. */
function stubReducedMotion(initialMatches: boolean) {
  const original = window.matchMedia;
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const fakeList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => listeners.delete(cb),
  } as unknown as MediaQueryList;

  window.matchMedia = ((query: string) =>
    query === '(prefers-reduced-motion: reduce)' ? fakeList : original(query)) as typeof window.matchMedia;

  return {
    restore(): void {
      window.matchMedia = original;
    },
    fire(nextMatches: boolean): void {
      matches = nextMatches;
      const event = { matches: nextMatches, media: fakeList.media } as MediaQueryListEvent;
      listeners.forEach((cb) => cb(event));
    },
  };
}

interface FakeIntersectionObserverInstance {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  disconnected: boolean;
}

/** Stubs the global `IntersectionObserver` with a fully fake, manually-driven
 *  implementation so play-on-visible tests control exactly when (and
 *  whether) intersection is reported -- the same spy-the-observer-constructor
 *  technique map.test.ts uses, since a real IntersectionObserver reports an
 *  on-screen fixture as intersecting almost immediately in the headless test
 *  page, making these scenarios impossible to reproduce deterministically. */
function stubIntersectionObserver() {
  const original = window.IntersectionObserver;
  const observedTargets: Element[] = [];
  const instances: FakeIntersectionObserverInstance[] = [];
  class FakeIntersectionObserver implements FakeIntersectionObserverInstance {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    disconnected = false;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      instances.push(this);
    }
    observe(target: Element): void {
      observedTargets.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      this.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  return {
    instances,
    observedTargets,
    restore(): void {
      (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = original;
    },
  };
}

it('is accessible with a slotted animation target', async () => {
  const el = await fixture(html`
      <lr-animation name="none" play iterations="1">
      <p>Animated content</p>
    </lr-animation>
  `);
  await expect(el).to.be.accessible();
});

// Regression test: `Element.animate()` throws a synchronous TypeError for a non-finite/negative
// `duration`/`delay`/`endDelay`, and for a negative/non-finite `iterationStart` -- this used to
// crash createAnimation() (called from updated() on nearly every property change) instead of
// clamping to a sane value.
it('does not throw and still produces a real, clamped animation when timing properties are non-finite/out-of-range', async () => {
  const el = (await fixture(html`
    <lr-animation
      name="fade-in"
      duration="NaN"
      delay="-50"
      end-delay="Infinity"
      iteration-start="-3"
      playback-rate="NaN"
      iterations="NaN"
    >
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const animations = target.getAnimations();
  expect(animations.length).to.equal(1);

  const timing = animations[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(1000); // NaN -> falls back to the constructed default
  expect(timing.delay).to.equal(0); // -50 clamped to the non-negative floor
  expect(timing.endDelay).to.equal(0); // Infinity clamped (endDelay has no Infinity sentinel)
  expect(timing.iterationStart).to.equal(0); // -3 clamped to the non-negative floor
  expect(timing.iterations).to.equal(1); // NaN -> falls back to 1, not the Infinity default
});

it('keeps the documented Infinity default for iterations intact (a legitimate WAAPI sentinel)', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const timing = target.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.iterations).to.equal(Infinity);
});

// The `slide-in-start`/`slide-in-end`/`slide-out-start`/`slide-out-end` presets resolve
// "start"/"end" against the element's own `dir` -- these four cases combine to exercise
// every branch of slidePreset()'s `dir === 'ltr' ? edge === 'start' : edge === 'end'` and
// its `mode === 'in'` ternary: (ltr, start) and (rtl, end) both produce an offscreen
// negative translateX; (rtl, start) and (ltr, end) both produce a positive one.
it('resolves slide-in/slide-out "start"/"end" presets against the effective text direction (RTL-aware)', async () => {
  const cases: { name: string; dir: 'ltr' | 'rtl'; mode: 'in' | 'out'; negative: boolean }[] = [
    { name: 'slide-in-start', dir: 'ltr', mode: 'in', negative: true },
    { name: 'slide-in-end', dir: 'rtl', mode: 'in', negative: true },
    { name: 'slide-out-start', dir: 'rtl', mode: 'out', negative: false },
    { name: 'slide-out-end', dir: 'ltr', mode: 'out', negative: false },
  ];
  for (const { name, dir, mode, negative } of cases) {
    const el = (await fixture(html`
      <lr-animation name=${name} dir=${dir} iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;
    const target = el.querySelector('p')!;
    const [from, to] = target.getAnimations()[0].effect!.getKeyframes();
    const offscreen = mode === 'in' ? from : to;
    const onscreen = mode === 'in' ? to : from;
    expect(String(offscreen.transform)).to.include('translateX');
    expect(String(offscreen.transform).includes('-1 *')).to.equal(negative, `${name} dir=${dir}`);
    expect(String(onscreen.transform)).to.equal('translateX(0px)');
    expect(String(mode === 'in' ? from.opacity : to.opacity)).to.equal('0');
    expect(String(mode === 'in' ? to.opacity : from.opacity)).to.equal('1');
  }
});

it('derives duration/easing from the --lr-transition-fast token when timingPreset is set, overriding the raw duration/easing properties', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" timing-preset="fast" duration="9999" easing="step-end" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const timing = target.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(120); // --lr-transition-fast: 120ms ease-out (tokens.styles.ts)
  expect(timing.easing).to.equal('ease-out');
});

it('parses a whole-second --lr-transition-ambient token (the "s" unit branch, vs. -fast/-base\'s "ms")', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" timing-preset="ambient" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const timing = target.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(1800); // --lr-transition-ambient: 1.8s ease-in-out (tokens.styles.ts)
  expect(timing.easing).to.equal('ease-in-out');
});

it('falls back to the constructed default duration/easing when the resolved --lr-transition-* token does not parse', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" timing-preset="fast" style="--lr-transition-fast: 180" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const timing = target.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(1000);
  expect(timing.easing).to.equal('linear');
});

it('rejects malformed timing-token numbers instead of passing NaN into WAAPI', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" timing-preset="fast" style="--lr-transition-fast: .ms ease-out" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const timing = el.querySelector('p')!.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(1000);
  expect(timing.easing).to.equal('linear');
});

it('normalizes invalid WAAPI direction, fill, and easing values without rejecting the update', async () => {
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'fade-in';
  el.iterations = 1;
  el.direction = 'sideways' as PlaybackDirection;
  el.fill = 'painted' as FillMode;
  el.easing = 'definitely-not-an-easing';
  const target = document.createElement('p');
  target.textContent = 'content';
  el.append(target);
  document.body.append(el);
  try {
    await el.updateComplete;
    const timing = target.getAnimations()[0].effect!.getComputedTiming();
    expect(timing.direction).to.equal('normal');
    // WAAPI resolves the safe `auto` input to its computed `none` value.
    expect(timing.fill).to.equal('none');
    expect(timing.easing).to.equal('linear');
  } finally {
    el.remove();
  }
});

it('falls back to safe IntersectionObserver options when rootMargin or threshold is invalid', async () => {
  const io = stubIntersectionObserver();
  try {
    const el = document.createElement('lr-animation') as LyraAnimation;
    el.name = 'fade-in';
    el.playOnVisible = true;
    el.rootMargin = 'not-a-margin';
    el.threshold = [-1, 2];
    const target = document.createElement('p');
    target.textContent = 'content';
    el.append(target);

    const OriginalObserver = window.IntersectionObserver;
    let attempts = 0;
    class ValidatingObserver extends (OriginalObserver as unknown as { new(callback: IntersectionObserverCallback, options?: IntersectionObserverInit): IntersectionObserver }) {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        attempts += 1;
        if (options?.rootMargin === 'not-a-margin') throw new SyntaxError('invalid root margin');
        super(callback, options);
      }
    }
    window.IntersectionObserver = ValidatingObserver as unknown as typeof IntersectionObserver;
    document.body.append(el);
    try {
      await el.updateComplete;
      // Initial connection and slot assignment may each rebuild the observer; every
      // invalid attempt must be paired with one safe fallback construction.
      expect(attempts).to.be.at.least(2);
      expect(attempts % 2).to.equal(0);
      expect(io.instances.at(-1)?.options?.rootMargin).to.equal('0px');
      expect(io.instances.at(-1)?.options?.threshold).to.equal(0);
    } finally {
      el.remove();
    }
  } finally {
    io.restore();
  }
});

it('a `keyframes` override always wins over `name`, per the documented precedence', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" .keyframes=${[{ opacity: 0.2 }, { opacity: 0.9 }]} iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const [from, to] = target.getAnimations()[0].effect!.getKeyframes();
  expect(String(from.opacity)).to.equal('0.2');
  expect(String(to.opacity)).to.equal('0.9');
});

it('does not throw and stays inert when there is no slotted target to animate (currentTime/play-on-visible/start all no-op the Animation half)', async () => {
  const el = (await fixture(html`<lr-animation name="fade-in" play play-on-visible></lr-animation>`)) as LyraAnimation;
  await el.updateComplete;

  expect(el.currentTime).to.equal(0);
  el.currentTime = 250; // no underlying Animation to forward to -- must not throw
  expect(el.currentTime).to.equal(0);
  expect((el as unknown as { visibilityObserver?: IntersectionObserver }).visibilityObserver).to.be.undefined;

  // Toggling `play` post-mount with no Animation ever created routes through
  // applyPlayState() (not a rebuild, since `name` etc. don't change) -- its
  // `if (!this.animation) return;` guard must no-op rather than throw.
  el.play = false;
  await el.updateComplete;
  el.start();
  await el.updateComplete;
  expect(el.play).to.be.true;
});

it('finishes immediately at creation time (still emitting lr-start then lr-finish, in order) when play is already true under reduced motion', async () => {
  const stub = stubReducedMotion(true);
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'fade-in';
  el.iterations = 5;
  el.play = true;
  const p = document.createElement('p');
  p.textContent = 'content';
  el.append(p);
  try {
    const startEvent = oneEvent(el, 'lr-start');
    const finishEvent = oneEvent(el, 'lr-finish');
    document.body.append(el);
    await startEvent;
    await finishEvent;
    expect(el.play).to.be.false; // onAnimationFinish resets play
  } finally {
    stub.restore();
    el.remove();
  }
});

it('respect-reduced-motion="false" (plain HTML attribute) plays through normally instead of instantly finishing when play is already true under reduced motion', async () => {
  const stub = stubReducedMotion(true);
  const el = document.createElement('lr-animation') as LyraAnimation;
  // A plain literal attribute value -- not a JS property/boolean-directive binding -- must drive
  // this true-defaulting boolean property back to false. Set before connecting, mirroring the
  // sibling reduced-motion test above.
  el.setAttribute('respect-reduced-motion', 'false');
  expect(el.respectReducedMotion).to.be.false;
  el.name = 'fade-in';
  el.iterations = 5;
  el.play = true;
  const p = document.createElement('p');
  p.textContent = 'content';
  el.append(p);
  try {
    let finished = false;
    el.addEventListener('lr-finish', () => (finished = true));

    const startEvent = oneEvent(el, 'lr-start');
    document.body.append(el);
    await startEvent;
    await el.updateComplete;

    // Real (non-reduced) playback never resolves synchronously at creation time -- unlike the
    // identical reduced-motion setup in the sibling test above, no lr-finish has fired
    // immediately after lr-start.
    expect(finished).to.be.false;
    expect(el.play).to.be.true;
  } finally {
    stub.restore();
    el.remove();
  }
});

it('reacts live to an OS-level reduced-motion preference change while already connected, rebuilding the Animation (re-fires lr-start/lr-finish)', async () => {
  const stub = stubReducedMotion(false);
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" iterations="5">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    el.start();
    await el.updateComplete;
    expect(el.play).to.be.true;

    // onMotionPreferenceChange rebuilds via createAnimation(): the rebuilt
    // Animation is created with `play` already true, so under the new
    // reduced-motion preference it re-emits lr-start and then finishes
    // immediately (iterations clamped to 1), re-emitting lr-finish.
    const startEvent = oneEvent(el, 'lr-start');
    const finishEvent = oneEvent(el, 'lr-finish');
    stub.fire(true);
    await startEvent;
    await finishEvent;
    expect(el.play).to.be.false; // onAnimationFinish resets play
  } finally {
    stub.restore();
  }
});

it('start()/pause() toggle `play` after the initial render, driving the existing Animation directly (not a rebuild) and emitting lr-start', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  expect(el.play).to.be.false;

  const startEvent = oneEvent(el, 'lr-start');
  el.start();
  await startEvent;
  expect(el.play).to.be.true;

  el.pause();
  await el.updateComplete;
  expect(el.play).to.be.false;
});

it('cancel() forwards to the underlying Animation, whose native cancel event surfaces as lr-cancel and resets `play`', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  el.start();
  await el.updateComplete;

  const cancelEvent = oneEvent(el, 'lr-cancel');
  el.cancel();
  await cancelEvent;
  expect(el.play).to.be.false;
});

it('finish() forwards to the underlying Animation, whose native finish event surfaces as lr-finish and resets `play`', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  el.start();
  await el.updateComplete;

  const finishEvent = oneEvent(el, 'lr-finish');
  el.finish();
  await finishEvent;
  expect(el.play).to.be.false;
});

it('currentTime getter/setter proxy the underlying Animation once one exists', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" duration="1000" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  el.currentTime = 250;
  expect(el.currentTime).to.equal(250);
});

it('play-on-visible: observes the slotted target and starts playback once it intersects, then auto-disconnects (repeat defaults to false)', async () => {
  const io = stubIntersectionObserver();
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    expect(el.play).to.be.false;
    const target = el.querySelector('p')!;
    expect(io.observedTargets).to.include(target);

    const latest = io.instances[io.instances.length - 1];
    latest.callback([{ isIntersecting: true } as unknown as IntersectionObserverEntry], latest as unknown as IntersectionObserver);
    await el.updateComplete;

    expect(el.play).to.be.true;
    expect(latest.disconnected, 'a single-shot observer disconnects itself after the first intersect').to.be.true;
  } finally {
    io.restore();
  }
});

it('play-on-visible: a notification batch with no entries is a defensive no-op', async () => {
  const io = stubIntersectionObserver();
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    const latest = io.instances[io.instances.length - 1];
    latest.callback([], latest as unknown as IntersectionObserver);
    await el.updateComplete;

    expect(el.play).to.be.false;
  } finally {
    io.restore();
  }
});

it('play-on-visible-repeat: keeps observing and toggles `play` on subsequent enter/leave notifications', async () => {
  const io = stubIntersectionObserver();
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible play-on-visible-repeat iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    const latest = io.instances[io.instances.length - 1];
    latest.callback([{ isIntersecting: true } as unknown as IntersectionObserverEntry], latest as unknown as IntersectionObserver);
    await el.updateComplete;
    expect(el.play).to.be.true;
    expect(latest.disconnected, 'a repeating observer stays connected after intersecting').to.be.false;

    latest.callback([{ isIntersecting: false } as unknown as IntersectionObserverEntry], latest as unknown as IntersectionObserver);
    await el.updateComplete;
    expect(el.play).to.be.false;
  } finally {
    io.restore();
  }
});

it('play-on-visible: passes a custom Element `root` through, and re-observes (disconnecting the previous observer) when rootMargin changes while connected', async () => {
  const io = stubIntersectionObserver();
  const rootEl = document.createElement('div');
  document.body.append(rootEl);
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible .root=${rootEl} iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    const first = io.instances[io.instances.length - 1];
    expect(first.options?.root).to.equal(rootEl);

    el.rootMargin = '20px';
    await el.updateComplete;

    expect(first.disconnected, 'the previous observer should be torn down before re-observing').to.be.true;
    const second = io.instances[io.instances.length - 1];
    expect(second).to.not.equal(first);
    expect(second.options?.rootMargin).to.equal('20px');

    el.remove();
    expect(second.disconnected, 'disconnectedCallback should tear down the still-active observer').to.be.true;
  } finally {
    io.restore();
    rootEl.remove();
  }
});
