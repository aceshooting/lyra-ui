import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './av-player.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraAvPlayer, LyraAvCue } from './av-player.js';
import { styles } from './av-player.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { invalidateLyraTheme } from '../../../internal/theme-watcher.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const MP3_SRC = 'https://example.test/podcast.mp3';
const MP4_SRC = 'https://example.test/clip.mp4';

function assertiveAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  );
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

const CUES: LyraAvCue[] = [
  { id: 'c1', start: 0, end: 10, text: 'Welcome to the show', speaker: 'Host' },
  { id: 'c2', start: 10, end: 25, text: 'Today we discuss agents', speaker: 'Host' },
  { id: 'c3', start: 25, end: 40, text: 'Thanks for having me', speaker: 'Guest' },
];

it('redraws a token-colored waveform after an out-of-band theme invalidation', async () => {
  const el = (await fixture(
    html`<lr-av-player .peaks=${[0.25, 0.75]}></lr-av-player>`,
  )) as LyraAvPlayer;
  await el.updateComplete;
  let redraws = 0;
  const internals = el as unknown as { drawWaveform: () => void };
  const originalDraw = internals.drawWaveform;
  internals.drawWaveform = () => {
    redraws += 1;
  };
  try {
    invalidateLyraTheme(el);
    await aTimeout(0);
    expect(redraws).to.equal(1);
  } finally {
    internals.drawWaveform = originalDraw;
  }
});

describe('visibility-gated waveform redraws', () => {
  it('defers hidden waveform paints and coalesces the visibility catch-up', async () => {
    const originalIntersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    let callback: IntersectionObserverCallback | undefined;
    let observed = false;
    let disconnected = false;
    class TestIntersectionObserver {
      constructor(next: IntersectionObserverCallback) {
        callback = next;
      }
      observe(target: Element): void {
        observed = target.localName === 'lr-av-player';
      }
      unobserve(): void {}
      disconnect(): void {
        disconnected = true;
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: TestIntersectionObserver,
    });

    let el: LyraAvPlayer | undefined;
    try {
      el = (await fixture(html`<lr-av-player .peaks=${[0.25, 0.75]}></lr-av-player>`)) as LyraAvPlayer;
      await el.updateComplete;
      expect(callback !== undefined, 'the owner-window visibility observer is installed').to.equal(true);
      expect(observed, 'the observer watches the player host').to.equal(true);

      callback!([{ target: el, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      let paints = 0;
      const internals = el as unknown as { paintWaveform(): void };
      const originalPaint = internals.paintWaveform.bind(el);
      internals.paintWaveform = () => {
        paints += 1;
        originalPaint();
      };

      el.peaks = [0.5, 1];
      await el.updateComplete;
      invalidateLyraTheme(el);
      await aTimeout(0);
      window.dispatchEvent(new Event('resize'));
      expect(paints, 'hidden peaks, theme, and resize invalidations perform no canvas work').to.equal(0);

      callback!([{ target: el, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      expect(paints, 'hidden invalidations coalesce into the visibility-entry paint').to.equal(1);

      el.remove();
      expect(disconnected, 'the visibility observer is disconnected with its host').to.equal(true);
    } finally {
      el?.remove();
      if (originalIntersectionObserver) {
        Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserver);
      } else {
        delete (window as unknown as { IntersectionObserver?: typeof IntersectionObserver })
          .IntersectionObserver;
      }
    }
  });

  it('waits for a fresh same-realm visibility result after a visible player reconnects', async () => {
    const originalIntersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    const callbacks: IntersectionObserverCallback[] = [];
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: TestIntersectionObserver,
    });

    let el: LyraAvPlayer | undefined;
    try {
      el = (await fixture(html`<lr-av-player .peaks=${[0.25, 0.75]}></lr-av-player>`)) as LyraAvPlayer;
      const parent = el.parentElement!;
      await el.updateComplete;
      expect(callbacks.length).to.equal(1);
      callbacks[0]!([{ target: el, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

      let paints = 0;
      const internals = el as unknown as { paintWaveform(): void };
      const originalPaint = internals.paintWaveform.bind(el);
      internals.paintWaveform = () => {
        paints += 1;
        originalPaint();
      };

      el.remove();
      parent.append(el);
      await el.updateComplete;

      expect(callbacks.length).to.equal(2);
      expect(paints, 'a reconnect must not trust visibility from the detached placement').to.equal(0);

      callbacks[1]!([{ target: el, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      window.dispatchEvent(new Event('resize'));
      expect(paints, 'the fresh off-screen observation keeps resize work deferred').to.equal(0);

      callbacks[1]!([{ target: el, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      expect(paints, 'the new owner-realm observer catches up once on re-entry').to.equal(1);
    } finally {
      el?.remove();
      if (originalIntersectionObserver) {
        Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserver);
      } else {
        delete (window as unknown as { IntersectionObserver?: typeof IntersectionObserver })
          .IntersectionObserver;
      }
    }
  });

  it('rebuilds waveform observation in an adopted owner realm and ignores stale deliveries', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalMainIntersectionObserver = Object.getOwnPropertyDescriptor(
      window,
      'IntersectionObserver',
    );
    const originalIntersectionObserver = Object.getOwnPropertyDescriptor(
      frameWindow,
      'IntersectionObserver',
    );
    let mainCallback: IntersectionObserverCallback | undefined;
    let ownerCallback: IntersectionObserverCallback | undefined;
    let mainConstructions = 0;
    let mainDisconnects = 0;
    let ownerConstructions = 0;
    let ownerDisconnects = 0;
    let observedInOwnerRealm = false;
    class MainIntersectionObserver {
      constructor(next: IntersectionObserverCallback) {
        mainCallback = next;
        mainConstructions += 1;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        mainDisconnects += 1;
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
    }
    class OwnerIntersectionObserver {
      constructor(next: IntersectionObserverCallback) {
        ownerCallback = next;
        ownerConstructions += 1;
      }
      observe(target: Element): void {
        observedInOwnerRealm = target.ownerDocument === frameDocument;
      }
      unobserve(): void {}
      disconnect(): void {
        ownerDisconnects += 1;
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: MainIntersectionObserver,
    });
    Object.defineProperty(frameWindow, 'IntersectionObserver', {
      configurable: true,
      value: OwnerIntersectionObserver,
    });

    const el = document.createElement('lr-av-player') as LyraAvPlayer;
    el.peaks = [0.25, 0.75];
    try {
      document.body.append(el);
      await el.updateComplete;
      expect(mainConstructions).to.equal(1);
      mainCallback!(
        [{ target: el, isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;

      expect(mainDisconnects, 'the source-realm observer is disconnected').to.equal(1);
      expect(ownerConstructions).to.equal(1);
      expect(observedInOwnerRealm).to.equal(true);

      let paints = 0;
      const internals = el as unknown as { paintWaveform(): void };
      const originalPaint = internals.paintWaveform.bind(el);
      internals.paintWaveform = () => {
        paints += 1;
        originalPaint();
      };
      mainCallback!(
        [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      el.peaks = [0.5, 1];
      await el.updateComplete;
      expect(paints, 'a known-hidden player stays deferred after adoption').to.equal(0);

      ownerCallback!(
        [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
      expect(paints, 'the adopted owner realm performs the deferred paint').to.equal(1);

      mainCallback!(
        [{ target: el, isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      el.peaks = [0.6, 0.4];
      await el.updateComplete;
      expect(paints, 'a queued source-realm callback cannot suppress owner-realm painting').to.equal(2);

      ownerCallback!(
        [{ target: el, isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      el.peaks = [0.75, 0.25];
      await el.updateComplete;
      expect(paints, 'the current owner-realm callback still gates hidden painting').to.equal(2);
      ownerCallback!(
        [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
      expect(paints, 'the current owner-realm callback restores the deferred paint').to.equal(3);

      el.remove();
      expect(ownerDisconnects, 'disconnect tears down the current-realm observer').to.equal(1);
    } finally {
      el.remove();
      if (originalMainIntersectionObserver) {
        Object.defineProperty(window, 'IntersectionObserver', originalMainIntersectionObserver);
      } else {
        delete (window as unknown as { IntersectionObserver?: typeof IntersectionObserver })
          .IntersectionObserver;
      }
      if (originalIntersectionObserver) {
        Object.defineProperty(frameWindow, 'IntersectionObserver', originalIntersectionObserver);
      } else {
        delete (frameWindow as unknown as { IntersectionObserver?: typeof IntersectionObserver })
          .IntersectionObserver;
      }
      iframe.remove();
    }
  });
});

function mediaEl(el: LyraAvPlayer): HTMLMediaElement {
  return el.shadowRoot!.querySelector('audio, video') as HTMLMediaElement;
}

// `renderItem`'s output (the `[part~="cue"]` rows) renders inside `<lr-virtual-list>`'s own nested
// shadow root, not directly in `el.shadowRoot` -- same pattern documented/used by pdf-viewer.test.ts
// for its `[part="page"]` rows.
function cueRows(el: LyraAvPlayer): HTMLButtonElement[] {
  const list = el.shadowRoot!.querySelector('lr-virtual-list');
  return [...(list?.shadowRoot?.querySelectorAll('[part~="cue"]') ?? [])] as HTMLButtonElement[];
}

type TranscriptList = HTMLElement & {
  activeId: string | number | '';
  keyFunction?: (item: unknown, index: number) => string | number;
  renderItem: (item: unknown, index: number) => unknown;
  renderedRows: HTMLElement[];
  scrollToIndex(
    index: number,
    options?: { align?: 'start' | 'end' | 'auto'; behavior?: ScrollBehavior },
  ): void;
  updateComplete: Promise<boolean>;
};

function transcriptList(el: LyraAvPlayer): TranscriptList {
  return el.shadowRoot!.querySelector('lr-virtual-list') as TranscriptList;
}

function renderedTranscriptRow(list: TranscriptList, index: number): HTMLElement | undefined {
  return list.renderedRows.find((row) => row.dataset.rowIndex === String(index));
}

describe('defaults', () => {
  it('defaults to empty src/name, metadata preload, playbackRate 1, empty cues/peaks/tracks', async () => {
    const el = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
    expect(el.src).to.equal('');
    expect(el.preload).to.equal('metadata');
    expect(el.playbackRate).to.equal(1);
    expect(el.rates).to.deep.equal([0.75, 1, 1.25, 1.5, 2]);
    expect(el.cues).to.deep.equal([]);
    expect(el.peaks).to.deep.equal([]);
    expect(el.tracks).to.deep.equal([]);
  });
});

describe('kind detection', () => {
  it('auto-detects audio from an audio/* mime-type', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} mime-type="audio/mpeg"></lr-av-player>`)) as LyraAvPlayer;
    expect((el.shadowRoot!.querySelector('audio')) != null).to.equal(true);
    expect((el.shadowRoot!.querySelector('video')) == null).to.equal(true);
  });

  it('defaults to video when mime-type is unset or non-audio', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP4_SRC} mime-type="video/mp4"></lr-av-player>`)) as LyraAvPlayer;
    expect((el.shadowRoot!.querySelector('video')) != null).to.equal(true);
  });

  it('an explicit kind overrides auto-detection', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} mime-type="audio/mpeg" kind="video"></lr-av-player>`)) as LyraAvPlayer;
    expect((el.shadowRoot!.querySelector('video')) != null).to.equal(true);
  });

  it('ignores an unrecognized kind and retains MIME auto-detection for rendering and lr-load', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} mime-type="audio/mpeg" kind="audio-file"></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    expect(media.localName).to.equal('audio');

    const loadPromise = oneEvent(el, 'lr-load');
    media.dispatchEvent(new Event('loadedmetadata'));
    const loaded = (await loadPromise) as CustomEvent<{ duration: number; kind: string }>;
    expect(loaded.detail.kind).to.equal('audio');
  });
});

it('canonicalizes invalid closed kind and preload values without rejecting updateComplete', async () => {
  const el = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
  el.kind = 'movie' as typeof el.kind;
  el.preload = 'eager' as typeof el.preload;
  await el.updateComplete;
  expect(el.kind).to.be.undefined;
  expect(el.preload).to.equal('metadata');
  expect(mediaEl(el).preload).to.equal('metadata');
});

it('clone-owns bounded AV collections and retains valid entries around hostile records', async () => {
  const el = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
  const hostileCue = new Proxy({}, {
    get() {
      throw new Error('hostile cue getter');
    },
  });
  const cues = [
    { id: 'valid', start: 1, text: 'Valid' },
    hostileCue,
    { id: '', start: 2, text: 'Missing identity' },
  ];
  el.cues = cues as unknown as readonly LyraAvCue[];
  el.rates = [1, 1, Number.NaN, 2];
  el.peaks = [0.25, Number.NaN, 2];
  el.tracks = [
    { src: 'captions.vtt', kind: 'captions', srclang: 'en', label: 'English' },
    { src: 'bad.vtt', kind: 'bogus', srclang: 'en', label: 'Bad' },
  ] as unknown as typeof el.tracks;

  // Admission is synchronous: no caller-owned collection is observable between assignment and
  // the next Lit update.
  expect(el.cues.map((cue) => cue.id)).to.deep.equal(['valid']);
  expect(el.rates).to.deep.equal([1, 2]);
  expect(el.peaks).to.deep.equal([0.25, 0, 1]);
  expect(el.tracks).to.have.length(1);
  for (const value of [el.cues, el.rates, el.peaks, el.tracks]) {
    expect(Object.isFrozen(value)).to.be.true;
  }
  expect(el.cues).not.to.equal(cues);
  await el.updateComplete;
});

describe('playback controls', () => {
  it('play()/pause()/toggle() proxy the native media element and emit lr-play/lr-pause', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'play', { value: () => { media.dispatchEvent(new Event('play')); return Promise.resolve(); } });
    Object.defineProperty(media, 'pause', { value: () => media.dispatchEvent(new Event('pause')) });
    const playPromise = oneEvent(el, 'lr-play');
    el.play();
    await playPromise;
    const pausePromise = oneEvent(el, 'lr-pause');
    el.pause();
    await pausePromise;
  });

  it('toggle() plays when the media element is paused, and pauses when it is not', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    let played = false;
    let paused = false;
    Object.defineProperty(media, 'play', { value: () => { played = true; return Promise.resolve(); }, configurable: true });
    Object.defineProperty(media, 'pause', { value: () => { paused = true; }, configurable: true });

    // A freshly-mounted, never-played native media element reports paused: true.
    expect(media.paused).to.be.true;
    el.toggle();
    expect(played, 'toggle() should play() while paused').to.be.true;
    expect(paused).to.be.false;

    Object.defineProperty(media, 'paused', { value: false, configurable: true });
    el.toggle();
    expect(paused, 'toggle() should pause() while playing').to.be.true;
  });

  it('seek() sets currentTime on the media element and playbackRate reflects to it', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    el.seek(42);
    expect(media.currentTime).to.equal(42);
    el.playbackRate = 1.5;
    await el.updateComplete;
    expect(media.playbackRate).to.equal(1.5);
    const eventPromise = oneEvent(el, 'lr-rate-change');
    el.playbackRate = 2;
    expect((await eventPromise).detail).to.deep.equal({ rate: 2 });
  });

  it('updates the duration and forces a final time notification when native seeking completes', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 90, configurable: true });
    Object.defineProperty(media, 'currentTime', { value: 12, writable: true, configurable: true });

    media.dispatchEvent(new Event('durationchange'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    expect(timeline.getAttribute('aria-valuemax')).to.equal('90');

    const times: number[] = [];
    el.addEventListener('lr-time-change', (event) => times.push(event.detail.currentTime));
    media.dispatchEvent(new Event('timeupdate'));
    media.currentTime = 13;
    media.dispatchEvent(new Event('timeupdate'));
    media.dispatchEvent(new Event('seeked'));

    expect(times).to.deep.equal([12, 13]);
  });

  it('keeps an open-ended cue current after native playback advances past its start', async () => {
    const cues: LyraAvCue[] = [{ id: 'open-ended', start: 10, text: 'Open-ended cue' }];
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${cues}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'currentTime', { value: 60, writable: true, configurable: true });
    const change = oneEvent(el, 'lr-cue-change');
    media.dispatchEvent(new Event('timeupdate'));

    expect((await change).detail).to.deep.equal({ cueId: 'open-ended', index: 0 });
    await el.updateComplete;
    expect(cueRows(el)[0]?.getAttribute('aria-current')).to.equal('true');
  });

  it('fails closed to the current rate when rates receives a non-array runtime value', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    el.rates = null as unknown as number[];
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector('[part="rate-select"]') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).to.deep.equal(['1']);
    expect(select.value).to.equal('1');
  });

  it('rate-select reflects the actual playbackRate even when it is not one of the offered rates (regression)', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .rates=${[1, 1.5, 2]}></lr-av-player>`)) as LyraAvPlayer;
    el.playbackRate = 1.75;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[part="rate-select"]') as HTMLSelectElement;
    expect(select.value).to.equal('1.75');
  });

  it('resets native appearance on the rate-select, themes its option list, and adds hover/focus/a chevron', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP4_SRC}></lr-av-player>`)) as LyraAvPlayer;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[part="rate-select"]') as HTMLSelectElement;
    expect(getComputedStyle(select).appearance).to.equal('none');
    expect(getComputedStyle(select).cursor).to.equal('pointer');
    const wrapper = select.closest('.rate-select-wrapper');
    expect((wrapper) != null, 'the select must be wrapped so a decorative chevron can be positioned over it').to.equal(true);
    expect(wrapper!.querySelector('.rate-select-chevron svg'), 'a decorative chevron must render since appearance:none removes the native one').to.exist;
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='rate-select'\] option[^{]*\{[^}]*background:/);
    expect(css).to.match(/\[part='rate-select'\]:hover[^{]*\{[^}]*background:/);
    expect(css).to.match(/\[part='rate-select'\]:focus-visible[^{]*\{[^}]*outline:/);
  });

  it('returns the native play promise and preserves its rejection for imperative callers', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const failure = new DOMException('Playback blocked', 'NotAllowedError');
    Object.defineProperty(media, 'play', {
      value: () => Promise.reject(failure),
      configurable: true,
    });
    const suppressUnhandled = (event: PromiseRejectionEvent): void => event.preventDefault();
    window.addEventListener('unhandledrejection', suppressUnhandled);
    try {
      const result = (el as unknown as { play(): Promise<void> }).play();
      const rejection = result ? await result.then(() => null, (error: unknown) => error) : null;
      await aTimeout(0);
      expect(result).to.be.instanceOf(Promise);
      expect(rejection).to.equal(failure);
    } finally {
      window.removeEventListener('unhandledrejection', suppressUnhandled);
    }
  });

  it('relays native media events from the host exactly once without bubbling or composing', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    let count = 0;
    let bubbles = true;
    let composed = true;
    el.addEventListener('play', (event) => {
      count += 1;
      bubbles = event.bubbles;
      composed = event.composed;
    });

    media.dispatchEvent(new Event('play'));

    expect(count).to.equal(1);
    expect(bubbles).to.be.false;
    expect(composed).to.be.false;
  });

  it('handles an internal keyboard-triggered play rejection through the localized render-error path', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const failure = new DOMException('Playback blocked', 'NotAllowedError');
    Object.defineProperty(media, 'play', {
      value: () => Promise.reject(failure),
      configurable: true,
    });
    let reported: unknown;
    el.addEventListener('lr-render-error', (event) => {
      reported = event.detail.error;
    });
    const suppressUnhandled = (event: PromiseRejectionEvent): void => event.preventDefault();
    window.addEventListener('unhandledrejection', suppressUnhandled);
    try {
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    Object.defineProperty(media, 'duration', { value: 60, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      await aTimeout(0);
      await el.updateComplete;
      expect(reported).to.equal(failure);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'The media failed to load.',
      );
    } finally {
      window.removeEventListener('unhandledrejection', suppressUnhandled);
    }
  });

  it('ignores a late internal play rejection after its source generation is replaced', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    let rejectPlay!: (error: unknown) => void;
    const pendingPlay = new Promise<void>((_resolve, reject) => {
      rejectPlay = reject;
    });
    Object.defineProperty(media, 'play', { value: () => pendingPlay, configurable: true });
    Object.defineProperty(media, 'duration', { value: 60, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;

    let failures = 0;
    el.addEventListener('lr-render-error', () => failures++);
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    el.src = MP4_SRC;
    await el.updateComplete;
    rejectPlay(new DOMException('Stale playback rejection', 'NotAllowedError'));
    await aTimeout(0);
    await el.updateComplete;

    expect(failures).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
    expect(assertiveAnnouncements()).to.deep.equal([]);
  });

  it('clears a transient playback rejection after native playback succeeds', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const failure = new DOMException('Playback blocked', 'NotAllowedError');
    Object.defineProperty(media, 'duration', { value: 60, configurable: true });
    Object.defineProperty(media, 'play', { value: () => Promise.reject(failure), configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    await aTimeout(0);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;

    media.dispatchEvent(new Event('play'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.be.true;
  });

  it('synchronizes native and authored volume, mute, and rate state without drift', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    media.volume = 0.35;
    media.muted = true;
    media.playbackRate = 1.75;
    media.dispatchEvent(new Event('volumechange'));
    media.dispatchEvent(new Event('ratechange'));
    await el.updateComplete;
    expect(el.volume).to.equal(0.35);
    expect(el.muted).to.be.true;
    expect(el.playbackRate).to.equal(1.75);

    el.volume = 0.6;
    el.muted = false;
    el.playbackRate = 1.25;
    await el.updateComplete;
    expect(media.volume).to.equal(0.6);
    expect(media.muted).to.be.false;
    expect(media.playbackRate).to.equal(1.25);
  });

  it('emits one committed time for an unchanged seek completion and a correction when clamped', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    Object.defineProperty(media, 'currentTime', { value: 0, writable: true, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    const times: number[] = [];
    el.addEventListener('lr-time-change', (event) => times.push(event.detail.currentTime));

    el.seek(25);
    media.dispatchEvent(new Event('seeked'));
    expect(times).to.deep.equal([25]);

    el.seek(40);
    media.currentTime = 39.5;
    media.dispatchEvent(new Event('seeked'));
    expect(times).to.deep.equal([25, 40, 39.5]);
  });

  it('localizes and reorders playback-rate option text through avPlayerRateOption', async () => {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .rates=${[1, 1.5]}
        .strings=${{ avPlayerRateOption: 'vitesse {rate}' }}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="rate-select"] option')].map(
      (option) => option.textContent,
    );
    expect(labels).to.deep.equal(['vitesse 1', 'vitesse 1.5']);
  });
});

describe('cues and transcript', () => {
  it('renders one transcript row per cue with speaker and text', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows.length).to.equal(3);
    expect(rows[0].querySelector('[part="cue-speaker"]')!.textContent).to.equal('Host');
    expect(rows[2].querySelector('[part="cue-text"]')!.textContent).to.equal('Thanks for having me');
  });

  it('emits lr-cue-change and marks the active cue as currentTime crosses cue boundaries', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'currentTime', { value: 12, writable: true, configurable: true });
    const eventPromise = oneEvent(el, 'lr-cue-change');
    media.dispatchEvent(new Event('timeupdate'));
    const detail = (await eventPromise).detail;
    expect(detail).to.deep.equal({ cueId: 'c2', index: 1 });
    expect(Object.isFrozen(detail)).to.equal(true);
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows[1].getAttribute('aria-current')).to.equal('true');
  });

  it("clicking a transcript row seeks to that cue's start", async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const rows = cueRows(el);
    rows[2].click();
    expect(media.currentTime).to.equal(25);
  });

  it('formats a cue timestamp with an hours component once start reaches 1 hour', async () => {
    const longCues: LyraAvCue[] = [{ id: 'long', start: 3661, text: 'An hour in' }];
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${longCues}></lr-av-player>`)) as LyraAvPlayer;
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows[0].querySelector('[part="cue-time"]')!.textContent).to.equal('1:01:01');
  });

  it('formats cue times and playback-rate labels with the effective locale', async () => {
    const el = (await fixture(html`
      <lr-av-player
        lang="ar-EG"
        src=${MP3_SRC}
        .cues=${[{ id: 'c1', start: 61, text: 'Localized time' }]}
        .rates=${[1, 1.5]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const time = cueRows(el)[0].querySelector('[part="cue-time"]')!.textContent!;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="rate-select"] option')].map(
      (option) => option.textContent,
    );
    expect(time).to.equal('١:٠١');
    expect(labels).to.include('١٫٥×');
  });

  it('retains the first valid cue for each unique nonempty cue id', async () => {
    const cues: LyraAvCue[] = [
      { id: 'duplicate', start: 0, end: 10, text: 'First' },
      { id: 'duplicate', start: 2, end: 10, text: 'Second' },
    ];
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .cues=${cues}></lr-av-player>
    `)) as LyraAvPlayer;
    await el.updateComplete;
    const list = transcriptList(el);
    await list.updateComplete;
    const rows = cueRows(el);
    expect(el.cues).to.have.length(1);
    expect(el.cues[0]!.text).to.equal('First');
    expect(rows).to.have.length(1);
    expect(Object.isFrozen(el.cues)).to.be.true;
    expect(el.cues).not.to.equal(cues);
  });

  it('ends an omitted cue at the next chronological start without mutating caller order', async () => {
    const cues: LyraAvCue[] = [
      { id: 'later', start: 10, end: 20, text: 'Later finite cue' },
      { id: 'open', start: 0, text: 'Open until later' },
    ];
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${cues}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    Object.defineProperty(media, 'currentTime', { value: 5, writable: true, configurable: true });
    const initial = oneEvent(el, 'lr-cue-change');
    media.dispatchEvent(new Event('loadedmetadata'));
    expect((await initial).detail).to.deep.equal({ cueId: 'open', index: 1 });

    const atLater = oneEvent(el, 'lr-cue-change');
    media.currentTime = 12;
    media.dispatchEvent(new Event('timeupdate'));
    expect((await atLater).detail).to.deep.equal({ cueId: 'later', index: 0 });

    const afterLater = oneEvent(el, 'lr-cue-change');
    media.currentTime = 25;
    media.dispatchEvent(new Event('timeupdate'));
    expect((await afterLater).detail).to.deep.equal({ cueId: null, index: -1 });
    expect(cues.map((cue) => cue.id)).to.deep.equal(['later', 'open']);
  });

  it('reconciles cue identity immediately on a paused seek and cue replacement', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    Object.defineProperty(media, 'currentTime', { value: 0, writable: true, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;

    const seekChange = oneEvent(el, 'lr-cue-change');
    el.seek(12);
    expect((await seekChange).detail).to.deep.equal({ cueId: 'c2', index: 1 });

    const replacementChange = oneEvent(el, 'lr-cue-change');
    el.cues = [{ id: 'replacement', start: 0, end: 20, text: 'Replacement' }];
    await el.updateComplete;
    expect((await replacementChange).detail).to.deep.equal({ cueId: 'replacement', index: 0 });
    expect(cueRows(el)[0]?.getAttribute('aria-current')).to.equal('true');
  });
});

describe('transcript virtualization', () => {
  it('keeps cue keys and retained row identity stable across unrelated updates and insertion', async () => {
    const first: LyraAvCue = { id: 'first', start: 0, text: 'First' };
    const retained: LyraAvCue = { id: 'retained', start: 5, text: 'Retained' };
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .cues=${[first, retained]}></lr-av-player>
    `)) as LyraAvPlayer;
    const list = transcriptList(el);
    await list.updateComplete;
    const originalKeyFunction = list.keyFunction;
    if (!originalKeyFunction) throw new Error('transcript should provide a key function');
    const originalRenderItem = list.renderItem;
    const retainedKey = originalKeyFunction(retained, 1);
    const originalRow = renderedTranscriptRow(list, 1);
    expect(originalRow !== undefined).to.be.true;

    el.playbackRate = 1.5;
    await el.updateComplete;
    await list.updateComplete;
    expect(list.keyFunction === originalKeyFunction).to.be.true;
    expect(list.renderItem === originalRenderItem).to.be.true;

    el.cues = [{ id: 'inserted', start: 0, text: 'Inserted' }, first, retained];
    await el.updateComplete;
    await list.updateComplete;
    expect(list.keyFunction === originalKeyFunction).to.be.true;
    expect(list.keyFunction?.(retained, 2)).to.equal(retainedKey);
    const retainedRow = renderedTranscriptRow(list, 2);
    expect(retainedRow === originalRow).to.be.true;
  });

  it('uses the unique cue id as stable row identity and ignores a duplicate replacement', async () => {
    const first: LyraAvCue = { id: 'duplicate', start: 0, text: 'First duplicate' };
    const duplicate: LyraAvCue = { id: 'duplicate', start: 5, text: 'Ignored duplicate' };
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .cues=${[first]}></lr-av-player>
    `)) as LyraAvPlayer;
    const list = transcriptList(el);
    await list.updateComplete;
    const keyFunction = list.keyFunction;
    if (!keyFunction) throw new Error('transcript should provide a key function');
    const firstKey = keyFunction(first, 0);
    const firstRow = renderedTranscriptRow(list, 0);
    expect(firstRow !== undefined).to.be.true;

    el.cues = [first, duplicate];
    await el.updateComplete;
    await list.updateComplete;
    expect(keyFunction(first, 0)).to.equal(firstKey);
    expect(el.cues).to.have.length(1);
    expect(renderedTranscriptRow(list, 0) === firstRow).to.be.true;

    const replacement: LyraAvCue = { id: 'duplicate', start: 8, text: 'Replacement' };
    el.cues = [replacement];
    await el.updateComplete;
    await list.updateComplete;
    expect(keyFunction(replacement, 0)).to.equal(firstKey);
    expect(renderedTranscriptRow(list, 0) === firstRow).to.be.true;
  });

  it('refreshes rendered transcript cues for search state and locale changes without replacing its key function', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const list = transcriptList(el);
    await list.updateComplete;
    const keyFunction = list.keyFunction;
    const initialRenderItem = list.renderItem;

    await el.search('host');
    await list.updateComplete;
    expect(list.keyFunction === keyFunction).to.be.true;
    expect(list.renderItem === initialRenderItem).to.be.false;
    expect(cueRows(el)[0]?.hasAttribute('data-active-match')).to.be.true;

    const searchedRenderItem = list.renderItem;
    expect(await el.searchNext()).to.be.true;
    await list.updateComplete;
    expect(list.keyFunction === keyFunction).to.be.true;
    expect(list.renderItem === searchedRenderItem).to.be.false;
    expect(cueRows(el)[1]?.hasAttribute('data-active-match')).to.be.true;

    const beforeLocaleRenderItem = list.renderItem;
    el.lang = 'ar-EG';
    await el.updateComplete;
    await list.updateComplete;
    expect(list.keyFunction === keyFunction).to.be.true;
    expect(list.renderItem === beforeLocaleRenderItem).to.be.false;
    expect(cueRows(el)[0]?.querySelector('[part="cue-time"]')?.textContent).to.equal('٠:٠٠');
  });
});

describe('search', () => {
  it('search() matches cue text/speaker case-insensitively and returns the match count', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const count = await el.search('HOST');
    expect(count).to.equal(2);
  });

  it('reveals each active search result in the transcript without seeking playback', async () => {
    const cues = Array.from({ length: 80 }, (_unused, index): LyraAvCue => ({
      id: `cue-${index}`,
      start: index,
      text: index === 21 || index === 67 ? `Needle ${index}` : `Cue ${index}`,
    }));
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${cues}></lr-av-player>`)) as LyraAvPlayer;
    const list = transcriptList(el);
    await list.updateComplete;
    const media = mediaEl(el);
    Object.defineProperty(media, 'currentTime', { value: 12, writable: true, configurable: true });
    const calls: Array<{ index: number; align?: string; behavior?: ScrollBehavior }> = [];
    const originalScrollToIndex = list.scrollToIndex;
    list.scrollToIndex = (index, options) => {
      calls.push({ index, align: options?.align, behavior: options?.behavior });
    };
    try {
      expect(await el.search('needle')).to.equal(2);
      expect(calls.map((call) => call.index)).to.deep.equal([21]);
      expect(calls[0]?.align).to.equal('auto');
      expect(calls[0]?.behavior).to.equal('auto');
      expect(media.currentTime).to.equal(12);

      expect(await el.searchNext()).to.be.true;
      expect(calls.map((call) => call.index)).to.deep.equal([21, 67]);
      expect(await el.searchPrevious()).to.be.true;
      expect(calls.map((call) => call.index)).to.deep.equal([21, 67, 21]);

      expect(await el.search('not-present')).to.equal(0);
      expect(calls.length).to.equal(3);
      expect(media.currentTime).to.equal(12);
    } finally {
      list.scrollToIndex = originalScrollToIndex;
    }
  });

  it('uses locale-aware case folding for Turkish cue searches', async () => {
    const cues: LyraAvCue[] = [{ id: 'tr', start: 0, text: 'İSTANBUL' }];
    const el = (await fixture(html`
      <lr-av-player lang="tr" src=${MP3_SRC} .cues=${cues}></lr-av-player>
    `)) as LyraAvPlayer;
    expect(await el.search('istanbul')).to.equal(1);
  });

  it('reconciles search matches when cues are replaced instead of transferring the active index', async () => {
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>
    `)) as LyraAvPlayer;
    await el.search('host');
    el.searchNext();
    el.cues = [
      { id: 'new-1', start: 0, text: 'No match' },
      { id: 'new-2', start: 5, text: 'Host replacement' },
    ];
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows.filter((row) => row.hasAttribute('data-match')).length).to.equal(1);
    expect(rows[1].hasAttribute('data-active-match')).to.be.true;
  });

  it('search() with an empty/whitespace-only query clears matches instead of matching everything', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    await el.search('host');
    const count = await el.search('   ');
    expect(count).to.equal(0);
  });

  it('searchNext/searchPrevious wrap and emit lr-search-change with the active index', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    await el.search('host');
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.searchNext();
    expect((await eventPromise).detail).to.deep.equal({ query: 'host', matchCount: 2, activeIndex: 1 });
    const wrapPromise = oneEvent(el, 'lr-search-change');
    el.searchNext();
    expect((await wrapPromise).detail.activeIndex).to.equal(0);
  });

  it('searchPrevious() wraps to the last match and emits lr-search-change with the active index', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    await el.search('host'); // 2 matches, activeIndex starts at 0
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.searchPrevious();
    expect((await eventPromise).detail).to.deep.equal({ query: 'host', matchCount: 2, activeIndex: 1 });
    const wrapPromise = oneEvent(el, 'lr-search-change');
    el.searchPrevious();
    expect((await wrapPromise).detail.activeIndex).to.equal(0);
  });

  it('clearSearch() resets state and emits a zero-match lr-search-change', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    await el.search('host');
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
  });
});

describe('search highlighting', () => {
  it('reaches the DOM: data-match on every match, data-active-match only on the active one, cleared by clearSearch()', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    await el.search('host');
    await el.updateComplete;
    let rows = cueRows(el);
    expect(rows[0].hasAttribute('data-match')).to.be.true;
    expect(rows[0].hasAttribute('data-active-match')).to.be.true;
    expect(rows[1].hasAttribute('data-match')).to.be.true;
    expect(rows[1].hasAttribute('data-active-match')).to.be.false;
    expect(rows[2].hasAttribute('data-match')).to.be.false;

    el.searchNext();
    await el.updateComplete;
    rows = cueRows(el);
    expect(rows[0].hasAttribute('data-active-match'), 'active match moved off row 0').to.be.false;
    expect(rows[1].hasAttribute('data-active-match'), 'active match moved onto row 1').to.be.true;

    el.clearSearch();
    await el.updateComplete;
    rows = cueRows(el);
    expect(rows.some((row) => row.hasAttribute('data-match'))).to.be.false;
    expect(rows.some((row) => row.hasAttribute('data-active-match'))).to.be.false;
  });
});

describe('timeline marker RTL positioning', () => {
  it('keeps a time-range marker pinned to the physical start (left) edge under a RTL ancestor', async () => {
    const el = (await fixture(
      html`<lr-av-player
        dir="rtl"
        src=${MP3_SRC}
        .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 10, end: 20 } }]}
      ></lr-av-player>`,
    )) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    const marker = el.shadowRoot!.querySelector('[part="timeline-marker"]') as HTMLElement;
    const timelineRect = timeline.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    // start=10/duration=100 -> 10% in from the physical left edge, not the right, regardless of the
    // RTL ancestor -- the timeline's own `direction: ltr` pins its logical-inset children physically.
    const distFromLeft = markerRect.left - timelineRect.left;
    const distFromRight = timelineRect.right - markerRect.right;
    expect(distFromLeft).to.be.lessThan(distFromRight);
  });
});

describe('timeline marker activation', () => {
  it('clicking a marker seeks to its start, sets activeHighlightId, and emits lr-highlight-activate', async () => {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 30 } }]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const media = mediaEl(el);
    // No `end` on this highlight -- exercises the `h.anchor.end ?? h.anchor.start` fallback used to
    // position the marker's inline-size.
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const marker = el.shadowRoot!.querySelector('[part="timeline-marker"]') as HTMLButtonElement;
    const eventPromise = oneEvent(el, 'lr-highlight-activate');
    marker.click();
    expect((await eventPromise).detail).to.deep.equal({ id: 'h1' });
    expect(media.currentTime).to.equal(30);
    expect(el.activeHighlightId).to.equal('h1');
  });

  it('keeps a very short timeline marker visually addressable with a compliant hit target', async () => {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .highlights=${[{ id: 'point', anchor: { kind: 'time-range', start: 1 } }]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 10_000, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const rect = el.shadowRoot!
      .querySelector('[part="timeline-marker"]')!
      .getBoundingClientRect();
    expect(rect.width).to.be.at.least(40);
    expect(rect.height).to.be.at.least(40);
  });
});

it('renders marker actions as siblings of the slider and passes populated accessibility checks', async () => {
  const el = (await fixture(html`
    <lr-av-player
      src=${MP3_SRC}
      .highlights=${[{ id: 'marker', label: 'Chapter', anchor: { kind: 'time-range', start: 5 } }]}
    ></lr-av-player>
  `)) as LyraAvPlayer;
  const media = mediaEl(el);
  Object.defineProperty(media, 'duration', { value: 60, configurable: true });
  media.dispatchEvent(new Event('loadedmetadata'));
  await el.updateComplete;
  const slider = el.shadowRoot!.querySelector('[part="timeline"]')!;
  const marker = el.shadowRoot!.querySelector('[part="timeline-marker"]')!;
  expect(slider.contains(marker)).to.be.false;
  expect(marker.closest('[role="slider"]') === null).to.be.true;
  expect(slider.parentElement!.contains(marker)).to.be.true;
  await expect(el).to.be.accessible();
});

describe('hover feedback for click-to-seek/clickable parts', () => {
  it('gives the timeline strip a :hover treatment, so a mouse user gets feedback before clicking', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='timeline'\]:hover/);
  });

  it('gives timeline highlight markers a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='timeline-marker'\]:hover/);
  });

  it('gives transcript cue rows a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/lr-virtual-list::part\(cue\):hover/);
  });
});

describe('focus-visible feedback for keyboard-operable parts', () => {
  it('gives the seek/scrub timeline a :focus-visible outline, since it is a real role="slider" keyboard target', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='timeline'\]:focus-visible[^{]*\{[^}]*outline:/);
  });
});

describe('timeline click-to-seek', () => {
  it('clicking the timeline seeks proportionally to the click position', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    const rect = timeline.getBoundingClientRect();
    expect(rect.width, 'the timeline needs real layout for this test to be meaningful').to.be.greaterThan(0);
    timeline.dispatchEvent(new MouseEvent('click', { clientX: rect.left + rect.width / 2, bubbles: true }));
    expect(media.currentTime).to.be.closeTo(50, 1);
  });

  it('is a no-op before duration is known', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    timeline.dispatchEvent(new MouseEvent('click', { clientX: 10, bubbles: true }));
    expect(media.currentTime).to.equal(0);
  });
});

it('removes an inactive zero-duration timeline from sequential focus and ignores shortcuts', async () => {
  const el = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
  const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
  expect(timeline.getAttribute('aria-disabled')).to.equal('true');
  expect(timeline.tabIndex).to.equal(-1);
  const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  timeline.dispatchEvent(key);
  expect(key.defaultPrevented).to.be.false;

  const media = mediaEl(el);
  Object.defineProperty(media, 'duration', { value: 30, configurable: true });
  media.dispatchEvent(new Event('loadedmetadata'));
  await el.updateComplete;
  expect(timeline.getAttribute('aria-disabled')).to.equal('false');
  expect(timeline.tabIndex).to.equal(0);
});

describe('timeline keyboard seeking', () => {
  it('ArrowRight/ArrowLeft seek by 5s, or 15s with Shift', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    el.currentTime = 50;

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
    timeline.dispatchEvent(right);
    expect(media.currentTime).to.equal(55);
    expect(right.defaultPrevented, 'a handled key calls preventDefault()').to.be.true;

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, cancelable: true, bubbles: true });
    timeline.dispatchEvent(left);
    expect(media.currentTime).to.equal(40);
  });

  it('keeps elapsed-time ArrowRight advancing and ArrowLeft rewinding under RTL', async () => {
    const el = (await fixture(html`<lr-av-player dir="rtl" src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    expect(getComputedStyle(timeline).direction).to.equal('ltr');
    el.currentTime = 50;

    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));
    expect(media.currentTime).to.equal(55);
    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true }));
    expect(media.currentTime).to.equal(50);
  });

  it('Home/End jump to the start/duration', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;

    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', cancelable: true, bubbles: true }));
    expect(media.currentTime).to.equal(100);
    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', cancelable: true, bubbles: true }));
    expect(media.currentTime).to.equal(0);
  });

  it('Space toggles playback', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    let played = false;
    Object.defineProperty(media, 'play', { value: () => { played = true; return Promise.resolve(); }, configurable: true });
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;

    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
    expect(played).to.be.true;
  });

  it('an unhandled key is a no-op', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    el.currentTime = 50;
    timeline.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true }));
    expect(media.currentTime).to.equal(50);
  });
});

describe('time-range anchors', () => {
  it('applyAnchor seeks to the anchor start once metadata is loaded', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: 'time-range', start: 25 })).to.be.true;
    expect(media.currentTime).to.equal(25);
    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
  });
});

describe('numeric safety (finite clamping)', () => {
  it('clamps playbackRate to a finite, HTMLMediaElement-supported range instead of an unsanitized assignment (regression)', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    el.playbackRate = NaN;
    expect(el.playbackRate).to.equal(1);
    el.playbackRate = -5;
    expect(el.playbackRate).to.equal(0.0625);
    el.playbackRate = 999;
    expect(el.playbackRate).to.equal(16);
    // A value already within range passes through unchanged.
    el.playbackRate = 1.5;
    expect(el.playbackRate).to.equal(1.5);
  });

  it('clamps currentTime to a non-negative value, preserving an oversized pending seek until a real duration is known (regression)', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    // Before metadata loads, `duration` is still 0 (not yet real) -- clamping the upper bound to it
    // would wrongly zero out a legitimate pending seek, so only the lower bound applies here.
    el.currentTime = -5;
    expect(media.currentTime).to.equal(0);
    el.currentTime = NaN;
    expect(media.currentTime).to.equal(0);
    el.currentTime = 500;
    expect(media.currentTime).to.equal(500);

    // Once a real, positive duration is known, an oversized value clamps to it.
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    el.currentTime = 99999;
    expect(media.currentTime).to.equal(100);
    el.currentTime = -20;
    expect(media.currentTime).to.equal(0);
  });

  it('normalizes a non-finite native duration before it reaches state, events, ARIA, or time labels', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: Number.POSITIVE_INFINITY, configurable: true });
    const loadEvent = oneEvent(el, 'lr-load');
    media.dispatchEvent(new Event('loadedmetadata'));
    const loaded = await loadEvent;
    await el.updateComplete;
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;

    expect(loaded.detail.duration).to.equal(0);
    expect(timeline.getAttribute('aria-valuemax')).to.equal('0');
    expect(timeline.getAttribute('aria-valuetext')).to.not.match(/Infinity|NaN|∞/);
  });

  it('clamps a pending seek to the finite duration when metadata becomes available', async () => {
    const el = document.createElement('lr-av-player') as LyraAvPlayer;
    el.src = MP3_SRC;
    el.currentTime = 500;
    try {
      document.body.append(el);
      await el.updateComplete;
      const media = mediaEl(el);
      Object.defineProperty(media, 'duration', { value: 100, configurable: true });
      media.dispatchEvent(new Event('loadedmetadata'));
      expect(media.currentTime).to.equal(100);
    } finally {
      el.remove();
    }
  });

  it('drops non-finite/out-of-range/duplicate public rate options', async () => {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .rates=${[Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1, 2, 2]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const values = [...el.shadowRoot!.querySelectorAll('[part="rate-select"] option')].map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(values).to.deep.equal(['1', '2']);
  });

  it('normalizes non-finite cue times and waveform peaks before visible/canvas math', async () => {
    const cues: LyraAvCue[] = [{
      id: 'bad-time',
      start: Number.POSITIVE_INFINITY,
      end: Number.NaN,
      text: 'Still renderable',
    }];
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .cues=${cues}
        .peaks=${[Number.NaN, Number.POSITIVE_INFINITY, -1, 2]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await list.updateComplete;
    const cueTime = cueRows(el)[0]!.querySelector('[part~="cue-time"]')!.textContent!;
    expect(cueTime).to.not.match(/Infinity|NaN|∞/);

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const originalFillRect = context.fillRect.bind(context);
    const calls: number[][] = [];
    context.fillRect = (...args: [number, number, number, number]) => {
      calls.push(args);
    };
    try {
      window.dispatchEvent(new Event('resize'));
      expect(calls.length).to.equal(4);
      expect(calls.every((args) => args.every(Number.isFinite))).to.be.true;
    } finally {
      context.fillRect = originalFillRect;
    }
  });
});

it('contains unbroken transcript text inside a 320px allocation', async () => {
  const wrapper = (await fixture(html`
    <div style="inline-size: 320px">
      <lr-av-player
        src=${MP3_SRC}
        .cues=${[{ id: 'long', start: 0, text: 'Transcript'.repeat(250) }]}
      ></lr-av-player>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
    updateComplete: Promise<boolean>;
  };
  await list.updateComplete;
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
});

for (const dir of ['ltr', 'rtl'] as const) {
  it(`contains AV chrome and actions in a 320px ${dir} allocation`, async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${dir} style="inline-size:320px; max-inline-size:320px; overflow:auto">
        <lr-av-player
          style="max-inline-size:100%"
          src=${MP3_SRC}
          .strings=${{ avPlayerRateOption: `Extremely long localized playback rate {rate}` }}
          .highlights=${[
            { id: 'first', anchor: { kind: 'time-range', start: 5 } },
            { id: 'second', anchor: { kind: 'time-range', start: 20 } },
          ]}
        ></lr-av-player>
      </div>
    `);
    const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 60, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    const bounds = wrapper.getBoundingClientRect();
    for (const control of el.shadowRoot!.querySelectorAll<HTMLElement>('select, [part="timeline"], [part="timeline-marker"]')) {
      const rect = control.getBoundingClientRect();
      expect(rect.left).to.be.at.least(bounds.left - 0.5);
      expect(rect.right).to.be.at.most(bounds.right + 0.5);
    }
  });
}

describe('seeking before the media element mounts', () => {
  it('queues a currentTime set before mount as a pending seek and applies it once metadata loads', async () => {
    const el = document.createElement('lr-av-player') as LyraAvPlayer;
    el.src = MP3_SRC;
    // Not yet connected: Lit creates `renderRoot` lazily on first connect/update, so the
    // `@query('audio, video')`-backed `mediaEl` genuinely resolves to nothing here, exercising the
    // pendingSeek branch instead of writing straight through to a native element.
    el.currentTime = 42;
    try {
      document.body.append(el);
      await el.updateComplete;
      const media = mediaEl(el);
      expect(media.currentTime, 'not yet applied to the native element').to.equal(0);

      Object.defineProperty(media, 'duration', { value: 100, configurable: true });
      media.dispatchEvent(new Event('loadedmetadata'));
      expect(media.currentTime, 'the pending seek is flushed once metadata loads').to.equal(42);
    } finally {
      el.remove();
    }
  });

  it('drops a pending seek when the source changes before metadata loads', async () => {
    const el = document.createElement('lr-av-player') as LyraAvPlayer;
    el.src = MP3_SRC;
    el.currentTime = 42;
    try {
      document.body.append(el);
      await el.updateComplete;
      el.src = MP4_SRC;
      await el.updateComplete;
      const media = mediaEl(el);
      Object.defineProperty(media, 'duration', { value: 100, configurable: true });
      media.dispatchEvent(new Event('loadedmetadata'));
      expect(media.currentTime).to.equal(0);
    } finally {
      el.remove();
    }
  });
});

describe('waveform', () => {
  it('renders a plain seek rail when peaks is empty, and a canvas when peaks is set', async () => {
    const withoutPeaks = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    expect((withoutPeaks.shadowRoot!.querySelector('canvas')) == null).to.equal(true);
    const withPeaks = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.1, 0.5, 0.9, 0.3]}></lr-av-player>`)) as LyraAvPlayer;
    expect((withPeaks.shadowRoot!.querySelector('canvas')) != null).to.equal(true);
  });

  it('still redraws on window resize after a disconnect/reconnect (regression)', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.2, 0.8]}></lr-av-player>`)) as LyraAvPlayer;
    const parent = el.parentElement!;

    // A reparent runs disconnectedCallback (which removes the window resize
    // listener) then connectedCallback, with no new firstUpdated pass.
    el.remove();
    parent.append(el);
    await el.updateComplete;

    // The resize handler dispatches through `this.drawWaveform()` at call
    // time, so an own-property spy shadows the prototype method and records
    // whether the window listener is still attached.
    let redraws = 0;
    (el as unknown as { drawWaveform: () => void }).drawWaveform = () => {
      redraws += 1;
    };
    window.dispatchEvent(new Event('resize'));
    expect(redraws, 'the resize listener should be re-attached on reconnect').to.equal(1);
  });

  it('resizes the waveform backing store when sibling allocation changes without a window resize', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="display:flex; inline-size:640px">
        <div id="sibling" style="flex:0 0 0"></div>
        <lr-av-player style="flex:1 1 auto; min-inline-size:0" .peaks=${[0.2, 0.8]}></lr-av-player>
      </div>
    `);
    const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    await waitUntil(() => canvas.width > 100);
    const initialWidth = canvas.width;

    (wrapper.querySelector('#sibling') as HTMLElement).style.flexBasis = '480px';
    await waitUntil(() => canvas.width < initialWidth / 2);
    expect(canvas.width).to.be.greaterThan(0);
  });

  it('caps huge CSS-size and DPR signals before allocating the waveform backing store', async () => {
    const el = (await fixture(html`<lr-av-player .peaks=${[0.25, 0.75]}></lr-av-player>`)) as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { value: 1000, configurable: true });
    Object.defineProperty(canvas, 'clientWidth', { value: 10_000, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 10_000, configurable: true });
    try {
      window.dispatchEvent(new Event('resize'));
      expect(canvas.width).to.be.at.most(4096);
      expect(canvas.height).to.be.at.most(4096);
      expect(canvas.width * canvas.height).to.be.at.most(8_388_608);
    } finally {
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('moves resize, DPR, and computed-style work to the adopted owner window', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalDpr = Object.getOwnPropertyDescriptor(frameWindow, 'devicePixelRatio');
    const originalGetComputedStyle = frameWindow.getComputedStyle.bind(frameWindow);
    const originalGetComputedStyleDescriptor = Object.getOwnPropertyDescriptor(
      frameWindow,
      'getComputedStyle',
    );
    let ownerStyleReads = 0;
    Object.defineProperty(frameWindow, 'devicePixelRatio', { value: 2, configurable: true });
    Object.defineProperty(frameWindow, 'getComputedStyle', {
      configurable: true,
      value: (element: Element, pseudo?: string | null) => {
        ownerStyleReads += 1;
        return originalGetComputedStyle(element, pseudo);
      },
    });

    const el = document.createElement('lr-av-player') as LyraAvPlayer;
    el.src = MP3_SRC;
    el.peaks = [0.25, 0.75];
    try {
      document.body.append(el);
      await el.updateComplete;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;

      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      Object.defineProperty(canvas, 'clientWidth', { value: 12, configurable: true });
      Object.defineProperty(canvas, 'clientHeight', { value: 6, configurable: true });
      canvas.width = 1;
      ownerStyleReads = 0;

      frameWindow.dispatchEvent(new frameWindow.Event('resize'));
      expect(canvas.width).to.equal(24);
      expect(canvas.height).to.equal(12);
      expect(ownerStyleReads).to.be.greaterThan(0);

      canvas.width = 5;
      window.dispatchEvent(new Event('resize'));
      expect(canvas.width, 'the original window listener should have been removed').to.equal(5);
    } finally {
      el.remove();
      if (originalDpr) Object.defineProperty(frameWindow, 'devicePixelRatio', originalDpr);
      else delete (frameWindow as unknown as { devicePixelRatio?: number }).devicePixelRatio;
      if (originalGetComputedStyleDescriptor) {
        Object.defineProperty(frameWindow, 'getComputedStyle', originalGetComputedStyleDescriptor);
      } else {
        delete (frameWindow as unknown as { getComputedStyle?: typeof getComputedStyle })
          .getComputedStyle;
      }
      iframe.remove();
    }
  });

  it('falls back to devicePixelRatio 1 and 1px dimensions when those signals are unavailable', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.2, 0.6]}></lr-av-player>`)) as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    Object.defineProperty(canvas, 'clientWidth', { value: 0, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 0, configurable: true });
    try {
      window.dispatchEvent(new Event('resize'));
      expect(canvas.width).to.equal(1);
      expect(canvas.height).to.equal(1);
    } finally {
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('is a no-op when the canvas cannot provide a 2d context', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.2, 0.6]}></lr-av-player>`)) as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    Object.defineProperty(canvas, 'getContext', { value: () => null, configurable: true });
    expect(() => window.dispatchEvent(new Event('resize'))).to.not.throw();
  });

  it('decimates waveform painting to physical canvas columns without changing peaks', async () => {
    const source = Array.from({ length: 41 }, () => 0);
    source[9] = 1;
    source[40] = 0.3;
    const peaks = Object.freeze([...source]) as unknown as number[];
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${peaks}></lr-av-player>`)) as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const originalFillRect = context.fillRect.bind(context);
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    const calls: Array<[number, number, number, number]> = [];

    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    Object.defineProperty(canvas, 'clientWidth', { value: 4, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 10, configurable: true });
    context.fillRect = (...args: [number, number, number, number]) => {
      calls.push(args);
    };
    try {
      window.dispatchEvent(new Event('resize'));

      expect(canvas.width).to.equal(8);
      expect(calls.length).to.equal(8);
      expect(el.peaks).not.to.equal(peaks);
      expect(el.peaks).to.deep.equal(source);
      expect(Object.isFrozen(el.peaks)).to.be.true;
      expect(calls.some(([, , , barHeight]) => barHeight === 10)).to.equal(true);
      expect(calls[calls.length - 1]![3]).to.equal(3);
      expect(calls.every((args) => args.every(Number.isFinite))).to.equal(true);
    } finally {
      context.fillRect = originalFillRect;
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('uses finite waveform geometry when canvas measurements or devicePixelRatio are non-finite', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.2, 0.6, 0.8]}></lr-av-player>`)) as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const originalFillRect = context.fillRect.bind(context);
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    const calls: Array<[number, number, number, number]> = [];

    Object.defineProperty(window, 'devicePixelRatio', { value: Number.POSITIVE_INFINITY, configurable: true });
    Object.defineProperty(canvas, 'clientWidth', { value: Number.POSITIVE_INFINITY, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: Number.NaN, configurable: true });
    context.fillRect = (...args: [number, number, number, number]) => {
      calls.push(args);
    };
    try {
      expect(() => window.dispatchEvent(new Event('resize'))).to.not.throw();
      expect(canvas.width).to.equal(1);
      expect(canvas.height).to.equal(1);
      expect(calls.length).to.equal(1);
      expect(calls.every((args) => args.every(Number.isFinite))).to.equal(true);
    } finally {
      context.fillRect = originalFillRect;
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('keeps a stable canvas ref callback identity, so an unrelated re-render does not redraw the waveform (regression)', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.2, 0.8]}></lr-av-player>`)) as LyraAvPlayer;
    let redraws = 0;
    (el as unknown as { drawWaveform: () => void }).drawWaveform = () => {
      redraws += 1;
    };
    // A re-render triggered by something other than `peaks` (playbackRate here) must not re-fire
    // the canvas ref callback -- a fresh arrow-function literal per render() call would make Lit
    // treat the persisting canvas element as an unmount+remount, redundantly redrawing every peak
    // bar on every unrelated update (e.g. each `timeupdate` tick while playing).
    el.playbackRate = 1.5;
    await el.updateComplete;
    expect(redraws, 'an unrelated re-render should not redraw the waveform').to.equal(0);
  });

  it('uses the --lr-color-brand custom property for the waveform fill when the host defines it', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[1, 1]}></lr-av-player>`)) as LyraAvPlayer;
    el.style.setProperty('--lr-color-brand', 'rgb(0, 200, 0)');
    window.dispatchEvent(new Event('resize'));
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.fillStyle = 'rgb(0, 200, 0)';
    expect(ctx.fillStyle).to.equal(probe.fillStyle);
  });

  it('resolves an invalid waveform token to a valid color instead of reusing the prior fill', async () => {
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .peaks=${[1, 1]}></lr-av-player>
    `)) as LyraAvPlayer;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    el.style.setProperty('--lr-color-brand', 'rgb(0, 200, 0)');
    window.dispatchEvent(new Event('resize'));
    const prior = ctx.fillStyle;

    el.style.setProperty('--lr-color-brand', 'definitely-not-a-color');
    window.dispatchEvent(new Event('resize'));
    expect(ctx.fillStyle).to.not.equal(prior);
    const probe = document.createElement('canvas').getContext('2d')!;
    const before = probe.fillStyle;
    probe.fillStyle = ctx.fillStyle;
    expect(probe.fillStyle).to.equal(ctx.fillStyle);
    expect(probe.fillStyle).to.not.equal(before);
  });
});

describe('tracks', () => {
  it('renders a <track> for each safe source and silently drops unsafe ones', async () => {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .tracks=${[
          { src: 'https://example.test/en.vtt', kind: 'subtitles', srclang: 'en', label: 'English', default: true },
          { src: 'javascript:alert(1)', kind: 'captions', srclang: 'fr', label: 'French' },
        ]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const media = mediaEl(el);
    const trackEls = [...media.querySelectorAll('track')];
    expect(trackEls.length).to.equal(1);
    expect(trackEls[0].src).to.equal('https://example.test/en.vtt');
    expect(trackEls[0].label).to.equal('English');
    expect(trackEls[0].default).to.be.true;
  });
});

describe('accessibility', () => {
  it('is accessible with cues and peaks set', async () => {
    const el = await fixture(html`<lr-av-player src=${MP3_SRC} name="Episode 1" .cues=${CUES} .peaks=${[0.2, 0.6, 0.4]}></lr-av-player>`);
    await expect(el).to.be.accessible();
  });

  it('uses distinct aggregate and native-media names', async () => {
    const named = (await fixture(html`<lr-av-player src=${MP3_SRC} name="Episode 1"></lr-av-player>`)) as LyraAvPlayer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Episode 1');
    expect(mediaEl(named).getAttribute('aria-label')).to.equal('Audio/video player');

    // With no name/aria-label, the localized default still applies to the media element.
    const unnamed = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
    const label = mediaEl(unnamed).getAttribute('aria-label');
    expect(label).to.be.a('string').and.to.not.equal('');
  });

  it('keeps an authored host name on the host and avoids a duplicate named shadow region', async () => {
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} aria-label="Episode controls"></lr-av-player>
    `)) as LyraAvPlayer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(el.getAttribute('aria-label')).to.equal('Episode controls');
    expect(
      (el as unknown as { semanticInternals: ElementInternals }).semanticInternals.role,
      'the authored host name belongs to a real aggregate region',
    ).to.equal('region');
    expect(base.hasAttribute('role')).to.be.false;
    expect(base.hasAttribute('aria-label')).to.be.false;
    expect(mediaEl(el).getAttribute('aria-label')).to.equal('Audio/video player');
  });
});

describe('source identity', () => {
  it('replaces the media generation and clears stale state when src changes', async () => {
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>
    `)) as LyraAvPlayer;
    const oldMedia = mediaEl(el);
    Object.defineProperty(oldMedia, 'duration', { value: 100, configurable: true });
    Object.defineProperty(oldMedia, 'currentTime', { value: 12, writable: true, configurable: true });
    oldMedia.dispatchEvent(new Event('loadedmetadata'));
    oldMedia.dispatchEvent(new Event('timeupdate'));
    oldMedia.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;

    el.src = MP4_SRC;
    await el.updateComplete;
    const replacement = mediaEl(el);
    expect((replacement) !== (oldMedia)).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]')!;
    expect(timeline.getAttribute('aria-valuemax')).to.equal('0');
    expect(timeline.getAttribute('aria-valuenow')).to.equal('0');
    expect(cueRows(el).some((row) => row.getAttribute('aria-current') === 'true')).to.be.false;

    Object.defineProperty(oldMedia, 'duration', { value: 999, configurable: true });
    oldMedia.dispatchEvent(new Event('loadedmetadata'));
    oldMedia.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(timeline.getAttribute('aria-valuemax')).to.equal('0');
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('clears an earlier native error after the current source loads successfully', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    media.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    Object.defineProperty(media, 'duration', { value: 60, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('preserves valid native playback preferences across a source generation', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const oldMedia = mediaEl(el);
    oldMedia.volume = 0.4;
    oldMedia.muted = true;
    oldMedia.playbackRate = 1.5;
    oldMedia.dispatchEvent(new Event('volumechange'));
    oldMedia.dispatchEvent(new Event('ratechange'));

    el.src = MP4_SRC;
    await el.updateComplete;
    const replacement = mediaEl(el);

    expect(replacement.volume).to.equal(0.4);
    expect(replacement.muted).to.be.true;
    expect(replacement.playbackRate).to.equal(1.5);
  });

  it('pauses and rejects native events while disconnected, then listens once after reconnect', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const parent = el.parentElement!;
    const media = mediaEl(el);
    let pauses = 0;
    Object.defineProperty(media, 'pause', {
      configurable: true,
      value: () => { pauses += 1; },
    });
    let timeUpdates = 0;
    el.addEventListener('timeupdate', () => { timeUpdates += 1; });

    el.remove();
    media.dispatchEvent(new Event('timeupdate'));
    parent.append(el);
    await el.updateComplete;
    media.dispatchEvent(new Event('timeupdate'));

    expect(pauses).to.equal(1);
    expect(timeUpdates).to.equal(1);
  });
});

describe('i18n', () => {
  it('routes every localized string through a .strings override, reaching the rendered DOM', async () => {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .cues=${CUES}
        .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 5 } }]}
        .strings=${{
          avPlayerLabel: 'Lecteur audio/vidéo',
          avPlayerFailedToLoad: 'Échec du chargement du média.',
          avPlayerPlaybackRate: 'Vitesse de lecture',
          avPlayerTimeline: 'Chercher',
          avPlayerPosition: '{current} sur {duration}',
          avPlayerTranscript: 'Transcription',
          viewerHighlightLabel: 'Surligner',
        }}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    await el.updateComplete;

    const media = mediaEl(el);
    expect(media.getAttribute('aria-label')).to.equal('Lecteur audio/vidéo');

    const rateSelect = el.shadowRoot!.querySelector('[part="rate-select"]') as HTMLSelectElement;
    expect(rateSelect.getAttribute('aria-label')).to.equal('Vitesse de lecture');

    const timeline = el.shadowRoot!.querySelector('[part="timeline"]') as HTMLElement;
    expect(timeline.getAttribute('aria-label')).to.equal('Chercher');
    expect(timeline.getAttribute('aria-valuetext')).to.equal('0:00 sur 0:00');

    const transcript = el.shadowRoot!.querySelector('[part="transcript"]') as HTMLElement;
    expect(transcript.getAttribute('aria-label')).to.equal('Transcription');

    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const marker = el.shadowRoot!.querySelector('[part="timeline-marker"]') as HTMLElement;
    expect(marker.getAttribute('aria-label')).to.equal('Surligner');

    const errorPromise = oneEvent(el, 'lr-render-error');
    media.dispatchEvent(new Event('error'));
    await errorPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Échec du chargement du média.');
  });
});

describe('render error', () => {
  it('fires one lr-render-error and announcement for duplicate native failures in one generation', async () => {
    const el = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    let count = 0;
    el.addEventListener('lr-render-error', () => count++);
    media.dispatchEvent(new Event('error'));
    media.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(count).to.equal(1);
    expect(assertiveAnnouncements()).to.deep.equal(['The media failed to load.']);
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
  });

  it('preserves native MediaError identity and emits again only for a replacement error', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const first = { code: 3, message: 'Decode failed' } as MediaError;
    const second = { code: 4, message: 'Unsupported source' } as MediaError;
    const reported: unknown[] = [];
    el.addEventListener('lr-render-error', (event) => reported.push(event.detail.error));
    Object.defineProperty(media, 'error', { value: first, configurable: true });
    media.dispatchEvent(new Event('error'));
    media.dispatchEvent(new Event('error'));
    Object.defineProperty(media, 'error', { value: second, configurable: true });
    media.dispatchEvent(new Event('error'));
    expect(reported).to.deep.equal([first, second]);
  });
});

describe('render branches', () => {
  it('renders an error region instead of a media element when src is unsafe', async () => {
    const el = (await fixture(html`
      <lr-av-player src="javascript:alert(1)" aria-label="Episode controls"></lr-av-player>
    `)) as LyraAvPlayer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(el.shadowRoot!.querySelectorAll('audio, video').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    expect(base.hasAttribute('role')).to.be.false;
    expect(base.hasAttribute('aria-label')).to.be.false;
    expect(el.getAttribute('aria-label')).to.equal('Episode controls');
    expect(el.shadowRoot!.querySelector('[part="error"]')!.getAttribute('role')).to.equal(null);
    expect(assertiveAnnouncements(), 'an already-invalid mount is not a live transition').to.deep.equal([]);
    await expect(el).to.be.accessible();
  });

  it('drops unsafe video poster URLs while retaining safe media schemes', async () => {
    const blobPoster = URL.createObjectURL(
      new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }),
    );
    try {
      const el = (await fixture(html`<lr-av-player src=${MP4_SRC}></lr-av-player>`)) as LyraAvPlayer;
      for (const poster of [
        '#poster',
        'http://example.test/cover.jpg',
        blobPoster,
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      ]) {
        el.poster = poster;
        await el.updateComplete;
        expect(mediaEl(el).getAttribute('poster'), poster).to.equal(poster);
      }

      for (const poster of ['javascript:alert(1)', 'java\tscript:alert(1)']) {
        el.poster = poster;
        await el.updateComplete;
        expect(mediaEl(el).hasAttribute('poster'), poster).to.be.false;
      }
    } finally {
      URL.revokeObjectURL(blobPoster);
    }
  });

  it('announces a post-mount transition to an unsafe source without losing the named region', async () => {
    const el = (await fixture(html`<lr-av-player aria-label="Episode controls"></lr-av-player>`)) as LyraAvPlayer;
    const rejection = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await el.updateComplete;
    expect((await rejection).detail.error).to.be.instanceOf(TypeError);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('role')).to.be.false;
    expect(base.hasAttribute('aria-label')).to.be.false;
    expect(el.getAttribute('aria-label')).to.equal('Episode controls');
    expect(assertiveAnnouncements()).to.deep.equal(['The media failed to load.']);
  });

  it('treats detached and first-reconnect unsafe source writes as state, not observable transitions', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const parent = el.parentElement!;
    let failures = 0;
    el.addEventListener('lr-render-error', () => failures++);

    el.remove();
    el.src = 'javascript:detached()';
    await el.updateComplete;
    expect(failures).to.equal(0);
    parent.append(el);
    await el.updateComplete;
    expect(failures).to.equal(0);
    expect(assertiveAnnouncements()).to.deep.equal([]);

    el.src = MP3_SRC;
    await el.updateComplete;
    el.remove();
    el.src = 'javascript:queued-before-reconnect()';
    parent.append(el);
    await el.updateComplete;
    expect(failures).to.equal(0);
    expect(assertiveAnnouncements()).to.deep.equal([]);
  });

  it('does not report source absence as an unsafe-source failure', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    let failures = 0;
    el.addEventListener('lr-render-error', () => failures++);
    el.src = '';
    await el.updateComplete;
    expect(failures).to.equal(0);
  });

  it('omits the src attribute entirely when kind is forced to audio with no src set', async () => {
    const el = (await fixture(html`<lr-av-player kind="audio"></lr-av-player>`)) as LyraAvPlayer;
    await el.updateComplete;
    const audio = el.shadowRoot!.querySelector('audio');
    // A present-but-empty src makes the element resolve the page URL as media and fire `error`
    // (MediaError.code 4), which would paint a role="alert" failure state for a component the
    // consumer has not configured yet.
    expect(audio!.hasAttribute('src'), 'src must be absent, not empty').to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });
});

describe('active-state cssprop escape hatches', () => {
  function resolvedIn(root: DocumentFragment | ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    (root as ShadowRoot).appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }
  const cueRoot = (el: LyraAvPlayer): ShadowRoot => el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;

  async function withMarker(style = ''): Promise<{ el: LyraAvPlayer; marker: HTMLElement }> {
    const wrapper = (await fixture(html`<div style=${style}>
      <lr-av-player
        src=${MP3_SRC}
        .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 10, end: 20 } }]}
        active-highlight-id="h1"
      ></lr-av-player>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const marker = el.shadowRoot!.querySelector('[part="timeline-marker"][data-active]') as HTMLElement;
    return { el, marker };
  }

  // `renderCue`'s rows are committed into `<lr-virtual-list>`'s own shadow root, so this component's
  // stylesheet reaches them through `lr-virtual-list::part(...)` rather than a bare `[part='cue']`
  // selector, and the state variants ride a part list (`cue cue-current`) since Shadow Parts forbids
  // an attribute selector after `::part()`. Every assertion below is on the real cue button in the
  // real state -- a stylesheet-text or probe-element assertion cannot tell a matching selector apart
  // from an inert one. `[part='timeline-marker']` renders directly in av-player's own shadow root.
  async function withCues(style = ''): Promise<LyraAvPlayer> {
    const wrapper = (await fixture(html`<div style=${style}><lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'currentTime', { value: 12, writable: true, configurable: true });
    media.dispatchEvent(new Event('timeupdate')); // 12s lands inside cue c2 -> aria-current
    await el.search('host'); // matches c1/c2, activeIndex 0 -> c1 carries data-active-match
    await el.updateComplete;
    expect(cueRoot(el).querySelector('[part~="cue"][aria-current="true"]'), 'a cue is current').to.exist;
    expect(cueRoot(el).querySelector('[part~="cue"][data-active-match]'), 'a cue is the active match').to.exist;
    return el;
  }

  const currentCue = (el: LyraAvPlayer): HTMLElement => cueRoot(el).querySelector('[part~="cue-current"]') as HTMLElement;
  const activeMatchCue = (el: LyraAvPlayer): HTMLElement => cueRoot(el).querySelector('[part~="cue-active-match"]') as HTMLElement;

  it('renders a cue with the component chrome rather than the raw UA button appearance', async () => {
    const el = await withCues();
    const cue = cueRows(el)[2]; // neither current nor a search match: the plain `cue` treatment
    const style = getComputedStyle(cue);
    // A raw UA button computes to padding 1px 6px, a grey background and a visible border here.
    expect(style.padding).to.not.equal('1px 6px');
    expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(style.borderStyle).to.equal('none');
    expect(style.display).to.equal('block');
    expect(style.textAlign).to.equal('start');
    expect(style.cursor).to.equal('pointer');
    expect(style.color).to.equal(resolvedIn(cueRoot(el), 'color: var(--lr-color-text)', 'color'));
  });

  it('styles a cue time and speaker label', async () => {
    const el = await withCues();
    const time = cueRoot(el).querySelector('[part="cue-time"]') as HTMLElement;
    expect(getComputedStyle(time).color).to.equal(resolvedIn(cueRoot(el), 'color: var(--lr-color-text)', 'color'));
    const speaker = cueRoot(el).querySelector('[part="cue-speaker"]') as HTMLElement;
    expect(getComputedStyle(speaker).fontWeight).to.equal(
      getComputedStyle(speaker).getPropertyValue('--lr-font-weight-semibold').trim(),
    );
  });

  it('outlines every search match, and the active match with the heavier solid treatment', async () => {
    const el = await withCues();
    const match = activeMatchCue(el);
    expect(getComputedStyle(match).outlineStyle).to.equal('solid');
    const plainMatch = cueRows(el).find((row) => row.hasAttribute('data-match') && !row.hasAttribute('data-active-match'))!;
    expect(getComputedStyle(plainMatch).outlineStyle).to.equal('dashed');
    const warning = resolvedIn(cueRoot(el), 'outline: 1px solid var(--lr-color-warning)', 'outline-color');
    expect(getComputedStyle(plainMatch).outlineColor).to.equal(warning);
  });

  it('--lr-av-player-marker-active-color recolors the active timeline-marker outline', async () => {
    const { marker } = await withMarker('--lr-av-player-marker-active-color: rgb(0, 51, 102)');
    expect(getComputedStyle(marker).outlineColor).to.equal('rgb(0, 51, 102)');
  });

  it('--lr-av-player-marker-bg / --lr-av-player-marker-<tone>-bg retint each timeline-marker tone independently of the shared success/warning/danger tokens', async () => {
    const wrapper = (await fixture(html`<div style="--lr-av-player-marker-bg: rgb(10, 20, 30); --lr-av-player-marker-success-bg: rgb(40, 50, 60)">
      <lr-av-player
        src=${MP3_SRC}
        .highlights=${[
          { id: 'h1', anchor: { kind: 'time-range', start: 5 } },
          { id: 'h2', anchor: { kind: 'time-range', start: 20 }, tone: 'success' },
        ]}
      ></lr-av-player>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const markers = [...el.shadowRoot!.querySelectorAll('[part="timeline-marker"]')] as HTMLElement[];
    expect(markers.length).to.equal(2);
    expect(getComputedStyle(markers[0]).backgroundColor, 'the untoned marker reads --lr-av-player-marker-bg').to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(markers[1]).backgroundColor, 'the success-toned marker reads --lr-av-player-marker-success-bg').to.equal('rgb(40, 50, 60)');
  });

  it('mixes a timeline marker hover and pressed fill from its own tone, and makes pressed the stronger step', async () => {
    // The interaction states used to be a brightness filter, which needed no knowledge of the fill
    // and so could not be got wrong per tone. A colour mix can be: written against the untoned
    // default it would flatten every toned marker to brand the moment the pointer arrived. Hence
    // the two halves below -- each marker mixes from ITS OWN resting fill, and pressed is a further
    // step rather than a repeat of hover.
    const wrapper = (await fixture(html`<div>
      <lr-av-player
        kind="audio"
        .highlights=${[
          { id: 'h1', anchor: { kind: 'time-range', start: 5 } },
          { id: 'h2', anchor: { kind: 'time-range', start: 60 }, tone: 'danger' },
        ]}
      ></lr-av-player>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 100, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const markers = [...el.shadowRoot!.querySelectorAll('[part="timeline-marker"]')] as HTMLElement[];
    expect(markers.length).to.equal(2);

    const plainFill = getComputedStyle(markers[0]).backgroundColor;
    const dangerFill = getComputedStyle(markers[1]).backgroundColor;
    expect(plainFill, 'the untoned fill is not empty').to.not.equal('');
    expect(dangerFill, 'the danger tone supplies its own fill for the mixes to read').to.not.equal(plainFill);

    const target = markers[1];
    target.scrollIntoView({ block: 'center', inline: 'center' });
    await aTimeout(0);
    const rect = target.getBoundingClientRect();
    expect(rect.width, 'the marker has real geometry to point at').to.be.greaterThan(0);
    const resting = getComputedStyle(target).backgroundColor;
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await aTimeout(0);
      const hit = el.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      expect(
        target.matches(':hover'),
        `the native pointer reaches the marker (rect ${rect.left},${rect.top},${rect.width},${rect.height}; viewport ${innerWidth}x${innerHeight}; hit ${(hit as Element | null)?.getAttribute('part') ?? (hit as Element | null)?.localName ?? 'none'})`,
      ).to.be.true;
      const hovered = getComputedStyle(target).backgroundColor;
      expect(hovered, 'hover moves the marker off its resting fill').to.not.equal(resting);

      await sendMouse({ type: 'down' });
      await aTimeout(0);
      const pressed = getComputedStyle(target).backgroundColor;
      expect(pressed, 'pressed is a further step, not a repeat of hover').to.not.equal(hovered);
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });

  it('--lr-av-player-cue-current-bg retints the current transcript cue', async () => {
    const el = await withCues('--lr-av-player-cue-current-bg: rgb(0, 51, 102)');
    expect(getComputedStyle(currentCue(el)).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('--lr-av-player-cue-active-match-color recolors the active search-match cue outline', async () => {
    const el = await withCues('--lr-av-player-cue-active-match-color: rgb(0, 51, 102)');
    expect(getComputedStyle(activeMatchCue(el)).outlineColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the pre-hatch tokens when unset', async () => {
    const { el: elM, marker } = await withMarker();
    expect(getComputedStyle(marker).outlineColor).to.equal(
      resolvedIn(elM.shadowRoot!, 'outline: 1px solid var(--lr-color-brand)', 'outline-color'),
    );
    expect(getComputedStyle(marker).backgroundColor).to.equal(
      resolvedIn(elM.shadowRoot!, 'background: color-mix(in srgb, var(--lr-color-brand) 35%, transparent)', 'background-color'),
    );
    const el = await withCues();
    expect(getComputedStyle(currentCue(el)).backgroundColor).to.equal(
      resolvedIn(cueRoot(el), 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(activeMatchCue(el)).outlineColor).to.equal(
      resolvedIn(cueRoot(el), 'outline: 1px solid var(--lr-color-warning)', 'outline-color'),
    );
  });

  it('exposes the cue parts to a consumer through exportparts', async () => {
    const style = document.createElement('style');
    style.textContent = `
      lr-av-player::part(cue) { letter-spacing: 3px; }
      lr-av-player::part(cue-current) { background: rgb(1, 2, 3); }
      lr-av-player::part(cue-active-match) { outline-color: rgb(4, 5, 6); }
      lr-av-player::part(cue-time) { color: rgb(7, 8, 9); }
      lr-av-player::part(cue-text) { color: rgb(10, 11, 12); }
    `;
    document.head.append(style);
    try {
      const el = await withCues();
      expect(getComputedStyle(cueRows(el)[0]).letterSpacing).to.equal('3px');
      expect(getComputedStyle(currentCue(el)).backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(activeMatchCue(el)).outlineColor).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(cueRoot(el).querySelector('[part="cue-time"]') as HTMLElement).color).to.equal('rgb(7, 8, 9)');
      expect(getComputedStyle(cueRoot(el).querySelector('[part="cue-text"]') as HTMLElement).color).to.equal('rgb(10, 11, 12)');
    } finally {
      style.remove();
    }
  });

  // Light themed values: the cue rules now genuinely paint, so a dark background would put the
  // cue's own quiet-toned timestamp below the contrast threshold.
  it('is accessible with every active-state prop themed', async () => {
    const el = await withCues(
      '--lr-av-player-marker-active-color: rgb(0, 51, 102); --lr-av-player-cue-current-bg: rgb(255, 255, 240); --lr-av-player-cue-active-match-color: rgb(0, 34, 68)',
    );
    expect(getComputedStyle(currentCue(el)).backgroundColor).to.equal('rgb(255, 255, 240)');
    await expect(el).to.be.accessible();
  });
});

it('honors inherited and direct-host AV theme hooks', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-transition-fast:0ms linear; --lr-av-player-marker-bg:rgb(1, 2, 3); --lr-av-player-transcript-height:123px">
      <lr-av-player
        src=${MP3_SRC}
        .cues=${CUES}
        .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 5 } }]}
      ></lr-av-player>
    </div>
  `);
  const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
  const media = mediaEl(el);
  Object.defineProperty(media, 'duration', { value: 60, configurable: true });
  media.dispatchEvent(new Event('loadedmetadata'));
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[part="timeline-marker"]') as HTMLElement;
  const transcript = el.shadowRoot!.querySelector('[part="transcript"]') as HTMLElement;
  expect(getComputedStyle(marker).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(transcript).getPropertyValue('--lr-virtual-list-height').trim()).to.equal('123px');

  el.style.setProperty('--lr-av-player-marker-bg', 'rgb(4, 5, 6)');
  await waitUntil(() => getComputedStyle(marker).backgroundColor === 'rgb(4, 5, 6)');
});

it('keeps rate hover and every marker category distinguishable in forced colors', async () => {
  await setForcedColors('active');
  try {
    const el = (await fixture(html`
      <lr-av-player
        src=${MP3_SRC}
        .highlights=${[
          { id: 'accent', anchor: { kind: 'time-range', start: 1 } },
          { id: 'success', tone: 'success', anchor: { kind: 'time-range', start: 2 } },
          { id: 'warning', tone: 'warning', anchor: { kind: 'time-range', start: 3 } },
          { id: 'danger', tone: 'danger', anchor: { kind: 'time-range', start: 4 } },
          { id: 'neutral', tone: 'neutral', anchor: { kind: 'time-range', start: 5 } },
        ]}
      ></lr-av-player>
    `)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'duration', { value: 60, configurable: true });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    const markers = [...el.shadowRoot!.querySelectorAll('[part="timeline-marker"]')] as HTMLElement[];
    expect(markers.map((marker) => getComputedStyle(marker).borderStyle)).to.deep.equal([
      'solid', 'double', 'dashed', 'dotted', 'solid',
    ]);
    expect(getComputedStyle(markers[4]!).outlineStyle).to.equal('dashed');

    const select = el.shadowRoot!.querySelector('[part="rate-select"]') as HTMLSelectElement;
    await resetMouse();
    select.scrollIntoView({ block: 'center', inline: 'center' });
    await aTimeout(0);
    const rect = select.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    // Firefox's forced-colors UA sheet retains the authored hover outline while normalizing the
    // native select border back to solid. The outline is the stable non-color hover cue owned by
    // this component across engines; exact native border painting is not.
    await waitUntil(
      () => select.matches(':hover') && getComputedStyle(select).outlineStyle === 'solid',
      'the playback-rate forced-colors hover cue did not settle',
      { timeout: 3000 },
    );
    expect(getComputedStyle(select).outlineStyle).to.equal('solid');
  } finally {
    await resetMouse();
    await setForcedColors('none');
  }
});

// -- Document-renderer registry entry ---------------------------------------

it('registers one shared audio/video renderer across every AV MIME type', async () => {
  const {
    adaptDocumentRenderer,
    getDefaultDocumentRendererRegistry,
    snapshotLyraDocumentRendererPayload,
  } = await import('../../viewers/document-viewer/registry.js');
  const registry = getDefaultDocumentRendererRegistry();
  const def = registry.get('audio/mpeg');
  expect(def, 'importing av-player.js registers the renderer').to.exist;
  expect(registry.get('audio/wav'), 'audio MIME types share one definition').to.equal(def);

  expect(def!.matches!({ name: 'talk.MP3', mimeType: 'audio/mpeg', src: MP3_SRC })).to.be.true;
  expect(def!.matches!({ name: 'no-extension', mimeType: 'video/webm', src: MP3_SRC })).to.be.true;
  expect(def!.matches!({ name: 'notes.txt', mimeType: 'text/plain', src: MP3_SRC })).to.be.false;

  const file = { name: 'talk.mp3', mimeType: 'audio/mpeg', src: MP3_SRC };
  const legacyInvocation = adaptDocumentRenderer(def!, file);
  expect(legacyInvocation.capabilities).to.deep.equal({ anchors: ['time-range'], search: false });
  const legacyHost = (await fixture(html`<div>${legacyInvocation.render()}</div>`)) as HTMLElement;
  const legacyPlayer = legacyHost.querySelector('lr-av-player') as LyraAvPlayer;
  expect(legacyPlayer).to.exist;
  expect(legacyPlayer.name).to.equal('talk.mp3');
  expect(legacyPlayer.cues.length).to.equal(0);
  expect(await legacyPlayer.search('unreachable document transcript')).to.equal(0);

  const richPayload = snapshotLyraDocumentRendererPayload({
    kind: 'av',
    file,
    cues: [{ id: 'cue-1', start: 0, text: 'Reachable document transcript' }],
    tracks: [{
      src: 'https://example.test/en.vtt',
      kind: 'captions',
      srclang: 'en',
      label: 'English',
    }],
  });
  const richInvocation = adaptDocumentRenderer(def!, file, richPayload);
  expect(richInvocation.capabilities).to.deep.equal({ anchors: ['time-range'], search: true });
  const richHost = (await fixture(html`<div>${richInvocation.render()}</div>`)) as HTMLElement;
  const richPlayer = richHost.querySelector('lr-av-player') as LyraAvPlayer;
  await richPlayer.updateComplete;
  expect(richPlayer.cues.map((cue) => cue.id)).to.deep.equal(['cue-1']);
  expect(richPlayer.tracks.map((track) => track.label)).to.deep.equal(['English']);
  expect(await richPlayer.search('reachable')).to.equal(1);

  const truncatedPayload = snapshotLyraDocumentRendererPayload({
    kind: 'av',
    file,
    cues: [
      ...Array.from({ length: 10_000 }, (_unused, index) => ({
        id: `empty-${index}`,
        start: index,
        text: '',
      })),
      { id: 'omitted-searchable', start: 10_000, text: 'Only omitted content is searchable' },
    ],
    tracks: [],
  });
  expect(adaptDocumentRenderer(def!, file, truncatedPayload).capabilities)
    .to.deep.equal({ anchors: ['time-range'], search: false });
});

it('searchNext/searchPrevious resolve a boolean, matching the shared viewer search contract', async () => {
  // `internal/text-viewer-target.ts`'s `LyraTextViewerTarget` declares both as
  // `Promise<boolean>`. These returned `void`, so a host driving several viewers through that one
  // typed surface -- `if (await viewer.searchNext())` -- got `undefined` here and took the
  // "nothing to move to" branch on every press, while every other viewer returned a real boolean.
  const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
  await el.updateComplete;

  expect(await el.search('HOST')).to.be.greaterThan(0);
  expect(await el.searchNext(), 'moved to the next match').to.be.true;
  expect(await el.searchPrevious(), 'moved to the previous match').to.be.true;

  expect(await el.search('__definitely_absent__')).to.equal(0);
  expect(await el.searchNext(), 'no matches to move to').to.be.false;
  expect(await el.searchPrevious(), 'no matches to move to').to.be.false;
});

it('forwards host focus()/blur()/click() to the native media element and re-dispatches its focus/blur', async () => {
  const wrapper = await fixture<HTMLElement>(
    html`<div><lr-av-player src=${MP3_SRC}></lr-av-player></div>`,
  );
  const el = wrapper.querySelector('lr-av-player') as LyraAvPlayer;
  await el.updateComplete;
  const media = el.shadowRoot!.querySelector('[part="media"]') as HTMLMediaElement;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  const sequence: string[] = [];
  wrapper.addEventListener('focus', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('focus');
  });
  wrapper.addEventListener('blur', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('blur');
  });
  wrapper.addEventListener('lr-focus', () => {
    aliases.push('lr-focus');
    sequence.push('lr-focus');
  });
  wrapper.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
    sequence.push('lr-blur');
  });

  el.focus();
  expect(el.shadowRoot!.activeElement === media).to.equal(true);

  let clicks = 0;
  media.addEventListener('click', () => {
    clicks += 1;
  });
  el.click();
  expect(clicks).to.equal(1);

  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
  expect(sequence).to.deep.equal(['focus', 'lr-focus', 'blur', 'lr-blur']);
});
