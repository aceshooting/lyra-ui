import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph } from './graph.class.js';
import { loadD3 } from './graph-loader.js';

async function graph() {
  // Peer startup is asynchronous; prepare the real modules before testing DOM readiness.
  const modules = await loadD3();
  expect(modules !== null, 'the optional graph peers are available').to.equal(true);
  const element = await fixture<LyraGraph>(html`<lr-graph layout="layered" selection-mode="single"></lr-graph>`);
  element.nodes = [{ id: 'a' }, { id: 'b' }];
  element.edges = [{ id: 'ab', source: 'a', target: 'b' }];
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="node"]').length === 2);
  return element;
}

it('emits canonical node activation and leaves the retired click event silent', async () => {
  const element = await graph();
  const order: string[] = [];
  let selection: unknown;
  element.addEventListener('lr-node-activate', (event) => {
    order.push('activate');
    expect((event as CustomEvent).detail.nodeId).to.equal('a');
    expect(event.cancelable).to.equal(false);
  });
  element.addEventListener('lr-node-click', () => order.push('retired'));
  element.addEventListener('lr-selection-change', (event) => { selection = event.detail; });
  element.shadowRoot!.querySelector('[part="node"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(order).to.deep.equal(['activate']);
  expect(selection).to.deep.equal({ selectedNodeIds: ['a'], selectedEdgeIds: [] });
  expect(element.selectedNodeIds).to.deep.equal([]);
});

it('emits the canonical edge detail and leaves the retired link event silent', async () => {
  const element = await graph();
  let canonical: unknown;
  let retired = 0;
  element.addEventListener('lr-edge-activate', (event) => { canonical = (event as CustomEvent).detail; });
  element.addEventListener('lr-link-click', () => { retired++; });
  element.shadowRoot!.querySelector('[part="link"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(canonical).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b', edgeId: 'ab' });
  expect(retired).to.equal(0);
});
