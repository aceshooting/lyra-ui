import { fixture, expect, html } from '@open-wc/testing';
import './badge.js';
import './tag.js';

it('renders a themed badge and tag alias', async () => {
  const el = await fixture(html`<div><lr-badge variant="success">Ready</lr-badge><lr-tag>Tag</lr-tag></div>`);
  expect(el.querySelector('lr-badge')?.textContent).to.contain('Ready');
  expect(el.querySelector('lr-tag')).to.exist;
  await expect(el.querySelector('lr-badge')!).to.be.accessible();
});
