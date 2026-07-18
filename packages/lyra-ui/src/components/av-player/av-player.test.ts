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

  it('rate-select reflects the actual playbackRate even when it is not one of the offered rates (regression)', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .rates=${[1, 1.5, 2]}></lyra-av-player>`)) as LyraAvPlayer;
    el.playbackRate = 1.75;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[part="rate-select"]') as HTMLSelectElement;
    expect(select.value).to.equal('1.75');
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

describe('search highlighting', () => {
  it('reaches the DOM: data-match on every match, data-active-match only on the active one, cleared by clearSearch()', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .cues=${CUES}></lyra-av-player>`)) as LyraAvPlayer;
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
      html`<lyra-av-player
        dir="rtl"
        src=${MP3_SRC}
        .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 10, end: 20 } }]}
      ></lyra-av-player>`,
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

describe('numeric safety (finite clamping)', () => {
  it('clamps playbackRate to a finite, HTMLMediaElement-supported range instead of an unsanitized assignment (regression)', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
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
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
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
});

describe('waveform', () => {
  it('renders a plain seek rail when peaks is empty, and a canvas when peaks is set', async () => {
    const withoutPeaks = (await fixture(html`<lyra-av-player src=${MP3_SRC}></lyra-av-player>`)) as LyraAvPlayer;
    expect(withoutPeaks.shadowRoot!.querySelector('canvas')).to.not.exist;
    const withPeaks = (await fixture(html`<lyra-av-player src=${MP3_SRC} .peaks=${[0.1, 0.5, 0.9, 0.3]}></lyra-av-player>`)) as LyraAvPlayer;
    expect(withPeaks.shadowRoot!.querySelector('canvas')).to.exist;
  });

  it('still redraws on window resize after a disconnect/reconnect (regression)', async () => {
    const el = (await fixture(html`<lyra-av-player src=${MP3_SRC} .peaks=${[0.2, 0.8]}></lyra-av-player>`)) as LyraAvPlayer;
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
});

describe('accessibility', () => {
  it('is accessible with cues and peaks set', async () => {
    const el = await fixture(html`<lyra-av-player src=${MP3_SRC} name="Episode 1" .cues=${CUES} .peaks=${[0.2, 0.6, 0.4]}></lyra-av-player>`);
    await expect(el).to.be.accessible();
  });

  it('names the native media element (the keyboard tab stop), not just [part="base"]', async () => {
    const named = (await fixture(html`<lyra-av-player src=${MP3_SRC} name="Episode 1"></lyra-av-player>`)) as LyraAvPlayer;
    expect(mediaEl(named).getAttribute('aria-label')).to.equal('Episode 1');

    // With no name/aria-label, the localized default still applies to the media element.
    const unnamed = (await fixture(html`<lyra-av-player></lyra-av-player>`)) as LyraAvPlayer;
    const label = mediaEl(unnamed).getAttribute('aria-label');
    expect(label).to.be.a('string').and.to.not.equal('');
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
