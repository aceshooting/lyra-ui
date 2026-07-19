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
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  expect(el.items).to.deep.equal([]);
  expect(el.categories).to.deep.equal([]);
  expect(el.orientation).to.equal('horizontal');
});

it('renders one cell per item, colored by its category', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
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
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
  expect(cells[0].querySelector('[part="marker"]')).to.not.exist;
  expect(cells[1].querySelector('[part="marker"]')).to.exist;
  expect(cells[2].querySelector('[part="marker"]')).to.not.exist;
});

it('is role="img" with an auto-generated aria-label summarizing counts per category', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
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
    html`<lr-sequence-strip accessible-label="Custom summary"></lr-sequence-strip>`,
  )) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom summary');
});

it('renders an empty strip (no cells, generic aria-label) when items is empty', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
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
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('shows the item label in the tooltip on pointerenter and hides it on pointerleave', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
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
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items; // no per-item label set
    el.categories = categories;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll('[part="cell"]')[0] as HTMLElement;
    cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal('Text');
  });

  it('flips the tooltip centering translate under dir="rtl"', async () => {
    const tooltipTranslateX = async (dirAttr: string): Promise<number> => {
      const el = (await fixture(
        html`<lr-sequence-strip dir=${dirAttr}></lr-sequence-strip>`,
      )) as LyraSequenceStrip;
      el.items = labeledItems;
      el.categories = categories;
      await el.updateComplete;
      const cell = el.shadowRoot!.querySelectorAll('[part="cell"]')[0] as HTMLElement;
      cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      await el.updateComplete;
      const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
      return new DOMMatrixReadOnly(getComputedStyle(tooltip).transform).m41;
    };
    // The tooltip centers on inset-inline-start: 50%, which anchors to the physical right edge
    // under RTL -- its centering translateX must resolve leftward (negative) in LTR and
    // rightward (positive) in RTL to stay over the strip's horizontal center.
    expect(await tooltipTranslateX('ltr')).to.be.lessThan(0);
    expect(await tooltipTranslateX('rtl')).to.be.greaterThan(0);
  });

  it('is accessible with items, categories, and markers set', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('category legend', () => {
  it('renders no legend by default, leaving the strip markup unchanged', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    expect(el.showLegend).to.be.false;
    expect(el.hasAttribute('show-legend')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
    // The full shadow tree, asserted literally: with `showLegend` unset the rendered output is
    // exactly what this component produced before the legend existed (lit's own template
    // markers aside, which are comments and carry no rendered meaning).
    expect(el).shadowDom.to.equal(`
      <div part="base" role="img" aria-label="Text: 2, Tool: 1">
        <span part="cell" style="background-color:#4f46e5"></span>
        <span part="cell" style="background-color:#16a34a"><span part="marker"></span></span>
        <span part="cell" style="background-color:#4f46e5"></span>
        <div part="tooltip" hidden></div>
      </div>
    `);
  });

  it('renders one legend item per category, in order, with that category color and label', async () => {
    const el = (await fixture(
      html`<lr-sequence-strip show-legend></lr-sequence-strip>`,
    )) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    expect(el.showLegend).to.be.true;
    const legend = el.shadowRoot!.querySelector('[part="legend"]')!;
    const entries = [...legend.querySelectorAll('[part="legend-item"]')];
    expect(entries.length).to.equal(2);
    expect(entries.map((entry) => entry.querySelector('[part="legend-label"]')!.textContent!.trim())).to.deep.equal([
      'Text',
      'Tool',
    ]);
    const swatches = entries.map((entry) => entry.querySelector('[part="legend-swatch"]') as HTMLElement);
    const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
    expect(swatches[0]!.style.backgroundColor).to.equal(cells[0]!.style.backgroundColor);
    expect(swatches[1]!.style.backgroundColor).to.equal(cells[1]!.style.backgroundColor);
  });

  it('keys the whole scheme: an unused category still renders, an uncategorized item adds nothing', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.showLegend = true;
    el.categories = [...categories, { key: 'mixed', color: '#b45309', label: 'Mixed' }];
    el.items = [
      { id: '1', category: 'text' },
      { id: '2', category: 'unknown' }, // matches no category entry
    ];
    await el.updateComplete;
    expect(el.hasAttribute('show-legend')).to.be.true; // reflected
    const labels = [...el.shadowRoot!.querySelectorAll('[part="legend-label"]')].map((n) => n.textContent!.trim());
    expect(labels).to.deep.equal(['Text', 'Tool', 'Mixed']); // 'Mixed' has no items but still keys the scheme
    expect(labels).to.not.include('unknown');
  });

  it('does not announce the legend a second time — it duplicates the strip aria-label visually only', async () => {
    const el = (await fixture(
      html`<lr-sequence-strip show-legend></lr-sequence-strip>`,
    )) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    // The strip keeps sole ownership of the announced summary.
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('Text: 2, Tool: 1');
    expect(base.contains(legend)).to.be.false;
    // The legend is a decorative duplicate of that same text, so it is pruned from the
    // accessibility tree entirely: aria-hidden, and nothing inside it re-exposes itself.
    expect(legend.getAttribute('aria-hidden')).to.equal('true');
    expect(legend.querySelectorAll('[role], [aria-label], [aria-labelledby], [title], [alt]').length).to.equal(0);
    expect(legend.textContent).to.contain('Text'); // ...while still being visible text on screen
  });

  it('wraps the legend onto multiple lines in a narrow allocation instead of overflowing', async () => {
    const el = (await fixture(
      html`<div style="inline-size: 320px">
        <lr-sequence-strip show-legend></lr-sequence-strip>
      </div>`,
    )).querySelector('lr-sequence-strip') as LyraSequenceStrip;
    el.items = items;
    el.categories = [
      ...categories,
      { key: 'mixed', color: '#b45309', label: 'Mixed responses and tool calls' },
      { key: 'sub', color: '#0e7490', label: 'Dispatched to a subagent' },
      { key: 'err', color: '#be123c', label: 'Errored tool invocation' },
    ];
    await el.updateComplete;
    const entries = [...el.shadowRoot!.querySelectorAll('[part="legend-item"]')] as HTMLElement[];
    const rows = new Set(entries.map((entry) => entry.getBoundingClientRect().top));
    expect(rows.size).to.be.greaterThan(1); // wrapped
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    expect(legend.scrollWidth).to.be.at.most(legend.clientWidth + 1); // no horizontal overflow
  });

  it('is accessible with the legend shown', async () => {
    const el = (await fixture(
      html`<lr-sequence-strip show-legend></lr-sequence-strip>`,
    )) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
