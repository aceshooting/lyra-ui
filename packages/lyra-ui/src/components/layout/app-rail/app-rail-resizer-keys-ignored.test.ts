import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraAppRail } from './app-rail.class.js';
import './app-rail.js';

it('leaves the rail width and the key alone for keys that do not resize', async () => {
  const el = await fixture<LyraAppRail>(html`<lr-app-rail force-mode="full" resizable
    rail-width="240" min-rail-width="190" max-rail-width="320"></lr-app-rail>`);
  const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
  const requests: number[] = [];
  el.addEventListener('lr-rail-resize-request', (event) => requests.push(event.detail.widthPx));
  const prevented: boolean[] = [];
  const record = (event: KeyboardEvent): void => { prevented.push(event.defaultPrevented); };
  await focusByKeyboard(resizer);
  document.addEventListener('keydown', record);
  try {
    await sendKeys({ press: 'a' });
    await sendKeys({ press: 'Enter' });
  } finally {
    document.removeEventListener('keydown', record);
  }
  await el.updateComplete;
  expect(requests).to.deep.equal([]);
  expect(prevented).to.deep.equal([false, false]);
  expect(el.railWidth).to.equal(240);
  expect(resizer.getAttribute('aria-valuenow')).to.equal('240');
});
