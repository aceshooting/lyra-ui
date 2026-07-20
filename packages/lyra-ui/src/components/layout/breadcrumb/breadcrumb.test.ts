import { fixture, expect, html } from '@open-wc/testing';
import './breadcrumb.js';
import './breadcrumb-item.js';

it('renders navigable breadcrumb items and marks the current page', async () => {
  const el = await fixture(html`<lr-breadcrumb>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const current = el.querySelector('lr-breadcrumb-item')?.nextElementSibling;
  expect(current?.shadowRoot?.querySelector('[aria-current="page"]')).to.exist;
  expect(el.shadowRoot!.querySelector('nav')?.getAttribute('aria-label')).to.equal('Breadcrumb');
  await expect(el).to.be.accessible();
});

it('forwards a host aria-label to the shadow <nav> landmark, overriding the localized default', async () => {
  const el = await fixture(html`<lr-breadcrumb aria-label="Docs breadcrumb">
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  expect(el.shadowRoot!.querySelector('nav')?.getAttribute('aria-label')).to.equal('Docs breadcrumb');
});

it('localizes the nav landmark default accessible name via .strings, proving the call site is wired up', async () => {
  const el = await fixture(html`<lr-breadcrumb .strings=${{ breadcrumb: 'Fil d’Ariane' }}>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  expect(el.shadowRoot!.querySelector('nav')?.getAttribute('aria-label')).to.equal('Fil d’Ariane');
});

it("separates items via a ::before on each non-first slotted item, matched by role rather than tag name", async () => {
  const el = await fixture(html`<lr-breadcrumb>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const [first, second] = Array.from(el.querySelectorAll('lr-breadcrumb-item'));
  expect(first.getAttribute('role')).to.equal('listitem');
  expect(getComputedStyle(first, '::before').content).to.equal('none');
  expect(getComputedStyle(second, '::before').content).to.equal('"/"');
});
