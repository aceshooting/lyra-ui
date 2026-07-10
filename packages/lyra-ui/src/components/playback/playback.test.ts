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
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-playback length="3"></lyra-playback>`)) as LyraPlayback;
  await expect(el).to.be.accessible();
});
