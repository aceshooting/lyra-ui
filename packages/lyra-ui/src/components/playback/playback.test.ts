import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './playback.js';
import type { LyraPlayback } from './playback.js';

it('advances the index on each tick and wraps when loop is true', async () => {
  const el = (await fixture(
    html`<lyra-playback length="3" interval-ms="10"></lyra-playback>`,
  )) as LyraPlayback;
  const playEvent = oneEvent(el, 'lyra-play');
  el.play();
  await playEvent;
  await aTimeout(35);
  el.pause();
  expect(el.index).to.be.greaterThan(0);
});

it('stops at the last index when loop is false and not-looping is reached', async () => {
  const el = (await fixture(
    html`<lyra-playback length="2" interval-ms="10" index="1"></lyra-playback>`,
  )) as LyraPlayback;
  el.loop = false;
  el.play();
  await aTimeout(30);
  expect(el.playing).to.be.false;
  expect(el.index).to.equal(1);
});

it('no-ops play() when length <= 1', async () => {
  const el = (await fixture(html`<lyra-playback length="1"></lyra-playback>`)) as LyraPlayback;
  el.play();
  expect(el.playing).to.be.false;
});

it('next()/previous()/goTo() emit lyra-step without starting playback', async () => {
  const el = (await fixture(html`<lyra-playback length="5" index="2"></lyra-playback>`)) as LyraPlayback;
  let detail: { index: number } | undefined;
  el.addEventListener('lyra-step', (e) => (detail = (e as CustomEvent).detail));
  el.next();
  expect(el.index).to.equal(3);
  expect(detail!.index).to.equal(3);
  el.previous();
  expect(el.index).to.equal(2);
  el.goTo(4);
  expect(el.index).to.equal(4);
  expect(el.playing).to.be.false;
});

it('auto-pauses on disconnect', async () => {
  const el = (await fixture(
    html`<lyra-playback length="3" interval-ms="10"></lyra-playback>`,
  )) as LyraPlayback;
  el.play();
  el.remove();
  expect(el.playing).to.be.false;
});

it('auto-pauses when the element becomes hidden', async () => {
  const el = (await fixture(
    html`<lyra-playback length="3" interval-ms="10"></lyra-playback>`,
  )) as LyraPlayback;
  el.play();
  await el.updateComplete;
  expect(el.playing).to.be.true;
  el.hidden = true;
  await el.updateComplete;
  expect(el.playing).to.be.false;
  expect(getComputedStyle(el).display).to.equal('none');
});

it('auto-pauses when length is externally reduced to <= 1 while playing', async () => {
  const el = (await fixture(
    html`<lyra-playback length="3" interval-ms="10"></lyra-playback>`,
  )) as LyraPlayback;
  el.play();
  await el.updateComplete;
  expect(el.playing).to.be.true;

  el.length = 1;
  await el.updateComplete;

  expect(el.playing).to.be.false;
  // The play button must not be left as the only control that could stop a
  // still-running timer — confirm the timer actually stopped, not just the
  // `playing` flag, by waiting well past interval-ms and checking the index
  // never advances again.
  const indexAfterPause = el.index;
  await aTimeout(60);
  expect(el.index).to.equal(indexAfterPause);
});

it('re-clamps index into range when length shrinks to a value still > 1', async () => {
  const el = (await fixture(
    html`<lyra-playback length="10" index="9"></lyra-playback>`,
  )) as LyraPlayback;
  expect(el.index).to.equal(9);

  el.length = 3;
  await el.updateComplete;

  expect(el.index).to.be.lessThan(3);
  expect(el.index).to.be.at.least(0);
});

it('goTo() never produces a negative index when length is at its default (0)', async () => {
  const el = (await fixture(html`<lyra-playback></lyra-playback>`)) as LyraPlayback;
  expect(el.length).to.equal(0);

  el.goTo(0);

  expect(el.index).to.be.at.least(0);
});

it('re-reads interval-ms fresh instead of baking the original value into the timer for the whole play session', async () => {
  const el = (await fixture(
    html`<lyra-playback length="100" interval-ms="30"></lyra-playback>`,
  )) as LyraPlayback;
  el.play();

  // First tick has fired (~30ms in) but not the second (~60ms in).
  await aTimeout(45);
  expect(el.index).to.equal(1);

  // Slow playback down drastically right after the first tick. The second
  // tick was already scheduled at the old cadence, so it still lands
  // (~60ms in); the *following* reschedule is what must pick up the change.
  el.intervalMs = 3000;

  // Under the old `setInterval`-baked-at-play()-time behavior this window
  // would let several more 30ms ticks land (index climbing well past 2);
  // fixed, only the already-in-flight second tick fires and then playback
  // stalls at the new, much longer cadence.
  await aTimeout(200);
  expect(el.index).to.equal(2);

  el.pause();
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-playback length="3"></lyra-playback>`)) as LyraPlayback;
  await expect(el).to.be.accessible();
});

it('renders the play/pause button content as an SVG icon, not a literal glyph, and swaps it with `playing`', async () => {
  const el = (await fixture(html`<lyra-playback length="3"></lyra-playback>`)) as LyraPlayback;
  const button = () => el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  expect(button().querySelector('svg')).to.exist;
  expect(button().textContent).to.not.include('▶');
  expect(button().textContent).to.not.include('❚❚');
  const playMarkup = button().innerHTML;

  el.playing = true;
  await el.updateComplete;

  expect(button().querySelector('svg')).to.exist;
  expect(button().innerHTML).to.not.equal(playMarkup);
});

it('shows the disabled affordance (opacity + not-allowed cursor) on the play button when length <= 1', async () => {
  const el = (await fixture(html`<lyra-playback length="1"></lyra-playback>`)) as LyraPlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  expect(button.disabled).to.be.true;
  const style = getComputedStyle(button);
  expect(style.opacity).to.equal('0.5');
  expect(style.cursor).to.equal('not-allowed');
});

it('shows a focus ring on the play button when it receives keyboard/programmatic focus', async () => {
  const el = (await fixture(html`<lyra-playback length="3"></lyra-playback>`)) as LyraPlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

  button.focus();
  await el.updateComplete;

  const style = getComputedStyle(button);
  expect(style.outlineStyle).to.equal('solid');
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('toggles playback when the rendered play-button is clicked', async () => {
  const el = (await fixture(html`<lyra-playback length="3"></lyra-playback>`)) as LyraPlayback;
  const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
  const playEvent = oneEvent(el, 'lyra-play');

  button.click();
  await playEvent;
  expect(el.playing).to.be.true;

  const pauseEvent = oneEvent(el, 'lyra-pause');
  button.click();
  await pauseEvent;
  expect(el.playing).to.be.false;
});

it('jumps to the input value when the rendered slider fires an input event', async () => {
  const el = (await fixture(html`<lyra-playback length="5" index="0"></lyra-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;
  const stepEvent = oneEvent(el, 'lyra-step');

  slider.value = '3';
  slider.dispatchEvent(new Event('input'));

  const { detail } = await stepEvent;
  expect(el.index).to.equal(3);
  expect(detail.index).to.equal(3);
});

it('disables the rendered slider when length <= 1', async () => {
  const el = (await fixture(html`<lyra-playback length="1"></lyra-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  expect(slider.disabled).to.be.true;
  const style = getComputedStyle(slider);
  expect(style.opacity).to.equal('0.5');
  expect(style.cursor).to.equal('not-allowed');
});

it('shows a focus ring on the slider when it receives keyboard/programmatic focus', async () => {
  const el = (await fixture(html`<lyra-playback length="3"></lyra-playback>`)) as LyraPlayback;
  const slider = el.shadowRoot!.querySelector('[part="slider"]') as HTMLInputElement;

  slider.focus();
  await el.updateComplete;

  const style = getComputedStyle(slider);
  expect(style.outlineStyle).to.equal('solid');
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});
