import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import { animations, getAnimationNames, getEasingNames, type LyraAnimation } from './animation.js';
import { setAnimation, setDefaultAnimation } from '../../../utilities/animation-registry.js';
import './animation.js';

/** Stubs `window.matchMedia('(prefers-reduced-motion: reduce)')` with a
 *  controllable fake `MediaQueryList` so reduced-motion arbitration is
 *  deterministic instead of depending on the ambient CI environment. Mirrors
 *  the identical helper in animated-image.test.ts. Restore via `.restore()`
 *  in a `finally` block. */
function stubReducedMotion(initialMatches: boolean, ownerWindow: Window = window) {
  const original = ownerWindow.matchMedia;
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

  ownerWindow.matchMedia = ((query: string) =>
    query === '(prefers-reduced-motion: reduce)' ? fakeList : original(query)) as typeof window.matchMedia;

  return {
    restore(): void {
      ownerWindow.matchMedia = original;
    },
    listenerCount(): number { return listeners.size; },
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
function stubIntersectionObserver(ownerWindow: Window = window) {
  const original = ownerWindow.IntersectionObserver;
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
  (ownerWindow as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  return {
    instances,
    observedTargets,
    restore(): void {
      (ownerWindow as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = original;
    },
  };
}

it('rebinds animation, motion, styles, and visibility to the adopted realm and ignores stale observers', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const parentMotion = stubReducedMotion(false);
  const frameMotion = stubReducedMotion(false, frameWindow);
  const parentIo = stubIntersectionObserver();
  const frameIo = stubIntersectionObserver(frameWindow);
  const originalFrameGetComputedStyle = frameWindow.getComputedStyle;
  let frameStyleReads = 0;
  frameWindow.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    frameStyleReads++;
    return originalFrameGetComputedStyle.call(frameWindow, element, pseudo);
  }) as typeof getComputedStyle;

  const parentRoot = document.createElement('div');
  const parentTarget = document.createElement('p');
  parentTarget.textContent = 'Parent target';
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'fade-in';
  el.iterations = 1;
  el.timingPreset = 'base';
  el.playOnVisible = true;
  el.root = parentRoot;
  el.append(parentTarget);
  parentRoot.append(el);
  document.body.append(parentRoot);

  try {
    await el.updateComplete;
    await aTimeout(0);
    expect(parentMotion.listenerCount()).to.equal(1);
    expect(parentIo.instances.length).to.be.greaterThan(0);
    expect(parentTarget.getAnimations().length).to.equal(1);
    const staleObserver = parentIo.instances.at(-1)!;

    frameDocument.adoptNode(el);
    const adoptedRoot = frameDocument.adoptNode(document.createElement('div'));
    el.root = adoptedRoot;
    adoptedRoot.append(el);
    frameDocument.body.append(adoptedRoot);
    await el.updateComplete;
    await aTimeout(0);

    expect(parentMotion.listenerCount()).to.equal(0);
    expect(frameMotion.listenerCount()).to.equal(1);
    expect(staleObserver.disconnected).to.be.true;
    expect(frameStyleReads).to.be.greaterThan(0);
    expect(frameIo.instances.length).to.be.greaterThan(0);
    expect(frameIo.observedTargets.length).to.be.greaterThan(0);
    expect(frameIo.observedTargets.at(-1)?.ownerDocument === frameDocument).to.be.true;
    expect(frameIo.instances.at(-1)?.options?.root === adoptedRoot).to.be.true;
    expect(parentTarget.ownerDocument === frameDocument).to.be.true;
    expect(parentTarget.getAnimations().length).to.equal(1);

    const adoptedObserver = frameIo.instances.at(-1)!;
    const frameRoot = frameDocument.createElement('div');
    const frameTarget = frameDocument.createElement('p');
    frameTarget.textContent = 'Frame target';
    el.replaceChildren(frameTarget);
    el.root = frameRoot;
    frameRoot.append(el);
    frameDocument.body.append(frameRoot);
    await el.updateComplete;
    await aTimeout(0);

    expect(adoptedObserver.disconnected).to.be.true;
    expect(parentTarget.getAnimations().length).to.equal(0);
    expect(frameIo.observedTargets.at(-1)?.ownerDocument === frameDocument).to.be.true;
    expect(frameIo.instances.at(-1)?.options?.root === frameRoot).to.be.true;
    expect(frameTarget.getAnimations().length).to.equal(1);

    staleObserver.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      staleObserver as unknown as IntersectionObserver,
    );
    await el.updateComplete;
    expect(el.play).to.be.false;

    const frameObserver = frameIo.instances.at(-1)!;
    el.remove();
    expect(frameObserver.disconnected).to.be.true;
    expect(frameMotion.listenerCount()).to.equal(0);
    expect(frameTarget.getAnimations().length).to.equal(0);
  } finally {
    el.remove();
    parentRoot.remove();
    frameWindow.getComputedStyle = originalFrameGetComputedStyle;
    parentMotion.restore();
    frameMotion.restore();
    parentIo.restore();
    frameIo.restore();
    frame.remove();
  }
});

// adoptedCallback()'s own comment explains this is a defensive boundary: real DOM adoption
// (document.adoptNode(), exercised by the sibling test above) always disconnects an element
// before adoptedCallback fires, so `this.isConnected` is false and only the early-return path
// (lines up to the guard) ever runs there. adoptedCallback() is not TS-private, so this test calls
// it directly while the element remains connected throughout, simulating the "unusual adoption
// path" the guard defends against, to exercise the rebind-and-rebuild path past the guard.
it('adoptedCallback() rebinds motion preference and rebuilds the animation when invoked directly while still connected', async () => {
  const motion = stubReducedMotion(false);
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;
    const target = el.querySelector('p')!;
    expect(target.getAnimations().length).to.equal(1);
    expect(motion.listenerCount()).to.equal(1);

    el.adoptedCallback();

    // Still connected throughout -- unlike real DOM adoption, no disconnectedCallback ran first.
    expect(el.isConnected).to.be.true;
    // Unbound then immediately rebound synchronously inside adoptedCallback: net listener count
    // is unchanged, which would not hold if the rebind (past the `!this.isConnected` guard) had
    // been skipped.
    expect(motion.listenerCount()).to.equal(1);

    await el.updateComplete;
    await aTimeout(0);
    // The animation was torn down by destroyAnimation() at the top of adoptedCallback and rebuilt
    // by the scheduleAfterUpdate() callback queued past the guard.
    expect(target.getAnimations().length).to.equal(1);
  } finally {
    motion.restore();
  }
});

it('is accessible with a slotted animation target', async () => {
  const el = await fixture(html`
      <lr-animation name="none" play iterations="1">
      <p>Animated content</p>
    </lr-animation>
  `);
  await expect(el).to.be.accessible();
});

// Regression test: non-finite WAAPI timing values must fail closed, while signed finite delays
// remain valid Web Animations values instead of being treated like timer durations.
it('preserves signed finite WAAPI delays while normalizing only invalid timing values', async () => {
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
  expect(timing.delay).to.equal(-50); // signed delay is valid WAAPI input
  expect(timing.endDelay).to.equal(0); // Infinity is not a valid endDelay
  expect(timing.iterationStart).to.equal(0); // -3 clamped to the non-negative floor
  expect(timing.iterations).to.equal(1); // NaN -> falls back to 1, not the Infinity default
});

it('does not impose the setTimeout ceiling on finite WAAPI durations or end delays', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" duration="3000000000" end-delay="-250" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const timing = el.querySelector('p')!.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(3_000_000_000);
  expect(timing.endDelay).to.equal(-250);
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

// Distinct from the sibling case above: here the token's number+unit+whitespace shape parses
// successfully (so the regex match succeeds and a finite duration is produced), but the trailing
// easing text is not a real CSS easing keyword/function -- exercising resolveTimingToken()'s
// post-match CSS.supports() validation rather than its regex-match guard.
it('falls back to the constructed default duration/easing when a well-formed token carries an easing keyword CSS does not support', async () => {
  const el = (await fixture(html`
    <lr-animation
      name="fade-in"
      timing-preset="fast"
      style="--lr-transition-fast: 200ms not-a-real-easing-keyword"
      iterations="1"
    >
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

it('owns a bounded readonly threshold snapshot and retains only finite values from 0 through 1', () => {
  const el = document.createElement('lr-animation') as LyraAnimation;
  const authored = [0.25, 0.75];
  el.threshold = authored;
  authored[0] = 1;
  authored.push(0.5);
  expect(el.threshold).to.deep.equal([0.25, 0.75]);
  expect(Object.isFrozen(el.threshold)).to.equal(true);

  const mixed = [0.5, Number.NaN, -1, 2, 0.25] as unknown[];
  Object.defineProperty(mixed, 0, {
    configurable: true,
    get(): never { throw new Error('hostile threshold entry'); },
  });
  el.threshold = mixed as readonly number[];
  expect(el.threshold).to.deep.equal([0.25]);

  el.threshold = Array.from({ length: 1_005 }, (_, index) => index / 1_005);
  expect((el.threshold as readonly number[]).length).to.equal(1_000);
  el.threshold = Number.POSITIVE_INFINITY;
  expect(el.threshold).to.equal(0);
});

it('falls back to safe IntersectionObserver options when rootMargin is invalid and normalizes thresholds', async () => {
  const io = stubIntersectionObserver();
  try {
    const el = document.createElement('lr-animation') as LyraAnimation;
    el.name = 'fade-in';
    el.playOnVisible = true;
    el.rootMargin = 'not-a-margin';
    el.threshold = [-1, 2];
    expect(el.threshold).to.equal(0);
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

it('fails open and plays immediately when the environment provides no IntersectionObserver support', async () => {
  const original = window.IntersectionObserver;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = undefined;
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    expect(el.play).to.be.true;
    expect((el as unknown as { visibilityObserver?: IntersectionObserver }).visibilityObserver).to.be.undefined;
  } finally {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = original;
  }
});

it('fails open and plays immediately when even the safe-defaults fallback IntersectionObserver construction throws', async () => {
  const original = window.IntersectionObserver;
  class AlwaysThrowingObserver {
    constructor() {
      throw new Error('constructor always fails, including with safe-default options');
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = AlwaysThrowingObserver;
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    expect(el.play).to.be.true;
    expect((el as unknown as { visibilityObserver?: IntersectionObserver }).visibilityObserver).to.be.undefined;
  } finally {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = original;
  }
});

it('fails open and plays immediately when the constructed IntersectionObserver throws from observe()', async () => {
  const original = window.IntersectionObserver;
  class ThrowsOnObserve {
    observe(): never {
      throw new Error('observe() rejects this target');
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ThrowsOnObserve;
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" play-on-visible iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    expect(el.play).to.be.true;
    expect((el as unknown as { visibilityObserver?: IntersectionObserver }).visibilityObserver).to.be.undefined;
  } finally {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = original;
  }
});

it('ignores a malformed `root` value instead of throwing (falls back to the default null root)', async () => {
  const io = stubIntersectionObserver();
  try {
    const el = document.createElement('lr-animation') as LyraAnimation;
    el.name = 'fade-in';
    el.playOnVisible = true;
    // Not a real Element owned by this document -- isElementOwnedBy() must reject it defensively
    // rather than pass it through to `new IntersectionObserver(callback, { root, ... })`.
    el.root = {} as unknown as Element;
    const target = document.createElement('p');
    target.textContent = 'content';
    el.append(target);
    try {
      document.body.append(el);
      await el.updateComplete;
      expect((io.instances.at(-1)?.options?.root) === (null)).to.equal(true);
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

// bindMotionPreference()'s `if (!owner || !query) return;` guard covers an environment with no
// `matchMedia` support: `owner?.matchMedia?.(...)` then evaluates to `undefined`, and the method
// must no-op rather than throw -- the animation itself still has to build normally since motion
// preference binding is a best-effort enhancement, not a precondition for playback.
it('bindMotionPreference() no-ops without throwing when matchMedia is unavailable in the environment', async () => {
  const original = window.matchMedia;
  (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    const target = el.querySelector('p')!;
    expect(target.getAnimations().length).to.equal(1);
  } finally {
    window.matchMedia = original;
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

// Lit still runs a pending update cycle for a property changed after disconnection (updates are
// not gated on document connection) -- so updated()'s direct, non-scheduled createAnimation() call
// for a rebuild-triggering property can run while `this.isConnected` is already false. Its own
// `if (!this.isConnected) return;` guard must no-op instead of recreating an Animation on a
// target the component has already torn down.
it('createAnimation() no-ops when a rebuild-triggering property changes after the element has been disconnected', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  const target = el.querySelector('p')!;
  expect(target.getAnimations().length).to.equal(1);

  el.remove(); // disconnectedCallback destroys the animation synchronously
  expect(target.getAnimations().length).to.equal(0);

  el.name = 'zoom-in'; // a rebuild key -- updated() still runs even while disconnected
  await el.updateComplete;
  expect(target.getAnimations().length).to.equal(0);
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

it('cancel() leaves the target reverted, not re-frozen on the first keyframe by the play-state sync', async () => {
  const el = (await fixture(html`
    <lr-animation name="fade-in" duration="2000" iterations="1">
      <p>content</p>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  const target = el.querySelector('p')!;
  el.start();
  await el.updateComplete;
  expect(target.getAnimations().length, 'the fixture must actually be animating').to.equal(1);

  const cancelEvent = oneEvent(el, 'lr-cancel');
  el.cancel();
  await cancelEvent;
  // The native `cancel` handler sets `play = false`, which schedules a Lit update whose
  // applyPlayState() used to pause() the now-idle Animation -- per the Web Animations spec that
  // un-cancels it back into 'paused' at time zero, re-applying the first keyframe (opacity: 0)
  // forever instead of reverting the target to its own CSS.
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  expect(target.getAnimations().length, 'a canceled animation must stay idle').to.equal(0);
  expect(getComputedStyle(target).opacity).to.equal('1');
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

it('ignores non-finite currentTime assignments instead of forwarding them into WAAPI', async () => {
  const el = (await fixture(html`
    <lr-animation .keyframes=${[{ opacity: 0 }, { opacity: 1 }]}>
      <div>Target</div>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  el.currentTime = 125;
  expect(el.currentTime).to.equal(125);

  expect(() => {
    el.currentTime = Number.NaN;
    el.currentTime = Number.POSITIVE_INFINITY;
    el.currentTime = Number.NEGATIVE_INFINITY;
  }).to.not.throw();
  expect(el.currentTime).to.equal(125);
});

it('resolves named presets through the public registry while retaining token timing by default', async () => {
  const cleanup = setDefaultAnimation('animation.fade-in', {
    keyframes: [{ opacity: 0.3 }, { opacity: 0.7 }],
  });
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" timing-preset="fast" iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;
    const native = el.querySelector('p')!.getAnimations()[0];
    const [from, to] = native.effect!.getKeyframes();
    expect(String(from.opacity)).to.equal('0.3');
    expect(String(to.opacity)).to.equal('0.7');
    expect(native.effect!.getComputedTiming().duration).to.equal(120);
  } finally {
    cleanup();
  }
});

it('publishes the complete mirrored animation/easing catalogs and resolves every animation name', async () => {
  const names = getAnimationNames();
  const easings = getEasingNames();
  expect(names.length).to.equal(98);
  expect(new Set(names).size).to.equal(names.length);
  expect(names).to.include('fadeIn');
  expect(names).to.include('jackInTheBox');
  expect(names).to.include('zoomOutUp');
  expect(easings.length).to.equal(29);
  expect(easings).to.include('easeInOutBack');
  expect(Object.keys(animations).filter((name) => name !== 'easings')).to.deep.equal(names);
  expect(animations.fadeIn.length).to.be.greaterThan(0);
  expect(animations.easings.easeInOutBack).to.match(/^cubic-bezier\(/);
  expect(Object.isFrozen(animations)).to.be.true;
  expect(Object.isFrozen(animations.fadeIn)).to.be.true;
  expect(Object.isFrozen(animations.fadeIn[0])).to.be.true;

  const el = (await fixture(html`
    <lr-animation duration="1" iterations="1"><span>target</span></lr-animation>
  `)) as LyraAnimation;
  const target = el.querySelector('span')!;
  for (const name of names) {
    el.name = name;
    await el.updateComplete;
    expect(target.getAnimations().length, name).to.equal(1);
  }
});

it('resolves mirrored named easings before validating raw CSS timing functions', async () => {
  const el = (await fixture(html`
    <lr-animation name="fadeIn" easing="easeInOutBack" duration="100" iterations="1">
      <span>target</span>
    </lr-animation>
  `)) as LyraAnimation;
  await el.updateComplete;
  const easing = el.querySelector('span')!.getAnimations()[0].effect!.getComputedTiming().easing;
  expect(easing).to.match(/^cubic-bezier\(/);
});

it('animates owner-realm SVG and MathML elements from the default slot', async () => {
  const svgEl = (await fixture(html`
    <lr-animation name="fadeIn" iterations="1"><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg></lr-animation>
  `)) as LyraAnimation;
  await svgEl.updateComplete;
  expect(svgEl.querySelector('svg')!.getAnimations().length).to.equal(1);

  const mathEl = (await fixture(html`
    <lr-animation name="fadeIn" iterations="1"><math><mi>x</mi></math></lr-animation>
  `)) as LyraAnimation;
  await mathEl.updateComplete;
  expect(mathEl.querySelector('math')!.getAnimations().length).to.equal(1);
});

it('keeps hostile direct keyframe records inert without rejecting updateComplete', async () => {
  const hostile = Object.defineProperty({}, 'opacity', {
    enumerable: true,
    get(): never {
      throw new Error('hostile keyframe getter');
    },
  });
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.keyframes = [hostile as Keyframe];
  el.append(document.createElement('span'));
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.querySelector('span')!.getAnimations().length).to.equal(1);
  } finally {
    el.remove();
  }
});

it('uses a weak per-instance preset override ahead of the global value and keeps it on reconnect', async () => {
  const globalCleanup = setDefaultAnimation('animation.zoom-in', {
    keyframes: [{ opacity: 0.1 }, { opacity: 0.2 }],
  });
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'zoom-in';
  el.iterations = 1;
  const target = document.createElement('p');
  target.textContent = 'content';
  el.append(target);
  const instanceCleanup = setAnimation(el, 'animation.zoom-in', {
    keyframes: [{ opacity: 0.8 }, { opacity: 0.9 }],
  });
  try {
    document.body.append(el);
    await el.updateComplete;
    expect(String(target.getAnimations()[0].effect!.getKeyframes()[0]?.opacity)).to.equal('0.8');

    el.remove();
    document.body.append(el);
    await el.updateComplete;
    expect(String(target.getAnimations()[0].effect!.getKeyframes()[0]?.opacity)).to.equal('0.8');

    instanceCleanup();
    el.duration = 321;
    await el.updateComplete;
    expect(String(target.getAnimations()[0].effect!.getKeyframes()[0]?.opacity)).to.equal('0.1');
  } finally {
    instanceCleanup();
    globalCleanup();
    el.remove();
  }
});

it('rebuilds a registry animation when inherited text direction changes', async () => {
  const wrapper = document.createElement('div');
  wrapper.dir = 'ltr';
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'slide-in-start';
  el.iterations = 1;
  const target = document.createElement('p');
  target.textContent = 'content';
  el.append(target);
  wrapper.append(el);
  const cleanup = setAnimation(el, 'animation.slide-in-start', {
    keyframes: [{ transform: 'translateX(-12px)' }, { transform: 'translateX(0)' }],
    rtlKeyframes: [{ transform: 'translateX(12px)' }, { transform: 'translateX(0)' }],
  });
  document.body.append(wrapper);
  try {
    await el.updateComplete;
    expect(String(target.getAnimations()[0].effect!.getKeyframes()[0]?.transform)).to.include('-12px');

    wrapper.dir = 'rtl';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await el.updateComplete;
    expect(String(target.getAnimations()[0].effect!.getKeyframes()[0]?.transform)).to.include('12px');
  } finally {
    cleanup();
    wrapper.remove();
  }
});

it('a null registry override disables visible motion but preserves start/finish lifecycle', async () => {
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'fade-in';
  el.play = true;
  el.iterations = 1;
  const target = document.createElement('p');
  target.textContent = 'content';
  el.append(target);
  const cleanup = setAnimation(el, 'animation.fade-in', null);
  try {
    const started = oneEvent(el, 'lr-start');
    const finished = oneEvent(el, 'lr-finish');
    document.body.append(el);
    await started;
    await finished;
    expect(target.getAnimations().every((item) => item.effect!.getComputedTiming().duration === 0)).to.be.true;
  } finally {
    cleanup();
    el.remove();
  }
});

it('does not let registry timing reintroduce motion under reduced motion', async () => {
  const motion = stubReducedMotion(true);
  const el = document.createElement('lr-animation') as LyraAnimation;
  el.name = 'fade-in';
  const target = document.createElement('p');
  target.textContent = 'content';
  el.append(target);
  const cleanup = setAnimation(el, 'animation.fade-in', {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    options: { delay: 80, duration: 800, endDelay: 40, iterations: 8 },
  });
  try {
    document.body.append(el);
    await el.updateComplete;
    // A zero-duration paused animation is omitted from Element#getAnimations() in every engine;
    // inspect the component-owned native animation directly to verify the resolved timing.
    const native = (el as unknown as { animation?: Animation }).animation;
    expect(native).to.exist;
    const timing = native!.effect!.getComputedTiming();
    expect(timing.delay).to.equal(0);
    expect(timing.duration).to.equal(0);
    expect(timing.endDelay).to.equal(0);
    expect(timing.iterations).to.equal(1);
  } finally {
    cleanup();
    el.remove();
    motion.restore();
  }
});

// The registry's `options` pass through to `target.animate()` unvalidated (see
// animation-registry.ts's getAnimation()); a malformed override (an invalid WAAPI `direction`
// here) makes the Web Animations API throw synchronously from createAnimation()'s first
// `target.animate(keyframes, options)` call. The catch must retry with the component's own
// already-sanitized `baseOptions` instead of letting a bad public registration crash the element.
it('falls back to the sanitized baseline timing options when a registry override makes target.animate() throw', async () => {
  const cleanup = setDefaultAnimation('animation.fade-in', {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    options: { direction: 'not-a-real-direction' as PlaybackDirection },
  });
  try {
    const el = (await fixture(html`
      <lr-animation name="fade-in" direction="reverse" iterations="1">
        <p>content</p>
      </lr-animation>
    `)) as LyraAnimation;
    await el.updateComplete;

    const target = el.querySelector('p')!;
    const animations = target.getAnimations();
    expect(animations.length).to.equal(1);
    const timing = animations[0].effect!.getComputedTiming();
    // baseOptions carries the component's own safeDirection ('reverse'), not the malformed
    // override's value -- proof the catch path's retry, not the first (throwing) attempt, won.
    expect(timing.direction).to.equal('reverse');
  } finally {
    cleanup();
  }
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
    expect((first.options?.root) === (rootEl)).to.equal(true);

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
