import { expect, fixture, html } from '@open-wc/testing';
import { resolveCssTokenLength } from './css-token-length.js';
import { resolveCssLength } from './css-length.js';

it('resolves density math while retaining the public literal-length contract', async () => {
  const host = await fixture<HTMLElement>(html`<div style="font-size: 20px"></div>`);
  expect(resolveCssTokenLength('max(calc(2em * 0.75), 24px)', { host })).to.equal(30);
  expect(resolveCssTokenLength('clamp(24px, 3em, 44px)', { host })).to.equal(44);
  expect(resolveCssTokenLength('min(3em, 44px)', { host })).to.equal(44);
  expect(resolveCssTokenLength('calc(1em - 24px)', { host })).to.equal(-4);
  expect(resolveCssTokenLength('24px', { host })).to.equal(24);
  expect(resolveCssLength('max(calc(2em * 0.75), 24px)', { host })).to.be.undefined;
  expect(host.childElementCount).to.equal(0);
});

it('re-reads expressions inside shadow roots after the inherited font size changes', async () => {
  const host = await fixture<HTMLElement>(html`<div style="font-size: 20px"></div>`);
  const root = host.attachShadow({ mode: 'open' });
  expect(resolveCssTokenLength('max(2em, 24px)', { host })).to.equal(40);
  host.style.fontSize = '30px';
  expect(resolveCssTokenLength('max(2em, 24px)', { host })).to.equal(60);
  expect(root.childElementCount).to.equal(0);
  expect(host.childElementCount).to.equal(0);
});

it('resolves expressions against the owner document and its live root font size', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const owner = frame.contentDocument;
  if (!owner) throw new Error('The iframe document was unavailable.');
  owner.documentElement.style.fontSize = '20px';
  const host = owner.body.appendChild(owner.createElement('div'));
  host.style.fontSize = '10px';
  expect(resolveCssTokenLength('calc(2rem + 1em)', { host })).to.equal(50);
  owner.documentElement.style.fontSize = '30px';
  expect(resolveCssTokenLength('calc(2rem + 1em)', { host })).to.equal(70);
  expect(host.childElementCount).to.equal(0);
});

it('fails closed for invalid expressions and percentages without a layout basis', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  for (const value of ['', 'auto', 'calc(bogus)', 'calc(var(--missing-length))', 'max(50%, 24px)', 'calc(1px); color: red']) {
    expect(resolveCssTokenLength(value, { host }), value).to.be.undefined;
  }
  expect(host.childElementCount).to.equal(0);
  const detached = document.createElement('div');
  expect(resolveCssTokenLength('max(2rem, 24px)', { host: detached })).to.be.undefined;
  const ownerless = document.implementation.createHTMLDocument('');
  const ownerlessHost = ownerless.body.appendChild(ownerless.createElement('div'));
  expect(resolveCssTokenLength('max(2rem, 24px)', { host: ownerlessHost })).to.be.undefined;
});
