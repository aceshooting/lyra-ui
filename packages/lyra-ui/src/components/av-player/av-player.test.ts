import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './av-player.js';
import '../virtual-list/virtual-list.js';
import type { LyraAvPlayer, LyraAvCue } from './av-player.js';

const MP3_SRC = 'https://example.test/podcast.mp3';

const CUES: LyraAvCue[] = [
  { id: 'c1', start: 0, end: 10, text: 'Welcome to the show', speaker: 'Host' },
  { id: 'c2', start: 10, end: 25, text: 'Today we discuss agents', speaker: 'Host' },
  { id: 'c3', start: 25, end: 40, text: 'Thanks for having me', speaker: 'Guest' },
];

function mediaEl(el: LyraAvPlayer): HTMLMediaElement {
  return el.shadowRoot!.querySelector('audio, video') as HTMLMediaElement;
}

// `renderItem`'s output (the `[part="cue"]` rows) renders inside `<lyra-virtual-list>`'s own nested
// shadow root, not directly in `el.shadowRoot` -- same pattern documented/used by pdf-viewer.test.ts
// for its `[part="page"]` rows.
function cueRows(el: LyraAvPlayer): HTMLButtonElement[] {
  const list = el.shadowRoot!.querySelector('lyra-virtual-list');
  return [...(list?.shadowRoot?.querySelectorAll('[part="cue"]') ?? [])] as HTMLButtonElement[];
}

describe('defaults', () => {
  it('defaults to empty src/name, metadata preload, playbackRate 1, empty cues/peaks/tracks', async () => {
    const el = (await fixture(html`<lyra-av-player></lyra-av-player>`)) as LyraAvPlayer;
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
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} mime-type="audio/mpeg"></lyra-av-player>`)) as LyraAvPlayer;
    expect(el.shadowRoot!.querySelector('audio')).to.exist;
    expect(el.shadowRoot!.querySelector('video')).to.not.exist;
  });

  it('defaults to video when mime-type is unset or non-audio', async () => {
    const el = (await fixture(html`<lyra-av-player src="https://example.test/clip.mp4" mime-type="video/mp4"></lyra-av-player>`)) as LyraAvPlayer;
    expect(el.shadowRoot!.querySelector('video')).to.exist;
  });

  it('an explicit kind overrides auto-detection', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} mime-type="audio/mpeg" kind="video"></lyra-av-player>`)) as LyraAvPlayer;
    expect(el.shadowRoot!.querySelector('video')).to.exist;
  });
});

describe('playback controls', () => {
  it('play()/pause()/toggle() proxy the native media element and emit lyra-play/lyra-pause', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'play', { value: () => { media.dispatchEvent(new Event('play')); return Promise.resolve(); } });
    Object.defineProperty(media, 'pause', { value: () => media.dispatchEvent(new Event('pause')) });
    const playPromise = oneEvent(el, 'lyra-play');
    el.play();
    await playPromise;
    const pausePromise = oneEvent(el, 'lyra-pause');
    el.pause();
    await pausePromise;
  });

  it('seek() sets currentTime on the media element and playbackRate reflects to it', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    el.seek(42);
    expect(media.currentTime).to.equal(42);
    el.playbackRate = 1.5;
    await el.updateComplete;
    expect(media.playbackRate).to.equal(1.5);
    const eventPromise = oneEvent(el, 'lyra-rate-change');
    el.playbackRate = 2;
    expect((await eventPromise).detail).to.deep.equal({ rate: 2 });
  });
});

describe('cues and transcript', () => {
  it('renders one transcript row per cue with speaker and text', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows.length).to.equal(3);
    expect(rows[0].querySelector('[part="cue-speaker"]')!.textContent).to.equal('Host');
    expect(rows[2].querySelector('[part="cue-text"]')!.textContent).to.equal('Thanks for having me');
  });

  it('emits lyra-cue-change and marks the active cue as currentTime crosses cue boundaries', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'currentTime', { value: 12, writable: true, configurable: true });
    const eventPromise = oneEvent(el, 'lyra-cue-change');
    media.dispatchEvent(new Event('timeupdate'));
    expect((await eventPromise).detail).to.deep.equal({ id: 'c2' });
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows[1].getAttribute('aria-current')).to.equal('true');
  });

  it("clicking a transcript row seeks to that cue's start", async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const rows = cueRows(el);
    rows[2].click();
    expect(media.currentTime).to.equal(25);
  });
});

describe('search', () => {
  it('search() matches cue text/speaker case-insensitively and returns the match count', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    const count = await el.search('HOST');
    expect(count).to.equal(2);
  });

  it('searchNext/searchPrevious wrap and emit lyra-search-change with the active index', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    await el.search('host');
    const eventPromise = oneEvent(el, 'lyra-search-change');
    el.searchNext();
    expect((await eventPromise).detail).to.deep.equal({ query: 'host', matchCount: 2, activeIndex: 1 });
    const wrapPromise = oneEvent(el, 'lyra-search-change');
    el.searchNext();
    expect((await wrapPromise).detail.activeIndex).to.equal(0);
  });

  it('clearSearch() resets state and emits a zero-match lyra-search-change', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    await el.search('host');
    const eventPromise = oneEvent(el, 'lyra-search-change');
    el.clearSearch();
    expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
  });
});

describe('time-range anchors', () => {
  it('applyAnchor seeks to the anchor start once metadata is loaded', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: 'time-range', start: 25 })).to.be.true;
    expect(media.currentTime).to.equal(25);
    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
  });
});

describe('waveform', () => {
  it('renders a plain seek rail when peaks is empty, and a canvas when peaks is set', async () => {
    const withoutPeaks = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
    expect(withoutPeaks.shadowRoot!.querySelector('canvas')).to.not.exist;
    const withPeaks = (await fixture(html`<lyra-av-player src=${MP3_SRC} .peaks=${[0.1, 0.5, 0.9, 0.3]}></lyra-av-player>`)) as LyraAvPlayer;
    expect(withPeaks.shadowRoot!.querySelector('canvas')).to.exist;
  });
});

describe('accessibility', () => {
  it('is accessible with cues and peaks set', async () => {
    const el = await fixture(html`<lyra-av-player src=${MP3_SRC} name="Episode 1" .cues=${CUES} .peaks=${[0.2, 0.6, 0.4]}></lyra-av-player>`);
    await expect(el).to.be.accessible();
  });
});

describe('render error', () => {
  it('fires lyra-render-error on a native media error event', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const eventPromise = oneEvent(el, 'lyra-render-error');
    media.dispatchEvent(new Event('error'));
    await eventPromise;
  });
});
