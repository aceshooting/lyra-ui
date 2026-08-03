import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './video.js';
import type { LyraVideo } from './video.js';

const VIDEO_SRC = 'https://example.test/video.mp4';

function nativeVideo(el: LyraVideo): HTMLVideoElement {
  return el.getVideoElement()!;
}

function button(el: LyraVideo, name: string): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector(`[data-control="${name}"]`);
}

function restoreOwnProperty(target: object, name: PropertyKey, descriptor?: PropertyDescriptor): void {
  if (descriptor) Object.defineProperty(target, name, descriptor);
  else delete (target as Record<PropertyKey, unknown>)[name];
}

function stubPlayback(media: HTMLVideoElement, initialPaused = true) {
  let paused = initialPaused;
  let playCalls = 0;
  let pauseCalls = 0;
  let loadCalls = 0;
  const playResult = Promise.resolve();
  Object.defineProperty(media, 'paused', { configurable: true, get: () => paused });
  Object.defineProperty(media, 'play', {
    configurable: true,
    value: () => {
      playCalls += 1;
      paused = false;
      return playResult;
    },
  });
  Object.defineProperty(media, 'pause', {
    configurable: true,
    value: () => {
      pauseCalls += 1;
      paused = true;
    },
  });
  Object.defineProperty(media, 'load', {
    configurable: true,
    value: () => {
      loadCalls += 1;
    },
  });
  return {
    playResult,
    get playCalls() { return playCalls; },
    get pauseCalls() { return pauseCalls; },
    get loadCalls() { return loadCalls; },
    set paused(value: boolean) { paused = value; },
  };
}

describe('lr-video public contract', () => {
  it('exposes the documented defaults and always opts into inline playback', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
    const media = nativeVideo(el);
    expect(el.autoplay).to.be.false;
    expect(el.autoplayMuted).to.be.false;
    expect(el.autoplayOnVisible).to.be.false;
    expect(el.controls).to.equal('standard');
    expect(el.currentTime).to.equal(0);
    expect(el.duration).to.equal(0);
    expect(el.iconLibrary).to.equal('system');
    expect(el.loop).to.be.false;
    expect(el.muted).to.be.false;
    expect(el.playing).to.be.false;
    expect(el.poster).to.equal('');
    expect(el.preload).to.equal('metadata');
    expect(el.src).to.equal('');
    expect(el.thumbnails).to.equal('');
    expect(el.title).to.equal('');
    expect(el.volume).to.equal(1);
    expect(media.hasAttribute('playsinline')).to.be.true;
    expect(media.controls).to.be.false;
    expect(media.preload).to.equal('metadata');
    expect(media.getAttribute('aria-label')).to.equal('Video player');
  });

  it('returns a fresh, synchronous, exact state snapshot and the native video', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
    const media = nativeVideo(el);
    Object.defineProperties(media, {
      paused: { configurable: true, get: () => false },
      currentTime: { configurable: true, value: 7, writable: true },
      duration: { configurable: true, value: 42 },
      volume: { configurable: true, value: 0.4, writable: true },
      muted: { configurable: true, value: true, writable: true },
      playbackRate: { configurable: true, value: 1.5, writable: true },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    const first = el.getState();
    const second = el.getState();
    expect(Object.keys(first)).to.deep.equal([
      'playing',
      'currentTime',
      'duration',
      'volume',
      'muted',
      'playbackRate',
    ]);
    expect(first).to.deep.equal({
      playing: true,
      currentTime: 7,
      duration: 42,
      volume: 0.4,
      muted: true,
      playbackRate: 1.5,
    });
    expect(first === second).to.be.false;
    expect(el.getVideoElement() === media).to.be.true;
  });

  it('attaches an iframe-realm native video after adoption before its first render', async () => {
    const iframe = document.createElement('iframe');
    const loaded = new Promise<void>((resolve) =>
      iframe.addEventListener('load', () => resolve(), { once: true }),
    );
    document.body.append(iframe);
    await loaded;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const el = document.createElement('lr-video') as LyraVideo;

    try {
      frameDocument.adoptNode(el);
      const media = frameDocument.createElement('video');
      expect(media instanceof frameWindow.HTMLVideoElement).to.be.true;
      expect(el.hasUpdated, 'the host has not rendered before the ref is attached').to.be.false;
      (el as unknown as { mediaRef: (element?: Element) => void }).mediaRef(media);

      expect(el.getVideoElement() === media).to.be.true;
    } finally {
      (el as unknown as { mediaRef: (element?: Element) => void }).mediaRef(undefined);
      iframe.remove();
    }
  });

  it('matches the documented attribute mapping and reflection contract', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video currentTime="3" duration="12" controls="full"></lr-video>
    `);
    expect(el.currentTime).to.equal(3);
    expect(el.duration).to.equal(12);
    expect(el.getAttribute('controls')).to.equal('full');

    el.setAttribute('current-time', '5');
    await el.updateComplete;
    expect(el.currentTime).to.equal(5);
    el.currentTime = 7;
    await el.updateComplete;
    expect(el.getVideoElement().currentTime).to.equal(7);
    expect(el.getAttribute('currenttime'), 'the public attribute is not reflected from IDL writes').to.equal('3');

    el.muted = true;
    el.playing = true;
    await el.updateComplete;
    expect(el.hasAttribute('muted')).to.be.true;
    expect(el.hasAttribute('playing')).to.be.true;
    el.muted = false;
    el.playing = false;
    await el.updateComplete;
    expect(el.hasAttribute('muted')).to.be.false;
    expect(el.hasAttribute('playing')).to.be.false;
  });

  it('keeps consumer source/track nodes in light DOM and inserts only safe allowlisted clones', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video src=${VIDEO_SRC}>
        <source id="owned" src="https://example.test/alternate.webm" type="video/webm" data-secret="no">
        <source src="javascript:alert(1)">
        <track src="https://example.test/en.vtt" kind="captions" srclang="en" label="English" default data-secret="no">
      </lr-video>
    `);
    const media = nativeVideo(el);
    const lightSource = el.querySelector('#owned');
    const privateSource = media.querySelector('source');
    const privateTrack = media.querySelector('track');
    expect(el.querySelectorAll('source').length).to.equal(2);
    expect(lightSource?.parentElement === el).to.be.true;
    expect(privateSource?.getAttribute('src')).to.equal('https://example.test/alternate.webm');
    expect(privateSource?.hasAttribute('data-secret')).to.be.false;
    expect(media.querySelectorAll('source').length).to.equal(1);
    expect(privateTrack?.getAttribute('kind')).to.equal('captions');
    expect(privateTrack?.hasAttribute('data-secret')).to.be.false;
    expect(media.getAttribute('src')).to.equal(VIDEO_SRC);
  });

  it('re-clones changed declarative sources when the Lyra load extension is called', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video><source src="https://example.test/first.mp4" type="video/mp4"></lr-video>
    `);
    const source = el.querySelector('source')!;
    source.src = 'https://example.test/second.webm';
    source.type = 'video/webm';
    el.load();
    const clone = nativeVideo(el).querySelector('source');
    expect(clone?.getAttribute('src')).to.equal('https://example.test/second.webm');
    expect(clone?.getAttribute('type')).to.equal('video/webm');
  });

  it('rejects executable src and poster URLs before they reach native sinks', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video src="javascript:alert(1)" poster="javascript:alert(2)"></lr-video>
    `);
    expect(nativeVideo(el).hasAttribute('src')).to.be.false;
    expect(el.shadowRoot!.querySelector('img')).to.equal(null);
  });

  it('proxies playback methods, preserves the native play promise, and guards numeric inputs', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
    const media = nativeVideo(el);
    const stub = stubPlayback(media);
    Object.defineProperties(media, {
      duration: { configurable: true, value: 10 },
      currentTime: { configurable: true, value: 0, writable: true },
      volume: { configurable: true, value: 1, writable: true },
      muted: { configurable: true, value: false, writable: true },
      playbackRate: { configurable: true, value: 1, writable: true },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    expect(el.play() === stub.playResult).to.be.true;
    el.pause();
    el.load();
    expect(stub.playCalls).to.equal(1);
    expect(stub.pauseCalls).to.equal(2);
    expect(stub.loadCalls).to.equal(1);
    media.dispatchEvent(new Event('loadedmetadata'));
    el.seek(999);
    expect(media.currentTime).to.equal(10);
    el.seek(Number.NaN);
    expect(media.currentTime).to.equal(0);
    el.setVolume(0.25);
    expect(media.volume).to.equal(0.25);
    el.setVolume(Number.POSITIVE_INFINITY);
    expect(media.volume).to.equal(0.25);
    el.setPlaybackRate(2);
    expect(media.playbackRate).to.equal(2);
    el.setPlaybackRate(Number.NaN);
    expect(media.playbackRate).to.equal(1);
    el.toggleMute();
    expect(media.muted).to.be.true;
    stub.paused = true;
    el.togglePlay();
    expect(stub.playCalls).to.equal(2);
    stub.paused = false;
    el.togglePlay();
    expect(stub.pauseCalls).to.equal(3);
  });

  it('preserves the exact native autoplay/play rejection for callers', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video autoplay></lr-video>`);
    const media = nativeVideo(el);
    const failure = new DOMException('Autoplay was blocked', 'NotAllowedError');
    const nativePromise = Promise.reject(failure);
    Object.defineProperty(media, 'play', { configurable: true, value: () => nativePromise });
    const returned = el.play();
    const caught = returned.catch((error: unknown) => error);
    expect(returned === nativePromise).to.be.true;
    expect((await caught) === failure).to.equal(true);
  });

  it('maps autoplay-muted to native autoplay and muted state without changing the authored muted property', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video autoplay-muted></lr-video>`);
    const media = nativeVideo(el);
    expect(el.muted).to.be.false;
    expect(media.autoplay).to.be.true;
    expect(media.muted).to.be.true;
    expect(el.getState().muted).to.be.true;
    el.toggleMute();
    expect(media.muted).to.be.false;
  });

  for (const type of ['ended', 'error', 'loadedmetadata', 'pause', 'play', 'timeupdate', 'volumechange']) {
    it(`relays ${type} once as a native non-crossing Event`, async () => {
      const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
      const received: Event[] = [];
      el.addEventListener(type, (event) => received.push(event));
      nativeVideo(el).dispatchEvent(new Event(type));
      expect(received.length).to.equal(1);
      expect(received[0] instanceof Event).to.be.true;
      expect(received[0].constructor === Event).to.be.true;
      expect(received[0].bubbles).to.be.false;
      expect(received[0].composed).to.be.false;
      expect(received[0].cancelable).to.be.false;
    });
  }

  it('renders exact base/video-wrapper aliases and the documented public parts', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video src=${VIDEO_SRC} poster="https://example.test/poster.jpg" title="Demo"></lr-video>
    `);
    const wrapper = el.shadowRoot!.querySelector('[part~="base"]');
    expect(wrapper?.getAttribute('part')).to.equal('base video-wrapper');
    for (const part of [
      'video', 'poster-overlay', 'poster-play-button', 'controls', 'controls-overlay',
      'progress', 'timeline', 'timeline-indicator', 'timeline-thumb', 'timeline-track',
      'video-title-overlay',
    ]) {
      expect(el.shadowRoot!.querySelector(`[part~="${part}"]`) !== null, part).to.be.true;
    }
  });

  it('applies all three exact upstream CSS custom-property hooks to rendered ink', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video
        style="--controls-background: rgb(1, 2, 3); --controls-color: rgb(4, 5, 6); --poster-play-button-background: rgb(7, 8, 9)"
        poster="https://example.test/poster.jpg"
      ></lr-video>
    `);
    const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    const overlay = el.shadowRoot!.querySelector('[part="controls-overlay"]') as HTMLElement;
    const posterButton = el.shadowRoot!.querySelector('[part="poster-play-button"]') as HTMLElement;
    expect(getComputedStyle(controls).color).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(overlay).backgroundImage).to.include('rgb(1, 2, 3)');
    expect(getComputedStyle(posterButton).backgroundColor).to.equal('rgb(7, 8, 9)');
  });

  it('renders every documented icon/control slot', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video poster="https://example.test/poster.jpg"></lr-video>
    `);
    const names = [...el.shadowRoot!.querySelectorAll('slot[name]')]
      .map((slot) => slot.getAttribute('name'))
      .filter((name): name is string => Boolean(name));
    expect(names).to.include.members([
      'controls-after-play', 'controls-start', 'exit-fullscreen-icon', 'fullscreen-icon',
      'mute-icon', 'pause-icon', 'play-icon', 'poster-icon', 'volume-icon',
    ]);
    expect(el.shadowRoot!.querySelector('slot:not([name])') !== null).to.be.true;
  });

  it('honors none/standard/full presets and feature-gates optional controls', async () => {
    const fsDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenEnabled');
    const pipDescriptor = Object.getOwnPropertyDescriptor(document, 'pictureInPictureEnabled');
    const requestFsDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
    const requestPipDescriptor = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'requestPictureInPicture');
    try {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
      Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: () => Promise.resolve() });
      Object.defineProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', { configurable: true, value: () => Promise.resolve() });
      const standard = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
      expect(button(standard, 'play') !== null).to.be.true;
      expect(button(standard, 'fullscreen') !== null).to.be.true;
      expect(standard.shadowRoot!.querySelector('[data-control="rate"]')).to.equal(null);
      expect(button(standard, 'picture-in-picture')).to.equal(null);
      const full = await fixture<LyraVideo>(html`<lr-video controls="full"></lr-video>`);
      expect(full.shadowRoot!.querySelector('[data-control="rate"]') !== null).to.be.true;
      expect(button(full, 'picture-in-picture') !== null).to.be.true;
      const none = await fixture<LyraVideo>(html`
        <lr-video controls="none" poster="https://example.test/poster.jpg"></lr-video>
      `);
      expect(none.shadowRoot!.querySelector('[part="controls-overlay"]')).to.equal(null);
      expect(none.shadowRoot!.querySelector('[part="poster-overlay"]') !== null).to.be.true;
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
      Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: false });
      const unsupported = await fixture<LyraVideo>(html`<lr-video controls="full"></lr-video>`);
      expect(button(unsupported, 'fullscreen')).to.equal(null);
      expect(button(unsupported, 'picture-in-picture')).to.equal(null);
    } finally {
      restoreOwnProperty(document, 'fullscreenEnabled', fsDescriptor);
      restoreOwnProperty(document, 'pictureInPictureEnabled', pipDescriptor);
      restoreOwnProperty(HTMLElement.prototype, 'requestFullscreen', requestFsDescriptor);
      restoreOwnProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', requestPipDescriptor);
    }
  });

  it('preserves fullscreen platform promises and rejects unsupported calls', async () => {
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenEnabled');
    const exitDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
    try {
      const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
      const wrapper = el.shadowRoot!.querySelector('[part~="video-wrapper"]') as HTMLElement;
      const requestPromise = Promise.resolve();
      const exitPromise = Promise.resolve();
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
      Object.defineProperty(wrapper, 'requestFullscreen', {
        configurable: true,
        value: () => requestPromise,
      });
      Object.defineProperty(document, 'exitFullscreen', {
        configurable: true,
        value: () => exitPromise,
      });
      expect(el.requestFullscreen() === requestPromise).to.be.true;
      expect(el.exitFullscreen() === exitPromise).to.be.true;

      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
      let rejection: unknown;
      try {
        await el.requestFullscreen();
      } catch (error) {
        rejection = error;
      }
      expect(rejection instanceof DOMException).to.be.true;
      expect((rejection as DOMException).name).to.equal('NotSupportedError');
    } finally {
      restoreOwnProperty(document, 'fullscreenEnabled', fullscreenDescriptor);
      restoreOwnProperty(document, 'exitFullscreen', exitDescriptor);
    }
  });

  it('uses the selected icon library for every fallback icon', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video icon-library="custom"></lr-video>`);
    const icons = [...el.shadowRoot!.querySelectorAll('lr-icon')];
    expect(icons.length).to.be.greaterThan(0);
    expect(icons.every((icon) => icon.getAttribute('library') === 'custom')).to.be.true;
  });

  it('formats elapsed and duration values with the effective locale', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video lang="ar-EG"></lr-video>`);
    const media = nativeVideo(el);
    Object.defineProperties(media, {
      duration: { configurable: true, value: 61 },
      currentTime: { configurable: true, value: 5, writable: true },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    media.dispatchEvent(new Event('timeupdate'));
    await el.updateComplete;
    const times = [...el.shadowRoot!.querySelectorAll('[data-time]')].map((node) => node.textContent);
    expect(times).to.deep.equal(['٠:٠٥', '١:٠١']);
  });

  it('emits timeupdate while the timeline is scrubbed', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
    const media = nativeVideo(el);
    Object.defineProperties(media, {
      duration: { configurable: true, value: 100 },
      currentTime: { configurable: true, value: 0, writable: true },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const progress = el.shadowRoot!.querySelector('[part="progress"]') as HTMLInputElement;
    progress.value = '25';
    const eventPromise = oneEvent(el, 'timeupdate');
    progress.dispatchEvent(new Event('input', { bubbles: true }));
    await eventPromise;
    expect(media.currentTime).to.equal(25);
    expect(el.currentTime).to.equal(25);
  });

  it('honors hidden and keeps component stacking isolated', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video hidden></lr-video>`);
    const wrapper = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(getComputedStyle(el).display).to.equal('none');
    expect(getComputedStyle(el).zIndex).to.equal('auto');
    expect(getComputedStyle(wrapper).isolation).to.equal('isolate');
  });

  it('loads bounded WebVTT thumbnails, resolves relative images, and previews the active cue', async () => {
    const originalFetch = window.fetch;
    let requested = '';
    window.fetch = (async (input: RequestInfo | URL) => {
      requested = String(input);
      return new Response(
        'WEBVTT\n\n00:00.000 --> 00:10.000\nthumbs.jpg#xywh=0,0,160,90\n',
        { headers: { 'content-type': 'text/vtt' } },
      );
    }) as typeof fetch;
    try {
      const el = await fixture<LyraVideo>(html`
        <lr-video thumbnails="https://example.test/cues/thumbs.vtt"></lr-video>
      `);
      await waitUntil(
        () => (el as unknown as { thumbnailCues: unknown[] }).thumbnailCues.length === 1,
        'thumbnail cues did not load',
      );
      await el.updateComplete;
      const media = nativeVideo(el);
      Object.defineProperties(media, {
        duration: { configurable: true, value: 20 },
        currentTime: { configurable: true, value: 0, writable: true },
      });
      media.dispatchEvent(new Event('loadedmetadata'));
      await el.updateComplete;
      const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
      Object.defineProperty(timeline, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 200, right: 200, top: 0, bottom: 20, height: 20, x: 0, y: 0, toJSON() {} }),
      });
      timeline.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, bubbles: true }));
      await el.updateComplete;
      const image = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
      expect(requested).to.equal('https://example.test/cues/thumbs.vtt');
      expect(image?.src).to.equal('https://example.test/cues/thumbs.jpg');
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('loads and cancels thumbnail requests through the adopted owner realm', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const base = frameDocument.createElement('base');
    base.href = 'https://video-frame.example/media/nested/';
    frameDocument.head.append(base);
    const ParentAbortController = window.AbortController;
    const OwnerAbortController = frameWindow.AbortController;
    const ParentURL = window.URL;
    const OwnerURL = frameWindow.URL;
    const originalParentFetch = window.fetch;
    const originalOwnerFetch = frameWindow.fetch;
    const parentRequests: string[] = [];
    const ownerRequests: string[] = [];
    const parentSignals: AbortSignal[] = [];
    const ownerSignals: AbortSignal[] = [];
    let parentUrlCreations = 0;
    let ownerUrlCreations = 0;

    class ParentTrackedAbortController extends ParentAbortController {
      constructor() {
        super();
        parentSignals.push(this.signal);
      }
    }
    class OwnerTrackedAbortController extends OwnerAbortController {
      constructor() {
        super();
        ownerSignals.push(this.signal);
      }
    }
    class ParentTrackedURL extends ParentURL {
      constructor(url: string | URL, base?: string | URL) {
        super(url, base);
        parentUrlCreations++;
      }
    }
    class OwnerTrackedURL extends OwnerURL {
      constructor(url: string | URL, base?: string | URL) {
        super(url, base);
        ownerUrlCreations++;
      }
    }
    const waitForAbort = (signal?: AbortSignal): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new frameWindow.DOMException('cancelled', 'AbortError')),
          { once: true },
        );
      });

    window.AbortController = ParentTrackedAbortController;
    frameWindow.AbortController = OwnerTrackedAbortController;
    window.URL = ParentTrackedURL;
    frameWindow.URL = OwnerTrackedURL;
    window.fetch = ((input: RequestInfo | URL) => {
      parentRequests.push(String(input));
      return Promise.resolve(new Response('WEBVTT'));
    }) as typeof fetch;
    frameWindow.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      ownerRequests.push(url);
      if (url.endsWith('/current.vtt')) {
        return Promise.resolve(
          new Response('WEBVTT\n\n00:00.000 --> 00:10.000\ncurrent.jpg\n'),
        );
      }
      return waitForAbort(init?.signal ?? undefined);
    }) as typeof fetch;

    let el: LyraVideo | undefined;
    try {
      el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;

      el.thumbnails = 'thumbs/old.vtt';
      await el.updateComplete;
      await waitUntil(() => ownerRequests.length === 1, 'the first owner request did not start');

      el.thumbnails = 'thumbs/current.vtt';
      await el.updateComplete;
      await waitUntil(
        () => (el as unknown as { thumbnailCues: unknown[] }).thumbnailCues.length === 1,
        'the replacement owner request did not load',
      );
      expect(ownerSignals[0]?.aborted, 'replacement must abort the retained owner signal').to.be.true;
      expect(ownerSignals[1]?.aborted).to.be.false;
      expect(parentSignals.length).to.equal(0);
      expect(parentRequests).to.deep.equal([]);
      expect(parentUrlCreations, 'thumbnail URLs must not use the ambient parser').to.equal(0);
      expect(ownerUrlCreations).to.be.greaterThan(2);
      expect(ownerRequests).to.deep.equal([
        'https://video-frame.example/media/nested/thumbs/old.vtt',
        'https://video-frame.example/media/nested/thumbs/current.vtt',
      ]);
      expect(
        (el as unknown as { thumbnailCues: Array<{ src: string }> }).thumbnailCues[0]?.src,
      ).to.equal('https://video-frame.example/media/nested/thumbs/current.jpg');

      el.thumbnails = 'thumbs/pending.vtt';
      await el.updateComplete;
      await waitUntil(() => ownerSignals.length === 3, 'the pending owner request did not start');
      el.remove();
      expect(ownerSignals[2]?.aborted, 'disconnect must abort the retained owner signal').to.be.true;
    } finally {
      el?.remove();
      window.AbortController = ParentAbortController;
      frameWindow.AbortController = OwnerAbortController;
      window.URL = ParentURL;
      frameWindow.URL = OwnerURL;
      window.fetch = originalParentFetch;
      frameWindow.fetch = originalOwnerFetch;
      iframe.remove();
    }
  });

  it('never fetches an unsafe thumbnail URL', async () => {
    const originalFetch = window.fetch;
    let calls = 0;
    window.fetch = (async () => {
      calls += 1;
      return new Response('WEBVTT');
    }) as typeof fetch;
    try {
      await fixture<LyraVideo>(html`<lr-video thumbnails="javascript:alert(1)"></lr-video>`);
      await aTimeout(0);
      expect(calls).to.equal(0);
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('fails closed before retaining a thumbnail file above the byte ceiling', async () => {
    const originalFetch = window.fetch;
    window.fetch = (async () => new Response('WEBVTT', {
      headers: { 'content-length': String(256 * 1024 + 1) },
    })) as typeof fetch;
    try {
      const el = await fixture<LyraVideo>(html`
        <lr-video thumbnails="https://example.test/oversized.vtt"></lr-video>
      `);
      await aTimeout(0);
      const internal = el as unknown as { thumbnailCues: unknown[] };
      expect(internal.thumbnailCues.length).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="thumbnail"]')).to.equal(null);
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('caps parsed thumbnail entries even when the VTT remains below its byte ceiling', async () => {
    const originalFetch = window.fetch;
    const cues = Array.from(
      { length: 2_005 },
      (_value, index) => `00:00.000 --> 00:01.000\n${index}.jpg`,
    ).join('\n\n');
    window.fetch = (async () => new Response(`WEBVTT\n\n${cues}`)) as typeof fetch;
    try {
      const el = await fixture<LyraVideo>(html`
        <lr-video thumbnails="https://example.test/capped.vtt"></lr-video>
      `);
      await aTimeout(0);
      const internal = el as unknown as { thumbnailCues: unknown[] };
      expect(internal.thumbnailCues.length).to.equal(2_000);
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('prevents a stale thumbnail response from overwriting a newer source', async () => {
    const originalFetch = window.fetch;
    let resolveOld!: (value: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
    window.fetch = ((input: RequestInfo | URL) => {
      if (String(input).includes('old.vtt')) return oldResponse;
      return Promise.resolve(new Response('WEBVTT\n\n00:00.000 --> 00:10.000\nnew.jpg\n'));
    }) as typeof fetch;
    try {
      const el = await fixture<LyraVideo>(html`<lr-video thumbnails="https://example.test/old.vtt"></lr-video>`);
      el.thumbnails = 'https://example.test/new.vtt';
      await el.updateComplete;
      await aTimeout(0);
      resolveOld(new Response('WEBVTT\n\n00:00.000 --> 00:10.000\nold.jpg\n'));
      await aTimeout(0);
      const internal = el as unknown as { thumbnailCues: Array<{ src: string }> };
      expect(internal.thumbnailCues.length).to.equal(1);
      expect(internal.thumbnailCues[0].src).to.equal('https://example.test/new.jpg');
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('shows the active native caption even when custom controls are disabled', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video controls="none">
        <track src="https://example.test/en.vtt" kind="captions" srclang="en" label="English" default>
      </lr-video>
    `);
    const media = nativeVideo(el);
    const track = new EventTarget() as EventTarget & {
      kind: string; label: string; language: string; mode: TextTrackMode; activeCues: Array<{ text: string }>;
    };
    Object.assign(track, {
      kind: 'captions', label: 'English', language: 'en', mode: 'showing', activeCues: [{ text: 'Hello world' }],
    });
    Object.defineProperty(media, 'textTracks', {
      configurable: true,
      value: { 0: track, length: 1 },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    track.dispatchEvent(new Event('cuechange'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="caption"]')?.textContent).to.equal('Hello world');
    expect(el.shadowRoot!.querySelector('[part="controls-overlay"]')).to.equal(null);
    await expect(el).to.be.accessible();
  });

  it('shows a caption selector only after selectable native tracks become available', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video></lr-video>`);
    const media = nativeVideo(el);
    const first = new EventTarget() as EventTarget & {
      kind: string; label: string; language: string; mode: TextTrackMode; activeCues: null;
    };
    const second = new EventTarget() as typeof first;
    Object.assign(first, {
      kind: 'captions', label: 'English', language: 'en', mode: 'showing', activeCues: null,
    });
    Object.assign(second, {
      kind: 'subtitles', label: 'Français', language: 'fr', mode: 'disabled', activeCues: null,
    });
    Object.defineProperty(media, 'textTracks', {
      configurable: true,
      value: { 0: first, 1: second, length: 2 },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[data-control="captions"]') as HTMLSelectElement;
    expect(select !== null).to.be.true;
    expect(select.options.length).to.equal(3);
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    expect(first.mode).to.equal('disabled');
    expect(second.mode).to.equal('showing');
  });

  it('pauses only visibility-owned playback and resumes it when visible again', async () => {
    const originalObserver = window.IntersectionObserver;
    let callback!: IntersectionObserverCallback;
    let observerCount = 0;
    let disconnectCount = 0;
    class FakeIntersectionObserver {
      constructor(next: IntersectionObserverCallback) {
        callback = next;
        observerCount += 1;
      }
      observe() {}
      unobserve() {}
      disconnect() { disconnectCount += 1; }
      takeRecords(): IntersectionObserverEntry[] { return []; }
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [0];
    }
    (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    try {
      const el = await fixture<LyraVideo>(html`<lr-video autoplay-on-visible></lr-video>`);
      const stub = stubPlayback(nativeVideo(el), false);
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(stub.playCalls).to.equal(0);
      callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(stub.pauseCalls).to.equal(1);
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      await aTimeout(0);
      expect(stub.playCalls).to.equal(1);
      const parent = el.parentElement!;
      nativeVideo(el).dispatchEvent(new Event('play'));
      await el.updateComplete;
      expect(el.playing).to.be.true;
      el.remove();
      await aTimeout(0);
      expect(el.playing).to.be.false;
      parent.append(el);
      await aTimeout(0);
      expect(observerCount).to.equal(2);
      expect(disconnectCount).to.be.greaterThan(0);
      let relays = 0;
      el.addEventListener('pause', () => { relays += 1; });
      nativeVideo(el).dispatchEvent(new Event('pause'));
      expect(relays).to.equal(1);
    } finally {
      (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = originalObserver;
    }
  });

  it('reconstructs its visibility observer in the adopted iframe realm', async () => {
    const iframe = document.createElement('iframe');
    const loaded = new Promise<void>((resolve) =>
      iframe.addEventListener('load', () => resolve(), { once: true }),
    );
    document.body.append(iframe);
    await loaded;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const OriginalMainObserver = window.IntersectionObserver;
    const OriginalFrameObserver = frameWindow.IntersectionObserver;
    let mainConstructions = 0;
    let frameConstructions = 0;
    let mainDisconnects = 0;
    let frameDisconnects = 0;
    let mainCallback: IntersectionObserverCallback | undefined;
    let frameCallback: IntersectionObserverCallback | undefined;
    class MainObserver {
      constructor(callback: IntersectionObserverCallback) {
        mainConstructions += 1;
        mainCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() { mainDisconnects += 1; }
      takeRecords(): IntersectionObserverEntry[] { return []; }
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [0];
    }
    class FrameObserver {
      constructor(callback: IntersectionObserverCallback) {
        frameConstructions += 1;
        frameCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() { frameDisconnects += 1; }
      takeRecords(): IntersectionObserverEntry[] { return []; }
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [0];
    }
    window.IntersectionObserver = MainObserver as unknown as typeof IntersectionObserver;
    frameWindow.IntersectionObserver = FrameObserver as unknown as typeof IntersectionObserver;
    let el: LyraVideo | undefined;

    try {
      el = await fixture<LyraVideo>(html`<lr-video autoplay-on-visible></lr-video>`);
      const playback = stubPlayback(nativeVideo(el), false);
      expect(mainConstructions).to.equal(1);
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      await el.updateComplete;

      expect(mainDisconnects, 'the source-realm observer is disconnected').to.be.greaterThan(0);
      expect(frameConstructions, 'the observer is rebuilt from the owner window').to.equal(1);
      const pauseCallsBeforeStaleDelivery = playback.pauseCalls;
      mainCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      expect(playback.pauseCalls, 'a queued source-realm delivery is ignored after adoption').to.equal(
        pauseCallsBeforeStaleDelivery,
      );
      playback.paused = false;
      frameCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      expect(playback.pauseCalls, 'the current owner-realm delivery still controls playback').to.equal(
        pauseCallsBeforeStaleDelivery + 1,
      );
      el.remove();
      expect(frameDisconnects, 'disconnect tears down the current-realm observer').to.equal(1);
    } finally {
      el?.remove();
      window.IntersectionObserver = OriginalMainObserver;
      frameWindow.IntersectionObserver = OriginalFrameObserver;
      iframe.remove();
    }
  });

  it('applies caller strings to the semantic controls and native video name', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video .strings=${{
        videoPlayerLabel: 'Lecteur vidéo',
        play: 'Lire',
        videoMute: 'Couper le son',
        videoVolume: 'Volume vidéo',
      }}></lr-video>
    `);
    expect(nativeVideo(el).getAttribute('aria-label')).to.equal('Lecteur vidéo');
    expect(button(el, 'play')?.getAttribute('aria-label')).to.equal('Lire');
    expect(button(el, 'mute')?.getAttribute('aria-label')).to.equal('Couper le son');
    expect(el.shadowRoot!.querySelector('[data-control="volume"]')?.getAttribute('aria-label')).to.equal('Volume vidéo');
  });

  it('gives a host aria-label precedence over title and localized video names', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video aria-label="Host-provided name" title="Visible title"></lr-video>
    `);
    expect(nativeVideo(el).getAttribute('aria-label')).to.equal('Host-provided name');
  });

  it('lays out at a 320px allocation and remains accessible when populated', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 320px">
        <lr-video src=${VIDEO_SRC} poster="https://example.test/poster.jpg" title="A very long localized video title"></lr-video>
      </div>
    `);
    const el = wrapper.querySelector('lr-video') as LyraVideo;
    const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    expect(getComputedStyle(controls).flexWrap).to.equal('wrap');
    await expect(el).to.be.accessible();
  });

  it('inherits RTL while keeping elapsed-time progression physical and uses no nonessential motion', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video dir="rtl"></lr-video>`);
    const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    const play = button(el, 'play')!;
    expect(getComputedStyle(controls).direction).to.equal('rtl');
    expect(getComputedStyle(timeline).direction).to.equal('ltr');
    expect(getComputedStyle(play).animationName).to.equal('none');
    expect(getComputedStyle(play).transitionDuration).to.equal('0s');
  });

  it('is accessible with controls disabled', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video controls="none" title="Captioned clip"></lr-video>
    `);
    await expect(el).to.be.accessible();
  });
});

describe('lr-video control surface', () => {
  it('applies the volume slider and playback-rate selector to the media element', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video controls="full"></lr-video>`);
    const media = nativeVideo(el);
    stubPlayback(media);
    Object.defineProperties(media, {
      duration: { configurable: true, value: 30 },
      currentTime: { configurable: true, value: 0, writable: true },
      volume: { configurable: true, value: 1, writable: true },
      muted: { configurable: true, value: false, writable: true },
      playbackRate: { configurable: true, value: 1, writable: true },
    });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;

    const volume = el.shadowRoot!.querySelector<HTMLInputElement>('[data-control="volume"]')!;
    volume.value = '0.4';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    expect(media.volume).to.equal(0.4);
    media.dispatchEvent(new Event('volumechange'));
    await el.updateComplete;
    expect(el.volume).to.equal(0.4);

    const rate = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-control="rate"]')!;
    rate.value = '2';
    rate.dispatchEvent(new Event('change', { bubbles: true }));
    expect(media.playbackRate).to.equal(2);
    media.dispatchEvent(new Event('ratechange'));
    await el.updateComplete;
    expect(el.playbackRate).to.equal(2);
  });

  it('starts playback from the poster overlay', async () => {
    const el = await fixture<LyraVideo>(html`
      <lr-video poster="https://example.test/poster.jpg"></lr-video>
    `);
    const stub = stubPlayback(nativeVideo(el));
    const poster = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="poster-play-button"]')!;
    poster.click();
    await stub.playResult;
    expect(stub.playCalls).to.equal(1);
  });

  it('drives fullscreen and picture-in-picture from their controls and document events', async () => {
    const fsEnabled = Object.getOwnPropertyDescriptor(document, 'fullscreenEnabled');
    const pipEnabled = Object.getOwnPropertyDescriptor(document, 'pictureInPictureEnabled');
    const fsElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const pipElement = Object.getOwnPropertyDescriptor(document, 'pictureInPictureElement');
    const requestFs = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
    const exitFs = Object.getOwnPropertyDescriptor(Document.prototype, 'exitFullscreen');
    const requestPip = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'requestPictureInPicture');
    const exitPip = Object.getOwnPropertyDescriptor(Document.prototype, 'exitPictureInPicture');
    let fullscreenRequests = 0;
    let fullscreenExits = 0;
    let pipRequests = 0;
    let pipExits = 0;
    try {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
      Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null, writable: true });
      Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: null, writable: true });
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        configurable: true,
        value: () => { fullscreenRequests += 1; return Promise.resolve(); },
      });
      Object.defineProperty(Document.prototype, 'exitFullscreen', {
        configurable: true,
        value: () => { fullscreenExits += 1; return Promise.resolve(); },
      });
      Object.defineProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', {
        configurable: true,
        value: () => { pipRequests += 1; return Promise.resolve({} as PictureInPictureWindow); },
      });
      Object.defineProperty(Document.prototype, 'exitPictureInPicture', {
        configurable: true,
        value: () => { pipExits += 1; return Promise.resolve(); },
      });

      const el = await fixture<LyraVideo>(html`<lr-video controls="full"></lr-video>`);
      const wrapper = el.shadowRoot!.querySelector('[part="video-wrapper"], [part~="wrapper"]');

      button(el, 'fullscreen')!.click();
      await el.updateComplete;
      expect(fullscreenRequests).to.equal(1);

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: wrapper });
      document.dispatchEvent(new Event('fullscreenchange'));
      await el.updateComplete;
      expect(el.fullscreen).to.equal(wrapper !== null);

      if (el.fullscreen) {
        button(el, 'fullscreen')!.click();
        await el.updateComplete;
        expect(fullscreenExits).to.equal(1);
      }

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
      document.dispatchEvent(new Event('fullscreenchange'));
      await el.updateComplete;
      expect(el.fullscreen).to.equal(false);

      button(el, 'picture-in-picture')!.click();
      await el.updateComplete;
      expect(pipRequests).to.equal(1);

      Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: nativeVideo(el) });
      document.dispatchEvent(new Event('enterpictureinpicture'));
      await el.updateComplete;
      expect(el.pictureInPicture).to.equal(true);

      button(el, 'picture-in-picture')!.click();
      await el.updateComplete;
      expect(pipExits).to.equal(1);

      Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: null });
      document.dispatchEvent(new Event('leavepictureinpicture'));
      await el.updateComplete;
      expect(el.pictureInPicture).to.equal(false);
    } finally {
      restoreOwnProperty(document, 'fullscreenEnabled', fsEnabled);
      restoreOwnProperty(document, 'pictureInPictureEnabled', pipEnabled);
      restoreOwnProperty(document, 'fullscreenElement', fsElement);
      restoreOwnProperty(document, 'pictureInPictureElement', pipElement);
      restoreOwnProperty(HTMLElement.prototype, 'requestFullscreen', requestFs);
      restoreOwnProperty(Document.prototype, 'exitFullscreen', exitFs);
      restoreOwnProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', requestPip);
      restoreOwnProperty(Document.prototype, 'exitPictureInPicture', exitPip);
    }
  });

  it('clears the timeline thumbnail when the pointer leaves the track', async () => {
    const el = await fixture<LyraVideo>(html`<lr-video controls="full"></lr-video>`);
    const timeline = el.shadowRoot!.querySelector<HTMLElement>('[part="timeline"]')!;
    timeline.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10 }));
    await el.updateComplete;
    timeline.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="thumbnail"]')).to.equal(null);
  });
});
