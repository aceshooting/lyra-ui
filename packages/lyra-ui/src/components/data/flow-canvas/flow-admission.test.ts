import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { snapshotFlowNodes, snapshotFlowDecorations } from './flow-model.js';
import { LyraFlowCanvas } from './flow-canvas.js';

it('bounds descriptor reads for a million-field logical metadata record', () => {
  let reads = 0;
  const data = new Proxy({}, {
    ownKeys: () => Array.from({ length: 1_000_000 }, (_, index) => `k${index}`),
    getOwnPropertyDescriptor: () => { reads++; return { configurable: true, enumerable: true, value: 1 }; },
  });
  const nodes = snapshotFlowNodes([{ id: 'n', data }]);
  expect(reads).to.be.at.most(10_000);
  expect(Object.keys(nodes[0]!.data!).length).to.equal(10_000);
});

it('shares one metadata copy and one total field budget across a node assignment', () => {
  const shared: Record<string, unknown> = { safe: { value: 1 } };
  shared['self'] = shared;
  const same = snapshotFlowNodes([{ id: 'a', data: shared }, { id: 'b', data: shared }]);
  expect(same[0]!.data === same[1]!.data).to.equal(true);
  expect(same[0]!.data!['self'] === same[0]!.data).to.equal(true);
  expect(Object.isFrozen(same[0]!.data!['safe'])).to.equal(true);
  const nodes = snapshotFlowNodes(Array.from({ length: 10 }, (_, index) => ({ id: `n${index}`, data: Object.fromEntries(Array.from({ length: 10_000 }, (_, field) => [`k${field}`, field])) })));
  expect(nodes.reduce((sum, node) => sum + Object.keys(node.data ?? {}).length, 0)).to.be.at.most(50_000);
});

it('reports metadata and root-array input loss independently from layout limits', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  const data = Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`k${index}`, index]));
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .nodes=${[{ id: 'n', data, position: { x: 0, y: 0 } }]}></lr-flow-canvas>`);
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Some nodes, edges, or node data were omitted');
  expect(sinkTexts().some(text => text.includes('Some nodes, edges, or node data were omitted'))).to.equal(false);
  el.strings = { flowCanvasInputLimit: 'Flow input was limited' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Flow input was limited');
  el.nodes = [{ id: 'n', position: { x: 0, y: 0 } }];
  el.edges = Array.from({ length: 10_001 }, (_, index) => ({ id: `e${index}`, source: 'missing', target: 'missing' }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]') !== null).to.equal(true);
  expect(sinkTexts()).to.include('Flow input was limited');
  el.edges = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
});

it('does not evaluate metadata accessors or allow prototype keys to change the owned clone', () => {
  let reads = 0;
  const data: Record<string, unknown> = { safe: 1 };
  Object.defineProperty(data, 'accessor', { enumerable: true, get() { reads++; return 'unsafe'; } });
  Object.defineProperty(data, '__proto__', { enumerable: true, value: { safe: 2 } });
  const result = snapshotFlowNodes([{ id: 'n', data }])[0]!.data!;
  expect(reads).to.equal(0);
  expect(Object.hasOwn(result, '__proto__')).to.equal(true);
  expect(Object.getPrototypeOf(result) === Object.prototype).to.equal(true);
  expect(result['safe']).to.equal(1);
  expect(Object.isFrozen(result['__proto__'])).to.equal(true);
});

it('bounds descriptor reads for a million-key logical decoration record', () => {
  let reads = 0;
  const source = new Proxy({}, {
    ownKeys: () => Array.from({ length: 1_000_000 }, (_, index) => `n${index}`),
    getOwnPropertyDescriptor: () => { reads++; return { configurable: true, enumerable: true, value: { status: 'running' } }; },
  });
  const result = snapshotFlowDecorations(source);
  expect(reads).to.be.at.most(10_000);
  expect(Object.keys(result).length).to.equal(10_000);
});
