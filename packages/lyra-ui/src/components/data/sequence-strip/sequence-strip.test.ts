import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './sequence-strip.js';
import type { LyraSequenceStrip } from './sequence-strip.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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
  expect(cells[0].style.backgroundColor).to.not.equal('');
  expect(cells[0].style.backgroundColor).to.equal(cells[2].style.backgroundColor); // both 'text'
  expect(cells[0].style.backgroundColor).to.not.equal(cells[1].style.backgroundColor);
});

it('bounds the DOM window for 200 and 500 items at 320px without sacrificing full roving focus', async () => {
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

      expect(cells.length, `${count} ${direction} cell count`).to.equal(Math.min(count, 200));
      expect(wrapper.scrollWidth, `${count} ${direction} wrapper`).to.be.at.most(wrapper.clientWidth + 1);
      expect(base.scrollWidth, `${count} ${direction} strip`).to.be.at.most(base.clientWidth + 1);
      expect(
        Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)),
        `${count} ${direction} visible cell width`,
      ).to.be.greaterThan(0);

      cells[0]!.focus();
      cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await el.updateComplete;
      cells = [...base.querySelectorAll<HTMLElement>('[part="cell"]')];
      expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['itemId']).to.equal(`item-${count}`);
      expect(cells.filter((cell) => cell.tabIndex === 0).map((cell) => cell.dataset['itemId'])).to.deep.equal([
        `item-${count}`,
      ]);
      expect(cells.at(-1)?.getAttribute('aria-posinset')).to.equal(String(count));
      expect(cells.at(-1)?.getAttribute('aria-setsize')).to.equal(String(count));
      if (count > 200) {
        expect(el.shadowRoot!.querySelector('[part="window-range"]')?.textContent).to.contain('500');
      }
    }
  }
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

it('renders a marker on cells whose item sets marker: true, and none otherwise', async () => {
  const el = (await fixture(html`<lr-sequence-strip></lr-sequence-strip>`)) as LyraSequenceStrip;
  el.items = items;
  el.categories = categories;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
  expect((cells[0].querySelector('[part="marker"]')) == null).to.be.true;
  expect(cells[1].querySelector('[part="marker"]')).to.exist;
  expect((cells[2].querySelector('[part="marker"]')) == null).to.be.true;
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
    const clauses = [
      el.localize('sequenceStripCategoryCount', undefined, { label: 'Text', count: new Intl.NumberFormat(locale).format(2), pluralCount: 2 }),
      el.localize('sequenceStripCategoryCount', undefined, { label: 'Tool', count: new Intl.NumberFormat(locale).format(1), pluralCount: 1 }),
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
