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

describe('hover tooltip', () => {
  const labeledItems = [
    { id: '1', category: 'text', label: 'Turn 1: text' },
    { id: '2', category: 'tool', label: 'Turn 2: tool' },
  ];

  it('hides the tooltip until a cell is hovered', async () => {
    const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('shows the item label in the tooltip on pointerenter and hides it on pointerleave', async () => {
    const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll('[part="cell"]')[1] as HTMLElement;

    cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hasAttribute('hidden')).to.be.false;
    expect(tooltip.textContent!.trim()).to.equal('Turn 2: tool');

    cell.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('falls back to the category label when the item has no label of its own', async () => {
    const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items; // no per-item label set
    el.categories = categories;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll('[part="cell"]')[0] as HTMLElement;
    cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal('Text');
  });

  it('is accessible with items, categories, and markers set', async () => {
    const el = (await fixture(html`<lyra-sequence-strip></lyra-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
