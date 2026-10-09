import { fixture, expect, html } from '@open-wc/testing';
import './visually-hidden.js';

type TestVisuallyHidden = HTMLElement & { updateComplete: Promise<unknown> };

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
  const el = await fixture<TestVisuallyHidden>(html`<lr-visually-hidden><a href="#main">Skip to content</a></lr-visually-hidden>`);
  el.querySelector('a')!.focus();
  await el.updateComplete;
  expect(el.getBoundingClientRect().height).to.be.greaterThan(1);
});

it('sizes its hidden box from the shared --lr-size-1px token, not the unrelated --lr-border-width-thin', async () => {
  const el = await fixture<TestVisuallyHidden>(html`<lr-visually-hidden>Skip to content</lr-visually-hidden>`);
  const style = getComputedStyle(el);
  expect(style.inlineSize).to.equal('1px');
  expect(style.blockSize).to.equal('1px');

  // Retheming an unrelated border-width token -- a plausible "no visible hairline borders" design
  // choice -- must not shrink this element to 0x0. It derives from --lr-size-1px, not
  // --lr-border-width-thin, even though both currently default to the same 1px value.
  document.documentElement.style.setProperty('--lr-theme-border-width-thin', '0');
  try {
    const rethemed = getComputedStyle(el);
    expect(rethemed.inlineSize, 'inline-size must not collapse to 0').to.equal('1px');
    expect(rethemed.blockSize, 'block-size must not collapse to 0').to.equal('1px');
  } finally {
    document.documentElement.style.removeProperty('--lr-theme-border-width-thin');
  }

  // The correct hook does reach it.
  el.style.setProperty('--lr-theme-size-1px', '3px');
  const sized = getComputedStyle(el);
  expect(sized.inlineSize).to.equal('3px');
  expect(sized.blockSize).to.equal('3px');
});
