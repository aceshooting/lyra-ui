import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './video.js';
import type { LyraVideo } from './video.class.js';
import { capture, center, changedPixels, loseContext, matches, nativeCanvas, redrawPanorama, nativePixels, nativeSample, seekNative, observeNativeDraws, requireWebgl2 } from '../../../../test/native-3d-ui.js';

const home = { yaw: 0, pitch: 0, fieldOfView: 75 };
const urls: string[] = [];
async function loaded(): Promise<{ el: LyraVideo; video: HTMLVideoElement }> {
  const response = await fetch(new URL('../media-card/fixtures/sample.mp4', import.meta.url));
  expect(response.ok).to.equal(true);
  const blob = new Blob([await response.arrayBuffer()], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob); urls.push(url);
  const el = await fixture<LyraVideo>(html`<lr-video style="inline-size:480px;block-size:320px" controls="full" .muted=${true} .volume=${0.4}></lr-video>`);
  const video = el.getVideoElement()!; el.src = url;
  await waitUntil(() => video.readyState >= 2 && video.videoWidth > 0, 'Native MP4 did not decode', { timeout: 15000 });
  expect(video.error === null).to.equal(true); expect(video.duration).to.equal(2);
  return { el, video };
}
async function ready(el: LyraVideo): Promise<HTMLCanvasElement> {
  await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"][data-ready]') !== null, 'Video panorama UI did not become ready', { timeout: 15000 });
  return nativeCanvas(el, 'panorama-engine');
}
function motionSample(earlier: Uint8ClampedArray, later: Uint8ClampedArray): { u: number; v: number } {
  let best = -1, largest = 0;
  for (let row = 2; row < 30; row++) for (let column = 1; column < 63; column++) {
    const offset = (row * 64 + column) * 4;
    const difference = Math.max(...[0, 1, 2].map(channel => Math.abs(earlier[offset + channel]! - later[offset + channel]!)));
    const flat = [earlier, later].every(image => [-64, -1, 1, 64].every(neighbor =>
      [0, 1, 2].every(channel => Math.abs(image[offset + channel]! - image[offset + neighbor * 4 + channel]!) < 35)));
    if (flat && difference > largest) { largest = difference; best = row * 64 + column; }
  }
  expect(largest > 100).to.equal(true); expect(best >= 0).to.equal(true);
  return { u: (best % 64 + 0.5) / 64, v: (Math.floor(best / 64) + 0.5) / 32 };
}

describe('lr-video actual native panorama companion integration', function () {
  this.timeout(40000);
  before(requireWebgl2);
  afterEach(() => { for (const url of urls.splice(0)) URL.revokeObjectURL(url); });

  it('N07 uploads discriminating paused seeks and preserves the native player and tracks across switches', async () => {
    const { el, video } = await loaded();
    const nativeVolume = video.volume; expect(nativeVolume).to.be.closeTo(0.4, 0.000001);
    const track = video.addTextTrack('captions', 'English', 'en'); track.mode = 'hidden';
    video.pause();
    // Choose a broad changing fixture patch before the actual engine comparisons.
    await seekNative(video, 0); const earlier = nativePixels(video);
    await seekNative(video, 1.4); const sample = motionSample(earlier, nativePixels(video));
    el.panoramaCamera = { ...home, yaw: (sample.u - 0.5) * Math.PI * 2, pitch: (0.5 - sample.v) * Math.PI };
    el.engine = 'webgl'; el.projection = 'equirectangular'; const canvas = await ready(el);
    expect(getComputedStyle(video).opacity).to.equal('0');
    const draws = observeNativeDraws(canvas, video);
    let expected: number[];
    try {
      await seekNative(video, 0);
      const initialExpected = nativeSample(video, sample.u, sample.v);
      await waitUntil(() => !!draws.latest && Math.abs(draws.latest.mediaTime) < 0.01 &&
        matches(center(canvas, draws.latest.pixels), initialExpected, 45),
      'Automatic paused panorama seek did not draw initial pixels', { timeout: 5000 });
      const initial = center(canvas, draws.latest!.pixels);
      const sequence = draws.latest!.sequence;
      await seekNative(video, 1.4);
      expected = nativeSample(video, sample.u, sample.v);
      await waitUntil(() => !!draws.latest && draws.latest.sequence > sequence &&
        Math.abs(draws.latest.mediaTime - 1.4) < 0.01 && matches(center(canvas, draws.latest.pixels), expected, 45),
      'Automatic paused panorama seek did not draw updated pixels', { timeout: 5000 });
      expect(matches(initial, expected, 45)).to.equal(false);
    } finally { draws.stop(); }
    expect(video.paused).to.equal(true); expect(Math.abs(video.currentTime - 1.4) < 0.01).to.equal(true);
    el.projection = 'flat'; await el.updateComplete;
    expect(el.getVideoElement() === video).to.equal(true); expect(video.textTracks[0] === track).to.equal(true);
    expect(track.mode).to.equal('hidden'); expect(video.volume).to.equal(nativeVolume);
    expect(video.paused).to.equal(true); expect(Math.abs(video.currentTime - 1.4) < 0.01).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('video').length).to.equal(1); expect(canvas.isConnected).to.equal(false);
    el.projection = 'equirectangular'; const resumed = await ready(el);
    const restored = center(resumed, await capture(el, resumed, () => redrawPanorama(el)));
    expect(matches(restored, expected, 45)).to.equal(true); expect(el.getVideoElement() === video).to.equal(true);
  });

  it('N08 presents successive native playback frames and restores its texture after actual context loss', async () => {
    const { el, video } = await loaded();
    el.panoramaCamera = { ...home, pitch: -Math.PI * 0.3 };
    el.engine = 'webgl'; el.projection = 'equirectangular'; const canvas = await ready(el);
    expect(getComputedStyle(video).opacity).to.equal('0');
    const draws = observeNativeDraws(canvas, video);
    try {
      await video.play();
      await waitUntil(() => !!draws.latest && draws.latest.mediaTime > 0.35,
        'Automatic panorama playback did not draw a frame', { timeout: 5000 });
      let previous = draws.latest!;
      let transitions = 0;
      const deadline = performance.now() + 3500;
      while (!video.ended && performance.now() < deadline) {
        // wait-reason: give the native renderer real frames to present before sampling its output
        await aTimeout(100);
        const current = draws.latest;
        if (current && current.sequence > previous.sequence && current.mediaTime > previous.mediaTime + 0.1 &&
            changedPixels(previous.pixels, current.pixels) > 100) {
          transitions++; previous = current;
        }
      }
      expect(transitions).to.be.at.least(2); expect(video.currentTime).to.be.greaterThan(1);
      draws.stop();
      // Context restoration is a separate explicit-redraw assertion after passive playback evidence.
      video.pause(); await seekNative(video, 1.4);
      // WebKit can still hand WebGL the previous decoded frame briefly after a paused seek, so redraw
      // until the panorama shows the frame the video element presents.
      let expected = nativeSample(video, 0.5, 0.8);
      await waitUntil(async () => {
        expected = nativeSample(video, 0.5, 0.8);
        return matches(center(canvas, await capture(el, canvas, () => redrawPanorama(el))), expected, 45);
      }, 'The paused seek frame did not reach the panorama texture', { timeout: 3000 });
      expect(expected.some(channel => channel > 100)).to.equal(true);
      const restore = await loseContext(el, canvas); await restore(); await ready(el);
      const after = center(canvas, await capture(el, canvas, () => redrawPanorama(el)));
      expect(matches(after, expected, 45)).to.equal(true);
      expect(el.getVideoElement() === video).to.equal(true); expect(video.paused).to.equal(true);
      expect(Math.abs(video.currentTime - 1.4) < 0.01).to.equal(true);
    } finally { draws.stop(); video.pause(); }
  });
});
