import { fixture, expect, html } from '@open-wc/testing';
import './sequence-strip.js';
import type { LyraSequenceStrip } from './sequence-strip.js';

const categories = [
  { key: 'text', color: '#4f46e5', label: 'Text' },
  { key: 'tool', color: '#16a34a', label: 'Tool' },
];
const items = [
  { id: '1', category: 'text' },
  { id: '2', category: 'tool', marker: true },
  { id: '3', category: 'text' },
];

it('defaults to empty items/categories and orientation horizontal', async () => {
  const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
  expect(el.items).to.deep.equal([]);
  expect(el.categories).to.deep.equal([]);
  expect(el.orientation).to.equal('horizontal');
});

it('renders one cell per item, colored by its category', async () => {
  const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
  expect(cells.length).to.equal(3);
  expect(cells[0].style.backgroundColor).to.not.equal('');
  expect(cells[0].style.backgroundColor).to.equal(cells[2].style.backgroundColor); // both 'text'
  expect(cells[0].style.backgroundColor).to.not.equal(cells[1].style.backgroundColor);
});

it('renders a marker on cells whose item sets marker: true, and none otherwise', async () => {
  const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
  expect(cells[0].querySelector('[part="marker"]')).to.not.exist;
  expect(cells[1].querySelector('[part="marker"]')).to.exist;
  expect(cells[2].querySelector('[part="marker"]')).to.not.exist;
});

it('is role="img" with an auto-generated aria-label summarizing counts per category', async () => {
  const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const root = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(root.getAttribute('role')).to.equal('img');
  const label = root.getAttribute('aria-label')!;
  expect(label).to.include('Text');
  expect(label).to.include('2'); // 2 'text' items
  expect(label).to.include('Tool');
  expect(label).to.include('1'); // 1 'tool' item
});

it('uses accessibleLabel verbatim instead of the auto-generated summary when set', async () => {
  const el = (await fixture(
    html`<lyra-sequence-strip accessible-label="Custom summary"></lyra-sequence-strip>`,
  )) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom summary');
});

it('renders an empty strip (no cells, generic aria-label) when items is empty', async () => {
  const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.be.a('string');
});
