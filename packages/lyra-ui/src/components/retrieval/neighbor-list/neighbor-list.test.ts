import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './neighbor-list.js';
import type { LyraNeighborList, LyraNeighborRow } from './neighbor-list.js';
import { styles } from './neighbor-list.styles.js';

const rows: LyraNeighborRow[] = [
  { relation: 'works_for', direction: 'out', node: { id: 'org1', label: 'Acme Corp', type: 'org', degree: 3 } },
  { relation: 'married_to', direction: 'both', node: { id: 'p2', label: 'Pierre Curie' } },
  { relation: 'discovered', direction: 'in', node: { id: 'elem1', label: 'Polonium' } },
];

it('defaults to empty rows, groupByRelation=false, expandable=false, virtualizeAt=100', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  expect(el.rows).to.deep.equal([]);
  expect(el.groupByRelation).to.be.false;
  expect(el.expandable).to.be.false;
  expect(el.virtualizeAt).to.equal(100);
});

it('includes visible type and localized degree metadata in the row description', async () => {
  const el = (await fixture(
    html`<lr-neighbor-list lang="ar-u-nu-arab" .rows=${rows}></lr-neighbor-list>`,
  )) as LyraNeighborList;
  const button = el.shadowRoot!.querySelector('[part="node-label"]')!;
  expect(button.getAttribute('aria-description')).to.contain('org');
  expect(button.getAttribute('aria-description')).to.contain('٣');
});

it('formats relation-group counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-neighbor-list lang="ar-u-nu-arab" group-by-relation .rows=${[
      rows[0]!,
      { ...rows[0]!, node: { ...rows[0]!.node, id: 'org2' } },
    ]}></lr-neighbor-list>`,
  )) as LyraNeighborList;
  expect(el.shadowRoot!.querySelector('[part="group-header"]')!.textContent).to.contain('٢');
});

it('formats multi-value node metadata as a locale-aware list instead of fixed punctuation', async () => {
  const el = (await fixture(
    html`<lr-neighbor-list
      lang="fr"
      .rows=${[
        {
          relation: 'works_for',
          direction: 'out',
          node: { id: 'acme', label: 'Acme', type: 'organisation', degree: 3 },
        },
      ]}
    ></lr-neighbor-list>`,
  )) as LyraNeighborList;
  const meta = el.shadowRoot!.querySelector('[part="node-meta"]')!;
  expect(meta.textContent).to.equal(
    new Intl.ListFormat('fr', { style: 'short', type: 'unit' }).format(['organisation', '3']),
  );
});

it('renders one row per entry, each with the node label and relation text', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  const rendered = el.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rendered.length).to.equal(3);
  expect(rendered[0]!.textContent).to.include('Acme Corp');
  expect(rendered[0]!.textContent).to.include('works_for');
});

it('emits lr-entity-activate with the node id when a row is activated', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="node-label"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-activate');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'org1' });
});

it('shows a per-row expand button emitting lr-node-expand only when expandable', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="expand-button"]').length).to.equal(0);

  el.expandable = true;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll('[part="expand-button"]');
  expect(buttons.length).to.equal(3);
  const listener = oneEvent(el, 'lr-node-expand');
  (buttons[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'org1' });
});

it('groups rows by relation with a labeled, counted header when groupByRelation is set', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = [
    ...rows,
    { relation: 'works_for', direction: 'out', node: { id: 'org2', label: 'Sorbonne' } },
  ];
  el.groupByRelation = true;
  await el.updateComplete;
  const headers = el.shadowRoot!.querySelectorAll('[part="group-header"]');
  expect(headers.length).to.equal(3);
  const worksFor = Array.from(headers).find((h) => h.textContent?.includes('works_for'))!;
  expect(worksFor.textContent).to.include('2');
});

it('renders through the internal virtual-list once rows exceeds virtualizeAt', async () => {
  const many: LyraNeighborRow[] = Array.from({ length: 5 }, (_, i) => ({
    relation: 'related_to',
    direction: 'out' as const,
    node: { id: `n${i}`, label: `Node ${i}` },
  }));
  const el = (await fixture(html`<lr-neighbor-list virtualize-at="3"></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = many;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
});

it('normalizes a NaN virtualizeAt to the default (100) instead of silently disabling virtualization', async () => {
  // A small row count (3, well below the real default of 100) -- proves the NaN falls back to a
  // real, non-negative default rather than an always-false comparison letting virtualization run
  // at any size: with the guard in place, 3 rows stay in the plain (non-virtualized) list.
  const el = (await fixture(html`<lr-neighbor-list virtualize-at="not-a-number"></lr-neighbor-list>`)) as LyraNeighborList;
  expect(Number.isNaN(el.virtualizeAt)).to.be.true;
  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.not.exist;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(rows.length);
});

it('gives the per-row expand button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  el.expandable = true;
  await el.updateComplete;
  const expandButton = el.shadowRoot!.querySelector('[part="expand-button"]') as HTMLElement;
  expect(getComputedStyle(expandButton).minInlineSize).to.equal('40px');
  expect(getComputedStyle(expandButton).minBlockSize).to.equal('40px');
});

it('renders the direction as an aria-hidden glyph plus localized text folded into the row name', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  const glyph = el.shadowRoot!.querySelector('[part="direction"]')!;
  expect(glyph.getAttribute('aria-hidden')).to.equal('true');
  const button = el.shadowRoot!.querySelector('[part="node-label"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Acme Corp, works_for, Outgoing');
});

it('shows neighborListEmpty when rows is empty', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No relationships');
});

it('names the region with a host aria-label override, then the label property, then the localized default', async () => {
  const withDefault = (await fixture(html`<lr-neighbor-list .rows=${rows}></lr-neighbor-list>`)) as LyraNeighborList;
  await withDefault.updateComplete;
  expect(withDefault.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Relationships');

  const withLabel = (await fixture(html`<lr-neighbor-list label="Family tree" .rows=${rows}></lr-neighbor-list>`)) as LyraNeighborList;
  await withLabel.updateComplete;
  expect(withLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Family tree');

  const withAria = (await fixture(
    html`<lr-neighbor-list aria-label="Custom" label="Family tree" .rows=${rows}></lr-neighbor-list>`,
  )) as LyraNeighborList;
  await withAria.updateComplete;
  expect(withAria.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom');
});

describe('localization', () => {
  it('localizes the empty state and a row accessible name via .strings', async () => {
    const empty = (await fixture(
      html`<lr-neighbor-list .strings=${{ neighborListEmpty: 'Aucune relation' }}></lr-neighbor-list>`,
    )) as LyraNeighborList;
    await empty.updateComplete;
    expect(empty.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('Aucune relation');

    const populated = (await fixture(
      html`<lr-neighbor-list
        .strings=${{ neighborDirectionOut: 'Sortant', neighborRowLabel: '{label} · {relation} · {direction}' }}
        .rows=${rows}
      ></lr-neighbor-list>`,
    )) as LyraNeighborList;
    await populated.updateComplete;
    const button = populated.shadowRoot!.querySelector('[part="node-label"]') as HTMLElement;
    expect(button.getAttribute('aria-label')).to.equal('Acme Corp · works_for · Sortant');
  });
});

it('is accessible with grouped, expandable rows', async () => {
  const el = (await fixture(html`<lr-neighbor-list></lr-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  el.groupByRelation = true;
  el.expandable = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('gives node-label a hover state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='node-label'\]:hover/);
});

describe('row part styling reaches both rendering paths', () => {
  const grouped: LyraNeighborRow[] = [
    ...rows,
    { relation: 'works_for', direction: 'out', node: { id: 'org2', label: 'Sorbonne', type: 'org' } },
  ];

  /** The shadow tree the rows actually live in: this component's own at/below `virtualize-at`,
   *  the internal `<lr-virtual-list>`'s above it. */
  function rowRoot(el: LyraNeighborList): ShadowRoot {
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    return list ? list.shadowRoot! : el.shadowRoot!;
  }

  async function list(virtualizeAt: number): Promise<LyraNeighborList> {
    const el = (await fixture(html`<lr-neighbor-list
      virtualize-at=${virtualizeAt}
      group-by-relation
      expandable
      style="--lr-theme-color-text-quiet: rgb(4, 5, 6); --lr-theme-color-text-normal: rgb(7, 8, 9)"
      .rows=${grouped}
    ></lr-neighbor-list>`)) as LyraNeighborList;
    await el.updateComplete;
    const virtual = el.shadowRoot!.querySelector('lr-virtual-list');
    if (virtual) await (virtual as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    return el;
  }

  // 1 => every fixture above virtualizes; 99 => every fixture stays on the plain path.
  for (const [label, virtualizeAt] of [
    ['virtualized', 1],
    ['plain', 99],
  ] as const) {
    it(`lays out [part="row"] and its node-label in the ${label} path`, async () => {
      const el = await list(virtualizeAt);
      expect(el.shadowRoot!.querySelector('lr-virtual-list') !== null).to.equal(label === 'virtualized');
      const rendered = [...rowRoot(el).querySelectorAll('[part~="row"]')] as HTMLElement[];
      expect(rendered.length).to.equal(grouped.length);
      expect(getComputedStyle(rendered[0]!).display).to.equal('flex');
      expect(getComputedStyle(rendered[0]!).borderBlockEndStyle).to.equal('solid');
      // Exactly one bordered row box per row -- a nested second part="row" would be matched by
      // ::part(row) too and draw the divider twice.
      expect(rendered[0]!.querySelectorAll('[part~="row"]').length).to.equal(0);

      const button = rendered[0]!.querySelector('[part="node-label"]') as HTMLElement;
      expect(getComputedStyle(button).flexGrow).to.equal('1');
      expect(getComputedStyle(button).cursor).to.equal('pointer');
      expect(getComputedStyle(button).color).to.equal('rgb(7, 8, 9)');
    });

    it(`styles the relation, direction and node-meta text in the ${label} path`, async () => {
      const el = await list(virtualizeAt);
      const root = rowRoot(el);
      const relation = root.querySelector('[part="relation"]') as HTMLElement;
      expect(getComputedStyle(relation).fontSize).to.equal('12px');
      expect(getComputedStyle(relation).color).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(root.querySelector('[part="direction"]') as HTMLElement).color).to.equal('rgb(4, 5, 6)');
      const meta = root.querySelector('[part="node-meta"]') as HTMLElement;
      expect(getComputedStyle(meta).textOverflow).to.equal('ellipsis');
    });

    it(`gives the expand button the shared minimum hit area in the ${label} path`, async () => {
      const el = await list(virtualizeAt);
      const expand = rowRoot(el).querySelector('[part="expand-button"]') as HTMLElement;
      expect(getComputedStyle(expand).minInlineSize).to.equal('40px');
      expect(getComputedStyle(expand).minBlockSize).to.equal('40px');
    });

    it(`presents the group header identically in the ${label} path`, async () => {
      const el = await list(virtualizeAt);
      // Virtualized, the header is lr-virtual-list's own `group` part; plain, it is this
      // component's `group-header` element. Both must render the same typographic treatment.
      const root = rowRoot(el);
      const header = root.querySelector(label === 'virtualized' ? '[part="group"]' : '[part="group-header"]') as HTMLElement;
      expect(header.textContent!.trim().length).to.be.greaterThan(0);
      expect(getComputedStyle(header).textTransform).to.equal('uppercase');
      expect(getComputedStyle(header).fontSize).to.equal('12px');
      expect(getComputedStyle(header).color).to.equal('rgb(4, 5, 6)');
    });

    it(`is accessible in the ${label} path`, async () => {
      const el = await list(virtualizeAt);
      expect(rowRoot(el).querySelectorAll('[part~="row"]').length).to.be.greaterThan(0);
      await expect(el).to.be.accessible();
    });
  }

  it('exports the virtualized row and group parts so a consumer stylesheet can reach them', async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-neighbor-list::part(node-label) {
            color: rgb(12, 34, 56);
          }
          lr-neighbor-list::part(group-header) {
            outline-color: rgb(21, 43, 65);
          }
        </style>
        <lr-neighbor-list virtualize-at="1" group-by-relation .rows=${grouped}></lr-neighbor-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-neighbor-list') as LyraNeighborList;
    await el.updateComplete;
    const virtual = el.shadowRoot!.querySelector('lr-virtual-list')!;
    await (virtual as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    expect(virtual.getAttribute('exportparts')).to.contain('row:row');
    expect(virtual.getAttribute('exportparts')).to.contain('group:group-header');
    const button = virtual.shadowRoot!.querySelector('[part="node-label"]') as HTMLElement;
    const header = virtual.shadowRoot!.querySelector('[part="group"]') as HTMLElement;
    expect(getComputedStyle(button).color).to.equal('rgb(12, 34, 56)');
    expect(getComputedStyle(header).outlineColor).to.equal('rgb(21, 43, 65)');
  });
});
