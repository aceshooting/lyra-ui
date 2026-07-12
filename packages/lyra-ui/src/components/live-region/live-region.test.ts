import { fixture, expect, html, waitUntil, nextFrame } from '@open-wc/testing';
import './live-region.js';
import type { LyraLiveRegion } from './live-region.js';

function regionEl(el: LyraLiveRegion): HTMLElement {
  return el.shadowRoot!.querySelector('[part="region"]') as HTMLElement;
}

it('is accessible in its default, empty state', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  await expect(el).to.be.accessible();
});

it('is accessible once it has announced text', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  el.announce('Loaded 12 results', { force: true });
  await expect(el).to.be.accessible();
});

it('defaults to mode="polite" (role="status", aria-live="polite")', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  expect(el.mode).to.equal('polite');
  const region = regionEl(el);
  expect(region.getAttribute('role')).to.equal('status');
  expect(region.getAttribute('aria-live')).to.equal('polite');
});

it('mode="assertive" renders role="alert" and aria-live="assertive"', async () => {
  const el = (await fixture(html`<lyra-live-region mode="assertive"></lyra-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);
  expect(region.getAttribute('role')).to.equal('alert');
  expect(region.getAttribute('aria-live')).to.equal('assertive');
});

it('reflects mode as a host attribute', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  el.mode = 'assertive';
  await el.updateComplete;
  expect(el.getAttribute('mode')).to.equal('assertive');
});

it('defaults throttleMs to 500, settable via the throttle-ms attribute', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  expect(el.throttleMs).to.equal(500);

  const withAttr = (await fixture(
    html`<lyra-live-region throttle-ms="120"></lyra-live-region>`,
  )) as LyraLiveRegion;
  expect(withAttr.throttleMs).to.equal(120);
});

it('renders the region visually hidden, but present in the accessibility tree', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);
  const rect = region.getBoundingClientRect();
  expect(rect.width).to.be.at.most(1);
  expect(rect.height).to.be.at.most(1);
});

it('announce() writes the coalesced text into the region once the throttle window elapses', async () => {
  const el = (await fixture(
    html`<lyra-live-region throttle-ms="30"></lyra-live-region>`,
  )) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('first');
  el.announce('second');
  expect(region.textContent, 'must not write synchronously').to.equal('');

  await waitUntil(() => region.textContent === 'second', 'expected the coalesced text to land', {
    timeout: 2000,
  });
  expect(region.textContent).to.equal('second');
});

it('announce(text, { force: true }) writes immediately, bypassing the throttle window', async () => {
  const el = (await fixture(
    html`<lyra-live-region throttle-ms="5000"></lyra-live-region>`,
  )) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('urgent', { force: true });
  expect(region.textContent).to.equal('urgent');
});

it('re-announcing the same text clears then re-sets it so assistive tech sees a change', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('same', { force: true });
  expect(region.textContent).to.equal('same');

  el.announce('same', { force: true });
  // Cleared synchronously on the second identical announcement...
  expect(region.textContent).to.equal('');
  // ...then re-populated on the next frame.
  await nextFrame();
  expect(region.textContent).to.equal('same');
});

it('back-to-back distinct announcements never need the clear step', async () => {
  const el = (await fixture(html`<lyra-live-region></lyra-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('one', { force: true });
  expect(region.textContent).to.equal('one');
  el.announce('two', { force: true });
  expect(region.textContent, 'distinct text should be set directly, no clear step').to.equal('two');
});

it('changing throttle-ms applies to the next burst', async () => {
  const el = (await fixture(
    html`<lyra-live-region throttle-ms="5000"></lyra-live-region>`,
  )) as LyraLiveRegion;
  const region = regionEl(el);

  el.throttleMs = 20;
  await el.updateComplete;

  el.announce('fast');
  await waitUntil(() => region.textContent === 'fast', 'expected the shortened window to apply', {
    timeout: 2000,
  });
});

it('buffers a flush that lands before the first render and applies it once ready', async () => {
  const el = document.createElement('lyra-live-region') as LyraLiveRegion;
  document.body.appendChild(el);
  // Synchronously right after mounting -- before firstUpdated() has had a
  // chance to run -- mirrors a consumer that mounts-then-immediately-uses a
  // region the way toaster.ts mounts-then-immediately-uses a toast region.
  el.announce('early', { force: true });

  await el.updateComplete;
  expect(regionEl(el).textContent).to.equal('early');
  el.remove();
});

it('cancels a pending announcement on disconnect so it never lands after removal', async () => {
  const el = (await fixture(
    html`<lyra-live-region throttle-ms="30"></lyra-live-region>`,
  )) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('too late');
  el.remove();

  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(region.textContent, 'a disconnected region must not still flush').to.equal('');
});
