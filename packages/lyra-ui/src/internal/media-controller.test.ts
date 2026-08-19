import { expect } from '@open-wc/testing';
import {
  NATIVE_MEDIA_RELAY_EVENTS,
  NativeMediaController,
  canExitFullscreen,
  canRequestFullscreen,
  canRequestPictureInPicture,
  cloneSafeMediaNodes,
  safeNativeMediaSource,
} from './media-controller.js';

function stubMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
): () => void {
  const own = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => {
    if (own) Object.defineProperty(target, key, own);
    else delete target[key];
  };
}

describe('NativeMediaController', () => {
  it('returns the exact native play promise and preserves its rejection', async () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const failure = new DOMException('Playback blocked', 'NotAllowedError');
    const nativePromise = Promise.reject(failure);
    const restorePlay = stubMethod(media, 'play', (() => nativePromise) as HTMLMediaElement['play']);
    const controller = new NativeMediaController(target);
    try {
      controller.attach(media);
      const returned = controller.play();
      expect(returned === nativePromise).to.be.true;
      const rejection = await returned.then(() => null, (error: unknown) => error);
      expect(rejection === failure).to.be.true;
    } finally {
      restorePlay();
    }
  });

  it('relays every native media event exactly once as a non-bubbling Event', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    const counts = new Map<string, number>();
    const contracts = new Map<string, { bubbles: boolean; composed: boolean; native: boolean }>();
    for (const name of NATIVE_MEDIA_RELAY_EVENTS) {
      target.addEventListener(name, (event) => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        contracts.set(name, {
          bubbles: event.bubbles,
          composed: event.composed,
          native: event.constructor === Event,
        });
      });
    }

    controller.attach(media);
    for (const name of NATIVE_MEDIA_RELAY_EVENTS) media.dispatchEvent(new Event(name));

    expect([...counts.values()]).to.deep.equal(NATIVE_MEDIA_RELAY_EVENTS.map(() => 1));
    expect([...contracts.values()].every((contract) => !contract.bubbles && !contract.composed)).to.be.true;
    expect([...contracts.values()].every((contract) => contract.native)).to.be.true;
  });

  it('rejects events from detached and old-generation media, then resumes once on reconnect', () => {
    const target = document.createElement('div');
    const first = document.createElement('video');
    const second = document.createElement('video');
    let pauses = 0;
    const restoreFirstPause = stubMethod(first, 'pause', (() => { pauses += 1; }) as HTMLMediaElement['pause']);
    const restoreSecondPause = stubMethod(second, 'pause', (() => { pauses += 1; }) as HTMLMediaElement['pause']);
    const controller = new NativeMediaController(target);
    let count = 0;
    target.addEventListener('timeupdate', () => { count += 1; });

    try {
      controller.attach(first);
      const firstGeneration = controller.generation;
      expect(controller.isCurrentGeneration(firstGeneration, first)).to.be.true;
      first.dispatchEvent(new Event('timeupdate'));
      controller.attach(second);
      expect(controller.isCurrentGeneration(firstGeneration, first)).to.be.false;
      expect(controller.isCurrentGeneration(controller.generation, second)).to.be.true;
      first.dispatchEvent(new Event('timeupdate'));
      second.dispatchEvent(new Event('timeupdate'));
      controller.disconnect();
      expect(controller.isCurrentGeneration(controller.generation, second)).to.be.false;
      second.dispatchEvent(new Event('timeupdate'));
      controller.reconnect();
      second.dispatchEvent(new Event('timeupdate'));

      expect(count).to.equal(3);
      expect(pauses).to.equal(2);
    } finally {
      restoreFirstPause();
      restoreSecondPause();
    }
  });

  it('normalizes duration, currentTime, volume, and playbackRate before proxying native state', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    Object.defineProperty(media, 'duration', { configurable: true, value: Number.POSITIVE_INFINITY });
    const controller = new NativeMediaController(target);
    controller.attach(media);
    media.dispatchEvent(new Event('loadedmetadata'));

    expect(controller.duration).to.equal(0);
    controller.currentTime = Number.NaN;
    controller.volume = 2;
    controller.playbackRate = 0;

    expect(controller.currentTime).to.equal(0);
    expect(controller.volume).to.equal(1);
    expect(controller.playbackRate).to.equal(0.0625);
    expect(Number.isFinite(media.currentTime)).to.be.true;
    expect(Number.isFinite(media.volume)).to.be.true;
    expect(Number.isFinite(media.playbackRate)).to.be.true;
  });

  it('queues a finite pre-attachment seek and clamps it when finite metadata arrives', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    controller.currentTime = 500;
    controller.attach(media);
    expect(media.currentTime).to.equal(0);

    Object.defineProperty(media, 'duration', { configurable: true, value: 100 });
    media.dispatchEvent(new Event('loadedmetadata'));

    expect(media.currentTime).to.equal(100);
    expect(controller.currentTime).to.equal(100);
  });

  it('captures and reapplies only valid user volume, mute, rate, and caption preferences', () => {
    const target = document.createElement('div');
    const first = document.createElement('video');
    const firstEnglish = first.addTextTrack('captions', 'English', 'en');
    firstEnglish.mode = 'showing';
    first.volume = 0.35;
    first.muted = true;
    first.playbackRate = 1.5;

    const second = document.createElement('video');
    const secondEnglish = second.addTextTrack('captions', 'English', 'en');
    const secondFrench = second.addTextTrack('captions', 'French', 'fr');
    secondFrench.mode = 'showing';

    const controller = new NativeMediaController(target);
    controller.attach(first);
    const preferences = controller.captureUserPreferences();
    controller.attach(second);

    expect(preferences.volume).to.equal(0.35);
    expect(preferences.muted).to.be.true;
    expect(preferences.playbackRate).to.equal(1.5);
    expect(preferences.textTrack?.language).to.equal('en');
    expect(second.volume).to.equal(0.35);
    expect(second.muted).to.be.true;
    expect(second.playbackRate).to.equal(1.5);
    expect(secondEnglish.mode).to.equal('showing');
    expect(secondFrench.mode).to.equal('disabled');

    controller.applyUserPreferences({
      volume: Number.NaN,
      muted: 'yes',
      playbackRate: 0,
      textTrack: { index: -1, kind: 2, label: null, language: {} },
    } as never);
    expect(second.volume).to.equal(0.35);
    expect(second.muted).to.be.true;
    expect(second.playbackRate).to.equal(1.5);
    expect(secondEnglish.mode).to.equal('showing');
  });

  it('clones only allowlisted safe source/track attributes without moving consumer nodes', () => {
    const consumer = document.createElement('div');
    consumer.innerHTML = `
      <source id="consumer-source" src=" https://example.test/video.mp4 " type="video/mp4" media="(width > 40rem)" onerror="alert(1)" data-private="x">
      <track id="consumer-track" src="/captions.vtt" kind="captions" srclang="en" label="English" default style="display:none">
      <source src="javascript:alert(1)" type="video/mp4">
      <track src="data:text/vtt,ok" kind="not-a-track-kind" label="Bad">
      <script src="https://example.test/not-media.js"></script>
    `;
    const clones = cloneSafeMediaNodes(consumer.children, document);

    expect(clones.length).to.equal(2);
    expect(consumer.children.length).to.equal(5);
    expect(consumer.firstElementChild?.parentElement?.tagName).to.equal('DIV');
    expect(clones[0]?.tagName).to.equal('SOURCE');
    expect(clones[0]?.getAttribute('src')).to.equal('https://example.test/video.mp4');
    expect(clones[0]?.getAttributeNames().sort()).to.deep.equal(['media', 'src', 'type']);
    expect(clones[1]?.tagName).to.equal('TRACK');
    expect(clones[1]?.getAttributeNames().sort()).to.deep.equal(['default', 'kind', 'label', 'src', 'srclang']);
  });

  it('loads and unloads without retaining source/track nodes or accepting an unsafe direct URL', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    let loads = 0;
    let pauses = 0;
    const restoreLoad = stubMethod(media, 'load', (() => { loads += 1; }) as HTMLMediaElement['load']);
    const restorePause = stubMethod(media, 'pause', (() => { pauses += 1; }) as HTMLMediaElement['pause']);
    const source = document.createElement('source');
    source.src = 'https://example.test/video.mp4';
    const track = document.createElement('track');
    track.src = 'https://example.test/captions.vtt';
    track.kind = 'captions';
    const controller = new NativeMediaController(target);

    try {
      controller.attach(media);
      expect(controller.setSources({ src: 'javascript:alert(1)', nodes: [source, track] })).to.be.false;
      expect(media.hasAttribute('src')).to.be.false;
      expect(media.querySelectorAll('source, track').length).to.equal(0);

      expect(controller.setSources({ nodes: [source, track] })).to.be.true;
      expect(media.querySelectorAll('source, track').length).to.equal(2);
      controller.load();
      controller.unload();

      expect(loads).to.equal(3);
      expect(pauses).to.be.greaterThan(0);
      expect(media.hasAttribute('src')).to.be.false;
      expect(media.querySelectorAll('source, track').length).to.equal(0);
    } finally {
      restoreLoad();
      restorePause();
    }
  });

  it('validates a native media source URL the same way the shared media-source guard does', () => {
    expect(safeNativeMediaSource('https://example.test/video.mp4')).to.equal(
      'https://example.test/video.mp4',
    );
    expect(safeNativeMediaSource('javascript:alert(1)')).to.equal(null);
  });

  it('exposes the attached native element through the element getter', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    expect(controller.element).to.equal(undefined);
    controller.attach(media);
    expect(controller.element === media).to.be.true;
  });

  it('falls back to a pending seek when assigning native currentTime throws', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    controller.attach(media);
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => 0,
      set: () => {
        throw new DOMException('Seek failed', 'InvalidStateError');
      },
    });

    controller.currentTime = 42;

    expect(controller.currentTime).to.equal(42);
  });

  it('resolves currentTime from a pending value or the default before any media is attached', () => {
    const target = document.createElement('div');
    const controller = new NativeMediaController(target);
    expect(controller.currentTime).to.equal(0);
    controller.currentTime = 42;
    expect(controller.currentTime).to.equal(42);
  });

  it('resolves muted from native state, then user preference, then the default', () => {
    const target = document.createElement('div');
    const controller = new NativeMediaController(target);
    expect(controller.muted).to.be.false;
    controller.muted = true;
    expect(controller.muted).to.be.true;

    const media = document.createElement('video');
    controller.attach(media);
    expect(media.muted).to.be.true;
    expect(controller.muted).to.be.true;

    controller.muted = false;
    expect(media.muted).to.be.false;
    expect(controller.muted).to.be.false;
  });

  it('resolves volume and playbackRate from native state, then preference, then the default', () => {
    const target = document.createElement('div');
    const controller = new NativeMediaController(target);
    expect(controller.volume).to.equal(1);
    expect(controller.playbackRate).to.equal(1);

    const media = document.createElement('video');
    controller.attach(media);
    controller.volume = 0.4;
    controller.playbackRate = 2;
    expect(controller.volume).to.equal(0.4);
    expect(controller.playbackRate).to.equal(2);

    Object.defineProperty(media, 'volume', { configurable: true, value: Number.NaN });
    Object.defineProperty(media, 'playbackRate', { configurable: true, value: Number.NaN });
    expect(controller.volume).to.equal(0.4);
    expect(controller.playbackRate).to.equal(2);
  });

  it('forwards pause() directly to the native element', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    let pauses = 0;
    const restorePause = stubMethod(media, 'pause', (() => { pauses += 1; }) as HTMLMediaElement['pause']);
    const controller = new NativeMediaController(target);
    try {
      controller.attach(media);
      controller.pause();
      expect(pauses).to.equal(1);
    } finally {
      restorePause();
    }
  });

  it('resolves play() immediately when no native element is attached', async () => {
    const target = document.createElement('div');
    const controller = new NativeMediaController(target);
    const result = await controller.play();
    expect(result).to.equal(undefined);
  });

  it('detaches the native element and clears pending state when attach(null) is called', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    let pauses = 0;
    const restorePause = stubMethod(media, 'pause', (() => { pauses += 1; }) as HTMLMediaElement['pause']);
    const controller = new NativeMediaController(target);
    try {
      controller.attach(media);
      controller.attach(null);
      expect(controller.element).to.equal(undefined);
      expect(pauses).to.equal(1);
      expect(controller.currentTime).to.equal(0);
    } finally {
      restorePause();
    }
  });

  it('rebinds a still-active element that lost its listeners when attach() repeats with no configured events', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target, { events: [], relayEvents: [] });
    controller.attach(media);
    controller.attach(media);
    expect(controller.element === media).to.be.true;
  });

  it('disconnects and reconnects safely when no native element was ever attached', () => {
    const target = document.createElement('div');
    const controller = new NativeMediaController(target);
    controller.disconnect();
    controller.reconnect();
    expect(controller.element).to.equal(undefined);
  });

  it('no-ops a second disconnect() call', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    let pauses = 0;
    const restorePause = stubMethod(media, 'pause', (() => { pauses += 1; }) as HTMLMediaElement['pause']);
    const controller = new NativeMediaController(target);
    try {
      controller.attach(media);
      controller.disconnect();
      expect(pauses).to.equal(1);
      controller.disconnect();
      expect(pauses).to.equal(1);
    } finally {
      restorePause();
    }
  });

  it('no-ops reconnect() when already active', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    controller.attach(media);
    const generationBefore = controller.generation;
    controller.reconnect();
    expect(controller.generation).to.equal(generationBefore);
  });

  it('no-ops load, unload, setSources, captureUserPreferences, and applyUserPreferences without an attached element', () => {
    const target = document.createElement('div');
    const controller = new NativeMediaController(target);
    controller.load();
    controller.unload();
    expect(controller.setSources({ src: 'https://example.test/video.mp4' })).to.be.false;
    expect(controller.captureUserPreferences()).to.deep.equal({});
    controller.applyUserPreferences({ volume: 0.5 });
    expect(controller.volume).to.equal(1);
  });

  it('ignores applyUserPreferences payloads that are null, non-object, omit textTrack, or carry a non-object textTrack', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    controller.attach(media);
    media.volume = 0.6;

    controller.applyUserPreferences(null as never);
    controller.applyUserPreferences('nope' as never);
    expect(media.volume).to.equal(0.6);

    controller.applyUserPreferences({ volume: 0.2 });
    expect(media.volume).to.equal(0.2);

    controller.applyUserPreferences({ textTrack: 'not-an-object' } as never);
    expect(media.volume).to.equal(0.2);
  });

  it('disables all user-selectable tracks when applyUserPreferences receives an explicit null textTrack', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const english = media.addTextTrack('captions', 'English', 'en');
    const chapters = media.addTextTrack('chapters', 'Chapters');
    english.mode = 'showing';
    chapters.mode = 'showing';
    const controller = new NativeMediaController(target);
    controller.attach(media);

    controller.applyUserPreferences({ textTrack: null });

    expect(english.mode).to.equal('disabled');
    expect(chapters.mode).to.equal('showing');
  });

  it('falls back to matching by index and kind when no exact caption match exists, and no-ops when nothing matches', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const english = media.addTextTrack('captions', 'English', 'en');
    const french = media.addTextTrack('captions', 'French', 'fr');
    const controller = new NativeMediaController(target);
    controller.attach(media);

    controller.applyUserPreferences({
      textTrack: { index: 0, kind: 'captions', label: 'Renamed', language: 'xx' },
    });
    expect(english.mode).to.equal('showing');
    expect(french.mode).to.equal('disabled');

    controller.applyUserPreferences({
      textTrack: { index: 5, kind: 'subtitles', label: 'Missing', language: 'zz' },
    });
    expect(english.mode).to.equal('showing');
    expect(french.mode).to.equal('disabled');
  });

  it('replaces existing source/track children and applies a fresh direct src across repeated setSources calls, then unloads stale content when a later direct URL is rejected', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    let loads = 0;
    const restoreLoad = stubMethod(media, 'load', (() => { loads += 1; }) as HTMLMediaElement['load']);
    const source = document.createElement('source');
    source.src = 'https://example.test/a.mp4';
    const controller = new NativeMediaController(target);

    try {
      controller.attach(media);

      expect(controller.setSources({ nodes: [source] })).to.be.true;
      expect(media.querySelectorAll('source, track').length).to.equal(1);

      expect(controller.setSources({ src: 'https://example.test/video2.mp4' })).to.be.true;
      expect(media.getAttribute('src')).to.equal('https://example.test/video2.mp4');
      expect(media.querySelectorAll('source, track').length).to.equal(0);

      expect(controller.setSources({ src: 'javascript:alert(1)' })).to.be.false;
      expect(media.hasAttribute('src')).to.be.false;
      expect(loads).to.be.greaterThan(2);
    } finally {
      restoreLoad();
    }
  });

  it('skips non-element nodes and tracks carrying an unrecognized kind while cloning', () => {
    const consumer = document.createElement('div');
    const comment = document.createComment('not an element');
    const text = document.createTextNode('not an element either');
    const track = document.createElement('track');
    track.src = 'https://example.test/unknown-kind.vtt';
    track.setAttribute('kind', 'not-a-track-kind');
    const source = document.createElement('source');
    source.src = 'https://example.test/ok.mp4';
    consumer.append(comment, text, track, source);

    const clones = cloneSafeMediaNodes(consumer.childNodes, document);

    expect(clones.length).to.equal(1);
    expect(clones[0]?.tagName).to.equal('SOURCE');
  });

  it("clones a <track> with no kind attribute as subtitles, matching HTML's missing-value default", () => {
    const consumer = document.createElement('div');
    consumer.innerHTML =
      '<track src="/captions.vtt" srclang="en" label="English" default>';

    const clones = cloneSafeMediaNodes(consumer.children, document);

    expect(clones.length).to.equal(1);
    expect(clones[0]?.tagName).to.equal('TRACK');
    expect(clones[0]?.getAttribute('kind')).to.equal('subtitles');
    expect(clones[0]?.getAttribute('srclang')).to.equal('en');
    expect(clones[0]?.getAttribute('label')).to.equal('English');
    expect(clones[0]?.hasAttribute('default')).to.equal(true);
  });

  it('leaves an explicitly empty kind out, since the empty string is not a valid keyword', () => {
    const consumer = document.createElement('div');
    consumer.innerHTML = '<track src="/captions.vtt" kind="" srclang="en" label="English">';

    expect(cloneSafeMediaNodes(consumer.children, document).length).to.equal(0);
  });

  it('invokes an onEvent callback registered through the constructor for every observed native event', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const seen: string[] = [];
    const controller = new NativeMediaController(target, {
      onEvent: (event, ctrl) => {
        seen.push(event.type);
        expect(ctrl === controller).to.be.true;
      },
    });
    controller.attach(media);
    media.dispatchEvent(new Event('play'));
    expect(seen).to.deep.equal(['play']);
  });

  it('clamps currentTime against a positive known duration on timeupdate and seeked', () => {
    const target = document.createElement('div');
    const media = document.createElement('video');
    const controller = new NativeMediaController(target);
    controller.attach(media);
    Object.defineProperty(media, 'duration', { configurable: true, value: 50 });
    media.dispatchEvent(new Event('loadedmetadata'));
    expect(controller.duration).to.equal(50);

    Object.defineProperty(media, 'currentTime', { configurable: true, value: 200 });
    media.dispatchEvent(new Event('timeupdate'));
    expect(controller.currentTime).to.equal(50);

    media.dispatchEvent(new Event('seeked'));
    expect(controller.currentTime).to.equal(50);
  });

  it('falls back to the global Event constructor when the native element has no owner window', () => {
    const target = document.createElement('div');
    const detachedDocument = document.implementation.createHTMLDocument('detached');
    const media = detachedDocument.createElement('video');
    const controller = new NativeMediaController(target);
    let received = 0;
    target.addEventListener('play', () => { received += 1; });
    controller.attach(media);
    media.dispatchEvent(new Event('play'));
    expect(received).to.equal(1);
  });
});

describe('native media capability predicates', () => {
  it('uses fullscreen and picture-in-picture features instead of user-agent detection', () => {
    const video = document.createElement('video') as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    };
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenEnabled');
    const pipDescriptor = Object.getOwnPropertyDescriptor(document, 'pictureInPictureEnabled');
    const restoreFullscreen = stubMethod(video, 'requestFullscreen', (() => Promise.resolve()) as Element['requestFullscreen']);
    const restoreExitFullscreen = stubMethod(document, 'exitFullscreen', (() => Promise.resolve()) as Document['exitFullscreen']);
    const restorePip = stubMethod(
      video,
      'requestPictureInPicture',
      (() => Promise.resolve({} as PictureInPictureWindow)) as NonNullable<typeof video.requestPictureInPicture>,
    );
    try {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
      Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
      expect(canRequestFullscreen(video)).to.be.true;
      expect(canExitFullscreen(document)).to.be.true;
      expect(canRequestPictureInPicture(video)).to.be.true;

      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
      Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: false });
      expect(canRequestFullscreen(video)).to.be.false;
      expect(canRequestPictureInPicture(video)).to.be.false;
    } finally {
      restoreFullscreen();
      restoreExitFullscreen();
      restorePip();
      if (fullscreenDescriptor) Object.defineProperty(document, 'fullscreenEnabled', fullscreenDescriptor);
      else delete (document as Document & { fullscreenEnabled?: boolean }).fullscreenEnabled;
      if (pipDescriptor) Object.defineProperty(document, 'pictureInPictureEnabled', pipDescriptor);
      else delete (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled;
    }
  });

  it('returns false for capability checks given no element', () => {
    expect(canRequestFullscreen(null)).to.be.false;
    expect(canRequestFullscreen(undefined)).to.be.false;
    expect(canRequestPictureInPicture(null)).to.be.false;
    expect(canRequestPictureInPicture(undefined)).to.be.false;
  });
});
