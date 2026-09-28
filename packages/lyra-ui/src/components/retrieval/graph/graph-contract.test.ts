import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph } from './graph.class.js';

async function graph() {
  const element = await fixture<LyraGraph>(html`<lr-graph layout="layered" selection-mode="single"></lr-graph>`);
  element.nodes = [{ id: 'a' }, { id: 'b' }];
  element.edges = [{ id: 'ab', source: 'a', target: 'b' }];
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="node"]').length === 2);
  return element;
}

it('reports canonical node activation before its compatibility event and uses property-named selection', async () => {
  const element = await graph();
  const order: string[] = [];
  let selection: unknown;
  element.addEventListener('lr-node-activate', (event) => {
    order.push('activate');
    expect((event as CustomEvent).detail.nodeId).to.equal('a');
    expect(event.cancelable).to.equal(false);
  });
  element.addEventListener('lr-node-click', () => order.push('click'));
  element.addEventListener('lr-selection-change', (event) => { selection = event.detail; });
  element.shadowRoot!.querySelector('[part="node"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(order).to.deep.equal(['activate', 'click']);
  expect(selection).to.deep.equal({ selectedNodeIds: ['a'], selectedEdgeIds: [] });
  expect(element.selectedNodeIds).to.deep.equal([]);
});

it('gives edge activation an edgeId while retaining the old event detail unchanged', async () => {
  const element = await graph();
  let canonical: unknown;
  let legacy: unknown;
  element.addEventListener('lr-edge-activate', (event) => { canonical = (event as CustomEvent).detail; });
  element.addEventListener('lr-link-click', (event) => { legacy = event.detail; });
  element.shadowRoot!.querySelector('[part="link"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(canonical).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b', edgeId: 'ab' });
  expect(legacy).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b', linkId: 'ab' });
});
