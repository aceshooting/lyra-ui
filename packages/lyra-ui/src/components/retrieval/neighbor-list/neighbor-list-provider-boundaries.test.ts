import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './neighbor-list.js';
import type { LyraNeighborList } from './neighbor-list.class.js';
import type { GraphSource } from '../graph/graph.class.js';

const row = (id: string, order = 0) => ({ key: `node:${id}`, order,
  value: { kind: 'node' as const, value: { id } } });
const page = () => ({ total: 1, rows: [row('current')], summary: { nodes: 1, edges: 0 } });
type QueryRequest = Parameters<GraphSource['records']['query']>[0];

function provider(query: (request: QueryRequest) => unknown): GraphSource {
  const source: GraphSource = {
    revision: 1,
    records: { revision: 1, query: async () => page(), lookup: async () => [], locate: async () => null },
    scene: async () => { throw new Error('A neighborhood list does not request a scene'); },
  };
  // A JavaScript provider can return values outside the compile-time page contract.
  Reflect.set(source.records, 'query', async (request: QueryRequest) => query(request));
  return source;
}

async function ready(el: LyraNeighborList): Promise<void> {
  await waitUntil(() => el.sourceTotal !== null, 'a current neighborhood page is ready');
  await el.updateComplete;
}

describe('neighbor-list provider admission boundaries', () => {
  for (const kind of ['null page', 'non-array rows', 'edge record', 'mismatched key', 'accessor label'] as const) {
    it(`rejects a ${kind} atomically, revokes old controls, and recovers on replacement`, async () => {
      const el = await fixture<LyraNeighborList>(html`<lr-neighbor-list .graphSource=${provider(page)}
        .centerKey=${'node:center'} .strings=${{ neighborSourceError: 'Neighbors unavailable' }}></lr-neighbor-list>`);
      await ready(el);
      const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!;
      const selected: string[] = [];
      el.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
      let getterReads = 0;
      el.graphSource = provider(() => {
        if (kind === 'null page') return null;
        const result = page();
        if (kind === 'non-array rows') Reflect.set(result, 'rows', {});
        if (kind === 'edge record') Reflect.set(result.rows[0]!.value, 'kind', 'edge');
        if (kind === 'mismatched key') result.rows[0]!.key = 'node:other';
        if (kind === 'accessor label') Object.defineProperty(result.rows[0]!.value.value, 'label', {
          get() { getterReads++; return 'Untrusted label'; },
        });
        return result;
      });
      await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'), 'malformed data fails closed');
      expect(el.sourceTotal).to.equal(null);
      expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
      expect(el.shadowRoot!.textContent).to.include('Neighbors unavailable');
      expect(el.shadowRoot!.textContent).not.to.include('Untrusted label');
      expect(getterReads).to.equal(0);
      old.click();
      expect(selected).to.deep.equal([]);
      el.graphSource = provider(page);
      await ready(el);
      expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(0);
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!.click();
      expect(selected).to.deep.equal(['current']);
      expect(getterReads).to.equal(0);
    });
  }

  it('uses exact IDs for unlabeled records and preserves an accessible-only name for navigation and expansion', async () => {
    const source = provider(() => ({ total: 2, summary: { nodes: 2, edges: 0 }, rows: [
      row('plain'), { key: 'node:spoken', order: 1, value: { kind: 'node', value: { id: 'spoken', accessibleLabel: 'Spoken entity', type: 'person' } } },
    ] }));
    const el = await fixture<LyraNeighborList>(html`<lr-neighbor-list .graphSource=${source}
      .centerKey=${'node:center'} expandable></lr-neighbor-list>`);
    await ready(el);
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-source-key]')];
    expect(buttons.map(button => button.textContent!.trim())).to.deep.equal(['plain', 'spoken']);
    expect(buttons.map(button => button.getAttribute('aria-label'))).to.deep.equal(['plain', 'Spoken entity']);
    const selected: string[] = [], expanded: string[] = [];
    el.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
    el.addEventListener('lr-node-expand', event => expanded.push(event.detail.nodeId));
    buttons[0]!.click();
    buttons[1]!.click();
    const expand = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="expand-button"]');
    expect(expand[1]!.getAttribute('aria-label')).to.include('Spoken entity');
    expand[1]!.click();
    expect(selected).to.deep.equal(['plain', 'spoken']);
    expect(expanded).to.deep.equal(['spoken']);
    await expect(el).to.be.accessible();
  });

  it('corrects an out-of-range neighborhood page once and keeps the corrected row actions live', async () => {
    const pages: number[] = [];
    const source = provider(request => {
      pages.push(request.page);
      return { ...page(), rows: request.page === 0 ? [row('current')] : [] };
    });
    const previousWarn = console.warn;
    let warnings = 0;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith('Element lr-neighbor-list scheduled an update')) warnings++;
      previousWarn.apply(console, args);
    };
    try {
      const el = await fixture<LyraNeighborList>(html`<lr-neighbor-list .graphSource=${source}
        .centerKey=${'node:center'} .sourcePage=${99} expandable></lr-neighbor-list>`);
      await ready(el);
      expect(el.sourcePage).to.equal(0);
      expect(pages).to.deep.equal([99, 0]);
      expect(el.sourceTotal).to.equal(1);
      const pagination = el.shadowRoot!.querySelector('lr-pagination')!;
      await pagination.updateComplete;
      expect(pagination.page).to.equal(1);
      expect(pagination.total).to.equal(1);
      const selected: string[] = [], expanded: string[] = [];
      el.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
      el.addEventListener('lr-node-expand', event => expanded.push(event.detail.nodeId));
      const current = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!;
      expect(current.dataset['sourceKey']).to.equal('node:current');
      current.click();
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!.click();
      expect(selected).to.deep.equal(['current']);
      expect(expanded).to.deep.equal(['current']);
      expect(pages).to.deep.equal([99, 0]);
      expect(warnings).to.equal(0);
    } finally {
      console.warn = previousWarn;
    }
  });

  it('keeps unlabeled virtualized legacy rows selectable under one authored overall name', async () => {
    const el = await fixture<LyraNeighborList>(html`<lr-neighbor-list aria-label="Related entities"
      virtualize-at="1" style="display: block; block-size: 240px"
      .rows=${[
        { relation: 'knows', direction: 'out', node: { id: 'first', label: '' } },
        { relation: 'knows', direction: 'out', node: { id: 'second', label: '' } },
      ]}></lr-neighbor-list>`);
    const buttons = () => [...(el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot
      ?.querySelectorAll<HTMLButtonElement>('[part="node-label"]') ?? [])];
    await waitUntil(() => buttons().length === 2, 'the two virtual rows have mounted', { timeout: 5000 });
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('role')).to.equal(false);
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(buttons()[0]!.textContent).to.include('first');
    expect(buttons()[1]!.textContent).to.include('second');
    expect(buttons()[0]!.getAttribute('aria-label')).to.include('first');
    const selected: string[] = [];
    el.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
    buttons()[1]!.click();
    expect(selected).to.deep.equal(['second']);
    el.virtualizeAt = 100;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-virtual-list').length).to.equal(0);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="node-label"]')!.click();
    expect(selected).to.deep.equal(['second', 'first']);
  });
});
