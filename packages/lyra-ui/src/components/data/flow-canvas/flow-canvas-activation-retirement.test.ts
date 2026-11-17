import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import './flow-canvas.js';

type Selection = {
  readonly selectedNodeIds: readonly string[];
  readonly selectedEdgeIds: readonly string[];
};

async function canvas(): Promise<LyraFlowCanvas> {
  const element = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas
    style="inline-size:480px;block-size:300px"></lr-flow-canvas>`);
  element.nodes = [
    { id: 'a', accessibleLabel: 'First original node', position: { x: 20, y: 20 } },
    { id: 'b', accessibleLabel: 'Second original node', position: { x: 220, y: 20 } },
  ];
  element.edges = [{ id: 'a-b', source: 'a', target: 'b', label: 'Original connection' }];
  await element.updateComplete;
  return element;
}

function activate(element: LyraFlowCanvas, kind: 'node' | 'edge', id: string): void {
  if (kind === 'node') {
    const control = element.shadowRoot!.querySelector<HTMLButtonElement>(
      `[data-node-id="${id}"] [part="node-control"]`,
    );
    expect(control !== null, 'the requested node control is rendered').to.equal(true);
    control!.click();
  } else {
    const control = element.shadowRoot!.querySelector<SVGElement>(
      `[data-edge-id="${id}"] [part="edge"]`,
    );
    expect(control !== null, 'the requested edge control is rendered').to.equal(true);
    control!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  }
}

for (const kind of ['node', 'edge'] as const) {
  it(`preserves replacement model selection when a ${kind} activation listener replaces the legacy scene`, async () => {
    const element = await canvas();
    const activations: string[] = [];
    const selections: Selection[] = [];
    const originalId = kind === 'node' ? 'a' : 'a-b';
    const freshId = kind === 'node' ? 'd' : 'c-d';
    const replacementSelection: Selection = kind === 'node'
      ? { selectedNodeIds: ['c'], selectedEdgeIds: [] }
      : { selectedNodeIds: [], selectedEdgeIds: ['c-d'] };
    const replace = (): void => {
      element.nodes = [
        { id: 'c', accessibleLabel: 'First replacement node', position: { x: 20, y: 20 } },
        { id: 'd', accessibleLabel: 'Second replacement node', position: { x: 220, y: 20 } },
      ];
      element.edges = [{ id: 'c-d', source: 'c', target: 'd', label: 'Replacement connection' }];
      element.selectedNodeIds = replacementSelection.selectedNodeIds;
      element.selectedEdgeIds = replacementSelection.selectedEdgeIds;
    };
    element.addEventListener('lr-selection-change', event => { selections.push(event.detail); });
    if (kind === 'node') {
      element.addEventListener('lr-node-activate', event => { activations.push(event.detail.nodeId); });
      element.addEventListener('lr-node-activate', replace, { once: true });
    } else {
      element.addEventListener('lr-edge-activate', event => { activations.push(event.detail.edgeId); });
      element.addEventListener('lr-edge-activate', replace, { once: true });
    }

    activate(element, kind, originalId);
    expect(activations).to.deep.equal([originalId]);
    expect(element.nodes.map(node => node.id)).to.deep.equal(['c', 'd']);
    expect(element.edges.map(edge => edge.id)).to.deep.equal(['c-d']);
    expect(element.selectedNodeIds, 'the retired activation does not clear the replacement node selection')
      .to.deep.equal(replacementSelection.selectedNodeIds);
    expect(element.selectedEdgeIds, 'the retired activation does not clear the replacement edge selection')
      .to.deep.equal(replacementSelection.selectedEdgeIds);
    expect(selections, 'assigning the replacement model and selection emits no obsolete selection change')
      .to.deep.equal([]);

    await element.updateComplete;
    const replacementSelector = kind === 'node'
      ? '[data-node-id="c"] [part="node-control"]'
      : '[data-edge-id="c-d"] [part="edge"]';
    await waitUntil(
      () => element.shadowRoot!.querySelector(replacementSelector)?.getAttribute('aria-pressed') === 'true',
      'the replacement selection reaches its rendered public control',
    );
    expect(element.shadowRoot!.querySelector('[data-node-id="a"]') === null).to.equal(true);
    expect(element.shadowRoot!.querySelector('[data-edge-id="a-b"]') === null).to.equal(true);

    activate(element, kind, freshId);
    await element.updateComplete;
    expect(activations).to.deep.equal([originalId, freshId]);
    const freshSelection: Selection = kind === 'node'
      ? { selectedNodeIds: ['d'], selectedEdgeIds: [] }
      : { selectedNodeIds: [], selectedEdgeIds: ['c-d'] };
    expect(selections).to.deep.equal([freshSelection]);
    expect(element.selectedNodeIds).to.deep.equal(freshSelection.selectedNodeIds);
    expect(element.selectedEdgeIds).to.deep.equal(freshSelection.selectedEdgeIds);
  });
}
