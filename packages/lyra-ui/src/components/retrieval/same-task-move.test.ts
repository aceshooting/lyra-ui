import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../lr-knowledge-base.js';
import '../lr-ingestion-queue.js';
import '../lr-retrieval-results.js';
import '../lr-neighbor-list.js';
import type { LyraSourceRecord } from '../../data-sources.js';

type Total = HTMLElement & { sourceTotal: number | null; updateComplete: Promise<boolean> };
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

const values: Record<string, (order: number) => unknown> = {
  'lr-knowledge-base': (order) => ({ id: `r${order}`, name: `Row ${order}`, syncStatus: 'synced', indexingHealth: 'healthy' }),
  'lr-ingestion-queue': (order) => ({ id: `r${order}`, document: { id: `d${order}`, name: `Row ${order}` }, stage: 'queued' }),
  'lr-retrieval-results': (order) => ({ id: `r${order}`, text: `Row ${order}`, score: 0.5, source: { id: 'source', name: 'Source' } }),
};

function provider(name: string) {
  const entry = (order: number): LyraSourceRecord<unknown> => ({ key: `r${order}`, order, value: values[name]!(order) });
  const state = { calls: 0 };
  const source = {
    revision: 1,
    query: async () => {
      state.calls++;
      return name === 'lr-knowledge-base' ? { total: 1, rows: [entry(0)], summary: { total: 1, synced: 1, syncing: 0, attention: 0 } } : { total: 1, rows: [entry(0)] };
    },
    lookup: async (keys: readonly string[]) => keys.map((key) => entry(Number(key.slice(1)))),
    locate: async (key: string) => Number(key.slice(1)),
  };
  return { source, state };
}

for (const name of Object.keys(values)) {
  it(`${name} keeps its loaded provider page across a same-task move and reloads after a real disconnect`, async () => {
    const data = provider(name);
    const host = await fixture<HTMLDivElement>(html`<div><section></section></div>`);
    const el = document.createElement(name) as Total;
    (el as unknown as { dataSource: unknown }).dataSource = data.source;
    host.append(el);
    await waitUntil(() => el.sourceTotal === 1, `${name} did not load`);
    await settle();
    expect(data.state.calls).to.equal(1);

    host.querySelector('section')!.append(el);
    await settle();
    await el.updateComplete;
    expect([data.state.calls, el.sourceTotal]).to.deep.equal([1, 1]);

    el.remove();
    await settle();
    host.append(el);
    await waitUntil(() => data.state.calls === 2 && el.sourceTotal === 1, `${name} did not reload after reconnecting`);
  });
}

it('lr-neighbor-list keeps its loaded neighborhood across a same-task move and reloads after a real disconnect', async () => {
  let calls = 0;
  const source = { revision: 1, records: { revision: 1,
    query: async () => { calls++; return { total: 1, summary: { nodes: 1, edges: 0 }, rows: [{ key: 'node:current', order: 0, value: { kind: 'node', value: { id: 'current', label: 'Current' } } }] }; },
    lookup: async () => [], locate: async () => 0,
  }, scene: () => { throw new Error('unexpected scene request'); } };
  const host = await fixture<HTMLDivElement>(html`<div><section></section><lr-neighbor-list .graphSource=${source} .centerKey=${'node:center'}></lr-neighbor-list></div>`);
  const el = host.querySelector('lr-neighbor-list')! as unknown as Total;
  await waitUntil(() => el.sourceTotal === 1, 'neighborhood did not load');
  await settle();
  host.querySelector('section')!.append(el);
  await settle();
  expect([calls, el.sourceTotal]).to.deep.equal([1, 1]);
  el.remove(); await settle(); host.append(el);
  await waitUntil(() => calls === 2 && el.sourceTotal === 1, 'neighborhood did not reload after reconnecting');
});
