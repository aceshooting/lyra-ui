import { fixture, expect, html, aTimeout } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './audio-visualizer.js';
import type { LyraAudioVisualizer } from './audio-visualizer.js';

function ambientAmplitudes(el: LyraAudioVisualizer, nowMs: number, reduced: boolean): number[] {
  return (
    el as unknown as { ambientAmplitudes: (nowMs: number, reduced: boolean) => number[] }
  ).ambientAmplitudes(nowMs, reduced);
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Waits until no frame has been scheduled for two consecutive frames (mirrors the `settle` helper
 *  used by the draw-loop-scheduling tests below), or gives up after `frames` frames. */
async function settleRaf(el: LyraAudioVisualizer, frames = 20): Promise<void> {
  const priv = el as unknown as { rafId?: number };
  for (let i = 0; i < frames; i++) {
    await waitFrame();
    if (priv.rafId === undefined) {
      await waitFrame();
      if (priv.rafId === undefined) return;
    }
  }
}

/** Forces `prefersReducedMotion()` (internal/motion.ts) to report `true` for the duration of the
 *  callback, using the same "replace window.matchMedia entirely" technique as motion.test.ts. */
async function withForcedReducedMotion(fn: () => Promise<void>): Promise<void> {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;
  try {
    await fn();
  } finally {
    window.matchMedia = original;
  }
}

it('defaults to state=idle, variant=bars, bar-count=5, gain=1, level=null, stream=null', async () => {
  const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  expect(el.state).to.equal('idle');
  expect(el.variant).to.equal('bars');
  expect(el.barCount).to.equal(5);
  expect(el.gain).to.equal(1);
  expect(el.level).to.be.null;
  expect(el.stream).to.be.null;
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
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
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

it('renders an aria-hidden canvas inside a role="img" host with an auto-generated aria-label', async () => {
  const el = (await fixture(html`<lr-audio-visualizer state="listening"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('Voice activity: Listening');
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
  expect(canvas.getAttribute('aria-hidden')).to.equal('true');
});

it('updates the auto-generated aria-label as state changes', async () => {
  const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  expect(el.getAttribute('aria-label')).to.equal('Voice activity: Idle');
  el.state = 'thinking';
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Voice activity: Thinking');
  el.state = 'speaking';
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Voice activity: Speaking');
});

it('lets an author-supplied role/aria-label win, and lets the label prop override the auto-generated one', async () => {
  const el = (await fixture(
    html`<lr-audio-visualizer role="presentation" aria-label="Custom"></lr-audio-visualizer>`,
  )) as LyraAudioVisualizer;
  expect(el.getAttribute('role')).to.equal('presentation');
  expect(el.getAttribute('aria-label')).to.equal('Custom');

  const withLabelProp = (await fixture(
    html`<lr-audio-visualizer label="On air"></lr-audio-visualizer>`,
  )) as LyraAudioVisualizer;
  expect(withLabelProp.getAttribute('aria-label')).to.equal('On air');
});

it('preserves a role supplied after mount across later reactive updates', async () => {
  const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  expect(el.getAttribute('role')).to.equal('img');

  el.setAttribute('role', 'presentation');
  el.state = 'thinking';
  await el.updateComplete;

  expect(el.getAttribute('role')).to.equal('presentation');
});

it('clamps bar-count to [1, 64]', async () => {
  const tooLow = (await fixture(html`<lr-audio-visualizer bar-count="0"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  expect((tooLow as unknown as { effectiveBarCount: number }).effectiveBarCount).to.equal(1);
  const tooHigh = (await fixture(
    html`<lr-audio-visualizer bar-count="500"></lr-audio-visualizer>`,
  )) as LyraAudioVisualizer;
  expect((tooHigh as unknown as { effectiveBarCount: number }).effectiveBarCount).to.equal(64);
  const fine = (await fixture(html`<lr-audio-visualizer bar-count="12"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  expect((fine as unknown as { effectiveBarCount: number }).effectiveBarCount).to.equal(12);
});

describe('ambient (no stream, no level) amplitude patterns', () => {
  it('idle is a flat, quiet pattern', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const amps = ambientAmplitudes(el, 0, false);
    expect(amps.every((a) => a > 0 && a < 0.2)).to.be.true;
  });

  it('thinking sweeps over time when motion is not reduced, but is a static mid-height pattern under prefers-reduced-motion', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="thinking"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const a1 = ambientAmplitudes(el, 0, false);
    const a2 = ambientAmplitudes(el, 400, false);
    expect(a1).to.not.deep.equal(a2); // the sweep moved

    const r1 = ambientAmplitudes(el, 0, true);
    const r2 = ambientAmplitudes(el, 400, true);
    expect(r1).to.deep.equal(r2); // static under reduced motion
    expect(new Set(r1).size).to.equal(1); // uniform mid-height, no sweep shape at all
  });
});

describe('level-driven amplitude', () => {
  it('a numeric level produces a uniform amplitude array scaled by gain, independent of state', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer level="0.5" gain="2" state="idle"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const amps = (el as unknown as { currentAmplitudes: (nowMs: number) => number[] }).currentAmplitudes(0);
    expect(amps.every((a) => a === 0.5)).to.be.true; // gain is applied at draw time, not baked into the amplitude array
  });

  it('clamps an out-of-range level into [0, 1], and a NaN level still counts as level-driven but clamps to 0', async () => {
    const tooHigh = (await fixture(html`<lr-audio-visualizer level="5"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    expect((tooHigh as unknown as { effectiveLevel: number | null }).effectiveLevel).to.equal(1);

    const negative = (await fixture(html`<lr-audio-visualizer level="-5"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    expect((negative as unknown as { effectiveLevel: number | null }).effectiveLevel).to.equal(0);

    const nan = (await fixture(html`<lr-audio-visualizer .level=${NaN}></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    // A non-null-but-NaN level (e.g. an unparsable attribute) still means "an external level is
    // set" -- not the ambient/no-signal case -- so it should keep driving amplitude, just safely
    // clamped to 0 rather than poisoning the draw with NaN.
    expect((nan as unknown as { effectiveLevel: number | null }).effectiveLevel).to.equal(0);
    const amps = (nan as unknown as { currentAmplitudes: (nowMs: number) => number[] }).currentAmplitudes(0);
    expect(amps.every((a) => a === 0)).to.be.true;
  });

  it('falls back to gain=1 for a NaN gain instead of poisoning the drawn amplitude with NaN', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer level="0.5" .gain=${NaN}></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    expect((el as unknown as { effectiveGain: number }).effectiveGain).to.equal(1);
  });
});

describe('reduced motion behaves at 320px', () => {
  it('renders without throwing in a 320px-wide container', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer
        state="speaking"
        variant="waveform"
        style="inline-size: 320px"
      ></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
  });
});

describe('draw-loop scheduling', () => {
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const rafId = (el: LyraAudioVisualizer) => (el as unknown as { rafId?: number }).rafId;
  // Waits until no frame has been scheduled for two consecutive frames (the initial
  // ResizeObserver delivery legitimately schedules one extra draw after the first frame), or
  // gives up after `frames` frames so an always-running loop still fails the assertion below.
  const settle = async (el: LyraAudioVisualizer, frames = 20): Promise<void> => {
    for (let i = 0; i < frames; i++) {
      await nextFrame();
      if (rafId(el) === undefined) {
        await nextFrame();
        if (rafId(el) === undefined) return;
      }
    }
  };

  it('parks the animation loop after drawing the static idle pattern', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settle(el);
    expect(rafId(el)).to.be.undefined;
    // The single settled draw still sized the backing store.
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).to.be.greaterThan(0);
  });

  it('parks the animation loop after drawing a constant level', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer level="0.4" state="idle"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    await settle(el);
    expect(rafId(el)).to.be.undefined;
  });

  it('resumes scheduling on a property change and keeps animating time-driven ambient states', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settle(el);
    expect(rafId(el)).to.be.undefined;

    el.state = 'thinking';
    await el.updateComplete;
    expect(rafId(el)).to.not.be.undefined; // a frame is scheduled again
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await nextFrame();
      await nextFrame();
      expect(rafId(el)).to.not.be.undefined; // the ambient sweep keeps the loop alive
    }
  });

  it('skips scheduling a redraw while scrolled off-screen (visible=false), even on a property change that would otherwise re-enter the loop', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settle(el);
    expect(rafId(el)).to.be.undefined;

    (el as unknown as { visible: boolean }).visible = false;
    el.state = 'thinking';
    await el.updateComplete;
    expect(rafId(el)).to.be.undefined; // scheduleDraw() no-ops while off-screen
  });

  it('cancels an in-flight time-driven loop as soon as drawFrame observes visible=false, instead of re-arming itself', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settle(el);
    const priv = el as unknown as { visible: boolean; rafId?: number; drawFrame: (nowMs: number) => void };
    // Force the time-driven branch deterministically -- state='thinking' alone depends on the test
    // environment's prefers-reduced-motion, which this test isn't about.
    Object.defineProperty(el, 'isTimeDriven', { configurable: true, get: () => true });
    try {
      priv.drawFrame(0);
      expect(priv.rafId).to.not.be.undefined; // still looping while visible and time-driven

      cancelAnimationFrame(priv.rafId!);
      priv.rafId = undefined;
      priv.visible = false;
      priv.drawFrame(16);
      expect(priv.rafId).to.be.undefined; // stops re-arming once off-screen, despite isTimeDriven
    } finally {
      delete (el as unknown as { isTimeDriven?: unknown }).isTimeDriven;
    }
  });

  it('resumes the loop once scheduleDraw() is called again after visible flips back to true', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settle(el);
    const priv = el as unknown as { visible: boolean; rafId?: number; scheduleDraw: () => void };
    priv.visible = false;
    priv.scheduleDraw();
    expect(priv.rafId).to.be.undefined;

    priv.visible = true;
    priv.scheduleDraw();
    expect(priv.rafId).to.not.be.undefined;
  });
});

describe('AudioContext resume on stream attach', () => {
  // Real browsers can create a brand-new AudioContext already `suspended` under autoplay
  // policy, and nothing spontaneously transitions it to `running` without an explicit
  // `resume()` call. This fake starts `suspended` and only flips to `running` (and fires
  // `statechange`, mirroring the real API) when `resume()` is actually called, so it catches a
  // regression where `resume()` is only invoked on a reused context, never a freshly-created one.
  class FakeAudioContext extends EventTarget {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    resumeCalls = 0;
    createMediaStreamSource(_stream: unknown): { connect: () => void; disconnect: () => void } {
      return { connect: () => {}, disconnect: () => {} };
    }
    createAnalyser(): { fftSize: number; frequencyBinCount: number; getByteTimeDomainData: () => void } {
      return { fftSize: 256, frequencyBinCount: 128, getByteTimeDomainData: () => {} };
    }
    resume(): Promise<void> {
      this.resumeCalls++;
      this.state = 'running';
      this.dispatchEvent(new Event('statechange'));
      return Promise.resolve();
    }
    suspend(): Promise<void> {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  it('resumes a freshly-created AudioContext when a stream is first attached, not only a reused one', async () => {
    const original = window.AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    try {
      const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      const ctx = (el as unknown as { audioCtx?: FakeAudioContext }).audioCtx;
      expect(ctx).to.exist;
      expect(ctx!.resumeCalls).to.be.greaterThan(0);
      expect(ctx!.state).to.equal('running');
      expect((el as unknown as { hasLiveSignal: boolean }).hasLiveSignal).to.be.true;
    } finally {
      (window as unknown as { AudioContext: unknown }).AudioContext = original;
    }
  });
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-audio-visualizer state="listening"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
  await expect(el).to.be.accessible();
});

it('localizes the auto-generated aria-label via this.localize()', async () => {
  const el = (await fixture(html`
    <lr-audio-visualizer
      state="speaking"
      .strings=${{ audioVisualizerLabel: 'Activité vocale : {state}', audioVisualizerSpeaking: 'Parle' }}
    ></lr-audio-visualizer>
  `)) as LyraAudioVisualizer;
  expect(el.getAttribute('aria-label')).to.equal('Activité vocale : Parle');
});

describe('media-query change handlers', () => {
  it('onDprChange rebuilds the DPR MediaQueryList and reschedules a draw', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settleRaf(el);
    const priv = el as unknown as { dprQuery?: MediaQueryList; rafId?: number };
    expect(priv.rafId).to.be.undefined;
    const before = priv.dprQuery;
    expect(before).to.exist;
    before!.dispatchEvent(new Event('change'));
    expect(priv.dprQuery).to.exist;
    expect(priv.dprQuery).to.not.equal(before); // watchDpr() rebuilt the MediaQueryList
    expect(priv.rafId).to.not.be.undefined; // scheduleDraw() re-entered the loop
  });

  it('onMotionPreferenceChange reschedules a draw when the reduced-motion preference flips', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settleRaf(el);
    const priv = el as unknown as { motionQuery?: MediaQueryList; rafId?: number };
    expect(priv.rafId).to.be.undefined;
    expect(priv.motionQuery).to.exist;
    priv.motionQuery!.dispatchEvent(new Event('change'));
    expect(priv.rafId).to.not.be.undefined;
  });

  it('refreshes the theme (clears cached colors) when an ancestor theme attribute mutates', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settleRaf(el);
    const priv = el as unknown as { resolvedColors?: unknown };
    priv.resolvedColors = { active: 'stale', quiet: 'stale' };
    el.setAttribute('data-theme', 'dark');
    await aTimeout(0); // let the ThemeWatcher's coalesced microtask run
    expect(priv.resolvedColors).to.be.undefined; // refreshTheme() reset the cache
  });
});

describe('refreshTheme() public API', () => {
  it('resets cached colors and reschedules a draw', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settleRaf(el);
    const priv = el as unknown as { resolvedColors?: unknown; rafId?: number };
    priv.resolvedColors = { active: 'stale', quiet: 'stale' };
    expect(priv.rafId).to.be.undefined;
    el.refreshTheme();
    expect(priv.resolvedColors).to.be.undefined;
    expect(priv.rafId).to.not.be.undefined;
  });
});

describe('theme-attribute coalescing (via the shared ThemeWatcher)', () => {
  it('coalesces a burst of watched-attribute writes into a single refreshTheme()', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    await settleRaf(el);
    let refreshes = 0;
    const realRefresh = (el as unknown as { refreshTheme: () => void }).refreshTheme.bind(el);
    (el as unknown as { refreshTheme: () => void }).refreshTheme = () => {
      refreshes++;
      realRefresh();
    };
    el.setAttribute('data-theme', 'a');
    el.setAttribute('data-color-scheme', 'b');
    el.setAttribute('class', 'c');
    await aTimeout(0);
    expect(refreshes).to.equal(1);
  });
});

// Theme-watching defensive branches (no defaultView, no MutationObserver) are covered by the
// shared controller's own suite in src/internal/theme-watcher.test.ts.

describe('AudioContext constructor fallback', () => {
  class FakeWebkitAudioContext extends EventTarget {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    createMediaStreamSource(_stream: unknown): { connect: () => void; disconnect: () => void } {
      return { connect: () => {}, disconnect: () => {} };
    }
    createAnalyser(): { fftSize: number; frequencyBinCount: number; getByteTimeDomainData: () => void } {
      return { fftSize: 256, frequencyBinCount: 128, getByteTimeDomainData: () => {} };
    }
    resume(): Promise<void> {
      this.state = 'running';
      this.dispatchEvent(new Event('statechange'));
      return Promise.resolve();
    }
    suspend(): Promise<void> {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  it('falls back to webkitAudioContext when window.AudioContext is unavailable', async () => {
    const originalAudioContext = window.AudioContext;
    const w = window as unknown as { AudioContext: unknown; webkitAudioContext?: unknown };
    w.AudioContext = undefined;
    w.webkitAudioContext = FakeWebkitAudioContext;
    try {
      const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      const ctx = (el as unknown as { audioCtx?: unknown }).audioCtx;
      expect(ctx).to.be.instanceOf(FakeWebkitAudioContext);
    } finally {
      w.AudioContext = originalAudioContext;
      delete w.webkitAudioContext;
    }
  });

  it('no-ops (leaves audioCtx unset) when neither AudioContext nor webkitAudioContext exist', async () => {
    const originalAudioContext = window.AudioContext;
    const w = window as unknown as { AudioContext: unknown; webkitAudioContext?: unknown };
    w.AudioContext = undefined;
    delete w.webkitAudioContext;
    try {
      const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      expect((el as unknown as { audioCtx?: unknown }).audioCtx).to.be.undefined;
    } finally {
      w.AudioContext = originalAudioContext;
    }
  });
});

describe('stream lifecycle: reattach and clear', () => {
  class TrackingFakeAudioContext extends EventTarget {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    disconnectCalls = 0;
    createMediaStreamSource(_stream: unknown): { connect: () => void; disconnect: () => void } {
      return {
        connect: () => {},
        disconnect: () => {
          this.disconnectCalls++;
        },
      };
    }
    createAnalyser(): { fftSize: number; frequencyBinCount: number; getByteTimeDomainData: () => void } {
      return { fftSize: 256, frequencyBinCount: 128, getByteTimeDomainData: () => {} };
    }
    resume(): Promise<void> {
      this.state = 'running';
      this.dispatchEvent(new Event('statechange'));
      return Promise.resolve();
    }
    suspend(): Promise<void> {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  it('disconnects the previous source on reattach, and disconnects + suspends on clear', async () => {
    const original = window.AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = TrackingFakeAudioContext;
    try {
      const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      const ctx = (el as unknown as { audioCtx?: TrackingFakeAudioContext }).audioCtx;
      expect(ctx).to.exist;
      expect(ctx!.disconnectCalls).to.equal(0); // first attach: nothing to disconnect yet

      // Reattach a new stream while one is already connected: disconnects the previous source.
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      expect(ctx!.disconnectCalls).to.equal(1);
      expect(ctx!.state).to.equal('running');

      // Clear the stream: disconnects the current source and suspends the still-live context.
      el.stream = null;
      await el.updateComplete;
      expect(ctx!.disconnectCalls).to.equal(2);
      expect(ctx!.state).to.equal('suspended');
      expect((el as unknown as { analyser?: unknown }).analyser).to.be.undefined;
      expect((el as unknown as { sourceNode?: unknown }).sourceNode).to.be.undefined;
    } finally {
      (window as unknown as { AudioContext: unknown }).AudioContext = original;
    }
  });
});

describe('live analyser draw loop', () => {
  class FakeRunningAudioContext extends EventTarget {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    createMediaStreamSource(_stream: unknown): { connect: () => void; disconnect: () => void } {
      return { connect: () => {}, disconnect: () => {} };
    }
    createAnalyser(): {
      fftSize: number;
      frequencyBinCount: number;
      getByteTimeDomainData: (arr: Uint8Array) => void;
    } {
      return {
        fftSize: 256,
        frequencyBinCount: 128,
        getByteTimeDomainData: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 256;
        },
      };
    }
    resume(): Promise<void> {
      this.state = 'running';
      this.dispatchEvent(new Event('statechange'));
      return Promise.resolve();
    }
    suspend(): Promise<void> {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  it('keeps the loop alive and draws bars from real analyser time-domain data while the AudioContext is running', async () => {
    const original = window.AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeRunningAudioContext;
    try {
      const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      await waitFrame();
      await waitFrame();
      const priv = el as unknown as { rafId?: number; isTimeDriven: boolean };
      expect(priv.isTimeDriven).to.be.true; // a live, running analyser is always time-driven
      expect(priv.rafId).to.not.be.undefined; // still animating
      const amps = (el as unknown as { currentAmplitudes: (nowMs: number) => number[] }).currentAmplitudes(0);
      expect(amps).to.have.length(5); // default bar-count
      expect(amps.some((a) => a > 0)).to.be.true;
    } finally {
      (window as unknown as { AudioContext: unknown }).AudioContext = original;
    }
  });

  it('draws waveform samples directly from analyser time-domain data when variant is waveform', async () => {
    const original = window.AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeRunningAudioContext;
    try {
      const el = (await fixture(
        html`<lr-audio-visualizer variant="waveform"></lr-audio-visualizer>`,
      )) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      const analyser = (el as unknown as { analyser?: { fftSize: number } }).analyser;
      expect(analyser?.fftSize).to.equal(2048); // waveform variant requests a finer FFT
      const amps = (el as unknown as { currentAmplitudes: (nowMs: number) => number[] }).currentAmplitudes(0);
      expect(amps).to.have.length(128); // frequencyBinCount from the fake analyser
      expect(amps.some((a) => a !== 0)).to.be.true;
    } finally {
      (window as unknown as { AudioContext: unknown }).AudioContext = original;
    }
  });
});

describe('reduced-motion ambient throttling in drawFrame', () => {
  it('throttles ambient (no-live-signal) redraws to the ~2Hz interval, then draws for real once it elapses', async () => {
    await withForcedReducedMotion(async () => {
      const el = (await fixture(html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
      const priv = el as unknown as {
        drawFrame: (nowMs: number) => void;
        lastAmbientDrawMs: number;
        rafId?: number;
      };
      // Drive drawFrame by hand with controlled timestamps so the 500ms throttle window is deterministic.
      if (priv.rafId !== undefined) cancelAnimationFrame(priv.rafId);
      priv.rafId = undefined;
      priv.lastAmbientDrawMs = 1000;

      priv.drawFrame(1200); // 200ms later: still inside the throttle window
      expect(priv.lastAmbientDrawMs).to.equal(1000); // no real draw happened
      expect(priv.rafId).to.not.be.undefined; // but another frame was requested

      cancelAnimationFrame(priv.rafId!);
      priv.rafId = undefined;
      priv.drawFrame(1600); // 600ms after the last real draw: interval elapsed, draws for real
      expect(priv.lastAmbientDrawMs).to.equal(1600);
    });
  });
});

describe('drawFrame guards', () => {
  it('is a no-op (and clears rafId) if the element is no longer connected when a stale frame fires', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const priv = el as unknown as { drawFrame: (nowMs: number) => void; rafId?: number };
    el.remove();
    expect(el.isConnected).to.be.false;
    priv.rafId = 12345;
    priv.drawFrame(0);
    expect(priv.rafId).to.be.undefined;
  });
});

describe('ambient amplitude branches not covered by idle/thinking tests', () => {
  it('listening/speaking is a fixed pulse under reduced motion and a time-varying sine otherwise', async () => {
    const el = (await fixture(html`<lr-audio-visualizer state="listening"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const reducedAmps = ambientAmplitudes(el, 250, true);
    expect(new Set(reducedAmps).size).to.equal(1);
    expect(reducedAmps[0]).to.equal(0.3);

    const a1 = ambientAmplitudes(el, 0, false);
    const a2 = ambientAmplitudes(el, 500, false);
    expect(a1).to.not.deep.equal(a2); // sine-driven, changes over time

    const speaking = (await fixture(html`<lr-audio-visualizer state="speaking"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    expect(ambientAmplitudes(speaking, 100, true)[0]).to.equal(0.3);
  });

  it('uses WAVEFORM_SAMPLES (64) instead of bar-count for the waveform variant', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer variant="waveform" bar-count="7"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const amps = ambientAmplitudes(el, 0, false);
    expect(amps).to.have.length(64);
  });

  it('the thinking sweep stays finite when bar-count=1 (n - 1 === 0 fallback)', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer state="thinking" bar-count="1"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const amps = ambientAmplitudes(el, 300, false);
    expect(amps).to.have.length(1);
    expect(Number.isFinite(amps[0])).to.be.true;
  });
});

describe('level-driven amplitude: waveform variant', () => {
  it('fills WAVEFORM_SAMPLES entries instead of bar-count when variant is waveform', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer variant="waveform" level="0.3"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const amps = (el as unknown as { currentAmplitudes: (nowMs: number) => number[] }).currentAmplitudes(0);
    expect(amps).to.have.length(64);
    expect(amps.every((a) => a === 0.3)).to.be.true;
  });
});

describe('resolveColors()', () => {
  it('picks up custom-property overrides instead of falling back to the hardcoded defaults', async () => {
    const el = (await fixture(html`
      <lr-audio-visualizer
        style="--lr-audio-visualizer-color: rgb(1, 2, 3); --lr-audio-visualizer-quiet-color: rgb(4, 5, 6);"
      ></lr-audio-visualizer>
    `)) as LyraAudioVisualizer;
    const colors = (
      el as unknown as { resolveColors: () => { active: string; quiet: string } }
    ).resolveColors();
    expect(colors.active).to.equal('rgb(1, 2, 3)');
    expect(colors.quiet).to.equal('rgb(4, 5, 6)');
  });

  it('falls back to the hardcoded defaults when the custom properties resolve empty', async () => {
    // The component's own :host styles always set --lr-audio-visualizer-color(/-quiet-color) via
    // var(--lr-color-brand) etc., so under normal token loading getPropertyValue() never returns
    // an empty string -- the `|| fallback` only fires if the whole custom-property chain resolves
    // to nothing. Stubbing getComputedStyle() is the only way to simulate that from a test.
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const original = window.getComputedStyle;
    window.getComputedStyle = (() => ({
      getPropertyValue: () => '',
    })) as unknown as typeof window.getComputedStyle;
    try {
      const colors = (
        el as unknown as { resolveColors: () => { active: string; quiet: string } }
      ).resolveColors();
      expect(colors.active).to.equal('#0969da');
      expect(colors.quiet).to.equal('#ddf4ff');
    } finally {
      window.getComputedStyle = original;
    }
  });
});

describe('waveform draw with a single sample (division-by-zero guard)', () => {
  class SingleSampleAudioContext extends EventTarget {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    createMediaStreamSource(_stream: unknown): { connect: () => void; disconnect: () => void } {
      return { connect: () => {}, disconnect: () => {} };
    }
    createAnalyser(): {
      fftSize: number;
      frequencyBinCount: number;
      getByteTimeDomainData: (arr: Uint8Array) => void;
    } {
      return {
        fftSize: 2048,
        frequencyBinCount: 1,
        getByteTimeDomainData: (arr: Uint8Array) => {
          arr[0] = 200;
        },
      };
    }
    resume(): Promise<void> {
      this.state = 'running';
      this.dispatchEvent(new Event('statechange'));
      return Promise.resolve();
    }
    suspend(): Promise<void> {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  it('does not divide by zero when the waveform has exactly one sample', async () => {
    const original = window.AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = SingleSampleAudioContext;
    try {
      const el = (await fixture(
        html`<lr-audio-visualizer variant="waveform"></lr-audio-visualizer>`,
      )) as LyraAudioVisualizer;
      el.stream = {} as unknown as MediaStream;
      await el.updateComplete;
      expect(() => (el as unknown as { draw: (nowMs: number) => void }).draw(0)).to.not.throw();
    } finally {
      (window as unknown as { AudioContext: unknown }).AudioContext = original;
    }
  });
});

describe('draw() defensive branches', () => {
  it('no-ops if the canvas is not yet in the render root (e.g. called before the first render)', () => {
    const el = document.createElement('lr-audio-visualizer') as LyraAudioVisualizer;
    expect(() => (el as unknown as { draw: (nowMs: number) => void }).draw(0)).to.not.throw();
  });

  it('no-ops if acquiring the 2D context fails', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    (canvas as unknown as { getContext: () => null }).getContext = () => null;
    expect(() => (el as unknown as { draw: (nowMs: number) => void }).draw(0)).to.not.throw();
  });

  it('falls back to a 48px height when the measured host size has zero height', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const priv = el as unknown as {
      hostSize?: { width: number; height: number };
      draw: (nowMs: number) => void;
    };
    priv.hostSize = { width: 100, height: 0 };
    expect(() => priv.draw(0)).to.not.throw();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    expect(canvas.height).to.equal(Math.floor(48 * dpr));
  });

  it('falls back to devicePixelRatio=1 when window.devicePixelRatio is unavailable', async () => {
    const el = (await fixture(html`<lr-audio-visualizer></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    const original = window.devicePixelRatio;
    (window as unknown as { devicePixelRatio: number }).devicePixelRatio = 0;
    try {
      const priv = el as unknown as {
        hostSize?: { width: number; height: number };
        draw: (nowMs: number) => void;
      };
      priv.hostSize = { width: 100, height: 50 };
      priv.draw(0);
      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.width).to.equal(100); // dpr fell back to 1, so the backing store matches CSS size
      expect(canvas.height).to.equal(50);
    } finally {
      (window as unknown as { devicePixelRatio: number }).devicePixelRatio = original;
    }
  });

  it('draws the waveform variant path (lineWidth/stroked path) without throwing', async () => {
    const el = (await fixture(html`<lr-audio-visualizer variant="waveform"></lr-audio-visualizer>`)) as LyraAudioVisualizer;
    expect(() => (el as unknown as { draw: (nowMs: number) => void }).draw(0)).to.not.throw();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).to.be.greaterThan(0);
  });

  it('fits all 64 supported bars inside a 320px drawing surface', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer bar-count="64" level="0.5"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const priv = el as unknown as {
      hostSize?: { width: number; height: number };
      draw: (nowMs: number) => void;
    };
    priv.hostSize = { width: 320, height: 48 };

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const originalFillRect = ctx.fillRect.bind(ctx);
    const rects: Array<{ x: number; width: number }> = [];
    ctx.fillRect = ((x: number, y: number, width: number, height: number) => {
      rects.push({ x, width });
      originalFillRect(x, y, width, height);
    }) as typeof ctx.fillRect;

    priv.draw(0);

    expect(rects).to.have.length(64);
    expect(Math.max(...rects.map((rect) => rect.x + rect.width))).to.be.at.most(320);
  });

  it('uses the active color while thinking', async () => {
    const el = (await fixture(
      html`<lr-audio-visualizer state="thinking" bar-count="1"></lr-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const priv = el as unknown as {
      hostSize?: { width: number; height: number };
      resolvedColors?: { active: string; quiet: string };
      draw: (nowMs: number) => void;
    };
    priv.hostSize = { width: 40, height: 48 };
    priv.resolvedColors = { active: 'rgb(1, 2, 3)', quiet: 'rgb(4, 5, 6)' };
    priv.draw(0);

    const ctx = (el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
    expect(ctx.fillStyle).to.equal('#010203');
  });
});
