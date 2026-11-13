import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import './flow-canvas.js';

type Selection = { readonly selectedNodeIds: readonly string[]; readonly selectedEdgeIds: readonly string[] };

async function canvas() {
  const element = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas
    style="inline-size:480px;block-size:300px"></lr-flow-canvas>`);
  element.nodes = [
    { id: 'a', accessibleLabel: 'First node', position: { x: 20, y: 20 } },
    { id: 'b', accessibleLabel: 'Second node', position: { x: 220, y: 20 } },
  ];
  element.edges = [{ id: 'a-b', source: 'a', target: 'b', label: 'Connection' }];
  await element.updateComplete;
  return element;
}

function node(element: LyraFlowCanvas, id: string): HTMLButtonElement {
  return element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-node-id="${id}"] [part="node-control"]`)!;
}

for (const modifier of ['ctrlKey', 'metaKey'] as const) {
  it(`toggles an edge with ${modifier} while retaining nodes and immutable event snapshots`, async () => {
    const element = await canvas();
    element.selectedNodeIds = ['a'];
    await element.updateComplete;
    const snapshots: Selection[] = [];
    element.addEventListener('lr-selection-change', event => { snapshots.push(event.detail); });
    const edge = element.shadowRoot!.querySelector<SVGElement>('[part="edge"]')!;
    edge.dispatchEvent(new MouseEvent('click', { bubbles: true, [modifier]: true }));
    expect(element.selectedNodeIds).to.deep.equal(['a']);
    expect(element.selectedEdgeIds).to.deep.equal(['a-b']);
    expect(snapshots).to.deep.equal([{ selectedNodeIds: ['a'], selectedEdgeIds: ['a-b'] }]);
    expect([snapshots[0], snapshots[0]!.selectedNodeIds, snapshots[0]!.selectedEdgeIds].every(Object.isFrozen)).to.equal(true);
    await element.updateComplete;
    expect(edge.getAttribute('aria-pressed')).to.equal('true');
    edge.dispatchEvent(new MouseEvent('click', { bubbles: true, [modifier]: true }));
    await element.updateComplete;
    expect(element.selectedNodeIds).to.deep.equal(['a']);
    expect(element.selectedEdgeIds).to.deep.equal([]);
    expect(edge.getAttribute('aria-pressed')).to.equal('false');
    expect(snapshots).to.deep.equal([
      { selectedNodeIds: ['a'], selectedEdgeIds: ['a-b'] },
      { selectedNodeIds: ['a'], selectedEdgeIds: [] },
    ]);
  });
}

for (const direction of ['ltr', 'rtl'] as const) {
  it(`keeps the only enabled node focused at both disabled boundaries in ${direction}`, async () => {
    const element = await canvas();
    element.dir = direction;
    element.edges = [];
    element.nodes = [
      { id: 'before', disabled: true, position: { x: 0, y: 0 } },
      { id: 'active', position: { x: 100, y: 0 } },
      { id: 'after', disabled: true, position: { x: 200, y: 0 } },
    ];
    await element.updateComplete;
    const active = node(element, 'active');
    await focusByKeyboard(active);
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      await sendKeys({ press: key });
      await element.updateComplete;
      await nextFrame();
      expect(element.shadowRoot!.activeElement === active).to.equal(true);
      expect(active.tabIndex).to.equal(0);
      expect(element.shadowRoot!.querySelectorAll('[part="node-control"][tabindex="0"]').length).to.equal(1);
      expect([node(element, 'before').tabIndex, node(element, 'after').tabIndex]).to.deep.equal([-1, -1]);
    }
  });
}

for (const key of ['Delete', 'Backspace']) {
  it(`ignores ${key} with an empty selection and reports only the later selected IDs`, async () => {
    const element = await canvas();
    element.nodesDraggable = true;
    await element.updateComplete;
    const requests: unknown[] = [];
    element.addEventListener('lr-selection-delete', event => { requests.push(event.detail); });
    await focusByKeyboard(node(element, 'a'));
    await sendKeys({ press: key });
    expect(requests).to.deep.equal([]);
    element.selectedNodeIds = ['b'];
    element.selectedEdgeIds = ['a-b'];
    await element.updateComplete;
    await sendKeys({ press: key });
    expect(requests).to.deep.equal([{ nodeIds: ['b'], edgeIds: ['a-b'] }]);
    expect(element.nodes.map(value => value.id)).to.deep.equal(['a', 'b']);
    expect(element.edges.map(value => value.id)).to.deep.equal(['a-b']);
  });
}

for (const kind of ['node', 'edge'] as const) {
  it(`finishes ${kind} selection safely when its consumer detaches the canvas and later reconnects it`, async () => {
    const element = await canvas();
    const parent = element.parentElement!;
    const selections: Selection[] = [];
    element.addEventListener('lr-selection-change', event => { selections.push(event.detail); });
    element.addEventListener('lr-selection-change', () => { element.remove(); }, { once: true });
    const target = kind === 'node' ? node(element, 'a') : element.shadowRoot!.querySelector('[part="edge"]')!;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(element.isConnected).to.equal(false);
    expect(selections).to.deep.equal([kind === 'node'
      ? { selectedNodeIds: ['a'], selectedEdgeIds: [] }
      : { selectedNodeIds: [], selectedEdgeIds: ['a-b'] }]);
    await nextFrame();
    parent.append(element);
    await element.updateComplete;
    await waitUntil(() => node(element, 'b') !== null);
    node(element, 'b').click();
    expect(selections.length).to.equal(2);
    expect(selections[1]).to.deep.equal({ selectedNodeIds: ['b'], selectedEdgeIds: [] });
    expect(element.selectedNodeIds).to.deep.equal(['b']);
    expect(element.selectedEdgeIds).to.deep.equal([]);
  });
}
