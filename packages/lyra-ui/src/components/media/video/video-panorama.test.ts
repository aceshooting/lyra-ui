import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './video.js';
import type { LyraVideo } from './video.class.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { panoramaLoader, panoramaEnvironment } from '../image-viewer/image-viewer-panorama.js';

async function ready(el: LyraVideo): Promise<HTMLVideoElement> {
  const video = el.getVideoElement()!;
  el.src = new URL('../media-card/fixtures/sample.mp4', import.meta.url).href;
  await waitUntil(() => video.readyState >= 2 && video.videoWidth > 0, 'Native media must decode before panorama admission', { timeout: 15000 });
  expect(video.error === null).to.equal(true);
  video.pause();
  return video;
}

describe('lr-video panorama', () => {
  const available = panoramaEnvironment.available;
  let creates: number, disposed: number;
  let media: HTMLVideoElement | undefined;
  let host: Engine3dHost;
  beforeEach(() => {
    creates = disposed = 0; media = undefined;
    panoramaEnvironment.available = () => true;
    panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => {
      creates++;
      return { contract: 1, async mount(_container, callbacks) { host = callbacks; },
        setData(data) { media = (data as { source: { video: HTMLVideoElement } }).source.video; },
        setCamera() {}, setStyle() {}, setState() {}, resize() {}, dispose() { disposed++; } };
    } }));
  });
  afterEach(() => { panoramaEnvironment.available = available; panoramaLoader.override(undefined); });

  it('does not import an engine under default settings', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video style="inline-size:480px;block-size:320px"></lr-video>`);
    await ready(el); await el.updateComplete;
    expect(el.engine).to.equal('builtin'); expect(el.projection).to.equal('flat'); expect(creates).to.equal(0);
  });

  it('reuses the native player and preserves playback preferences and tracks across switches', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video style="inline-size:480px;block-size:320px" controls="full" .volume=${0.4}></lr-video>`);
    const video = await ready(el);
    const nativeVolume = video.volume; expect(nativeVolume).to.be.closeTo(0.4, 0.000001);
    const track = video.addTextTrack('captions', 'English', 'en'); track.mode = 'hidden';
    const sought = oneEvent(video, 'seeked'); el.currentTime = 0.7; await sought;
    expect(video.paused).to.equal(true);
    el.engine = 'webgl'; el.projection = 'equirectangular';
    await el.updateComplete;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama"]')!;
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama-engine"]')!;
    expect(surface.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(surface.getBoundingClientRect().height).to.be.closeTo(viewport.getBoundingClientRect().height, 1);
    await waitUntil(() => media === video);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true, 'media readiness and renderer readiness reach the DOM');
    expect(el.shadowRoot!.querySelectorAll('video').length).to.equal(1);
    expect(video.volume).to.equal(nativeVolume);
    el.src = el.src; await el.updateComplete;
    expect(disposed).to.equal(0); expect(Math.abs(video.currentTime - 0.7) < 0.01).to.equal(true);
    el.projection = 'flat'; await el.updateComplete;
    expect(el.getVideoElement() === video).to.equal(true); expect(video.textTracks[0] === track).to.equal(true);
    expect(track.mode).to.equal('hidden'); expect(video.volume).to.equal(nativeVolume); expect(Math.abs(video.currentTime - 0.7) < 0.01).to.equal(true); expect(disposed).to.equal(1);
  });

  it('restores context without replacing native video, and invalidates old media callbacks', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video style="inline-size:480px;block-size:320px" engine="webgl" projection="equirectangular" .hotspots=${[{ id: 'exit', yaw: 0, pitch: 0 }]}></lr-video>`);
    const video = await ready(el);
    await el.updateComplete;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama"]')!;
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama-engine"]')!;
    expect(surface.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(surface.getBoundingClientRect().height).to.be.closeTo(viewport.getBoundingClientRect().height, 1);
    await waitUntil(() => media === video);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true, 'media readiness and renderer readiness reach the DOM');
    const previous = host;
    const fallback = oneEvent(el, 'lr-engine-fallback'); host.lost('context-lost');
    expect((await fallback).detail.reason).to.equal('context-lost'); await el.updateComplete;
    host.restored!(); await el.updateComplete;
    expect(el.getVideoElement() === video).to.equal(true);
    let selected = 0; el.addEventListener('lr-panorama-hotspot-select', () => { selected++; });
    el.src = 'data:video/mp4;base64,AAAA'; await el.updateComplete;
    previous.pick(0, { shift: false, ctrl: false, double: false });
    expect(selected).to.equal(0);
  });

  it('keeps the admitted panorama renderer through transient native buffering', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video style="inline-size:480px;block-size:320px" engine="webgl" projection="equirectangular"></lr-video>`);
    expect(creates).to.equal(0);
    const video = await ready(el);
    await waitUntil(() => media === video && el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
    const admitted = host;
    const descriptor = Object.getOwnPropertyDescriptor(video, 'readyState');
    let readyState = 1;
    try {
      Object.defineProperty(video, 'readyState', { configurable: true, get: () => readyState });
      el.panoramaCamera = { ...el.panoramaCamera, yaw: 0.2 }; await el.updateComplete;
      expect(disposed, 'buffering must retain the admitted renderer').to.equal(0);
      expect(creates).to.equal(1); expect(host === admitted).to.equal(true);
      expect(el.getVideoElement() === video).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready')).to.equal(true);
      readyState = 4;
      el.panoramaCamera = { ...el.panoramaCamera, yaw: 0.4 }; await el.updateComplete;
      expect(disposed).to.equal(0); expect(creates).to.equal(1); expect(host === admitted).to.equal(true);
      readyState = 1;
      host.lost('context-lost'); await el.updateComplete;
      expect(disposed).to.equal(0); expect(host === admitted).to.equal(true);
      host.restored!(); await el.updateComplete;
      expect(disposed).to.equal(0); expect(creates).to.equal(1);
      video.dispatchEvent(new Event('emptied')); await el.updateComplete;
      expect(disposed).to.equal(1); expect(creates).to.equal(1);
      expect(el.getVideoElement() === video).to.equal(true);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === false);
      readyState = 4;
      video.dispatchEvent(new Event('loadeddata'));
      await waitUntil(() => creates === 2 && el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
      expect(host === admitted).to.equal(false); expect(el.getVideoElement() === video).to.equal(true);
      const parent = el.parentNode!;
      el.remove(); expect(disposed).to.equal(2);
      readyState = 1;
      parent.appendChild(el); await el.updateComplete;
      expect(creates, 'reconnection must wait for a decoded frame').to.equal(2);
      readyState = 4;
      el.panoramaCamera = { ...el.panoramaCamera, yaw: 0.6 };
      await waitUntil(() => creates === 3 && el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
      expect(el.getVideoElement() === video).to.equal(true);
    } finally {
      if (descriptor) Object.defineProperty(video, 'readyState', descriptor);
      else Reflect.deleteProperty(video, 'readyState');
    }
  });
});
