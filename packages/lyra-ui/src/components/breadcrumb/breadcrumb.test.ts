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

it('forwards a host aria-label to the shadow <nav> landmark, overriding the localized default', async () => {
  const el = await fixture(html`<lyra-breadcrumb aria-label="Docs breadcrumb">
    <lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item>
  </lyra-breadcrumb>`);
  expect(el.shadowRoot!.querySelector('nav')?.getAttribute('aria-label')).to.equal('Docs breadcrumb');
});

it("separates items via a ::before on each non-first slotted item, matched by role rather than tag name", async () => {
  const el = await fixture(html`<lyra-breadcrumb>
    <lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item>
    <lyra-breadcrumb-item current>Reports</lyra-breadcrumb-item>
  </lyra-breadcrumb>`);
  const [first, second] = Array.from(el.querySelectorAll('lyra-breadcrumb-item'));
  expect(first.getAttribute('role')).to.equal('listitem');
  expect(getComputedStyle(first, '::before').content).to.equal('none');
  expect(getComputedStyle(second, '::before').content).to.equal('"/"');
});
