import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './av-player.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraAvPlayer, LyraAvCue } from './av-player.js';
import { styles } from './av-player.styles.js';

const MP3_SRC = 'https://example.test/podcast.mp3';
const MP4_SRC = 'https://example.test/clip.mp4';

const CUES: LyraAvCue[] = [
  { id: 'c1', start: 0, end: 10, text: 'Welcome to the show', speaker: 'Host' },
  { id: 'c2', start: 10, end: 25, text: 'Today we discuss agents', speaker: 'Host' },
  { id: 'c3', start: 25, end: 40, text: 'Thanks for having me', speaker: 'Guest' },
];

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
    expect(el.shadowRoot!.querySelector('audio')).to.exist;
    expect(el.shadowRoot!.querySelector('video')).to.not.exist;
  });

  it('defaults to video when mime-type is unset or non-audio', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP4_SRC} mime-type="video/mp4"></lr-av-player>`)) as LyraAvPlayer;
    expect(el.shadowRoot!.querySelector('video')).to.exist;
  });

  it('an explicit kind overrides auto-detection', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} mime-type="audio/mpeg" kind="video"></lr-av-player>`)) as LyraAvPlayer;
    expect(el.shadowRoot!.querySelector('video')).to.exist;
  });
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
    expect(wrapper, 'the select must be wrapped so a decorative chevron can be positioned over it').to.exist;
    expect(wrapper!.querySelector('.rate-select-chevron svg'), 'a decorative chevron must render since appearance:none removes the native one').to.exist;
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='rate-select'\] option[^{]*\{[^}]*background:/);
    expect(css).to.match(/\[part='rate-select'\]:hover[^{]*\{[^}]*background:/);
    expect(css).to.match(/\[part='rate-select'\]:focus-visible[^{]*\{[^}]*outline:/);
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
    expect((await eventPromise).detail).to.deep.equal({ id: 'c2' });
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
    expect(labels).to.include('١٫٥x');
  });

  it('marks only one occurrence current when public cue ids are duplicated', async () => {
    const cues: LyraAvCue[] = [
      { id: 'duplicate', start: 0, end: 10, text: 'First' },
      { id: 'duplicate', start: 2, end: 10, text: 'Second' },
    ];
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} .cues=${cues}></lr-av-player>
    `)) as LyraAvPlayer;
    const media = mediaEl(el);
    Object.defineProperty(media, 'currentTime', { value: 5, writable: true, configurable: true });
    media.dispatchEvent(new Event('timeupdate'));
    await el.updateComplete;
    const rows = cueRows(el);
    expect(rows.length).to.equal(2);
    expect(rows.filter((row) => row.getAttribute('aria-current') === 'true').length).to.equal(1);
    expect(rows[1].getAttribute('aria-current')).to.equal('true');
  });
});

describe('search', () => {
  it('search() matches cue text/speaker case-insensitively and returns the match count', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC} .cues=${CUES}></lr-av-player>`)) as LyraAvPlayer;
    const count = await el.search('HOST');
    expect(count).to.equal(2);
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
});

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
    expect(withoutPeaks.shadowRoot!.querySelector('canvas')).to.not.exist;
    const withPeaks = (await fixture(html`<lr-av-player src=${MP3_SRC} .peaks=${[0.1, 0.5, 0.9, 0.3]}></lr-av-player>`)) as LyraAvPlayer;
    expect(withPeaks.shadowRoot!.querySelector('canvas')).to.exist;
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

  it('names the native media element (the keyboard tab stop), not just [part="base"]', async () => {
    const named = (await fixture(html`<lr-av-player src=${MP3_SRC} name="Episode 1"></lr-av-player>`)) as LyraAvPlayer;
    expect(mediaEl(named).getAttribute('aria-label')).to.equal('Episode 1');

    // With no name/aria-label, the localized default still applies to the media element.
    const unnamed = (await fixture(html`<lr-av-player></lr-av-player>`)) as LyraAvPlayer;
    const label = mediaEl(unnamed).getAttribute('aria-label');
    expect(label).to.be.a('string').and.to.not.equal('');
  });

  it('puts the advertised accessible name on a region rather than a generic container', async () => {
    const el = (await fixture(html`
      <lr-av-player src=${MP3_SRC} aria-label="Episode controls"></lr-av-player>
    `)) as LyraAvPlayer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('region');
    expect(base.getAttribute('aria-label')).to.equal('Episode controls');
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
    expect(replacement).to.not.equal(oldMedia);
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.equal(null);
    const timeline = el.shadowRoot!.querySelector('[part="timeline"]')!;
    expect(timeline.getAttribute('aria-valuemax')).to.equal('0');
    expect(timeline.getAttribute('aria-valuenow')).to.equal('0');
    expect(cueRows(el).some((row) => row.getAttribute('aria-current') === 'true')).to.be.false;

    Object.defineProperty(oldMedia, 'duration', { value: 999, configurable: true });
    oldMedia.dispatchEvent(new Event('loadedmetadata'));
    oldMedia.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(timeline.getAttribute('aria-valuemax')).to.equal('0');
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.equal(null);
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
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.equal(null);
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
  it('fires lr-render-error on a native media error event', async () => {
    const el = (await fixture(html`<lr-av-player src=${MP3_SRC}></lr-av-player>`)) as LyraAvPlayer;
    const media = mediaEl(el);
    const eventPromise = oneEvent(el, 'lr-render-error');
    media.dispatchEvent(new Event('error'));
    await eventPromise;
  });
});

describe('render branches', () => {
  it('renders an error region instead of a media element when src is unsafe', async () => {
    const el = (await fixture(html`<lr-av-player src="javascript:alert(1)"></lr-av-player>`)) as LyraAvPlayer;
    expect(el.shadowRoot!.querySelector('audio, video')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('renders <audio src=""> when kind is forced to audio with no src set', async () => {
    const el = (await fixture(html`<lr-av-player kind="audio"></lr-av-player>`)) as LyraAvPlayer;
    const audio = el.shadowRoot!.querySelector('audio');
    expect(audio).to.exist;
    expect(audio!.getAttribute('src')).to.equal('');
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
    expect(getComputedStyle(time).color).to.equal(resolvedIn(cueRoot(el), 'color: var(--lr-color-text-quiet)', 'color'));
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
