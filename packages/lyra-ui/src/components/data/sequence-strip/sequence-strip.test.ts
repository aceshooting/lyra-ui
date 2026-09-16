import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './sequence-strip.js';
import type {
  LyraSequenceStrip,
  SequenceStripCategory,
  SequenceStripItem,
} from './sequence-strip.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-sequence-strip', 'orientation');

const categories = [
  { id: 'text', color: '#4f46e5', label: 'Text' },
  { id: 'tool', color: '#16a34a', label: 'Tool' },
];
const items = [
  { id: '1', categoryId: 'text' },
  { id: '2', categoryId: 'tool', marker: true },
  { id: '3', categoryId: 'text' },
];

it('rejects declaration-breaking and url category paint values', async () => {
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip show-legend></lr-sequence-strip>`);
  el.items = [{ id: '1', categoryId: 'bad' }];
  el.categories = [{ id: 'bad', color: 'red;position:fixed', label: 'Bad' }];
  await el.updateComplete;
  const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
  expect(cell.style.position).to.equal('');
  expect(cell.style.backgroundColor).to.equal('transparent');
  expect(swatch.style.position).to.equal('');

  el.categories = [{ id: 'bad', color: 'var(--lr-color-brand)', label: 'Good' }];
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement).style.backgroundColor).to.equal(
    'var(--lr-color-brand)',
  );
});

it('contains a throwing shadow-root activeElement getter during item reconciliation', async () => {
  const el = (await fixture(html`
    <lr-sequence-strip .items=${[{ id: 'first', categoryId: 'a' }]}></lr-sequence-strip>
  `)) as LyraSequenceStrip;
  const root = el.shadowRoot!;
  const prior = Object.getOwnPropertyDescriptor(root, 'activeElement');
  let unavailable = true;
  Object.defineProperty(root, 'activeElement', {
    configurable: true,
    get(): Element {
      if (unavailable) throw new TypeError('active element unavailable');
      return {} as Element;
    },
  });
  try {
    el.items = [{ id: 'second', categoryId: 'a' }];
    await el.updateComplete;
    unavailable = false;
    el.items = [{ id: 'third', categoryId: 'a' }];
    await el.updateComplete;
    expect(el.items[0]!.id).to.equal('third');
  } finally {
    if (prior) Object.defineProperty(root, 'activeElement', prior);
    else delete (root as unknown as { activeElement?: unknown }).activeElement;
  }
});

it('defaults to empty items/categories', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  expect(el.items).to.deep.equal([]);
  expect(el.categories).to.deep.equal([]);
});

it('exposes no `orientation` property or attribute (removed in 9.0.0)', async () => {
  // The single-member `'horizontal'` union was read by nothing -- neither the template nor the
  // stylesheet ever mentioned it -- so the reflected attribute styled nothing either.
  const el = (await fixture(
    html`<lr-sequence-strip orientation="vertical"></lr-sequence-strip>`,
  )) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  expect('orientation' in el).to.equal(false);
  // A stray authored attribute is inert: it neither reflects back nor changes the rendered strip.
  expect(el.getAttribute('orientation')).to.equal('vertical');
  const strip = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(strip).flexDirection).to.equal('row');
});

it('renders one cell per item, colored by its category', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
  expect(cells.length).to.equal(3);
  expect(cells[0]!.style.backgroundColor).to.not.equal('');
  expect(cells[0]!.style.backgroundColor).to.equal(cells[2]!.style.backgroundColor); // both 'text'
  expect(cells[0]!.style.backgroundColor).to.not.equal(cells[1]!.style.backgroundColor);
});

it('fills 320px with the whole span in both directions, one item per cell at the cap and ranges past it', async () => {
  for (const count of [200, 500] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      const wrapper = (await fixture(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
          <lr-sequence-strip></lr-sequence-strip>
        </div>
      `)) as HTMLElement;
      const el = wrapper.querySelector('lr-sequence-strip') as LyraSequenceStrip;
      el.categories = categories;
      el.items = Array.from({ length: count }, (_, index) => ({
        id: `item-${index + 1}`,
        categoryId: index % 2 === 0 ? 'text' : 'tool',
        label: `Item ${index + 1}`,
      }));
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      let cells = [...base.querySelectorAll<HTMLElement>('[part="cell"]')];

      expect(cells.length, `${count} ${direction} cell count`).to.equal(200);
      expect(wrapper.scrollWidth, `${count} ${direction} wrapper`).to.be.at.most(wrapper.clientWidth + 1);
      expect(base.scrollWidth, `${count} ${direction} strip`).to.be.at.most(base.clientWidth + 1);
      expect(
        Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)),
        `${count} ${direction} visible cell width`,
      ).to.be.greaterThan(0);
      // Span preserved regardless of cardinality: the rendered cells tile [0, count) exactly once.
      expect(cells[0]!.dataset['rangeStart'], `${count} ${direction} first range`).to.equal('0');
      expect(cells.at(-1)!.dataset['rangeEnd'], `${count} ${direction} last range`).to.equal(
        String(count - 1),
      );

      cells[0]!.focus();
      cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await el.updateComplete;
      cells = [...base.querySelectorAll<HTMLElement>('[part="cell"]')];
      // Absolute literals, not a value re-read off the element under test: at the cap cell 199 is
      // item index 199, and at 500 items `ceil(199 * 500 / 200)` puts its range at [498, 499], so
      // End must land on item index 498 -- id `item-499`, since ids are 1-based here.
      const expectedLastRange = count === 200 ? { start: '199', id: 'item-200' } : { start: '498', id: 'item-499' };
      expect(cells.at(-1)!.dataset['rangeStart'], `${count} ${direction} last range start`).to.equal(
        expectedLastRange.start,
      );
      expect(
        (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['itemId'],
        `${count} ${direction} End focus`,
      ).to.equal(expectedLastRange.id);
      expect(cells.filter((cell) => cell.tabIndex === 0).map((cell) => cell.dataset['index'])).to.deep.equal([
        '199',
      ]);
      expect(cells.at(-1)?.getAttribute('aria-posinset')).to.equal('200');
      expect(cells.at(-1)?.getAttribute('aria-setsize')).to.equal('200');
      const summary = el.shadowRoot!.querySelector('[part="bucket-summary"]')?.textContent?.trim();
      if (count > 200) {
        expect(summary, `${count} ${direction} summary`).to.contain('500');
        expect(summary, `${count} ${direction} summary`).to.contain('200');
      } else {
        expect(summary, `${count} ${direction} has nothing to summarise`).to.equal(undefined);
      }
    }
  }
});

it('anchors the sole keyboard entry stop on the cell that owns a valid controlled selection', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 500 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: index % 2 === 0 ? 'text' : 'tool',
    label: `Item ${index + 1}`,
  }));
  el.selectedIndex = 499;
  await el.updateComplete;

  const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-selected]');
  expect(selected === null, 'the controlled item has an owning cell').to.equal(false);
  expect(selected!.dataset['index'], 'the last of the 200 ranges owns item 499').to.equal('199');
  expect(Number(selected!.dataset['rangeStart'])).to.be.at.most(499);
  expect(Number(selected!.dataset['rangeEnd'])).to.equal(499);
  expect(selected!.getAttribute('aria-current')).to.equal('true');
  expect(selected!.tabIndex, 'the strip retains one keyboard entry stop').to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]')).to.have.length(200);
});

it('snapshots readonly models and enforces first-wins unique item/category ids', async () => {
  const el = (await fixture(html`<lr-sequence-strip show-legend></lr-sequence-strip>`)) as LyraSequenceStrip;
  const sourceItems = [
    { id: '', categoryId: 'first', label: 'Missing item identity' },
    { id: '   ', categoryId: 'first', label: 'Blank item identity' },
    { id: 'same', categoryId: 'first', label: 'First item' },
    { id: 'same', categoryId: 'second', label: 'Duplicate item' },
  ];
  const sourceCategories = [
    { id: '', color: '#000', label: 'Missing category identity' },
    { id: '   ', color: '#000', label: 'Blank category identity' },
    { id: 'first', color: '#111', label: 'First category' },
    { id: 'first', color: '#222', label: 'Duplicate category' },
  ];
  el.items = sourceItems;
  el.categories = sourceCategories;
  sourceItems[2]!.label = 'Mutated caller value';
  sourceCategories[2]!.label = 'Mutated caller category';
  await el.updateComplete;

  expect(el.items.length).to.equal(1);
  expect(el.categories.length).to.equal(1);
  expect(Object.isFrozen(el.items)).to.equal(true);
  expect(Object.isFrozen(el.items[0]!)).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="cell"]')!.getAttribute('aria-label')).to.equal('First item');
  expect(el.shadowRoot!.querySelector('[part="legend-label"]')!.textContent?.trim()).to.equal('First category');
});

it('retains later valid records after hostile and malformed collection entries', async () => {
  const hostileItem = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'id') throw new Error('hostile item');
        return undefined;
      },
    }
  );
  const hostileCategory = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'id') throw new Error('hostile category');
        return undefined;
      },
    }
  );
  const el = (await fixture(html`
    <lr-sequence-strip show-legend></lr-sequence-strip>
  `)) as LyraSequenceStrip;
  el.items = [
    hostileItem,
    { id: 'valid', categoryId: 7, label: 'Valid item' },
  ] as unknown as readonly SequenceStripItem[];
  el.categories = [
    hostileCategory,
    { id: 'valid-category', color: 7, label: 'Valid category' },
  ] as unknown as readonly SequenceStripCategory[];
  await el.updateComplete;

  expect(el.items).to.deep.equal([{ id: 'valid', categoryId: '', label: 'Valid item' }]);
  expect(el.categories).to.deep.equal([
    { id: 'valid-category', color: '', label: 'Valid category' },
  ]);
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(1);
});

it('renders a marker on cells whose item sets marker: true, and none otherwise', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
  expect((cells[0]!.querySelector('[part="marker"]')) == null).to.be.true;
  expect(cells[1]!.querySelector('[part="marker"]')).to.exist;
  expect((cells[2]!.querySelector('[part="marker"]')) == null).to.be.true;
});

it('is a labeled list whose items expose their individual details', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const root = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(root.getAttribute('role')).to.equal('list');
  const label = root.getAttribute('aria-label')!;
  expect(label).to.include('Text');
  expect(label).to.include('2'); // 2 'text' items
  expect(label).to.include('Tool');
  expect(label).to.include('1'); // 1 'tool' item
  const cells = [...root.querySelectorAll<HTMLElement>('[part="cell"]')];
  expect(cells.map((cell) => cell.getAttribute('role'))).to.deep.equal(['listitem', 'listitem', 'listitem']);
  expect(cells.map((cell) => cell.getAttribute('aria-label'))).to.deep.equal(['Text', 'Tool', 'Text']);
  expect(cells.map((cell) => cell.tabIndex)).to.deep.equal([0, -1, -1]);
});

it('formats generated category counts with the effective locale', async () => {
  const el = (await fixture(html`<lr-sequence-strip locale="fa-IR"></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')!;
  const number = new Intl.NumberFormat('fa-IR');

  expect(label).to.include(`Text: ${number.format(2)}`);
  expect(label).to.include(`Tool: ${number.format(1)}`);
});

it('joins generated clauses with the effective locale list punctuation', async () => {
  for (const locale of ['ar', 'ja'] as const) {
    const el = (await fixture(html`<lr-sequence-strip locale=${locale}></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    const localize = (
      el as unknown as {
        localize(
          key: string,
          fallback?: string,
          values?: Record<string, string | number>
        ): string;
      }
    ).localize.bind(el);
    const clauses = [
      localize('sequenceStripCategoryCount', undefined, { label: 'Text', count: new Intl.NumberFormat(locale).format(2), pluralCount: 2 }),
      localize('sequenceStripCategoryCount', undefined, { label: 'Tool', count: new Intl.NumberFormat(locale).format(1), pluralCount: 1 }),
    ];
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      new Intl.ListFormat(locale, { style: 'long', type: 'unit' }).format(clauses),
    );
  }
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

it('treats an explicitly empty accessibleLabel as a real override, distinct from an omitted one', async () => {
  const explicit = (await fixture(
    html`<lr-sequence-strip accessible-label=""></lr-sequence-strip>`,
  )) as LyraSequenceStrip;
  await explicit.updateComplete;
  expect(explicit.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');

  const omitted = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  await omitted.updateComplete;
  expect(omitted.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('No items');
});

it('keeps a host aria-label distinct from the internal list name', async () => {
  const el = (await fixture(html`
    <lr-sequence-strip accessible-label="Component alias" aria-label="Host label"></lr-sequence-strip>
  `)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const renderedLabel = (): string | null =>
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
  expect(el.getAttribute('aria-label')).to.equal('Host label');
  expect(renderedLabel()).to.equal('Component alias');

  el.setAttribute('aria-label', 'Updated host label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Updated host label');
  expect(renderedLabel()).to.equal('Component alias');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.be.null;
  expect(renderedLabel()).to.equal('Component alias');
});

it('renders an empty strip (no cells, generic aria-label) when items is empty', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.be.a('string');
});

it('honors a .strings override for the empty-state summary in the rendered aria-label', async () => {
  const el = (await fixture(
    html`<lr-sequence-strip .strings=${{ sequenceStripEmpty: 'Aucun élément' }}></lr-sequence-strip>`,
  )) as LyraSequenceStrip;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Aucun élément');
});

it('honors a .strings override for the per-category summary clause in the rendered aria-label', async () => {
  const el = (await fixture(
    html`<lr-sequence-strip .strings=${{ sequenceStripCategoryCount: '{label} ({count})' }}></lr-sequence-strip>`,
  )) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Text (2), Tool (1)',
  );
});

it('gives an unnamed category a localized nonempty list-item and tooltip label', async () => {
  const el = (await fixture(html`
    <lr-sequence-strip
      .strings=${{ sequenceStripUnnamedCategory: 'Sans catégorie' }}
    ></lr-sequence-strip>
  `)) as LyraSequenceStrip;
  el.items = [{ id: 'unnamed-item', categoryId: 'unnamed-category' }];
  el.categories = [{ id: 'unnamed-category', color: '#4f46e5', label: '   ' }];
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
  expect(cell.getAttribute('aria-label')).to.equal('Sans catégorie');
  cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal('Sans catégorie');
  await expect(el).to.be.accessible();
});

it('uses the English unnamed-category fallback without exposing an internal category id', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = [{ id: 'unnamed-item', categoryId: 'internal-category-id' }];
  el.categories = [{ id: 'internal-category-id', color: '#4f46e5' }];
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
  expect(cell.getAttribute('aria-label')).to.equal('Unnamed category');
  cell.focus();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal('Unnamed category');
});

describe('hover tooltip', () => {
  const labeledItems = [
    { id: '1', categoryId: 'text', label: 'Turn 1: text' },
    { id: '2', categoryId: 'tool', label: 'Turn 2: tool' },
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

  it('anchors the pointer tooltip to the hovered cell rather than the whole strip', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <lr-sequence-strip></lr-sequence-strip>
      </div>
    `);
    const el = wrapper.querySelector('lr-sequence-strip') as LyraSequenceStrip;
    el.items = [
      ...labeledItems,
      { id: '3', categoryId: 'text', label: 'Turn 3: text' },
      { id: '4', categoryId: 'tool', label: 'Turn 4: tool' },
    ];
    el.categories = categories;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[0]!;
    const cellRect = cell.getBoundingClientRect();

    await resetMouse();
    try {
      await sendMouse({
        type: 'move',
        position: [
          Math.round(cellRect.left + cellRect.width / 2),
          Math.round(cellRect.top + cellRect.height / 2),
        ],
      });
      await waitUntil(
        () => el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false,
        'pointer tooltip did not open over the hovered cell',
      );
      const tooltipRect = el.shadowRoot!
        .querySelector<HTMLElement>('[part="tooltip"]')!
        .getBoundingClientRect();

      expect(tooltipRect.left + tooltipRect.width / 2).to.be.closeTo(
        cellRect.left + cellRect.width / 2,
        1,
      );
    } finally {
      await resetMouse();
    }
  });

  it('anchors the focus tooltip to the focused cell rather than the whole strip', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <lr-sequence-strip></lr-sequence-strip>
      </div>
    `);
    const el = wrapper.querySelector('lr-sequence-strip') as LyraSequenceStrip;
    el.items = [
      ...labeledItems,
      { id: '3', categoryId: 'text', label: 'Turn 3: text' },
      { id: '4', categoryId: 'tool', label: 'Turn 4: tool' },
    ];
    el.categories = categories;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[3]!;

    cell.focus();
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    expect(tooltipRect.left + tooltipRect.width / 2).to.be.closeTo(
      cellRect.left + cellRect.width / 2,
      1,
    );
  });

  it('shows item details on keyboard focus and roves with arrow/Home/End keys', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    let cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    cells[0]!.focus();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal('Turn 1: text');
    expect(cells[0]!.getAttribute('aria-describedby')).to.be.null;

    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    expect((el.shadowRoot!.activeElement) === (cells[1])).to.equal(true);
    expect(cells.map((cell) => cell.tabIndex)).to.deep.equal([-1, 0]);
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal('Turn 2: tool');

    cells[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement) === (cells[0])).to.equal(true);
  });

  it('uses logical forward and backward arrow keys in RTL', async () => {
    const el = (await fixture(html`
      <lr-sequence-strip dir="rtl"></lr-sequence-strip>
    `)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    cells[0]!.focus();

    cells[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === cells[1]).to.equal(true);

    cells[1]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === cells[0]).to.equal(true);
  });

  it('preserves real focus and the sole roving stop by item id across a controlled refresh', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[1]!.focus();

    el.items = labeledItems.map((item) => ({ ...item }));
    await el.updateComplete;

    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    const focusedId = cells.find((cell) => cell === el.shadowRoot!.activeElement)?.dataset['itemId'];
    expect(focusedId).to.equal('2');
    expect(cells.filter((cell) => cell.tabIndex === 0).map((cell) => cell.dataset['itemId'])).to.deep.equal(['2']);
  });

  it('cancels a queued arrow focus when the item model is replaced in the same turn', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[0]!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    el.items = [
      { id: 'replacement-a', categoryId: 'text', label: 'Replacement A' },
      { id: 'replacement-b', categoryId: 'tool', label: 'Replacement B' },
    ];
    await el.updateComplete;

    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['itemId'],
      'controlled refresh owns focus repair; the stale numeric ArrowRight target is ignored',
    ).to.equal('replacement-a');
  });

  it('cancels a queued arrow focus across disconnect and reconnect', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[0]!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;

    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['itemId']).to.be.undefined;
    expect(
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')]
        .filter((cell) => cell.tabIndex === 0)
        .map((cell) => cell.dataset['itemId']),
    ).to.deep.equal(['1']);
  });

  it('clamps owned focus to a survivor and then the stable base as items shrink', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[2]!.focus();

    el.items = items.slice(0, 2);
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['itemId']).to.equal('2');
    expect(el.shadowRoot!.querySelectorAll('[part="cell"][tabindex="0"]')).to.have.lengthOf(1);

    el.items = [];
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  });

  it('does not move external focus when an unfocused strip refreshes', async () => {
    const wrapper = await fixture(html`
      <div>
        <button id="outside-sequence">Outside</button>
        <lr-sequence-strip></lr-sequence-strip>
      </div>
    `);
    const el = wrapper.querySelector('lr-sequence-strip') as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    wrapper.querySelector<HTMLElement>('#outside-sequence')!.focus();

    el.items = items.slice(0, 1);
    await el.updateComplete;
    expect(el.ownerDocument.activeElement?.id).to.equal('outside-sequence');
  });

  it('clears transient hover/focus details across disconnect and item replacement', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = labeledItems;
    el.categories = categories;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[1]!;
    cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    cell.focus();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.equal(false);

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.equal(true);

    el.items = [{ id: 'fresh', categoryId: 'text', label: 'Fresh' }];
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.equal(true);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!.tabIndex).to.equal(0);
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
    const tooltipGeometry = async (dirAttr: string): Promise<{ centerDelta: number; translateX: number }> => {
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
      const cellRect = cell.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      return {
        centerDelta:
          tooltipRect.left + tooltipRect.width / 2 -
          (cellRect.left + cellRect.width / 2),
        translateX: new DOMMatrixReadOnly(getComputedStyle(tooltip).transform).m41,
      };
    };
    // The tooltip centers on inset-inline-start: 50%, which anchors to the physical right edge
    // under RTL -- its centering translateX must resolve leftward (negative) in LTR and
    // rightward (positive) in RTL to stay over the active cell's horizontal center.
    const ltr = await tooltipGeometry('ltr');
    const rtl = await tooltipGeometry('rtl');
    expect(ltr.translateX).to.be.lessThan(0);
    expect(rtl.translateX).to.be.greaterThan(0);
    expect(ltr.centerDelta).to.be.closeTo(0, 1);
    expect(rtl.centerDelta).to.be.closeTo(0, 1);
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
    expect((el.shadowRoot!.querySelector('[part="legend"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('list');
    expect(el.shadowRoot!.querySelectorAll('[part="cell"]')).to.have.length(3);
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

  it('bounds a large legend and discloses the rendered and total category counts', async () => {
    const el = (await fixture(html`
      <lr-sequence-strip show-legend></lr-sequence-strip>
    `)) as LyraSequenceStrip;
    el.categories = Array.from({ length: 205 }, (_, index) => ({
      id: `category-${index}`,
      color: '#123456',
      label: `Category ${index}`,
    }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="legend-item"]').length).to.equal(200);
    expect(el.shadowRoot!.querySelector('[part="legend-limit"]')!.textContent!.trim()).to.equal(
      '200 / 205'
    );
  });

  it('keys the whole scheme: an unused category still renders, an uncategorized item adds nothing', async () => {
    const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.showLegend = true;
    el.categories = [...categories, { id: 'mixed', color: '#b45309', label: 'Mixed' }];
    el.items = [
      { id: '1', categoryId: 'text' },
      { id: '2', categoryId: 'unknown' }, // matches no category entry
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
    expect(base.getAttribute('role')).to.equal('list');
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
      { id: 'mixed', color: '#b45309', label: 'Mixed responses and tool calls' },
      { id: 'sub', color: '#0e7490', label: 'Dispatched to a subagent' },
      { id: 'err', color: '#be123c', label: 'Errored tool invocation' },
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

describe('marker legend entry', () => {
  const threeCategories = [...categories, { id: 'mixed', color: '#b45309', label: 'Mixed' }];

  async function strip(template: ReturnType<typeof html>): Promise<LyraSequenceStrip> {
    const el = (await fixture(template)) as LyraSequenceStrip;
    el.items = items;
    el.categories = threeCategories;
    await el.updateComplete;
    return el;
  }

  it('appends one extra legend item, last, whose swatch is the marker swatch', async () => {
    const el = await strip(html`<lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>`);
    expect(el.markerLabel).to.equal('Subagent');
    const entries = [...el.shadowRoot!.querySelectorAll('[part="legend-item"]')];
    expect(entries.length).to.equal(4); // 3 categories + the marker row
    const last = entries[3]!;
    expect(last.querySelector('[part="legend-marker-swatch"]')).to.exist;
    expect((last.querySelector('[part="legend-swatch"]')) == null).to.be.true;
    expect(last.querySelector('[part="legend-label"]')!.textContent!.trim()).to.equal('Subagent');
    // ...and only the marker row carries it.
    expect(el.shadowRoot!.querySelectorAll('[part="legend-marker-swatch"]').length).to.equal(1);
  });

  it('keeps the category-only legend shape when markerLabel is unset', async () => {
    const el = (await fixture(html`<lr-sequence-strip show-legend></lr-sequence-strip>`)) as LyraSequenceStrip;
    el.items = items;
    el.categories = categories;
    await el.updateComplete;
    expect(el.markerLabel).to.equal(undefined);
    expect((el.shadowRoot!.querySelector('[part="legend-marker-swatch"]')) == null).to.be.true;
    const legend = el.shadowRoot!.querySelector('[part="legend"]')!;
    expect(legend.querySelectorAll('[part="legend-item"]')).to.have.length(2);
    expect((legend.querySelector('[part="legend-marker-swatch"]')) == null).to.be.true;
  });

  it('reproduces the cell marker treatment: a neutral chip with a bottom bar in the marker color', async () => {
    const el = await strip(html`<lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>`);
    const swatch = el.shadowRoot!.querySelector('[part="legend-marker-swatch"]') as HTMLElement;
    const cellMarker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
    const swatchStyle = getComputedStyle(swatch);
    const categorySwatch = getComputedStyle(el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement);

    // Same footprint as a category swatch (both size off --lr-sequence-strip-legend-swatch-size).
    expect(swatchStyle.inlineSize).to.equal(categorySwatch.inlineSize);
    expect(swatchStyle.blockSize).to.equal(categorySwatch.blockSize);
    // The bar is an inset box-shadow in exactly the color the cell's own marker paints with.
    expect(swatchStyle.boxShadow).to.contain('inset');
    expect(swatchStyle.boxShadow).to.contain(getComputedStyle(cellMarker).backgroundColor);
    // ...over a neutral chip that is neither transparent nor a category color.
    expect(swatchStyle.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    expect(swatchStyle.backgroundColor).to.not.equal(categorySwatch.backgroundColor);
  });

  it('follows --lr-sequence-strip-marker-color and its own neutral-chip cssprop', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-sequence-strip-marker-color: rgb(0, 51, 102); --lr-sequence-strip-legend-marker-bg: rgb(200, 201, 202);">
        <lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-sequence-strip') as LyraSequenceStrip;
    el.items = items;
    el.categories = threeCategories;
    await el.updateComplete;
    const swatchStyle = getComputedStyle(el.shadowRoot!.querySelector('[part="legend-marker-swatch"]') as HTMLElement);
    expect(swatchStyle.boxShadow).to.contain('rgb(0, 51, 102)');
    expect(swatchStyle.backgroundColor).to.equal('rgb(200, 201, 202)');
  });

  it('announces the marker count in the summary, so the legend row has a spoken counterpart', async () => {
    const el = await strip(html`<lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>`);
    const label = el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')!;
    expect(label).to.equal('Text: 2, Tool: 1, Subagent: 1');
  });

  it('leaves the summary untouched when markerLabel is unset, and defers to accessibleLabel when set', async () => {
    const bare = await strip(html`<lr-sequence-strip show-legend></lr-sequence-strip>`);
    expect(bare.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Text: 2, Tool: 1');

    const custom = await strip(
      html`<lr-sequence-strip show-legend marker-label="Subagent" accessible-label="Custom"></lr-sequence-strip>`,
    );
    expect(custom.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom');
  });

  it('omits the marker count when no item carries a marker, exactly like a zero-count category', async () => {
    const el = (await fixture(
      html`<lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>`,
    )) as LyraSequenceStrip;
    el.items = [{ id: '1', categoryId: 'text' }];
    el.categories = categories;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Text: 1');
    // The row still keys the scheme, like a category with no matching item.
    expect(el.shadowRoot!.querySelector('[part="legend-marker-swatch"]')).to.exist;
  });

  it('renders no legend at all when markerLabel is set but showLegend is off', async () => {
    const el = await strip(html`<lr-sequence-strip marker-label="Subagent"></lr-sequence-strip>`);
    expect((el.shadowRoot!.querySelector('[part="legend"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.contain('Subagent: 1');
  });

  it('is accessible with the marker legend row shown', async () => {
    const el = await strip(html`<lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>`);
    await expect(el).to.be.accessible();
  });
});

describe('item activation and selection', () => {
  const build = async () => {
    const el = (await fixture(
      html`<lr-sequence-strip style="inline-size: 400px"></lr-sequence-strip>`
    )) as LyraSequenceStrip;
    el.categories = categories;
    el.items = [
      { id: 'a', categoryId: 'text' },
      { id: 'b', categoryId: 'tool' },
      { id: 'c', categoryId: 'text' },
    ];
    await el.updateComplete;
    return el;
  };

  const cellAt = (el: LyraSequenceStrip, index: number) =>
    el.shadowRoot!.querySelector<HTMLElement>(`[part="cell"][data-index="${index}"]`)!;

  it('emits lr-item-activate on click, carrying the index and id', async () => {
    const el = await build();
    const listener = oneEvent(el, 'lr-item-activate');
    cellAt(el, 1).click();
    const event = await listener;
    expect(event.detail.index).to.equal(1);
    expect(event.detail.id).to.equal('b');
    expect(event.detail.item.categoryId).to.equal('tool');
  });

  it('ignores callbacks retained by a stale cell after a controlled shrink', async () => {
    const el = await build();
    const staleCell = cellAt(el, 2);
    const activations: CustomEvent[] = [];
    el.addEventListener('lr-item-activate', ((event: CustomEvent) => {
      activations.push(event);
    }) as EventListener);

    el.items = [];
    await el.updateComplete;
    staleCell.click();
    const keydown = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    staleCell.dispatchEvent(keydown);

    expect(activations).to.deep.equal([]);
    expect(keydown.defaultPrevented).to.equal(false);
  });

  it('activates a focused cell from the keyboard, not only the pointer', async () => {
    // The cells already carried a roving tabindex, so without this they were reachable but inert.
    for (const key of ['Enter', ' ']) {
      const el = await build();
      const listener = oneEvent(el, 'lr-item-activate');
      cellAt(el, 2).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true })
      );
      const event = await listener;
      expect(event.detail.index, `activated with ${JSON.stringify(key)}`).to.equal(2);
    }
  });

  it('bubbles and crosses the shadow boundary, like every library event', async () => {
    const el = await build();
    const seen: number[] = [];
    document.addEventListener('lr-item-activate', ((event: CustomEvent) => {
      seen.push(event.detail.index as number);
    }) as EventListener, { once: true });
    cellAt(el, 0).click();
    expect(seen, 'reached a document-level listener').to.deep.equal([0]);
  });

  it('marks the controlled selection without recolouring the category', async () => {
    const el = await build();
    el.selectedIndex = 1;
    await el.updateComplete;
    expect(cellAt(el, 1).getAttribute('aria-current'), 'announced as current').to.equal('true');
    expect(cellAt(el, 1).hasAttribute('data-selected'), 'and styleable').to.be.true;
    expect(cellAt(el, 0).hasAttribute('data-selected'), 'siblings unaffected').to.be.false;
    expect(cellAt(el, 0).getAttribute('aria-current'), 'non-current cells render an explicit false').to.equal(
      'false',
    );
  });

  it('does not move the selection itself, leaving the consumer in control', async () => {
    // Controlled on purpose: the strip must not drift from a playback index it does not own.
    const el = await build();
    el.selectedIndex = 0;
    await el.updateComplete;
    cellAt(el, 2).click();
    await el.updateComplete;
    expect(el.selectedIndex, 'unchanged until the consumer sets it').to.equal(0);
  });

  it('selects nothing for an out-of-range or non-integer index', async () => {
    const el = await build();
    for (const value of [-1, 99, 1.5, Number.NaN]) {
      el.selectedIndex = value;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelectorAll('[part="cell"][data-selected]').length,
        `selectedIndex=${value}`
      ).to.equal(0);
    }
  });

  it('defaults to no selection', async () => {
    const el = await build();
    expect(el.selectedIndex).to.equal(-1);
    expect(el.shadowRoot!.querySelectorAll('[part="cell"][data-selected]')).to.have.length(0);
  });
});

describe('disabled items', () => {
  const cellAt = (el: LyraSequenceStrip, index: number) =>
    el.shadowRoot!.querySelector<HTMLElement>(`[part="cell"][data-index="${index}"]`)!;

  const withDisabled = async (): Promise<LyraSequenceStrip> => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .categories=${categories}></lr-sequence-strip>`);
    el.items = [
      { id: 'a', categoryId: 'text' },
      { id: 'b', categoryId: 'tool', disabled: true },
      { id: 'c', categoryId: 'text' },
    ];
    await el.updateComplete;
    return el;
  };

  it('renders aria-disabled on a disabled cell and leaves an ordinary one unset (unset-regression)', async () => {
    const el = await withDisabled();
    expect(cellAt(el, 0).getAttribute('aria-disabled')).to.equal(null);
    expect(cellAt(el, 1).getAttribute('aria-disabled')).to.equal('true');
    expect(cellAt(el, 2).getAttribute('aria-disabled')).to.equal(null);
  });

  it('uses the shared disabled-opacity theme token when no component override is set', async () => {
    const el = await fixture<LyraSequenceStrip>(
      html`<lr-sequence-strip style="--lr-theme-opacity-disabled: 0.37"></lr-sequence-strip>`,
    );
    el.items = [{ id: 'disabled', categoryId: 'text', disabled: true }];
    await el.updateComplete;

    expect(getComputedStyle(cellAt(el, 0)).opacity).to.equal('0.37');
  });

  it('starts the roving tab stop on the first enabled cell when the first cell is disabled', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .categories=${categories}></lr-sequence-strip>`);
    el.items = [
      { id: 'a', categoryId: 'text', disabled: true },
      { id: 'b', categoryId: 'tool' },
    ];
    await el.updateComplete;
    expect(cellAt(el, 0).getAttribute('tabindex'), 'a disabled cell is never the resting tab stop').to.equal('-1');
    expect(cellAt(el, 1).getAttribute('tabindex')).to.equal('0');
  });

  it('a click on a disabled cell emits no lr-item-activate', async () => {
    const el = await withDisabled();
    let fired = false;
    el.addEventListener('lr-item-activate', () => (fired = true));
    cellAt(el, 1).click();
    expect(fired).to.equal(false);
  });

  it('Enter/Space on a disabled cell emits nothing', async () => {
    const el = await withDisabled();
    let fired = false;
    el.addEventListener('lr-item-activate', () => (fired = true));
    cellAt(el, 1).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }),
    );
    expect(fired).to.equal(false);
  });

  it('ArrowRight/ArrowLeft step over a disabled cell instead of landing on it', async () => {
    const el = await withDisabled();
    cellAt(el, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(cellAt(el, 2).getAttribute('tabindex'), 'skips disabled b straight to c').to.equal('0');
    expect(cellAt(el, 1).getAttribute('tabindex')).to.equal('-1');

    cellAt(el, 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(cellAt(el, 0).getAttribute('tabindex'), 'skips disabled b straight back to a').to.equal('0');
  });

  it('Home/End land on the nearest enabled boundary cell', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .categories=${categories}></lr-sequence-strip>`);
    el.items = [
      { id: 'a', categoryId: 'text', disabled: true },
      { id: 'b', categoryId: 'tool' },
      { id: 'c', categoryId: 'text' },
      { id: 'd', categoryId: 'tool', disabled: true },
    ];
    await el.updateComplete;
    cellAt(el, 1).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(cellAt(el, 2).getAttribute('tabindex'), 'End skips disabled d, landing on c').to.equal('0');

    cellAt(el, 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(cellAt(el, 1).getAttribute('tabindex'), 'Home skips disabled a, landing on b').to.equal('0');
  });

  it('is accessible with a mix of enabled and disabled cells', async () => {
    const el = await withDisabled();
    await expect(el).to.be.accessible();
  });
});


// Regression: [part='cell'][data-selected] declares the same `outline`/`outline-offset` the
// [part='cell']:hover, [part='cell']:focus-visible rule does, at the identical (0,2,0) specificity,
// and sits later in the stylesheet -- so the selection ring won outright and a focused selected
// cell rendered pixel-for-pixel like the same cell at rest. Same ring width, different colour, so
// only a computed-colour comparison against a genuinely focused unselected cell can see it.
it('keeps a SELECTED cell distinguishable once focused, instead of showing only the selection ring', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  el.selectedIndex = 1;
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-index="1"]')!;
  const plain = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-index="0"]')!;
  expect(selected.hasAttribute('data-selected'), 'sanity: cell 1 must be the selected one').to.equal(
    true,
  );

  const selectionRing = getComputedStyle(selected).outlineColor;
  plain.focus();
  // Read the reference ring while `plain` still holds focus: an unfocused cell declares no outline
  // at all, so its computed outline-width falls back to the CSS initial `medium` (3px).
  const focusRing = getComputedStyle(plain).outlineColor;
  const focusRingWidth = getComputedStyle(plain).outlineWidth;
  const focusRingOffset = getComputedStyle(plain).outlineOffset;
  expect(
    focusRing,
    'sanity: the focus ring and the selection ring must be different colours for this test to discriminate',
  ).to.not.equal(selectionRing);

  selected.focus();
  expect(
    getComputedStyle(selected).outlineColor,
    'a focused selected cell must show the focus ring, not just its selection ring',
  ).to.equal(focusRing);
  // The ring geometry is unchanged -- only the colour channel carries the focus indicator.
  expect(getComputedStyle(selected).outlineWidth).to.equal(focusRingWidth);
  expect(getComputedStyle(selected).outlineOffset).to.equal(focusRingOffset);
});

// The complementary half of the same cascade decision: the selection ring deliberately survives
// hover (a hovered selected cell still reads as selected), which is only safe while focus has its
// own answer above.
it('leaves the selection ring in place while a selected cell is merely hovered', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  el.selectedIndex = 1;
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-index="1"]')!;
  selected.scrollIntoView({ block: 'center', inline: 'center' });
  const selectionRing = getComputedStyle(selected).outlineColor;
  const rect = selected.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(
      () => selected.matches(':hover'),
      'the selected cell never reported itself hovered',
    );
    expect(getComputedStyle(selected).outlineColor).to.equal(selectionRing);
  } finally {
    await resetMouse();
  }
});

// ---------------------------------------------------------------------------
// Span-preserving bucketed overview past the render cap (16.0.0).
// ---------------------------------------------------------------------------

/** Builds `count` items split into two equal, contiguous category halves. */
function halvedItems(count: number): SequenceStripItem[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `item-${index + 1}`,
    categoryId: index < count / 2 ? 'text' : 'tool',
  }));
}

it('summarises past the render cap as span-preserving ranges rather than a stretched window', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = halvedItems(600);
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];

  expect(cells.length, 'the rendered cell count stays at the 200 cap').to.equal(200);
  const colors = new Set(cells.map((cell) => cell.style.backgroundColor));
  expect(
    colors.size,
    'the strip paints both halves of the 600-item sequence, not a stretched leading window',
  ).to.equal(2);
  expect(cells[0]!.dataset['rangeStart'], 'the first cell starts at the first item').to.equal('0');
  expect(cells.at(-1)!.dataset['rangeEnd'], 'the last cell ends at the last item').to.equal('599');
});

it('paints each range by its dominant category, breaking a tie toward the earliest one', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = [
    { id: 'text', color: 'rgb(1, 2, 3)', label: 'Text' },
    { id: 'tool', color: 'rgb(4, 5, 6)', label: 'Tool' },
  ];
  // 600 over 200 cells is exactly three items per range. Range 0 is a strict tool majority whose
  // FIRST item is text, so a cell that merely copied its range's first item would read 'text'.
  // Range 1 is a 2-1 text majority. Ranges 2+ are uniform text.
  el.items = Array.from({ length: 600 }, (_, index) => {
    const dominantToolIndexes = new Set([0, 1, 2, 4]);
    return {
      id: `item-${index + 1}`,
      categoryId: index === 0 ? 'text' : dominantToolIndexes.has(index) ? 'tool' : 'text',
    };
  });
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  expect(cells[0]!.dataset['rangeEnd'], 'three items land in the first range').to.equal('2');
  expect(cells[0]!.style.backgroundColor, 'a 2-1 tool majority paints the first range').to.equal(
    'rgb(4, 5, 6)',
  );
  expect(cells[1]!.style.backgroundColor, 'a 2-1 text majority paints the second range').to.equal(
    'rgb(1, 2, 3)',
  );

  // A 1-1 tie inside one range resolves to the category that appears earliest in it.
  el.items = Array.from({ length: 400 }, (_, index) => ({
    id: `tie-${index + 1}`,
    categoryId: index % 2 === 0 ? 'text' : 'tool',
  }));
  await el.updateComplete;
  const tied = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-index="0"]')!;
  expect(tied.dataset['rangeEnd'], 'two items land in each range').to.equal('1');
  expect(tied.style.backgroundColor, 'the earliest category in the range wins the tie').to.equal(
    'rgb(1, 2, 3)',
  );
});

it('reports a range as marked when any single item inside it is marked', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: 'text',
    ...(index === 2 ? { marker: true } : {}),
  }));
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  expect(cells[0]!.dataset['rangeEnd'], 'the marked item is the third of the first range').to.equal('2');
  expect(
    cells[0]!.querySelector('[part="marker"]') !== null,
    'the range containing the marked item reports the marker',
  ).to.equal(true);
  expect(
    cells[1]!.querySelector('[part="marker"]') !== null,
    'an unmarked range reports nothing',
  ).to.equal(false);
});

it('roves and activates over ranges, emitting the focused range first item', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: index % 2 === 0 ? 'text' : 'tool',
  }));
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.querySelector<HTMLElement>('[part="cell"][data-index="0"]')!.focus();
  el.shadowRoot!.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['index'],
    'ArrowRight advances one range, not one item',
  ).to.equal('1');

  // Activation reads the range the user is actually focused on, not a remembered index.
  const focused = el.shadowRoot!.activeElement as HTMLElement;
  const expectedStart = Number(focused.dataset['rangeStart']);
  const activated = oneEvent(el, 'lr-item-activate');
  focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const event = await activated;
  expect(event.detail.index, 'the range reports its first item').to.equal(expectedStart);
  expect(event.detail.id).to.equal(`item-${expectedStart + 1}`);
  expect(el.selectedIndex, 'activation stays controlled').to.equal(-1);
});

it('reverses range order and arrow direction under RTL', async () => {
  const wrapper = (await fixture(html`
    <div dir="rtl"><lr-sequence-strip></lr-sequence-strip></div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-sequence-strip') as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: 'text',
  }));
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  expect(
    cells[0]!.getBoundingClientRect().left > cells.at(-1)!.getBoundingClientRect().left,
    'the first range sits at the physical end under RTL',
  ).to.equal(true);

  cells[0]!.focus();
  cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['index'],
    'ArrowLeft advances forward under RTL',
  ).to.equal('1');
});

it('clamps the roving range when the item list shrinks below the focused range', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: 'text',
  }));
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.querySelector<HTMLElement>('[part="cell"][data-index="0"]')!.focus();
  el.shadowRoot!.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['index']).to.equal('199');

  // Every id the old ranges referenced disappears, and there are now far fewer cells than the
  // range index that owned focus.
  el.items = [
    { id: 'fresh-1', categoryId: 'text' },
    { id: 'fresh-2', categoryId: 'tool' },
    { id: 'fresh-3', categoryId: 'text' },
  ];
  await el.updateComplete;
  await waitUntil(
    () => (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part') === 'cell',
    'focus never returned to a surviving cell',
  );
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  expect(cells.length).to.equal(3);
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['index'],
    'the roving stop clamps to the last surviving cell',
  ).to.equal('2');
  expect(cells.filter((cell) => cell.tabIndex === 0).length, 'exactly one entry stop remains').to.equal(1);
});

it('buckets unsorted input by position, never by category order', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  // Deliberately interleaved: a sorting projection would group the categories and destroy the
  // sequence the strip exists to show.
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: index % 7 === 0 ? 'tool' : 'text',
  }));
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  const starts = cells.map((cell) => Number(cell.dataset['rangeStart']));
  const ends = cells.map((cell) => Number(cell.dataset['rangeEnd']));
  expect(starts[0]).to.equal(0);
  expect(ends.at(-1)).to.equal(599);
  const contiguous = starts.every((start, index) => (index === 0 ? start === 0 : start === ends[index - 1]! + 1));
  expect(contiguous, 'the ranges tile the sequence in order with no gap or overlap').to.equal(true);
  expect(
    ends.every((end, index) => end >= starts[index]!),
    'every range holds at least one item',
  ).to.equal(true);
});

it('honors .strings overrides for the range name and the overview disclosure', async () => {
  const el = (await fixture(html`
    <lr-sequence-strip
      .strings=${{
        sequenceStripBucketLabel: '{label} — de {start} à {end}',
        sequenceStripBucketSummary: '{items} éléments en {ranges} plages',
      }}
    ></lr-sequence-strip>
  `)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: 'text',
  }));
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="cell"]')!.getAttribute('aria-label'),
  ).to.equal('Text — de 1 à 3');
  expect(el.shadowRoot!.querySelector('[part="bucket-summary"]')!.textContent?.trim()).to.equal(
    '600 éléments en 200 plages',
  );
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label'),
    'the overview clause reaches the list name too',
  ).to.contain('600 éléments en 200 plages');
});

it('selects nothing for a non-integer or out-of-range selectedIndex past the cap', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: 'text',
  }));
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 12.5, -3, 600]) {
    el.selectedIndex = value;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="cell"][data-selected]').length,
      `selectedIndex ${String(value)} selects nothing`,
    ).to.equal(0);
    expect(
      el.shadowRoot!.querySelectorAll('[part="cell"][aria-current="true"]').length,
      `selectedIndex ${String(value)} marks nothing current`,
    ).to.equal(0);
  }
  el.selectedIndex = 300;
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-selected]');
  expect(selected === null, 'a valid index still resolves to its owning range').to.equal(false);
  expect(Number(selected!.dataset['rangeStart'])).to.be.at.most(300);
  expect(Number(selected!.dataset['rangeEnd'])).to.be.at.least(300);
});

it('is accessible while showing a bucketed overview with a legend and a selection', async () => {
  const el = (await fixture(html`<lr-sequence-strip show-legend marker-label="Subagent"></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: index % 3 === 0 ? 'tool' : 'text',
    ...(index % 50 === 0 ? { marker: true } : {}),
  }));
  el.selectedIndex = 120;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('rebuilds a bucketed overview after a disconnect and reconnect', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  el.items = Array.from({ length: 600 }, (_, index) => ({
    id: `item-${index + 1}`,
    categoryId: 'text',
  }));
  await el.updateComplete;
  const parent = el.parentNode!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  expect(cells.length).to.equal(200);
  expect(cells.at(-1)!.dataset['rangeEnd']).to.equal('599');
  expect(cells.filter((cell) => cell.tabIndex === 0).length, 'one entry stop survives reconnect').to.equal(1);
});

it('tiles awkward totals exactly and maps every selectable item into its own range', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.categories = categories;
  // 201 leaves a single two-item range among 199 singletons; 333 and 601 leave uneven remainders.
  // These are the totals where a floor/floor pairing of the range boundary and the item->range
  // lookup disagreed about which range owns an item near a boundary.
  for (const total of [201, 333, 601] as const) {
    el.items = Array.from({ length: total }, (_unused, index) => ({
      id: `n${total}-${index}`,
      categoryId: 'text',
    }));
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    expect(cells.length, `${total} cell count`).to.equal(200);
    let expectedStart = 0;
    for (const cell of cells) {
      expect(Number(cell.dataset['rangeStart']), `${total} contiguity`).to.equal(expectedStart);
      expect(Number(cell.dataset['rangeEnd']), `${total} non-empty range`).to.be.at.least(expectedStart);
      expectedStart = Number(cell.dataset['rangeEnd']) + 1;
    }
    expect(expectedStart, `${total} ranges cover every item exactly once`).to.equal(total);

    // Sample both sides of several range boundaries: the owning cell must actually contain the
    // selected item, never the neighbour that merely rounds to it.
    const probes = new Set<number>([0, 1, total - 2, total - 1]);
    for (const cell of cells.slice(0, 6)) {
      probes.add(Number(cell.dataset['rangeStart']));
      probes.add(Number(cell.dataset['rangeEnd']));
    }
    for (const probe of probes) {
      el.selectedIndex = probe;
      await el.updateComplete;
      const owner = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-selected]');
      expect(owner === null, `${total} item ${probe} has an owning range`).to.equal(false);
      expect(Number(owner!.dataset['rangeStart']), `${total} item ${probe} lower bound`).to.be.at.most(probe);
      expect(Number(owner!.dataset['rangeEnd']), `${total} item ${probe} upper bound`).to.be.at.least(probe);
    }
    el.selectedIndex = -1;
    await el.updateComplete;
  }
});
