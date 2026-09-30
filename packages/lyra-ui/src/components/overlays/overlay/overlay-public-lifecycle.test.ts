import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './popover.js';
import './tooltip.js';
import type { LyraPopover } from './popover.class.js';
import type { LyraTooltip } from './tooltip.class.js';

afterEach(async () => { await resetMouse(); });

it('reschedules an interaction hide when the live popover hide delay changes', async () => {
  const el = await fixture<LyraPopover>(html`
    <lr-popover trigger="hover" show-delay="0" hide-delay="1000" style="--show-duration:0ms;--hide-duration:0ms">
      <button slot="trigger">Details</button><p>Additional information</p>
    </lr-popover>
  `);
  const trigger = el.querySelector<HTMLButtonElement>('button')!;
  await hoverUntilMatched(trigger, 'pointer reached the popover trigger');
  await waitUntil(() => el.open);
  await resetMouse();
  await aTimeout(30);
  expect(el.open).to.equal(true);
  const hidden = oneEvent(el, 'lr-after-hide');
  el.hideDelay = 0;
  await hidden;
  expect(el.open).to.equal(false);
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
});

it('reconnects an open popover after overlay cleanup without announcing a second show', async () => {
  const el = await fixture<LyraPopover>(html`
    <lr-popover style="--show-duration:0ms;--hide-duration:0ms">
      <button slot="trigger">Details</button><p>Additional information</p>
    </lr-popover>
  `);
  let shows = 0;
  el.addEventListener('lr-show', () => { shows += 1; });
  await el.show();
  const parent = el.parentElement!;
  el.remove();
  await aTimeout(30);
  parent.append(el);
  await el.updateComplete;
  await waitUntil(() => !el.shadowRoot!.querySelector('[part~="popup"]')!.hasAttribute('data-hidden'));
  expect(shows).to.equal(1);
  const hidden = oneEvent(el, 'lr-after-hide');
  await sendKeys({ press: 'Escape' });
  await hidden;
  expect(el.open).to.equal(false);
});

it('releases a keyboard tooltip description when focus is removed from its trigger vocabulary', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip trigger="focus" show-delay="0" hide-delay="0" style="--show-duration:0ms;--hide-duration:0ms">
      <button slot="trigger">Help</button><span>Helpful explanation</span>
    </lr-tooltip>
  `);
  const trigger = el.querySelector<HTMLButtonElement>('button')!;
  await focusByKeyboard(trigger);
  await waitUntil(() => el.open);
  expect(trigger.getAttribute('aria-describedby')).not.to.equal(null);
  await el.hide();
  expect(trigger.getAttribute('aria-describedby')).not.to.equal(null);
  el.trigger = 'hover';
  await el.updateComplete;
  await waitUntil(() => !trigger.hasAttribute('aria-describedby'));
  expect(document.activeElement === trigger).to.equal(true);
  expect(el.open).to.equal(false);
});

it('cancels a pending popover reveal when it disconnects and leaves reconnect closed', async () => {
  const el = await fixture<LyraPopover>(html`
    <lr-popover trigger="hover" show-delay="120">
      <button slot="trigger">Details</button><p>Additional information</p>
    </lr-popover>
  `);
  let shows = 0;
  el.addEventListener('lr-show', () => { shows += 1; });
  await hoverUntilMatched(el.querySelector<HTMLButtonElement>('button')!, 'pointer reached the delayed trigger');
  const parent = el.parentElement!;
  el.remove();
  await resetMouse();
  await aTimeout(200);
  parent.append(el);
  await el.updateComplete;
  expect(el.open).to.equal(false);
  expect(shows).to.equal(0);
});
