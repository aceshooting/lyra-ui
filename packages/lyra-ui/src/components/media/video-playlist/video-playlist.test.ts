import { aTimeout, fixture, expect, html, oneEvent } from '@open-wc/testing';
import './video-playlist.js';
import type {
  LyraVideoPlaylist,
  LyraVideoPlaylistChangeDetail,
  LyraVideoPlaylistItem,
} from './video-playlist.js';
import type { LyraVideo } from '../video/video.js';

function childVideos(el: LyraVideoPlaylist): LyraVideo[] {
  return [...el.children].filter((child): child is LyraVideo => child.localName === 'lr-video');
}

function media(video: LyraVideo): HTMLVideoElement {
  return video.getVideoElement()!;
}

function items(el: LyraVideoPlaylist): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="playlist-item"]')];
}

async function settle(el: LyraVideoPlaylist): Promise<void> {
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
}

function stubPlayback(video: LyraVideo, initialPaused = true) {
  const native = media(video);
  let paused = initialPaused;
  let playCalls = 0;
  let pauseCalls = 0;
  let loadCalls = 0;
  Object.defineProperties(native, {
    paused: { configurable: true, get: () => paused },
    ended: { configurable: true, get: () => false },
    play: {
      configurable: true,
      value: () => {
        playCalls += 1;
        paused = false;
        return Promise.resolve();
      },
    },
    pause: {
      configurable: true,
      value: () => {
        pauseCalls += 1;
        paused = true;
      },
    },
    load: {
      configurable: true,
      value: () => {
        loadCalls += 1;
      },
    },
  });
  return {
    get playCalls() { return playCalls; },
    get pauseCalls() { return pauseCalls; },
    get loadCalls() { return loadCalls; },
    get paused() { return paused; },
    set paused(value: boolean) { paused = value; },
  };
}

function press(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe('lr-video-playlist public contract', () => {
  it('renders deterministic item metadata while no live video children are observable', async () => {
    const seededItems: readonly LyraVideoPlaylistItem[] = [
      {
        title: 'Server-rendered introduction',
        poster: 'https://example.test/introduction.jpg',
        duration: 125,
      },
      { title: 'Server-rendered unavailable lesson', unavailable: true },
    ];
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist .items=${seededItems}></lr-video-playlist>
    `);

    const buttons = items(el);
    expect(buttons.map((button) => button.textContent!.replace(/\s+/gu, ' ').trim())).to.deep.equal([
      'Server-rendered introduction 2:05',
      'Server-rendered unavailable lesson',
    ]);
    expect(buttons.map((button) => button.disabled)).to.deep.equal([true, true]);
    expect(buttons.map((button) => button.tabIndex)).to.deep.equal([-1, -1]);
    expect(buttons[0]!.getAttribute('aria-current')).to.equal('true');
    expect(
      buttons[0]!.querySelector<HTMLImageElement>('[part="playlist-thumbnail"] img')?.src,
    ).to.equal('https://example.test/introduction.jpg');
  });

  it('adopts direct video metadata instead of stale item seeds on a browser-only first render', async () => {
    const seededItems: readonly LyraVideoPlaylistItem[] = [
      { title: 'Stale server title', duration: 1 },
    ];
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist .items=${seededItems}>
        <lr-video title="Live child title"></lr-video>
      </lr-video-playlist>
    `);

    expect(items(el).length).to.equal(1);
    expect(items(el)[0]!.textContent).to.contain('Live child title');
    expect(items(el)[0]!.textContent).not.to.contain('Stale server title');
    expect(items(el)[0]!.disabled).to.be.false;
    expect(items(el)[0]!.tabIndex).to.equal(0);
  });

  it('matches documented defaults, reflection, forwarding, slot, and CSS parts', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="First" poster="https://example.test/first.jpg">
          <source src="https://example.test/first.mp4" type="video/mp4">
        </lr-video>
        <lr-video title="Second">
          <source src="https://example.test/second.mp4" type="video/mp4">
        </lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [first, second] = childVideos(el);
    expect(el.controls).to.equal('full');
    expect(el.getAttribute('controls')).to.equal('full');
    expect(el.iconLibrary).to.equal('system');
    expect(el.hasAttribute('icon-library')).to.be.false;
    expect(el.autoAdvance).to.be.true;
    expect(el.repeat).to.equal('none');
    expect(first!.controls).to.equal('full');
    expect(second!.controls).to.equal('full');
    expect(first!.iconLibrary).to.equal('system');
    expect(second!.iconLibrary).to.equal('system');
    expect(first!.hidden).to.be.false;
    expect(second!.hidden).to.be.true;
    expect(media(first!).querySelectorAll('source').length).to.equal(1);
    expect(media(second!).querySelectorAll('source').length).to.equal(0);
    expect((el.shadowRoot!.querySelector('slot')) != null).to.equal(true);

    const root = el.shadowRoot!.querySelector('[part~="video-playlist"]')!;
    expect(root.getAttribute('part')!.split(/\s+/u)).to.include.members(['base', 'video-playlist']);
    for (const part of [
      'playlist',
      'playlist-duration',
      'playlist-item',
      'playlist-thumbnail',
      'playlist-title',
    ]) {
      expect(el.shadowRoot!.querySelector(`[part~="${part}"]`), part).to.exist;
    }

    el.controls = 'none';
    el.iconLibrary = 'custom';
    await settle(el);
    expect(el.getAttribute('controls')).to.equal('none');
    expect(first!.controls).to.equal('none');
    expect(second!.controls).to.equal('none');
    expect(first!.iconLibrary).to.equal('custom');
    expect(second!.iconLibrary).to.equal('custom');
    expect(el.shadowRoot!.querySelector('lr-icon')?.getAttribute('library')).to.equal('custom');

    el.setAttribute('auto-advance', 'false');
    await el.updateComplete;
    expect(el.autoAdvance).to.be.false;
    el.removeAttribute('auto-advance');
    await el.updateComplete;
    expect(el.autoAdvance).to.be.true;
    el.controls = 'invalid' as typeof el.controls;
    el.repeat = 'invalid' as typeof el.repeat;
    await el.updateComplete;
    expect(el.controls).to.equal('full');
    expect(el.repeat).to.equal('none');
  });

  it('uses default and ancestor-themed current-item hooks for rendered playlist ink', async () => {
    const defaults = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="First"></lr-video><lr-video title="Second"></lr-video></lr-video-playlist>
    `);
    await settle(defaults);
    const [defaultCurrent, defaultInactive] = items(defaults);
    expect(getComputedStyle(defaultCurrent!).borderColor === getComputedStyle(defaultInactive!).borderColor).to.be.false;

    const wrapper = await fixture<HTMLElement>(html`
      <div
        style="--lr-video-playlist-item-current-border-color: rgb(23, 24, 25); --lr-video-playlist-item-current-background: rgb(26, 27, 28)"
      >
        <lr-video-playlist><lr-video title="First"></lr-video></lr-video-playlist>
      </div>
    `);
    const themed = wrapper.querySelector<LyraVideoPlaylist>('lr-video-playlist')!;
    await settle(themed);
    const themedCurrent = items(themed)[0]!;
    expect(getComputedStyle(themedCurrent).borderColor).to.equal('rgb(23, 24, 25)');
    expect(getComputedStyle(themedCurrent).backgroundColor).to.equal('rgb(26, 27, 28)');
  });

  it('uses only direct video children and skips inert videos for activation and arrow-navigation focus', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="Unavailable" inert></lr-video>
        <div><lr-video title="Nested"></lr-video></div>
        <lr-video title="Available"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const direct = childVideos(el);
    const nested = el.querySelector('div > lr-video') as LyraVideo;
    expect(items(el).length).to.equal(2);
    expect(items(el)[0]!.disabled).to.be.true;
    expect(items(el)[0]!.tabIndex).to.equal(-1);
    expect(items(el)[1]!.tabIndex).to.equal(0);
    expect(direct[0]!.hidden).to.be.true;
    expect(direct[1]!.hidden).to.be.false;
    expect(nested.hidden).to.be.false;
    expect(nested.controls).to.equal('standard');
  });

  it('does not invent an availability contract from an undeclared child disabled attribute', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="First" disabled></lr-video>
        <lr-video title="Second"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [first, second] = childVideos(el);

    expect(first!.hidden).to.be.false;
    expect(second!.hidden).to.be.true;
    expect(items(el)[0]!.disabled).to.be.false;
    expect(items(el)[0]!.tabIndex).to.equal(0);
  });

  it('emits exact composed change detail as fresh recursively frozen metadata snapshots', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="First"></lr-video>
        <lr-video title="Second" poster="https://example.test/second.jpg" src="https://example.test/direct.mp4" preload="none">
          <source src="https://example.test/alternate.webm" type="video/webm" media="(min-width: 30rem)">
          <track src="data:text/vtt,WEBVTT" kind="captions" srclang="en" label="English" default>
        </lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const pending = oneEvent(el, 'lr-video-change');
    el.goTo(1);
    const event = await pending as CustomEvent<LyraVideoPlaylistChangeDetail>;
    expect(event.bubbles).to.be.true;
    expect(event.composed).to.be.true;
    expect(event.cancelable).to.be.false;
    expect(Object.keys(event.detail)).to.deep.equal(['previousIndex', 'currentIndex', 'video']);
    expect(event.detail.previousIndex).to.equal(0);
    expect(event.detail.currentIndex).to.equal(1);
    expect(Object.keys(event.detail.video)).to.deep.equal(['title', 'poster', 'sources', 'tracks']);
    expect(event.detail.video).to.deep.equal({
      title: 'Second',
      poster: 'https://example.test/second.jpg',
      sources: [
        { src: 'https://example.test/direct.mp4', type: '', media: '' },
        { src: 'https://example.test/alternate.webm', type: 'video/webm', media: '(min-width: 30rem)' },
      ],
      tracks: [
        { src: 'data:text/vtt,WEBVTT', kind: 'captions', srclang: 'en', label: 'English', default: true },
      ],
    });
    expect(Object.isFrozen(event.detail)).to.be.true;
    expect(Object.isFrozen(event.detail.video)).to.be.true;
    expect(Object.isFrozen(event.detail.video.sources)).to.be.true;
    expect(Object.isFrozen(event.detail.video.sources[0]!)).to.be.true;
    expect(Object.isFrozen(event.detail.video.tracks[0]!)).to.be.true;

    const again = oneEvent(el, 'lr-video-change');
    el.goTo(1);
    const secondEvent = await again as CustomEvent<LyraVideoPlaylistChangeDetail>;
    expect(secondEvent.detail.video === event.detail.video).to.be.false;
    expect(secondEvent.detail.video.sources === event.detail.video.sources).to.be.false;
    expect(secondEvent.detail.video.title).to.equal('Second');
    expect(secondEvent.detail.video.sources[0]!.src).to.equal('https://example.test/direct.mp4');
    expect(secondEvent.detail.video.tracks[0]!.label).to.equal('English');
  });

  it('emits for goTo(current), while invalid and boundary navigation are inert', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const details: LyraVideoPlaylistChangeDetail[] = [];
    el.addEventListener('lr-video-change', (event) => details.push(event.detail));
    el.goTo(0);
    expect(details.map(({ previousIndex, currentIndex }) => [previousIndex, currentIndex])).to.deep.equal([[0, 0]]);
    el.goTo(-1);
    el.goTo(1.5);
    el.goTo(Number.NaN);
    el.goTo(2);
    el.previous();
    expect(details.length).to.equal(1);
    el.next();
    el.next();
    expect(details.map(({ previousIndex, currentIndex }) => [previousIndex, currentIndex])).to.deep.equal([
      [0, 0],
      [0, 1],
    ]);
  });

  it('synchronously pauses and unloads the outgoing player before activating the incoming one', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A" preload="none"><source src="https://example.test/a.mp4" type="video/mp4"></lr-video>
        <lr-video title="B" preload="none"><source src="https://example.test/b.mp4" type="video/mp4"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [first, second] = childVideos(el);
    const outgoing = stubPlayback(first!, false);
    stubPlayback(second!);
    const order: string[] = [];
    const nativePause = media(first!).pause.bind(media(first!));
    Object.defineProperty(media(first!), 'pause', {
      configurable: true,
      value: () => { order.push('outgoing-pause'); nativePause(); },
    });
    const nativeLoad = media(first!).load.bind(media(first!));
    Object.defineProperty(media(first!), 'load', {
      configurable: true,
      value: () => { order.push('outgoing-unload'); nativeLoad(); },
    });
    const incomingLoad = second!.load.bind(second!);
    Object.defineProperty(second!, 'load', {
      configurable: true,
      value: () => { order.push('incoming-load'); incomingLoad(); },
    });

    el.goTo(1);
    expect(order.slice(0, 3)).to.deep.equal(['outgoing-pause', 'outgoing-unload', 'incoming-load']);
    expect(outgoing.paused).to.be.true;
    expect(first!.hidden).to.be.true;
    expect(second!.hidden).to.be.false;
    expect(media(first!).hasAttribute('src')).to.be.false;
    expect(media(first!).querySelectorAll('source, track').length).to.equal(0);
    expect(media(second!).querySelectorAll('source').length).to.equal(1);
  });

  it('pauses and unloads a non-active video that reports a native play event', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video><lr-video title="B"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    const bPlayback = stubPlayback(b!, true);
    const before = bPlayback.pauseCalls;
    b!.dispatchEvent(new Event('play'));
    expect(bPlayback.pauseCalls).to.be.greaterThan(before);
    expect(b!.hidden).to.be.true;

    const aPlayback = stubPlayback(a!, false);
    const activePauseCalls = aPlayback.pauseCalls;
    a!.dispatchEvent(new Event('play'));
    expect(aPlayback.pauseCalls).to.equal(activePauseCalls);
  });

  it('retries a deferred activation once the incoming video element becomes available', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video><lr-video title="B"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    stubPlayback(a!, false);
    const bPlayback = stubPlayback(b!);
    const realGetVideoElement = b!.getVideoElement.bind(b!);
    let getCalls = 0;
    // The very first activation attempt finds the incoming video's native element not yet
    // rendered (as can happen right after a fast structural change); every later read returns
    // the real element, matching how the browser eventually finishes the child's own update.
    b!.getVideoElement = () => {
      getCalls += 1;
      return getCalls === 1 ? undefined : realGetVideoElement();
    };

    // An attribute change (not a childList change) so only the mutation observer's own
    // reconcile pass runs -- a slotchange from removing the node instead would fire a second,
    // independent reconcile that races the deferred retry this test targets.
    a!.inert = true;
    await settle(el);

    expect(bPlayback.playCalls).to.equal(1);
    expect(b!.hidden).to.be.false;
  });

  it('auto-advances ended only for the current activation generation and never skips errors', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video><lr-video title="B"></lr-video><lr-video title="C"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [a, b, c] = childVideos(el);
    const aPlayback = stubPlayback(a!);
    const bPlayback = stubPlayback(b!);
    const cPlayback = stubPlayback(c!);
    a!.dispatchEvent(new Event('ended'));
    await aTimeout(0);
    expect(b!.hidden).to.be.false;
    expect(bPlayback.playCalls).to.equal(1);
    a!.dispatchEvent(new Event('ended'));
    a!.dispatchEvent(new Event('error'));
    expect(b!.hidden).to.be.false;
    expect(cPlayback.playCalls).to.equal(0);
    b!.dispatchEvent(new Event('error'));
    await aTimeout(0);
    expect(b!.hidden).to.be.false;
    expect(c!.hidden).to.be.true;
    expect(cPlayback.playCalls).to.equal(0);
    b!.dispatchEvent(new Event('ended'));
    await aTimeout(0);
    expect(c!.hidden).to.be.false;
    expect(cPlayback.playCalls).to.equal(1);
    expect(aPlayback.playCalls).to.equal(0);
  });

  it('supports explicit auto-advance and repeat-one/repeat-all modes', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    const aPlayback = stubPlayback(a!);
    const bPlayback = stubPlayback(b!);
    el.autoAdvance = false;
    await el.updateComplete;
    a!.dispatchEvent(new Event('ended'));
    expect(a!.hidden).to.be.false;
    expect(bPlayback.playCalls).to.equal(0);

    el.autoAdvance = true;
    el.repeat = 'one';
    await el.updateComplete;
    Object.defineProperty(media(a!), 'currentTime', { configurable: true, value: 9, writable: true });
    a!.dispatchEvent(new Event('ended'));
    await aTimeout(0);
    expect(a!.hidden).to.be.false;
    expect(media(a!).currentTime).to.equal(0);
    expect(aPlayback.playCalls).to.equal(1);

    el.repeat = 'all';
    await el.updateComplete;
    el.goTo(1);
    b!.dispatchEvent(new Event('ended'));
    await aTimeout(0);
    expect(a!.hidden).to.be.false;
    expect(aPlayback.playCalls).to.equal(2);
  });

  it('swallows a rejected repeat-one replay instead of leaking the rejection', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist repeat="one"><lr-video title="Only"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const video = childVideos(el)[0]!;
    const native = media(video);
    Object.defineProperties(native, {
      paused: { configurable: true, get: () => false },
      ended: { configurable: true, get: () => false },
      play: { configurable: true, value: () => Promise.reject(new DOMException('nope', 'AbortError')) },
      pause: { configurable: true, value: () => undefined },
      load: { configurable: true, value: () => undefined },
    });
    expect(() => video.dispatchEvent(new Event('ended'))).to.not.throw();
    await aTimeout(0);
    expect(video.hidden).to.be.false;
  });

  it('restarts a one-item repeat-all playlist without emitting a false index change', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist repeat="all"><lr-video title="Only"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const only = childVideos(el)[0]!;
    const playback = stubPlayback(only);
    Object.defineProperty(media(only), 'currentTime', { configurable: true, value: 7, writable: true });
    let changes = 0;
    el.addEventListener('lr-video-change', () => { changes += 1; });
    only.dispatchEvent(new Event('ended'));
    await aTimeout(0);
    expect(media(only).currentTime).to.equal(0);
    expect(playback.playCalls).to.equal(1);
    expect(changes).to.equal(0);
  });

  it('swallows a rejected repeat-all restart on a single-item playlist', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist repeat="all"><lr-video title="Only"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const only = childVideos(el)[0]!;
    const native = media(only);
    Object.defineProperties(native, {
      paused: { configurable: true, get: () => false },
      ended: { configurable: true, get: () => false },
      play: { configurable: true, value: () => Promise.reject(new DOMException('nope', 'AbortError')) },
      pause: { configurable: true, value: () => undefined },
      load: { configurable: true, value: () => undefined },
    });
    expect(() => only.dispatchEvent(new Event('ended'))).to.not.throw();
    await aTimeout(0);
    expect(only.hidden).to.be.false;
  });

  it('preserves valid volume, mute, rate, and caption preferences across activation', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    const oldTrack = { kind: 'captions', label: 'English', language: 'en', mode: 'showing' } as TextTrack;
    const incomingEnglish = { kind: 'captions', label: 'English', language: 'en', mode: 'disabled' } as TextTrack;
    const incomingFrench = { kind: 'captions', label: 'Français', language: 'fr', mode: 'showing' } as TextTrack;
    Object.defineProperties(media(a!), {
      paused: { configurable: true, get: () => true },
      volume: { configurable: true, value: 0.35, writable: true },
      muted: { configurable: true, value: true, writable: true },
      playbackRate: { configurable: true, value: 1.5, writable: true },
      textTracks: { configurable: true, value: { 0: oldTrack, length: 1 } },
    });
    Object.defineProperties(media(b!), {
      paused: { configurable: true, get: () => true },
      volume: { configurable: true, value: 1, writable: true },
      muted: { configurable: true, value: false, writable: true },
      playbackRate: { configurable: true, value: 1, writable: true },
      textTracks: { configurable: true, value: { 0: incomingEnglish, 1: incomingFrench, length: 2 } },
      pause: { configurable: true, value: () => undefined },
      load: { configurable: true, value: () => undefined },
    });
    el.goTo(1);
    expect(media(b!).volume).to.equal(0.35);
    expect(media(b!).muted).to.be.true;
    expect(media(b!).playbackRate).to.equal(1.5);
    expect(incomingEnglish.mode).to.equal('hidden');
    expect(incomingFrench.mode).to.equal('disabled');
  });

  it('transfers playback and preferences when its active child is removed', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video>
        <lr-video title="B"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    const outgoingCaption = { kind: 'captions', label: 'English', language: 'en', mode: 'showing' } as TextTrack;
    const incomingCaption = { kind: 'captions', label: 'English', language: 'en', mode: 'disabled' } as TextTrack;
    const alternateCaption = { kind: 'captions', label: 'Français', language: 'fr', mode: 'showing' } as TextTrack;
    stubPlayback(a!, false);
    const incomingPlayback = stubPlayback(b!);
    a!.dispatchEvent(new Event('play'));
    Object.defineProperties(media(a!), {
      volume: { configurable: true, value: 0.35, writable: true },
      muted: { configurable: true, value: true, writable: true },
      playbackRate: { configurable: true, value: 1.5, writable: true },
      textTracks: { configurable: true, value: { 0: outgoingCaption, length: 1 } },
    });
    Object.defineProperties(media(b!), {
      volume: { configurable: true, value: 1, writable: true },
      muted: { configurable: true, value: false, writable: true },
      playbackRate: { configurable: true, value: 1, writable: true },
      textTracks: { configurable: true, value: { 0: incomingCaption, 1: alternateCaption, length: 2 } },
    });
    a!.remove();
    await settle(el);

    expect(b!.hidden).to.be.false;
    expect(incomingPlayback.playCalls).to.equal(1);
    expect(media(b!).volume).to.equal(0.35);
    expect(media(b!).muted).to.be.true;
    expect(media(b!).playbackRate).to.equal(1.5);
    expect(incomingCaption.mode).to.equal('hidden');
    expect(alternateCaption.mode).to.equal('disabled');
  });

  it('restores every authored child presentation and resource field when ownership ends', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-video-playlist controls="full" icon-library="system">
          <lr-video
            title="Authored"
            controls="standard"
            icon-library="custom-icons"
            hidden
            src="https://example.test/authored.mp4"
          >
            <source src="https://example.test/authored.webm" type="video/webm">
            <track src="data:text/vtt,WEBVTT" kind="captions" srclang="en" label="English">
          </lr-video>
        </lr-video-playlist>
      </div>
    `);
    const playlist = wrapper.querySelector('lr-video-playlist') as LyraVideoPlaylist;
    await settle(playlist);
    const video = childVideos(playlist)[0]!;
    expect(video.controls).to.equal('full');
    expect(video.iconLibrary).to.equal('system');
    expect(video.hidden).to.be.false;

    wrapper.append(video);
    await settle(playlist);
    await video.updateComplete;

    expect(video.controls).to.equal('standard');
    expect(video.iconLibrary).to.equal('custom-icons');
    expect(video.hidden).to.be.true;
    expect(video.src).to.equal('https://example.test/authored.mp4');
    expect(video.querySelector('source')?.getAttribute('src')).to.equal(
      'https://example.test/authored.webm',
    );
    expect(video.querySelector('track')?.getAttribute('src')).to.equal('data:text/vtt,WEBVTT');
  });

  it('does not resume the successor after the user pauses the active child before removal', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    const outgoingPlayback = stubPlayback(a!, false);
    const incomingPlayback = stubPlayback(b!);

    a!.dispatchEvent(new Event('play'));
    outgoingPlayback.paused = true;
    a!.dispatchEvent(new Event('pause'));
    a!.remove();
    await settle(el);

    expect(b!.hidden).to.be.false;
    expect(incomingPlayback.playCalls).to.equal(0);
  });

  it('recognizes description tracks as selectable, alongside subtitles and captions', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const [a, b] = childVideos(el);
    const outgoingDescriptions = { kind: 'descriptions', label: 'Descriptions', language: 'en', mode: 'showing' } as TextTrack;
    const incomingDescriptions = { kind: 'descriptions', label: 'Descriptions', language: 'en', mode: 'disabled' } as TextTrack;
    Object.defineProperties(media(a!), {
      paused: { configurable: true, get: () => true },
      textTracks: { configurable: true, value: { 0: outgoingDescriptions, length: 1 } },
    });
    Object.defineProperties(media(b!), {
      paused: { configurable: true, get: () => true },
      textTracks: { configurable: true, value: { 0: incomingDescriptions, length: 1 } },
      pause: { configurable: true, value: () => undefined },
      load: { configurable: true, value: () => undefined },
    });
    el.goTo(1);
    expect(incomingDescriptions.mode).to.equal('hidden');
  });

  it('guards rejected play promises from superseded activations', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video><lr-video title="B"></lr-video><lr-video title="C"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [a, b, c] = childVideos(el);
    stubPlayback(a!, false);
    stubPlayback(c!);
    let reject!: (reason: unknown) => void;
    let bPaused = false;
    Object.defineProperties(media(b!), {
      paused: { configurable: true, get: () => false },
      play: { configurable: true, value: () => new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; }) },
      pause: { configurable: true, value: () => { bPaused = true; } },
      load: { configurable: true, value: () => undefined },
    });
    el.goTo(1);
    el.goTo(2);
    reject(new DOMException('Superseded', 'AbortError'));
    await aTimeout(0);
    expect(c!.hidden).to.be.false;
    expect(b!.hidden).to.be.true;
    expect(bPaused).to.be.true;
  });

  it('tracks duplicate metadata by identity and recovers when children shrink', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="Duplicate"></lr-video>
        <lr-video title="Duplicate"></lr-video>
        <lr-video title="Last"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [first, duplicate, last] = childVideos(el);
    el.goTo(1);
    first!.remove();
    await settle(el);
    expect(duplicate!.hidden).to.be.false;
    expect(last!.hidden).to.be.true;
    expect(items(el).length).to.equal(2);
    expect(items(el)[0]!.getAttribute('aria-current')).to.equal('true');
    duplicate!.remove();
    await settle(el);
    expect(last!.hidden).to.be.false;
    expect(items(el).length).to.equal(1);
    last!.remove();
    await settle(el);
    expect(items(el).length).to.equal(0);
    el.next();
    el.previous();
    el.goTo(0);
  });

  it('falls back to an earlier enabled video when the one nearest the end becomes inert', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video><lr-video title="B"></lr-video><lr-video title="C"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    el.goTo(2);
    await settle(el);
    childVideos(el)[2]!.inert = true;
    await settle(el);
    expect(childVideos(el)[1]!.hidden).to.be.false;
    expect(childVideos(el)[2]!.hidden).to.be.true;
  });

  it('clears the active video when every remaining item becomes inert at once', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    el.goTo(1);
    await settle(el);
    childVideos(el)[0]!.inert = true;
    childVideos(el)[1]!.inert = true;
    await settle(el);
    expect(items(el).every((button) => button.getAttribute('aria-current') === 'false')).to.be.true;
    expect(childVideos(el)[0]!.hidden).to.be.true;
    expect(childVideos(el)[1]!.hidden).to.be.true;
  });

  it('does not wrap arrow-navigation focus past either end of the list', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="One"></lr-video><lr-video title="Two"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    const buttons = items(el);
    buttons[0]!.focus();
    press(buttons[0]!, 'ArrowUp');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === buttons[0]).to.be.true;

    buttons[1]!.focus();
    press(buttons[1]!, 'ArrowDown');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === buttons[1]).to.be.true;
  });

  it('ignores a arrow-navigation move started from a row that just went stale', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two"></lr-video><lr-video title="Three"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const buttons = items(el);
    buttons[0]!.focus();
    childVideos(el)[0]!.inert = true;
    // The rendered row has not caught up with the just-set property yet -- but `moveRoving`
    // looks the pressed row up against the *live* enabled set, finds it already missing, and
    // returns before ever calling `focusItem`, so focus stays exactly where it was.
    expect(buttons[0]!.disabled, 'the row has not re-rendered yet').to.be.false;
    press(buttons[0]!, 'ArrowDown');
    expect(el.shadowRoot!.activeElement === buttons[0], 'focus was not moved by the stale request').to.be.true;
    await settle(el);
  });

  it('supersedes an in-flight focus move when a second one starts first', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two"></lr-video><lr-video title="Three"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const buttons = items(el);
    buttons[0]!.focus();
    press(buttons[0]!, 'ArrowDown');
    press(buttons[1]!, 'ArrowDown');
    await el.updateComplete;
    await aTimeout(0);
    expect(el.shadowRoot!.activeElement === items(el)[2]).to.be.true;
  });

  it('ignores a keydown dispatched directly on a disabled playlist row', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two" inert></lr-video><lr-video title="Three"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const disabledButton = items(el)[1]!;
    expect(disabledButton.disabled).to.be.true;
    const event = press(disabledButton, 'Enter');
    expect(event.defaultPrevented).to.be.false;
    expect(childVideos(el)[1]!.hidden).to.be.true;
  });

  it('activates a playlist item via a real click on its button', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
    `);
    await settle(el);
    items(el)[1]!.click();
    await settle(el);
    expect(childVideos(el)[1]!.hidden).to.be.false;
    expect(items(el)[1]!.getAttribute('aria-current')).to.equal('true');
    expect(items(el)[1]!.tabIndex).to.equal(0);
  });

  it('previous() finds the nearest earlier enabled video, skipping an inert one', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="A"></lr-video><lr-video title="B" inert></lr-video><lr-video title="C"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    el.goTo(2);
    await settle(el);
    el.previous();
    await settle(el);
    expect(childVideos(el)[0]!.hidden).to.be.false;
    expect(childVideos(el)[2]!.hidden).to.be.true;

    el.previous();
    await settle(el);
    expect(childVideos(el)[0]!.hidden).to.be.false;
  });

  it('still renders and reconciles children without a MutationObserver global', async () => {
    const original = window.MutationObserver;
    // @ts-expect-error -- deliberately removing the global to exercise the defensive fallback
    delete window.MutationObserver;
    try {
      const el = await fixture<LyraVideoPlaylist>(html`
        <lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist>
      `);
      await settle(el);
      expect(childVideos(el)[0]!.hidden).to.be.false;
      expect(items(el).length).to.equal(2);
    } finally {
      window.MutationObserver = original;
    }
  });

  it('ignores a slotchange notification that arrives after disconnection', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist></div>
    `);
    const el = wrapper.querySelector('lr-video-playlist') as LyraVideoPlaylist;
    await settle(el);
    const slot = el.shadowRoot!.querySelector('slot')!;
    el.remove();
    expect(() => slot.dispatchEvent(new Event('slotchange'))).to.not.throw();
    wrapper.append(el);
    await settle(el);
    expect(childVideos(el).length).to.equal(2);
  });

  it('disconnects media/listeners and reconnects with one current generation', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><lr-video-playlist><lr-video title="A"></lr-video><lr-video title="B"></lr-video></lr-video-playlist></div>
    `);
    const el = wrapper.querySelector('lr-video-playlist') as LyraVideoPlaylist;
    await settle(el);
    const [a, b] = childVideos(el);
    const aPlayback = stubPlayback(a!);
    const bPlayback = stubPlayback(b!);
    let changes = 0;
    el.addEventListener('lr-video-change', () => { changes += 1; });
    el.remove();
    expect(aPlayback.pauseCalls).to.be.greaterThan(0);
    wrapper.append(el);
    await settle(el);
    a!.dispatchEvent(new Event('ended'));
    await aTimeout(0);
    expect(changes).to.equal(1);
    expect(bPlayback.playCalls).to.equal(1);
    expect(b!.hidden).to.be.false;
  });

  it('reconstructs its child observer in the adopted iframe realm', async () => {
    const iframe = document.createElement('iframe');
    const loaded = new Promise<void>((resolve) =>
      iframe.addEventListener('load', () => resolve(), { once: true }),
    );
    document.body.append(iframe);
    await loaded;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const OriginalFrameObserver = frameWindow.MutationObserver;
    let frameObserverConstructions = 0;
    frameWindow.MutationObserver = function (callback: MutationCallback): MutationObserver {
      frameObserverConstructions += 1;
      return new OriginalFrameObserver(callback);
    } as unknown as typeof MutationObserver;
    let el: LyraVideoPlaylist | undefined;

    try {
      el = await fixture<LyraVideoPlaylist>(html`
        <lr-video-playlist><lr-video title="A"></lr-video></lr-video-playlist>
      `);
      await settle(el);
      frameDocument.body.append(frameDocument.adoptNode(el));
      await settle(el);

      expect(
        frameObserverConstructions,
        'the reconnected playlist uses its current owner window constructor',
      ).to.be.greaterThan(0);
    } finally {
      el?.remove();
      frameWindow.MutationObserver = OriginalFrameObserver;
      iframe.remove();
    }
  });

  it('rehomes focus when an iframe-realm playlist row becomes unavailable', async () => {
    const iframe = document.createElement('iframe');
    const loaded = new Promise<void>((resolve) =>
      iframe.addEventListener('load', () => resolve(), { once: true }),
    );
    document.body.append(iframe);
    await loaded;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="First"></lr-video>
        <lr-video title="Second"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const [first] = childVideos(el);

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await settle(el);
      const iframeRow = frameDocument.createElement('button');
      iframeRow.setAttribute('part', 'playlist-item');
      el.shadowRoot!.append(iframeRow);
      iframeRow.focus();
      expect(iframeRow instanceof frameWindow.HTMLElement).to.be.true;
      expect(el.shadowRoot!.activeElement === iframeRow).to.be.true;

      first!.inert = true;
      await settle(el);

      expect(
        el.shadowRoot!.activeElement === items(el)[1],
        'focus follows the new arrow-navigation row even when the old focused node came from the iframe realm',
      ).to.be.true;
    } finally {
      el.remove();
      iframe.remove();
    }
  });

  it('keeps every enabled row Tab-reachable while retaining optional arrow shortcuts', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two"></lr-video><lr-video title="Three"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    let buttons = items(el);
    expect(buttons.map((button) => button.tabIndex)).to.deep.equal([0, 0, 0]);
    buttons[0]!.focus();
    expect(press(buttons[0]!, 'ArrowDown').defaultPrevented).to.be.true;
    await el.updateComplete;
    buttons = items(el);
    expect(el.shadowRoot!.activeElement === buttons[1]).to.be.true;
    expect(buttons.map((button) => button.tabIndex)).to.deep.equal([0, 0, 0]);
    press(buttons[1]!, 'Enter');
    await el.updateComplete;
    expect(childVideos(el)[1]!.hidden).to.be.false;
    press(items(el)[1]!, 'End');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === items(el)[2]).to.be.true;
    press(items(el)[2]!, 'Home');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === items(el)[0]).to.be.true;

    el.dir = 'rtl';
    await el.updateComplete;
    const rtlFirst = items(el)[0]!;
    rtlFirst.focus();
    press(rtlFirst, 'ArrowLeft');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === items(el)[1]).to.be.true;
    press(items(el)[1]!, 'ArrowRight');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === items(el)[0]).to.be.true;
  });

  it('refreshes title and duration metadata and localizes semantic labels', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist .strings=${{
        videoPlaylistLabel: 'Programme vidéo',
        videoPlaylistUntitled: 'Vidéo {position}',
      }}>
        <lr-video></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    const video = childVideos(el)[0]!;
    expect(el.shadowRoot!.querySelector('[part="playlist"]')!.getAttribute('aria-label')).to.equal('Programme vidéo');
    expect(el.shadowRoot!.querySelector('[part="playlist-title"]')!.textContent!.trim()).to.equal('Vidéo 1');
    video.title = 'Renamed';
    video.duration = 65;
    video.dispatchEvent(new Event('loadedmetadata'));
    await settle(el);
    const row = items(el)[0]!;
    const duration = el.shadowRoot!.querySelector('[part="playlist-duration"]') as HTMLElement;
    expect(el.shadowRoot!.querySelector('[part="playlist-title"]')!.textContent!.trim()).to.equal('Renamed');
    expect(duration.textContent!.trim()).to.equal('1:05');
    expect(row.getAttribute('aria-describedby')).to.equal(duration.id);

    // An hour or more switches the duration format to include an hours segment.
    video.duration = 3725;
    video.dispatchEvent(new Event('loadedmetadata'));
    await settle(el);
    expect(el.shadowRoot!.querySelector('[part="playlist-duration"]')!.textContent!.trim()).to.equal('1:02:05');

    video.duration = 0;
    video.dispatchEvent(new Event('loadedmetadata'));
    await settle(el);
    expect(items(el)[0]!.hasAttribute('aria-describedby')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="playlist-duration"]')!.textContent!.trim()).to.equal('');
  });

  it('gives host aria-label precedence, handles 320px long titles, RTL, and populated axe', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir="rtl" style="inline-size: 320px">
        <lr-video-playlist aria-label="Host playlist label">
          <lr-video title="A very long title that must remain inside its narrow playlist item" poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"></lr-video>
          <lr-video title="Second"></lr-video>
        </lr-video-playlist>
      </div>
    `);
    const el = wrapper.querySelector('lr-video-playlist') as LyraVideoPlaylist;
    await settle(el);
    const root = el.shadowRoot!.querySelector('[part~="video-playlist"]') as HTMLElement;
    const title = el.shadowRoot!.querySelector('[part="playlist-title"]') as HTMLElement;
    const thumbnail = el.shadowRoot!.querySelector('[part="playlist-thumbnail"]') as HTMLElement;
    expect(el.getAttribute('aria-label')).to.equal('Host playlist label');
    expect(el.shadowRoot!.querySelector('[part="playlist"]')!.getAttribute('aria-label')).to.equal('Video playlist');
    expect(getComputedStyle(root).gridTemplateColumns.split(' ').length).to.equal(1);
    expect(getComputedStyle(title).overflow).to.equal('hidden');
    expect(getComputedStyle(title).textOverflow).to.equal('ellipsis');
    expect(thumbnail.getAttribute('aria-hidden')).to.equal('true');
    expect(thumbnail.inert).to.be.true;
    expect(getComputedStyle(el).direction).to.equal('rtl');
    await expect(el).to.be.accessible();
  });

  it('is accessible when empty', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`<lr-video-playlist></lr-video-playlist>`);
    await settle(el);
    expect(items(el).length).to.equal(0);
    await expect(el).to.be.accessible();
  });
});

describe('lr-video-playlist inert handling', () => {
  it('skips an inert video while every enabled row remains in the sequential Tab order', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two" inert></lr-video><lr-video title="Three"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    let buttons = items(el);
    // The row standing in for inert content is itself disabled, so it refuses focus outright --
    // which is exactly why arrow navigation must never step onto it.
    expect(buttons[1]!.disabled).to.be.true;
    expect(buttons.map((button) => button.tabIndex)).to.deep.equal([0, -1, 0]);

    buttons[0]!.focus();
    expect(press(buttons[0]!, 'ArrowDown').defaultPrevented).to.be.true;
    await el.updateComplete;
    buttons = items(el);
    expect(el.shadowRoot!.activeElement === buttons[2]).to.be.true;
    expect(buttons.map((button) => button.tabIndex)).to.deep.equal([0, -1, 0]);

    press(buttons[2]!, 'ArrowUp');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === items(el)[0]).to.be.true;
  });

  it('never activates an inert video, and steps past it on next()', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two" inert></lr-video><lr-video title="Three"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    el.goTo(1);
    await settle(el);
    expect(childVideos(el)[1]!.hidden).to.be.true;

    el.next();
    await settle(el);
    expect(childVideos(el)[1]!.hidden).to.be.true;
    expect(childVideos(el)[2]!.hidden).to.be.false;
  });

  it('rehomes arrow-navigation focus when the row it sits on becomes inert', async () => {
    const el = await fixture<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="One"></lr-video><lr-video title="Two"></lr-video>
      </lr-video-playlist>
    `);
    await settle(el);
    items(el)[0]!.focus();

    childVideos(el)[0]!.inert = true;
    await settle(el);
    await settle(el);

    const buttons = items(el);
    expect(buttons[0]!.disabled).to.be.true;
    expect(buttons.map((button) => button.tabIndex)).to.deep.equal([-1, 0]);
    expect(el.shadowRoot!.activeElement === buttons[1]).to.be.true;
  });

  it('keeps the active video playable when an ancestor inerts the whole playlist', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-video-playlist>
          <lr-video title="One"></lr-video><lr-video title="Two"></lr-video>
        </lr-video-playlist>
      </div>
    `);
    const el = wrapper.querySelector('lr-video-playlist') as LyraVideoPlaylist;
    await settle(el);
    expect(childVideos(el)[0]!.hidden).to.be.false;

    // A modal inerting the page behind it inerts every child alike. Treating them all as
    // unavailable would drop the active video, pause it, and unload its media element.
    wrapper.inert = true;
    el.iconLibrary = 'system-2';
    await settle(el);

    expect(items(el)[0]!.disabled).to.be.false;
    expect(items(el)[0]!.tabIndex).to.equal(0);
    expect(childVideos(el)[0]!.hidden).to.be.false;
  });
});

it('forwards host focus()/blur()/click() to the arrow-navigation playlist row and re-dispatches its focus/blur with no prefixed alias', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-video-playlist>
        <lr-video title="First"></lr-video>
        <lr-video title="Second"></lr-video>
      </lr-video-playlist>
    </div>
  `);
  const el = wrapper.querySelector('lr-video-playlist') as LyraVideoPlaylist;
  await settle(el);
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
  });
  wrapper.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
  });

  el.focus();
  expect(el.shadowRoot!.activeElement === items(el)[0]).to.equal(true);

  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  const changed = oneEvent(el, 'lr-video-change');
  el.goTo(1);
  await changed;
  await settle(el);
  el.focus();
  expect(el.shadowRoot!.activeElement === items(el)[1], 'focus follows the arrow-navigation row').to.equal(true);

  let clicks = 0;
  items(el)[1]!.addEventListener('click', () => {
    clicks += 1;
  });
  el.click();
  expect(clicks, 'click() activates the arrow-navigation row').to.equal(1);
  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur', 'focus']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(sequence).to.deep.equal(['focus', 'blur', 'focus']);
  expect(aliases, 'lr-focus/lr-blur compatibility aliases must not fire').to.deep.equal([]);
});
