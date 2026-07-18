import { fixture, expect, html } from '@open-wc/testing';
import './audio-visualizer.js';
import type { LyraAudioVisualizer } from './audio-visualizer.js';

function ambientAmplitudes(el: LyraAudioVisualizer, nowMs: number, reduced: boolean): number[] {
  return (
    el as unknown as { ambientAmplitudes: (nowMs: number, reduced: boolean) => number[] }
  ).ambientAmplitudes(nowMs, reduced);
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
