import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './tooltip.js';
import type { LyraTooltip } from './tooltip.class.js';

it('replaces a pending hide delay without letting its obsolete timer close a still-visible tooltip', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip trigger="hover" hide-delay="50"
      style="--lr-duration-fast:0ms;--lr-duration-normal:0ms">
      Save the current document
      <button slot="trigger">Save</button>
    </lr-tooltip>
  `);
  const trigger = el.querySelector('button')!;
  let hidden = 0;
  el.addEventListener('lr-after-hide', () => { hidden++; });
  try {
    await el.show();
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    el.hideDelay = 5000;
    await el.updateComplete;
    // wait-reason: pass the obsolete 50ms timer to prove its close request was cancelled
    await aTimeout(150);
    expect(el.open).to.equal(true);
    expect(hidden).to.equal(0);
    const closed = oneEvent(el, 'lr-after-hide');
    el.hideDelay = 0;
    await closed;
    expect(el.open).to.equal(false);
    expect(hidden).to.equal(1);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!.hidden).to.equal(true);
    expect(trigger.hasAttribute('aria-describedby')).to.equal(false);
    await el.show();
    expect(el.open).to.equal(true);
    expect(trigger.hasAttribute('aria-describedby')).to.equal(true);
    await expect(el).to.be.accessible();
  } finally {
    await el.hide();
  }
});
