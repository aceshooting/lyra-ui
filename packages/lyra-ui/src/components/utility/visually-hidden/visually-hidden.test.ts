import { fixture, expect, html } from '@open-wc/testing';
import './visually-hidden.js';

it('collapses out of sight while remaining in the accessibility tree', async () => {
  const el = await fixture(html`<lr-visually-hidden>Skip to content</lr-visually-hidden>`);
  const style = getComputedStyle(el);
  // Rendered result, not stylesheet text: an element that were `display:none` would also be gone
  // from the a11y tree, which is exactly the failure this component must not have.
  expect(style.display).to.not.equal('none');
  expect(style.visibility).to.not.equal('hidden');
  expect(el.getBoundingClientRect().width).to.be.at.most(1);
  expect(el.getBoundingClientRect().height).to.be.at.most(1);
  expect(el.textContent?.trim()).to.equal('Skip to content');
  await expect(el).to.be.accessible();
});

it('becomes visible while focus is inside it', async () => {
  const el = await fixture(html`<lr-visually-hidden><a href="#main">Skip to content</a></lr-visually-hidden>`);
  el.querySelector('a')!.focus();
  await el.updateComplete;
  expect(el.getBoundingClientRect().height).to.be.greaterThan(1);
});
