import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-dialog.js';
import type { LyraDialog } from '../../lr-dialog.js';

it('routes the heading line height, header border and body overflow tokens, keeping defaults unset', async () => {
  const el = await fixture<LyraDialog>(html`<lr-dialog open label="Heading" style="--lr-duration-base: 0ms; line-height: 17px">Body</lr-dialog>`);
  const root = el.shadowRoot!;
  const heading = root.querySelector<HTMLElement>('[part~="heading"]')!;
  const header = root.querySelector<HTMLElement>('[part="header"]')!;
  const body = root.querySelector<HTMLElement>('[part="body"]')!;
  expect(getComputedStyle(heading).lineHeight).to.equal('17px');
  expect(getComputedStyle(header).borderBottomStyle).to.equal('solid');
  expect(getComputedStyle(body).overflowY).to.equal('auto');
  el.style.setProperty('--lr-dialog-heading-line-height', '33px');
  el.style.setProperty('--lr-dialog-header-border', 'none');
  el.style.setProperty('--lr-dialog-body-overflow', 'hidden');
  expect(getComputedStyle(heading).lineHeight).to.equal('33px');
  expect(getComputedStyle(header).borderBottomStyle).to.equal('none');
  expect(getComputedStyle(body).overflowY).to.equal('hidden');
  el.style.setProperty('--lr-dialog-header-border', '3px dashed rgb(1, 2, 3)');
  expect([getComputedStyle(header).borderBottomWidth, getComputedStyle(header).borderBottomColor]).to.deep.equal(['3px', 'rgb(1, 2, 3)']);
  const footer = root.querySelector<HTMLElement>('[part="footer"]');
  if (footer) expect(getComputedStyle(footer).borderTopWidth).to.not.equal('3px');
  el.open = false;
  await el.updateComplete;
});
