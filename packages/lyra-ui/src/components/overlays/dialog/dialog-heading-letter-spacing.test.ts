import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-dialog.js';
import type { LyraDialog } from '../../lr-dialog.js';

it('applies --lr-dialog-heading-letter-spacing to the heading, normal while unset', async () => {
  const el = await fixture<LyraDialog>(html`<lr-dialog open label="Heading" style="--lr-duration-base: 0ms">Body</lr-dialog>`);
  const heading = el.shadowRoot!.querySelector<HTMLElement>('[part~="heading"]')!;
  expect(getComputedStyle(heading).letterSpacing).to.equal('normal');
  el.style.setProperty('--lr-dialog-heading-letter-spacing', '2px');
  expect(getComputedStyle(heading).letterSpacing).to.equal('2px');
  el.open = false;
  await el.updateComplete;
});
