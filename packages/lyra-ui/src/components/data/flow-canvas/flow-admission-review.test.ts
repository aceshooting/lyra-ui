import { expect, fixture, html } from '@open-wc/testing';
import { snapshotFlowNodes } from './flow-model.js';
import { LyraFlowCanvas, type FlowNode } from './flow-canvas.js';

function fullBudget(): FlowNode[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `n${index}`, position: { x: index * 300, y: 0 },
    data: Object.fromEntries(Array.from({ length: 10_000 }, (_, field) => [`k${field}`, field])),
  }));
}

it('never exposes provisional metadata after an unreadable value interrupts a shared root', () => {
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const safe = { value: 1 };
  const data = { safe, bad: revoked.proxy };
  const nodes = snapshotFlowNodes([{ id: 'a', data }, { id: 'b', data }]);
  for (const node of nodes) {
    expect(Object.isFrozen(node.data)).to.equal(true);
    expect(Object.isFrozen(node.data!['safe'])).to.equal(true);
    expect(node.data === data).to.equal(false);
    expect(node.data!['safe'] === safe).to.equal(false);
    expect((node.data!['safe'] as { value: number }).value).to.equal(1);
  }
  expect(nodes.map(node => node.id)).to.deep.equal(['a', 'b']);
  expect(nodes[0]!.data === nodes[1]!.data).to.equal(true);
  expect(Object.hasOwn(nodes[0]!.data!, 'bad')).to.equal(false);
});

it('does not report loss for empty roots or containers at the exact metadata budget', async () => {
  const source = [...fullBudget(), { id: 'empty', data: {} }];
  let losses = 0;
  const nodes = snapshotFlowNodes(source, () => losses++);
  expect(losses).to.equal(0);
  expect(nodes[5]!.data).to.deep.equal({});
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .nodes=${source}></lr-flow-canvas>`);
  expect(canvas.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
  for (const empty of [{}, []]) {
    const nested = fullBudget();
    nested[4] = { ...nested[4]!, data: { ...nested[4]!.data, k9999: empty } };
    losses = 0;
    const copied = snapshotFlowNodes(nested, () => losses++);
    expect(losses).to.equal(0);
    expect(copied[4]!.data!['k9999']).to.deep.equal(empty);
    expect(Object.isFrozen(copied[4]!.data!['k9999'])).to.equal(true);
  }
});

it('stops exhausted-budget emptiness checks after one nonempty remainder establishes loss', () => {
  let enumerations = 0;
  let descriptors = 0;
  const data = () => new Proxy({}, {
    ownKeys: () => { enumerations++; return Array.from({ length: 1_000_000 }, (_, index) => `k${index}`); },
    getOwnPropertyDescriptor: () => { descriptors++; return { configurable: true, enumerable: true, value: 1 }; },
  });
  let losses = 0;
  const nodes = snapshotFlowNodes([...fullBudget(), { id: 'more-a', data: data() }, { id: 'more-b', data: data() }], () => losses++);
  expect(losses).to.equal(1);
  expect(enumerations).to.equal(1);
  expect(descriptors).to.equal(0);
  expect(Object.isFrozen(nodes[5]!.data)).to.equal(true);
  expect(Object.isFrozen(nodes[6]!.data)).to.equal(true);
});
