import { fixture, expect, html } from '@open-wc/testing';
import './icon.js';
import type { LyraIcon } from './icon.js';

it('renders a named SVG path as a decorative icon', async () => {
  const el = (await fixture(html`<lr-icon name="search"></lr-icon>`)) as LyraIcon;
  expect(el.shadowRoot!.querySelector('path')).to.exist;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).to.equal('true');
});

it('is accessible when given a label', async () => {
  const el = await fixture(html`<lr-icon name="search" label="Search"></lr-icon>`);
  await expect(el).to.be.accessible();
});

it('forwards the host accessible name to the shadow SVG, including late changes', async () => {
  const el = (await fixture(html`<lr-icon name="search" aria-label="Find"></lr-icon>`)) as LyraIcon;
  const svg = el.shadowRoot!.querySelector('svg')!;

  expect(svg.getAttribute('aria-label')).to.equal('Find');
  expect(svg.getAttribute('aria-hidden')).to.equal('false');

  el.setAttribute('aria-label', 'Search');
  await el.updateComplete;
  expect(svg.getAttribute('aria-label')).to.equal('Search');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(svg.hasAttribute('aria-label')).to.be.false;
  expect(svg.getAttribute('aria-hidden')).to.equal('true');
});

it('renders custom SVG nodes inside the shadow SVG', async () => {
  const el = await fixture(html`
    <lr-icon>
      <path d="M4 12h16"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </lr-icon>
  `);

  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg > path')).to.exist;
  expect(el.shadowRoot!.querySelector('svg > circle')).to.exist;
});

it('does not clone hyphenated light-DOM custom elements into the SVG namespace', async () => {
  const el = await fixture(html`
    <lr-icon>
      <x-icon-test-node><path d="M0 0"></path></x-icon-test-node>
      <path d="M4 12h16"></path>
    </lr-icon>
  `);
  await (el as LyraIcon).updateComplete;
  expect(el.shadowRoot!.querySelector('svg > x-icon-test-node')).to.not.exist;
  expect(el.shadowRoot!.querySelector('svg > path')).to.exist;
});
