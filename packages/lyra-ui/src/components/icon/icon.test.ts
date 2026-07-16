import { fixture, expect, html } from '@open-wc/testing';
import './icon.js';
import type { LyraIcon } from './icon.js';

it('renders a named SVG path as a decorative icon', async () => {
  const el = (await fixture(html`<lyra-icon name="search"></lyra-icon>`)) as LyraIcon;
  expect(el.shadowRoot!.querySelector('path')).to.exist;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).to.equal('true');
});

it('is accessible when given a label', async () => {
  const el = await fixture(html`<lyra-icon name="search" label="Search"></lyra-icon>`);
  await expect(el).to.be.accessible();
});

it('renders custom SVG nodes inside the shadow SVG', async () => {
  const el = await fixture(html`
    <lyra-icon>
      <path d="M4 12h16"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </lyra-icon>
  `);

  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg > path')).to.exist;
  expect(el.shadowRoot!.querySelector('svg > circle')).to.exist;
});
