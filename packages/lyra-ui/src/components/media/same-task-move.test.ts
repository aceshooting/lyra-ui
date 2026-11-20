import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../lr-animation.js';
import '../lr-sequence-playback.js';
import '../lr-qr-code.js';
import '../lr-video.js';
import '../lr-video-playlist.js';
import '../lr-flag.js';
import '../lr-av-player.js';
import type { LyraAnimation } from './animation/animation.class.js';
import type { LyraSequencePlayback } from './sequence-playback/sequence-playback.class.js';
import type { LyraQrCode } from './qr-code/qr-code.class.js';
import type { LyraVideo } from './video/video.class.js';
import type { LyraVideoPlaylist } from './video-playlist/video-playlist.class.js';
import type { LyraFlag } from './flag/flag.class.js';
import type { LyraAvPlayer } from './av-player/av-player.class.js';

const IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%23f00"/%3E%3C/svg%3E';

/** Two containers: a same-task `append()` into the second is a DOM move, never a teardown. */
async function stage<T extends HTMLElement>(markup: ReturnType<typeof html>): Promise<{ el: T; other: HTMLElement }> {
  const root = await fixture<HTMLDivElement>(html`<div><div id="a">${markup}</div><div id="b"></div></div>`);
  return { el: root.querySelector('#a')!.firstElementChild as T, other: root.querySelector<HTMLElement>('#b')! };
}

/** Counts native `pause()` calls on a media element without touching its prototype. */
function countPauses(media: HTMLMediaElement): () => number {
  let calls = 0;
  const pause = media.pause.bind(media);
  media.pause = () => { calls++; pause(); };
  return () => calls;
}

describe('same-task DOM move keeps media resources', () => {
  it('lr-animation keeps its finished Animation and fill across a move, and cancels it on removal', async () => {
    const { el, other } = await stage<LyraAnimation>(html`<lr-animation name="fade-in" duration="300" iterations="1" fill="forwards"><p>Shown</p></lr-animation>`);
    const target = el.querySelector('p')!;
    const animation = () => (el as unknown as { animation?: Animation }).animation;
    let finished = false;
    el.addEventListener('lr-finish', () => { finished = true; });
    el.play = true;
    await waitUntil(() => finished, 'animation never finished');
    const before = animation(); const time = before?.currentTime;
    other.append(el);
    await el.updateComplete; await aTimeout(20);
    expect(animation() === before, 'same Animation object').to.equal(true);
    expect(animation()?.currentTime).to.equal(time);
    expect(getComputedStyle(target).opacity).to.equal('1');
    el.remove(); await aTimeout(0);
    expect(animation() === undefined).to.equal(true);
    expect(target.getAnimations().length).to.equal(0);
  });

  it('lr-sequence-playback keeps playing across a move and pauses on removal', async () => {
    const { el, other } = await stage<LyraSequencePlayback>(html`<lr-sequence-playback item-count="4" interval-ms="5000"></lr-sequence-playback>`);
    el.play(); await el.updateComplete;
    other.append(el); await aTimeout(0);
    expect(el.playing).to.equal(true);
    el.remove(); await aTimeout(0);
    expect(el.playing).to.equal(false);
  });

  it('lr-qr-code keeps its symbol and embedded image across a move and drops the image on removal', async () => {
    const { el, other } = await stage<LyraQrCode>(html`<lr-qr-code size="80" image=${IMAGE}></lr-qr-code>`);
    let loads = 0;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => {
      loads++;
      return Promise.resolve({ create: () => ({ modules: { size: 1, get: () => 1 } }) });
    };
    el.value = 'hello';
    const image = () => (el as unknown as { loadState: { image?: HTMLImageElement } }).loadState.image;
    await waitUntil(() => image() !== undefined, 'embedded image never loaded');
    const before = image(); const generated = loads;
    other.append(el);
    await el.updateComplete; await aTimeout(20);
    expect(image() === before, 'same embedded image').to.equal(true);
    expect(loads).to.equal(generated);
    expect(el.getAttribute('aria-busy')).to.equal('false');
    el.remove(); await aTimeout(0);
    expect(image() === undefined).to.equal(true);
  });

  it('lr-flag keeps a resolved direct image across a move and restarts after a genuine removal', async () => {
    const { el, other } = await stage<LyraFlag>(html`<lr-flag src=${IMAGE}></lr-flag>`);
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('img')!;
    first.dispatchEvent(new Event('load')); await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('false');
    other.append(el); await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelector('img') === first).to.equal(true);
    el.remove(); await aTimeout(0);
    other.append(el); await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('true');
  });

  it('lr-video does not pause or unbind its native media across a move, and pauses on removal', async () => {
    const { el, other } = await stage<LyraVideo>(html`<lr-video src="https://example.test/move.mp4" preload="none"></lr-video>`);
    await el.updateComplete;
    const native = el.getVideoElement()!;
    await aTimeout(20);
    const pauses = countPauses(native);
    other.append(el); await el.updateComplete; await aTimeout(20);
    expect(pauses()).to.equal(0);
    expect(el.getVideoElement() === native).to.equal(true);
    el.remove(); await aTimeout(0);
    expect(pauses()).to.be.greaterThan(0);
  });

  it('lr-video-playlist keeps the active video loaded across a move, and unloads on removal', async () => {
    const { el, other } = await stage<LyraVideoPlaylist>(html`
      <lr-video-playlist>
        <lr-video title="First" src="https://example.test/first.mp4" preload="none"></lr-video>
        <lr-video title="Second" src="https://example.test/second.mp4" preload="none"></lr-video>
      </lr-video-playlist>`);
    await el.updateComplete; await aTimeout(0); await el.updateComplete;
    const first = el.querySelector<LyraVideo>('lr-video')!;
    await first.updateComplete;
    const native = first.getVideoElement()!;
    expect(native.hasAttribute('src')).to.equal(true);
    await aTimeout(20);
    const pauses = countPauses(native);
    other.append(el); await el.updateComplete; await aTimeout(20);
    expect(pauses()).to.equal(0);
    expect(first.hidden).to.equal(false);
    expect(native.hasAttribute('src')).to.equal(true);
    el.remove(); await aTimeout(0);
    expect(first.hidden).to.equal(true);
  });

  it('lr-av-player does not pause its native media across a move, and pauses on removal', async () => {
    const { el, other } = await stage<LyraAvPlayer>(html`<lr-av-player src="https://example.test/move.mp3" preload="none"></lr-av-player>`);
    await el.updateComplete;
    const native = el.shadowRoot!.querySelector<HTMLMediaElement>('audio, video')!;
    await aTimeout(20);
    const pauses = countPauses(native);
    other.append(el); await el.updateComplete; await aTimeout(20);
    expect(pauses()).to.equal(0);
    el.remove(); await aTimeout(0);
    expect(pauses()).to.be.greaterThan(0);
  });
});
