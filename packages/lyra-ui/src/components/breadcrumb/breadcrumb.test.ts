import { fixture, expect, html } from '@open-wc/testing';
import './breadcrumb.js';
import './breadcrumb-item.js';

it('renders navigable breadcrumb items and marks the current page', async () => {
  const el = await fixture(html`<lyra-breadcrumb>
    <lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item>
    <lyra-breadcrumb-item current>Reports</lyra-breadcrumb-item>
  </lyra-breadcrumb>`);
  const current = el.querySelector('lyra-breadcrumb-item')?.nextElementSibling;
  expect(current?.shadowRoot?.querySelector('[aria-current="page"]')).to.exist;
  expect(el.shadowRoot!.querySelector('nav')?.getAttribute('aria-label')).to.equal('Breadcrumb');
  await expect(el).to.be.accessible();
});
