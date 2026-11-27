import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-video.js';
import type { LyraVideo } from '../../lr-video.js';

const clip = new URL('../media-card/fixtures/sample.mp4', import.meta.url).href;

function bounds(el: LyraVideo, part: string): DOMRect {
  return el.shadowRoot!.querySelector(`[part~="${part}"]`)!.getBoundingClientRect();
}

function expectRatio(rect: DOMRect, ratio: number): void {
  expect(rect.width).to.be.greaterThan(0);
  expect(rect.height).to.be.closeTo(rect.width / ratio, 1);
}

describe('lr-video source geometry', () => {
  it('keeps the fixed 16:9 default and author CSS ratio when media metadata changes', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video controls="none" style="width: 320px"></lr-video>`);
    expect(el.aspectRatio).to.equal('fixed');
    expect(el.fit).to.equal('default');
    expectRatio(bounds(el, 'video-wrapper'), 16 / 9);
    el.style.setProperty('--aspect-ratio', '4 / 3');
    const media = el.getVideoElement()!;
    Object.defineProperties(media, {
      videoWidth: { configurable: true, value: 180 },
      videoHeight: { configurable: true, value: 320 },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expectRatio(bounds(el, 'video-wrapper'), 4 / 3);
  });

  it('normalizes unrecognized sizing attributes and uses the authored fallback geometry', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video aspect-ratio="unknown" fit="unknown"
      controls="none" style="width: 320px; --aspect-ratio: 4 / 3"></lr-video>`);
    expect([el.aspectRatio, el.fit]).to.deep.equal(['fixed', 'default']);
    expectRatio(bounds(el, 'video-wrapper'), 4 / 3);
  });

  it('uses the author ratio until real metadata arrives and restores it when the source clears', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video controls="none" aspect-ratio="auto"
      style="width: 320px; --aspect-ratio: 1"></lr-video>`);
    expectRatio(bounds(el, 'video-wrapper'), 1);
    const video = el.getVideoElement()!;
    const metadata = oneEvent(video, 'loadedmetadata');
    el.src = clip;
    await metadata;
    expect(video.videoWidth).to.be.greaterThan(0);
    await el.updateComplete;
    expectRatio(bounds(el, 'video-wrapper'), video.videoWidth / video.videoHeight);
    el.src = '';
    await waitUntil(() => Math.abs(bounds(el, 'video-wrapper').height - 320) <= 1,
      'clearing the source restores the author ratio');
  });

  it('uses the portrait display dimensions of a landscape frame with rotation metadata', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video controls="none" aspect-ratio="auto" style="width: 180px"></lr-video>`);
    const media = el.getVideoElement()!;
    const metadata = oneEvent(media, 'loadedmetadata');
    // FFmpeg copied one 320 × 180 frame from media-card/fixtures/sample.mp4 and added a 90° display matrix.
    el.src = new URL('./fixtures/quarter-turn.mp4', import.meta.url).href;
    await metadata;
    await el.updateComplete;
    expect([media.videoWidth, media.videoHeight]).to.deep.equal([180, 320]);
    expectRatio(bounds(el, 'video-wrapper'), 9 / 16);
  });

  it('centers portrait and landscape media in a bounded stage when native display dimensions change', async () => {
    const stage = await fixture<HTMLElement>(html`<div style="width: 480px; height: 240px">
      <lr-video fit="contain" aspect-ratio="auto" controls="none"></lr-video>
    </div>`);
    const el = stage.querySelector<LyraVideo>('lr-video')!;
    const media = el.getVideoElement()!;
    for (const [width, height, event] of [[90, 160, 'loadedmetadata'], [300, 100, 'resize']] as const) {
      Object.defineProperties(media, {
        videoWidth: { configurable: true, value: width },
        videoHeight: { configurable: true, value: height },
      });
      media.dispatchEvent(new Event(event));
      await el.updateComplete;
      const frame = bounds(el, 'video-wrapper');
      const box = stage.getBoundingClientRect();
      expectRatio(frame, width / height);
      expect(frame.width).to.be.closeTo(Math.min(box.width, box.height * width / height), 1);
      expect(frame.left + frame.width / 2).to.be.closeTo(box.left + box.width / 2, 1);
      expect(frame.top + frame.height / 2).to.be.closeTo(box.top + box.height / 2, 1);
    }
  });

  it('allocates space for the full control bar below narrow contained media', async () => {
    const stage = await fixture<HTMLElement>(html`<div style="width: 320px; height: 220px">
      <lr-video fit="contain" controls="full" style="--aspect-ratio: 1"></lr-video>
    </div>`);
    const el = stage.querySelector<LyraVideo>('lr-video')!;
    const video = bounds(el, 'video');
    const controls = bounds(el, 'controls-overlay');
    expectRatio(video, 1);
    expect(controls.height).to.be.greaterThan(0);
    expect(controls.top).to.be.at.least(video.bottom - 1);
    expect(controls.bottom).to.be.at.most(stage.getBoundingClientRect().bottom + 1);
  });

  it('keeps contained media at full inline size above the control bar without a bounded block size', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video fit="contain" controls="full" style="width: 320px"></lr-video>`);
    const video = bounds(el, 'video');
    const controls = bounds(el, 'controls-overlay');
    expect(video.width).to.be.closeTo(320, 1);
    expectRatio(video, 16 / 9);
    expect(controls.top).to.be.at.least(video.bottom - 1);
    expect(el.getBoundingClientRect().bottom).to.be.closeTo(controls.bottom, 1);
  });
});

describe('lr-video same-task playback', () => {
  it('applies the new src before calling native play and preserves its rejection and promise identity', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video controls="full"></lr-video>`);
    const video = el.getVideoElement()!;
    const failure = new DOMException('Playback denied', 'NotAllowedError');
    const nativePromise = Promise.reject<void>(failure);
    const rejection = nativePromise.catch((error: unknown) => error);
    const sources: string[] = [];
    Object.defineProperty(video, 'play', { configurable: true, value: () => {
      sources.push(video.src);
      return nativePromise;
    } });
    el.src = clip;
    const result = el.play();
    expect(result === nativePromise).to.equal(true);
    expect(await rejection === failure).to.equal(true);
    await el.updateComplete;
    expect(sources).to.deep.equal([clip]);
  });

  it('reloads for a changed source child but not for a track-only attribute edit', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video muted>
      <source src=${clip} type="video/mp4"><track kind="captions" srclang="en" label="English">
    </lr-video>`);
    const media = el.getVideoElement()!;
    let loads = 0;
    Object.defineProperty(media, 'load', { configurable: true, value: () => { loads++; } });
    Object.defineProperty(media, 'play', { configurable: true, value: () => Promise.resolve() });
    el.querySelector('track')!.setAttribute('label', 'English (US)');
    await el.play();
    expect(loads).to.equal(0);
    el.querySelector('source')!.setAttribute('src', clip + '?next');
    await el.play();
    expect(loads).to.equal(1);
  });

  it('starts playback on the replacement clip and keeps playing after the pending update', async function () {
    this.timeout(15000);
    const el = await fixture<LyraVideo>(html`<lr-video muted controls="full" src=${clip}></lr-video>`);
    const media = el.getVideoElement()!;
    await waitUntil(() => media.readyState >= HTMLMediaElement.HAVE_METADATA,
      'the first clip loaded metadata', { timeout: 10000 });
    const next = clip + '?next';
    el.src = next;
    await el.play();
    await el.updateComplete;
    expect(media.currentSrc).to.equal(next);
    expect(media.paused).to.equal(false);
    expect(el.playing).to.equal(true);
    el.pause();
  });

  it('plays a connected video before its first render with the requested real source', async function () {
    this.timeout(15000);
    const parent = await fixture<HTMLElement>(html`<div></div>`);
    const el = document.createElement('lr-video') as LyraVideo;
    el.muted = true;
    parent.append(el);
    el.src = clip;
    await el.play();
    const media = el.getVideoElement();
    expect(media?.currentSrc).to.equal(clip);
    expect(media?.paused).to.equal(false);
    await waitUntil(() => el.playing, 'playing state follows native playback');
    el.pause();
  });

  it('toggles playback on the new source when the previous clip was playing', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video muted src=${clip}></lr-video>`);
    await el.play();
    const media = el.getVideoElement()!;
    expect(media.paused).to.equal(false);
    const next = clip + '?toggle';
    el.src = next;
    el.togglePlay();
    await waitUntil(() => media.currentSrc === next && !media.paused && el.playing,
      'toggle starts playback of the replacement clip');
    el.pause();
  });

  it('ignores a control play failure from the previous source after replacement', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video muted></lr-video>`);
    const media = el.getVideoElement()!;
    let rejectNative!: (reason: DOMException) => void;
    const pending = new Promise<void>((_resolve, reject) => { rejectNative = reject; });
    Object.defineProperty(media, 'play', { configurable: true, value: () => pending });
    let failures = 0;
    el.addEventListener('lr-render-error', () => { failures++; });
    el.src = clip;
    el.togglePlay();
    el.src = clip + '?replacement';
    await el.updateComplete;
    rejectNative(new DOMException('Superseded play request', 'NotAllowedError'));
    await pending.catch(() => undefined);
    await el.updateComplete;
    expect(failures).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  });

  for (const cancellation of ['pause', 'source replacement', 'disconnect'] as const) {
    it(`does not replay a stale request after ${cancellation}`, async () => {
      const el = await fixture<LyraVideo>(html`<lr-video muted></lr-video>`);
      const media = el.getVideoElement()!;
      const sources: string[] = [];
      let abortNative!: (reason: DOMException) => void;
      const nativeResult = new Promise<void>((_resolve, reject) => { abortNative = reject; });
      Object.defineProperty(media, 'play', { configurable: true, value: () => {
        sources.push(media.src);
        return nativeResult;
      } });
      el.src = clip;
      const result = el.play().catch((error: unknown) => error);
      if (cancellation === 'pause') el.pause();
      else if (cancellation === 'source replacement') el.src = clip + '?replacement';
      else el.remove();
      const error = new DOMException('Native playback interrupted', 'AbortError');
      abortNative(error);
      expect(await result === error).to.equal(true);
      await el.updateComplete;
      expect(sources).to.deep.equal([clip]);
      expect(el.playing).to.equal(false);
    });
  }
});
