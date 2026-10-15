import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraPopover } from '../../overlays/overlay/popover.class.js';
import type { LyraGraph } from '../graph/graph.class.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.class.js';
import './knowledge-graph-explorer.js';

const nodes = [
  { id: 'a', label: 'Alpha', position: { x: -40, y: 0, z: 60 } },
  { id: 'b', label: 'Beta', position: { x: 40, y: 0, z: -60 } },
];

describe('knowledge graph spatial integration', () => {
  it('forwards spatial coordinates, selection and user view changes', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="3d" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    expect(graph.view).to.equal('3d');
    expect(graph.getNodePosition3d('a')).to.deep.equal(nodes[0]!.position);
    (graph.shadowRoot!.querySelector('[data-spatial-action="list"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await graph.updateComplete;
    expect(el.view).to.equal('list');
    const activate = oneEvent(el, 'lr-node-activate');
    (graph.shadowRoot!.querySelector('[part="spatial-list-item"]') as HTMLButtonElement).click();
    expect((await activate).detail.nodeId).to.equal('a');
    expect(el.selectedNodeId).to.equal('a');
  });

  it('centers spatial search selection and follows camera changes without SVG node DOM', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="3d" selected-node-id="a" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="detail-card"]')));
    expect(graph.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(0);
    expect(await el.focusNode('b')).to.equal(true);
    const position = graph.getNodeScreenPosition('b');
    expect(Number.isFinite(position?.x)).to.equal(true);
    const event = oneEvent(el, 'lr-camera-change');
    (graph.shadowRoot!.querySelector('[data-spatial-action="right"]') as HTMLButtonElement).click();
    expect(Number.isFinite((await event).detail.camera.yaw)).to.equal(true);
  });
  it('reanchors open details after a silent authored camera update', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="3d" selected-node-id="a" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    const popover = el.shadowRoot!.querySelector<LyraPopover>('[part="detail-popover"]')!;
    await waitUntil(() => popover.open);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    let lastAnchor: { x: number; y: number } | undefined;
    let cameraEvents = 0;
    const original = popover.showAt;
    popover.showAt = function (rect) { lastAnchor = rect; return original.call(this, rect); };
    el.addEventListener('lr-camera-change', () => { cameraEvents++; });
    try {
      el.camera = { yaw: 0.3, pitch: 0, distance: 300, target: { x: 50, y: 0, z: 0 } };
      await el.updateComplete;
      await graph.updateComplete;
      await waitUntil(() => lastAnchor !== undefined, 'open detail follows an authored camera');
      const projected = graph.getNodeScreenPosition('a')!, bounds = graph.getBoundingClientRect();
      expect(lastAnchor!.x).to.be.closeTo(bounds.left + projected.x, 0.1);
      expect(lastAnchor!.y).to.be.closeTo(bounds.top + projected.y, 0.1);
      expect(cameraEvents).to.equal(0);
    } finally { popover.showAt = original; }
  });

  it('opens native spatial pointer activation without recentering the camera', async () => {
    const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="3d" .camera=${camera} .nodes=${nodes}></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    const point = graph.getNodeScreenPosition('a')!, bounds = graph.getBoundingClientRect();
    const popover = el.shadowRoot!.querySelector<LyraPopover>('[part="detail-popover"]')!;
    try {
      await sendMouse({ type: 'click', position: [Math.round(bounds.left + point.x), Math.round(bounds.top + point.y)] });
      await waitUntil(() => popover.open);
      expect(el.selectedNodeId).to.equal('a');
      expect(graph.getNodeScreenPosition('a')!.x).to.be.closeTo(point.x, 0.1);
      expect(graph.getNodeScreenPosition('a')!.y).to.be.closeTo(point.y, 0.1);
    } finally { await resetMouse(); }
  });

});
