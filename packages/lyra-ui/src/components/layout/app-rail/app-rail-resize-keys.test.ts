import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraAppRail } from './app-rail.class.js';
import './app-rail.js';

for (const direction of ['ltr', 'rtl']) {
  it(`uses native Home and End to reach resize bounds and honors a veto in ${direction}`, async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail dir=${direction} force-mode="full" resizable
      rail-width="240" min-rail-width="190" max-rail-width="320"></lr-app-rail>`);
    const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
    const requests: number[] = [], committed: number[] = [];
    let veto = false;
    el.addEventListener('lr-rail-resize-request', event => {
      requests.push(event.detail.widthPx);
      if (veto) event.preventDefault();
    });
    el.addEventListener('lr-rail-resize', event => committed.push(event.detail.widthPx));
    await focusByKeyboard(resizer);
    await sendKeys({ press: 'End' });
    await el.updateComplete;
    expect(el.railWidth).to.equal(320);
    expect(resizer.getAttribute('aria-valuenow')).to.equal('320');
    await sendKeys({ press: 'End' });
    expect(requests).to.deep.equal([320]);
    await sendKeys({ press: 'Home' });
    await el.updateComplete;
    expect(el.railWidth).to.equal(190);
    expect(resizer.getAttribute('aria-valuenow')).to.equal('190');
    veto = true;
    await sendKeys({ press: 'End' });
    await el.updateComplete;
    expect(el.railWidth).to.equal(190);
    expect(resizer.getAttribute('aria-valuenow')).to.equal('190');
    expect(requests).to.deep.equal([320, 190, 320]);
    expect(committed).to.deep.equal([320, 190]);
  });
}
