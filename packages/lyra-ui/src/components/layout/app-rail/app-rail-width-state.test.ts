import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraAppRail } from './app-rail.class.js';
import './app-rail.js';
import './app-rail-item.js';

afterEach(async () => { await resetMouse(); });

it('uses the current explicit CSS width while peeking and normalizes an unresolvable width to its minimum', async () => {
  const el = await fixture<LyraAppRail>(html`<lr-app-rail auto-hide force-mode="icon-only" resizable
    rail-width="18rem" min-rail-width="10rem" max-rail-width="24rem">
    <lr-app-rail-item href="#overview">Overview</lr-app-rail-item>
  </lr-app-rail>`);
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const action = el.querySelector('lr-app-rail-item')!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const footprint = el.getBoundingClientRect().width;
  const stripWidth = surface.getBoundingClientRect().width;
  await focusByKeyboard(action);
  await waitUntil(() => el.peeking && Math.abs(surface.getBoundingClientRect().width - 18 * rem) < 1);
  expect(el.mode).to.equal('icon-only');
  expect(el.getBoundingClientRect().width).to.be.closeTo(footprint, 1);
  expect(el.shadowRoot!.querySelectorAll('[part="resizer"]').length).to.equal(0);

  el.railWidth = '20rem';
  await el.updateComplete;
  await waitUntil(() => Math.abs(surface.getBoundingClientRect().width - 20 * rem) < 1);
  el.railWidth = 'unresolvable';
  await el.updateComplete;
  await waitUntil(() => Math.abs(surface.getBoundingClientRect().width - 10 * rem) < 1);
  expect(el.railWidth, 'normalization affects layout without rewriting caller data').to.equal('unresolvable');
  expect(el.getBoundingClientRect().width).to.be.closeTo(footprint, 1);

  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !el.peeking && Math.abs(surface.getBoundingClientRect().width - stripWidth) < 1);
  expect(el.getBoundingClientRect().width).to.be.closeTo(footprint, 1);
  expect(el.mode).to.equal('icon-only');
});

for (const persist of ['', 'unknown-field', null]) {
  it(`does not overwrite stored state when persist has no recognized fields (${String(persist)})`, async () => {
    const storageKey = `width-state-${String(persist)}`;
    const key = `lr-app-rail:${storageKey}`;
    const before = JSON.stringify({ railWidthPx: 390, preferredMode: 'icon-only', open: true });
    localStorage.setItem(key, before);
    try {
      const el = await fixture<LyraAppRail>(html`<lr-app-rail force-mode="full" resizable
        storage-key=${storageKey} .persist=${persist} rail-width="240"></lr-app-rail>`);
      expect(el.railWidth).to.equal(240);
      expect(el.open).to.equal(false);
      el.railWidth = 320;
      el.preferredMode = 'full';
      await el.updateComplete;
      expect(localStorage.getItem(key)).to.equal(before);
      const separator = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
      expect(separator.getAttribute('aria-valuenow')).to.equal('320');
    } finally {
      localStorage.removeItem(key);
    }
  });
}
