import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraGraphSource } from '../../../data-sources.js';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import type { FlowNode, FlowEdge, FlowStructureSnapshot } from './flow-types.js';
import './flow-canvas.js';

type Source = LyraGraphSource<FlowNode, FlowEdge>;
function provider(first = 0): Source {
  const indices = [first, first + 1];
  const row = (index: number) => ({ key: `node:${index}`, order: index - first,
    value: { kind: 'node' as const, value: { id: String(index), accessibleLabel: `Node ${index}` } } });
  return {
    revision: 1,
    records: { revision: 1,
      query: async request => ({ rows: indices.slice(request.page * request.pageSize, (request.page + 1) * request.pageSize).map(row),
        total: 2, summary: { nodes: 2, edges: 0 } }),
      lookup: async keys => keys.map(key => row(Number(key.slice(5)))),
      locate: async key => Number(key.slice(5)) - first,
    },
    scene: async () => ({ nodes: indices.map((index, order) => ({ key: `node:${index}`, value: row(index).value.value,
      position: { x: order * 100, y: 0 } })), edges: [], coverage: 'complete', total: { nodes: 2, edges: 0 },
      worldBounds: { x: 0, y: 0, width: 200, height: 100 } }),
  };
}
const ready = (el: LyraFlowCanvas, key = 'node:0') => waitUntil(() => el.sourceTotal === 2 &&
  el.shadowRoot!.querySelector(`[data-source-key="${key}"]`) !== null);

for (const field of ['source revision', 'records', 'records revision'] as const) {
  for (const retirement of ['replacement', 'unset', 'disconnect'] as const) {
    it(`retires source binding after ${field} causes ${retirement} and accepts a later source`, async () => {
      const source = provider(), replacement = provider(7);
      const records = source.records, query = records.query;
      let queries = 0;
      records.query = async request => { queries++; return query(request); };
      const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .graphSource=${source}
        .strings=${{ graphSourceRecordsError: 'Records unavailable', graphSourceSceneError: 'Scene unavailable' }}></lr-flow-canvas>`);
      await ready(el);
      const parent = el.parentNode!;
      const before = queries;
      let retired = false;
      Object.defineProperty(field === 'records revision' ? records : source, field === 'records' ? 'records' : 'revision', {
        configurable: true,
        get() {
          if (!retired) {
            retired = true;
            if (retirement === 'replacement') el.graphSource = replacement;
            else if (retirement === 'unset') el.graphSource = undefined;
            else el.remove();
          }
          return field === 'records' ? records : 1;
        },
      });
      el.graphSource = source;
      await el.updateComplete;
      expect(retired).to.equal(true);
      expect(queries, 'no query starts against the retired binding').to.equal(before);
      if (retirement !== 'replacement') el.graphSource = replacement;
      if (retirement === 'disconnect') parent.appendChild(el);
      await ready(el, 'node:7');
      expect(el.shadowRoot!.querySelectorAll('[data-source-key="node:0"]').length).to.equal(0);
      expect(el.shadowRoot!.textContent).not.to.include('Records unavailable');
      expect(el.shadowRoot!.textContent).not.to.include('Scene unavailable');
      expect(await el.revealSourceKey('node:8')).to.equal(true);
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:8"]')!.click();
      expect(el.selectedNodeIds).to.deep.equal(['8']);
    });
  }
}

for (const failingRead of [1, 2]) {
  it(`rejects an activation when the source revision throws on authority read ${failingRead}`, async () => {
    const source = provider();
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .graphSource=${source}></lr-flow-canvas>`);
    await ready(el);
    let reads = 0, armed = true, activations = 0;
    Object.defineProperty(source, 'revision', { configurable: true, get() {
      if (armed && ++reads === failingRead) { armed = false; throw new Error('Revision unavailable'); }
      return 1;
    } });
    el.addEventListener('lr-node-activate', () => { activations++; });
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:0"]')!;
    button.click();
    expect(reads).to.equal(failingRead);
    expect(activations).to.equal(0);
    expect(el.selectedNodeIds).to.deep.equal([]);
    button.click();
    expect(activations).to.equal(1);
    expect(el.selectedNodeIds).to.deep.equal(['0']);
  });
}

for (const inconsistent of ['world bounds', 'node total', 'edge total'] as const) {
  it(`clears an inconsistent viewport scene (${inconsistent}) and recovers through retry`, async () => {
    const source = provider(), scene = source.scene;
    let invalid = false;
    source.scene = async request => {
      const result = await scene(request);
      if (!invalid) return result;
      if (inconsistent === 'world bounds') return { ...result, worldBounds: { x: 0, y: 0, width: 300, height: 100 } };
      return { ...result, coverage: 'neighborhood', total: {
        nodes: inconsistent === 'node total' ? 3 : 2,
        edges: inconsistent === 'edge total' ? 1 : 0,
      } };
    };
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .graphSource=${source}
      .strings=${{ graphSourceSceneError: 'Scene unavailable', retry: 'Retry scene' }}></lr-flow-canvas>`);
    await ready(el);
    let snapshot: FlowStructureSnapshot | undefined;
    const unregister = el.registerCompanion(value => { snapshot = value; });
    try {
      await waitUntil(() => snapshot?.nodes.length === 2);
      invalid = true;
      el.setViewport({ x: 20, y: 30, zoom: 1 });
      await waitUntil(() => el.shadowRoot!.textContent?.includes('Scene unavailable') === true && snapshot?.nodes.length === 0);
      expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="source-coverage"]').length).to.equal(0);
      expect(el.sourceTotal).to.equal(2);
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:1"]')!.click();
      expect(el.selectedNodeIds).to.deep.equal(['1']);
      invalid = false;
      const retry = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="source-status"] button')]
        .find(button => button.textContent === 'Retry scene')!;
      retry.click();
      await waitUntil(() => snapshot?.nodes.length === 2 && el.sourceTotal === 2);
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).not.to.include('Scene unavailable');
      expect(el.shadowRoot!.querySelectorAll('[part="source-coverage"]').length).to.equal(1);
    } finally { unregister(); }
  });
}
