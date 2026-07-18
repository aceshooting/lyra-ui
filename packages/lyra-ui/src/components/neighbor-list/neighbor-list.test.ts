import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './neighbor-list.js';
import type { LyraNeighborList, LyraNeighborRow } from './neighbor-list.js';

const rows: LyraNeighborRow[] = [
  { relation: 'works_for', direction: 'out', node: { id: 'org1', label: 'Acme Corp', type: 'org', degree: 3 } },
  { relation: 'married_to', direction: 'both', node: { id: 'p2', label: 'Pierre Curie' } },
  { relation: 'discovered', direction: 'in', node: { id: 'elem1', label: 'Polonium' } },
];

it('defaults to empty rows, groupByRelation=false, expandable=false, virtualizeAt=100', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  expect(el.rows).to.deep.equal([]);
  expect(el.groupByRelation).to.be.false;
  expect(el.expandable).to.be.false;
  expect(el.virtualizeAt).to.equal(100);
});

it('renders one row per entry, each with the node label and relation text', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  const rendered = el.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rendered.length).to.equal(3);
  expect(rendered[0]!.textContent).to.include('Acme Corp');
  expect(rendered[0]!.textContent).to.include('works_for');
});

it('emits lyra-entity-activate with the node id when a row is activated', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="node-label"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lyra-entity-activate');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'org1' });
});

it('shows a per-row expand button emitting lyra-node-expand only when expandable', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="expand-button"]').length).to.equal(0);

  el.expandable = true;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll('[part="expand-button"]');
  expect(buttons.length).to.equal(3);
  const listener = oneEvent(el, 'lyra-node-expand');
  (buttons[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'org1' });
});

it('groups rows by relation with a labeled, counted header when groupByRelation is set', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
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
  const el = (await fixture(html`<lyra-neighbor-list virtualize-at="3"></lyra-neighbor-list>`)) as LyraNeighborList;
  el.rows = many;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
});

it('renders the direction as an aria-hidden glyph plus localized text folded into the row name', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  await el.updateComplete;
  const glyph = el.shadowRoot!.querySelector('[part="direction"]')!;
  expect(glyph.getAttribute('aria-hidden')).to.equal('true');
  const button = el.shadowRoot!.querySelector('[part="node-label"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Acme Corp, works_for, Outgoing');
});

it('shows neighborListEmpty when rows is empty', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No relationships');
});

it('is accessible with grouped, expandable rows', async () => {
  const el = (await fixture(html`<lyra-neighbor-list></lyra-neighbor-list>`)) as LyraNeighborList;
  el.rows = rows;
  el.groupByRelation = true;
  el.expandable = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
