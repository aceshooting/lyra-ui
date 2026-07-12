import { fixture, expect, html } from '@open-wc/testing';
import { isRtl } from './rtl.js';

it('reads the resolved direction off the element, not a fixed default', async () => {
  const ltr = await fixture(html`<div dir="ltr"></div>`);
  const rtl = await fixture(html`<div dir="rtl"></div>`);
  expect(isRtl(ltr)).to.be.false;
  expect(isRtl(rtl)).to.be.true;
});

it('inherits direction from an ancestor when not set directly on the element', async () => {
  const wrapper = await fixture(html`<div dir="rtl"><span></span></div>`);
  const child = wrapper.querySelector('span')!;
  expect(isRtl(child)).to.be.true;
});
