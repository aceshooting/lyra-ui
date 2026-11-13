import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { GraphSource } from '../graph/graph.class.js';
import type { LyraNeighborList } from './neighbor-list.class.js';
import './neighbor-list.js';

type Query = Parameters<GraphSource['records']['query']>[0];
function provider() {
  const queries: Query[] = [], located: string[] = [];
  const source: GraphSource = { revision: 1, records: { revision: 1,
    query: async request => {
      queries.push(request);
      return { total: 1, summary: { nodes: 1, edges: 0 }, rows: [
        { key: 'node:current', order: 0, value: { kind: 'node', value: { id: 'current', label: 'Current' } } },
      ] };
    },
    lookup: async () => [], locate: async key => { located.push(key); return key === 'node:current' ? 0 : null; },
  }, scene: () => { throw new Error('Neighborhood lookup must not request a graph scene'); } };
  return { source, queries, located };
}
async function mount(source: GraphSource): Promise<LyraNeighborList> {
  const list = await fixture<LyraNeighborList>(html`<lr-neighbor-list .graphSource=${source}
    .centerKey=${'node:center'} .strings=${{ neighborSourceError: 'Invalid neighborhood' }}></lr-neighbor-list>`);
  await ready(list);
  return list;
}
async function ready(list: LyraNeighborList): Promise<void> {
  await waitUntil(() => list.sourceTotal === 1);
  await list.updateComplete;
}

describe('neighbor-list source scope boundaries', () => {
  const invalidTypes: [string, unknown][] = [
    ['null', null], ['non-array', {}], ['non-string', [7]], ['blank', ['  ']],
    ['empty', ['']], ['sparse', Array(1)], ['overlong', ['x'.repeat(65_537)]],
  ];
  for (const [name, value] of invalidTypes) {
    it(`rejects ${name} type filters without querying and recovers on reassignment`, async () => {
      const data = provider();
      const list = await mount(data.source);
      const old = list.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!;
      const selected: string[] = [];
      list.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
      Reflect.set(list, 'sourceNodeTypes', value);
      await list.updateComplete;
      expect(list.sourceNodeTypes).to.deep.equal([]);
      expect(Object.isFrozen(list.sourceNodeTypes)).to.equal(true);
      expect(list.sourceTotal).to.equal(null);
      expect(data.queries.length).to.equal(1);
      expect(list.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
      expect(list.shadowRoot!.textContent).to.include('Invalid neighborhood');
      old.click();
      expect(selected).to.deep.equal([]);
      list.sourceNodeTypes = ['person'];
      await ready(list);
      expect(data.queries.length).to.equal(2);
      expect(data.queries[1]!.query.nodeTypes).to.deep.equal(['person']);
      list.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!.click();
      expect(selected).to.deep.equal(['current']);
      expect(list.shadowRoot!.textContent).not.to.include('Invalid neighborhood');
    });
  }

  const exactLimits: [string, string[]][] = [
    ['500 entries', Array.from({ length: 500 }, (_, i) => `type-${i}`)],
    ['65,536 units per type', ['x'.repeat(65_536)]],
    ['2,000,000 distinct units', [
      ...Array.from({ length: 30 }, (_, i) => String(i).padEnd(65_536, 'x')), 'last'.padEnd(33_920, 'y'),
    ]],
  ];
  for (const [name, types] of exactLimits) {
    it(`accepts exactly ${name} and owns the sorted filter snapshot`, async () => {
      const data = provider();
      const list = await mount(data.source);
      const input = [...types].reverse();
      list.sourceNodeTypes = input;
      input[0] = 'caller mutation';
      await ready(list);
      expect(data.queries.length).to.equal(2);
      expect(data.queries[1]!.query.nodeTypes).to.deep.equal([...types].sort());
      expect(list.sourceNodeTypes).to.deep.equal([...types].sort());
      expect(Object.isFrozen(list.sourceNodeTypes)).to.equal(true);
      expect(list.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(1);
    });
  }

  const invalidKeys: [string, unknown][] = [
    ['null', null], ['numeric', 3], ['wrong kind', 'edge:current'], ['missing prefix', 'current'],
    ['empty id', 'node:'], ['blank id', 'node:  '], ['overlong id', `node:${'x'.repeat(65_532)}`],
  ];
  for (const [name, key] of invalidKeys) {
    it(`declines a ${name} reveal without changing the current page`, async () => {
      const data = provider();
      const list = await mount(data.source);
      const selected: string[] = [];
      list.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
      expect(await list.revealSourceKey(key as string)).to.equal(false);
      expect(data.located).to.deep.equal([]);
      expect(data.queries.length).to.equal(1);
      expect(list.sourcePage).to.equal(0);
      expect(list.sourceTotal).to.equal(1);
      expect(selected).to.deep.equal([]);
      expect(list.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!.textContent).to.include('Current');
    });
  }

  it('declines reveal with a missing center or an unset source without provider work', async () => {
    const data = provider();
    const list = await fixture<LyraNeighborList>(html`<lr-neighbor-list .graphSource=${data.source}></lr-neighbor-list>`);
    expect(await list.revealSourceKey('node:current')).to.equal(false);
    list.graphSource = undefined;
    list.centerKey = 'node:center';
    expect(await list.revealSourceKey('node:current')).to.equal(false);
    expect(data.located).to.deep.equal([]);
    expect(data.queries.length).to.equal(0);
  });

  it('invalidates a pending reveal when the newer requested key is invalid', async () => {
    const data = provider();
    let finish: (index: number) => void = () => { throw new Error('Lookup did not start'); };
    let started = false;
    data.source.records.locate = () => new Promise<number>(resolve => { started = true; finish = resolve; });
    const list = await mount(data.source);
    const first = list.revealSourceKey('node:current');
    await waitUntil(() => started);
    expect(await list.revealSourceKey('edge:invalid')).to.equal(false);
    finish(0);
    expect(await first).to.equal(false);
    expect(data.queries.length).to.equal(1);
    expect(list.shadowRoot!.activeElement?.getAttribute('data-source-key') ?? null).to.equal(null);
  });
});
