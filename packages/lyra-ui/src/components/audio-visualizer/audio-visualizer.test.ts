import { fixture, expect, html } from '@open-wc/testing';
import './audio-visualizer.js';
import type { LyraAudioVisualizer } from './audio-visualizer.js';

function ambientAmplitudes(el: LyraAudioVisualizer, nowMs: number, reduced: boolean): number[] {
  return (
    el as unknown as { ambientAmplitudes: (nowMs: number, reduced: boolean) => number[] }
  ).ambientAmplitudes(nowMs, reduced);
}

it('defaults to state=idle, variant=bars, bar-count=5, gain=1, level=null, stream=null', async () => {
  const el = (await fixture(html`<lyra-audio-visualizer></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
  expect(el.state).to.equal('idle');
  expect(el.variant).to.equal('bars');
  expect(el.barCount).to.equal(5);
  expect(el.gain).to.equal(1);
  expect(el.level).to.be.null;
  expect(el.stream).to.be.null;
});

it('renders an aria-hidden canvas inside a role="img" host with an auto-generated aria-label', async () => {
  const el = (await fixture(html`<lyra-audio-visualizer state="listening"></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('Voice activity: Listening');
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
  expect(canvas.getAttribute('aria-hidden')).to.equal('true');
});

it('updates the auto-generated aria-label as state changes', async () => {
  const el = (await fixture(html`<lyra-audio-visualizer></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
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
    html`<lyra-audio-visualizer role="presentation" aria-label="Custom"></lyra-audio-visualizer>`,
  )) as LyraAudioVisualizer;
  expect(el.getAttribute('role')).to.equal('presentation');
  expect(el.getAttribute('aria-label')).to.equal('Custom');

  const withLabelProp = (await fixture(
    html`<lyra-audio-visualizer label="On air"></lyra-audio-visualizer>`,
  )) as LyraAudioVisualizer;
  expect(withLabelProp.getAttribute('aria-label')).to.equal('On air');
});

it('clamps bar-count to [1, 64]', async () => {
  const tooLow = (await fixture(html`<lyra-audio-visualizer bar-count="0"></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
  expect((tooLow as unknown as { effectiveBarCount: number }).effectiveBarCount).to.equal(1);
  const tooHigh = (await fixture(
    html`<lyra-audio-visualizer bar-count="500"></lyra-audio-visualizer>`,
  )) as LyraAudioVisualizer;
  expect((tooHigh as unknown as { effectiveBarCount: number }).effectiveBarCount).to.equal(64);
  const fine = (await fixture(html`<lyra-audio-visualizer bar-count="12"></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
  expect((fine as unknown as { effectiveBarCount: number }).effectiveBarCount).to.equal(12);
});

describe('ambient (no stream, no level) amplitude patterns', () => {
  it('idle is a flat, quiet pattern', async () => {
    const el = (await fixture(html`<lyra-audio-visualizer state="idle"></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
    const amps = ambientAmplitudes(el, 0, false);
    expect(amps.every((a) => a > 0 && a < 0.2)).to.be.true;
  });

  it('thinking sweeps over time when motion is not reduced, but is a static mid-height pattern under prefers-reduced-motion', async () => {
    const el = (await fixture(html`<lyra-audio-visualizer state="thinking"></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
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
      html`<lyra-audio-visualizer level="0.5" gain="2" state="idle"></lyra-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    const amps = (el as unknown as { currentAmplitudes: (nowMs: number) => number[] }).currentAmplitudes(0);
    expect(amps.every((a) => a === 0.5)).to.be.true; // gain is applied at draw time, not baked into the amplitude array
  });
});

describe('reduced motion behaves at 320px', () => {
  it('renders without throwing in a 320px-wide container', async () => {
    const el = (await fixture(
      html`<lyra-audio-visualizer
        state="speaking"
        variant="waveform"
        style="inline-size: 320px"
      ></lyra-audio-visualizer>`,
    )) as LyraAudioVisualizer;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
  });
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-audio-visualizer state="listening"></lyra-audio-visualizer>`)) as LyraAudioVisualizer;
  await expect(el).to.be.accessible();
});

it('localizes the auto-generated aria-label via this.localize()', async () => {
  const el = (await fixture(html`
    <lyra-audio-visualizer
      state="speaking"
      .strings=${{ audioVisualizerLabel: 'Activité vocale : {state}', audioVisualizerSpeaking: 'Parle' }}
    ></lyra-audio-visualizer>
  `)) as LyraAudioVisualizer;
  expect(el.getAttribute('aria-label')).to.equal('Activité vocale : Parle');
});
