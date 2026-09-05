import { expect, fixture, html } from '@open-wc/testing';
import './avatar.js';

it('consumes a removed label as absent while retaining null readback and later fallback naming', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-avatar']>(html`<lr-avatar label="Ada Lovelace" initials="AL"></lr-avatar>`);
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Ada Lovelace');
  el.removeAttribute('label');
  await el.updateComplete;
  expect(el.label).to.equal(null);
  expect(base.getAttribute('role')).to.equal(null);
  expect(base.getAttribute('aria-label')).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part="initials"]')!.getAttribute('aria-hidden')).to.equal(null);
  el.setAttribute('label', '');
  await el.updateComplete;
  expect(el.label).to.equal('');
  expect(base.getAttribute('aria-label')).to.equal(null);
  el.setAttribute('label', 'Grace Hopper');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Grace Hopper');
  el.setAttribute('aria-label', 'Host owner');
  el.removeAttribute('label');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Host owner');
});
