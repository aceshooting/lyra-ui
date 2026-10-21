import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { stubNoOwnerWindow } from '../../../../test/graph-test-support.js';
import type { LyraPopover } from '../../overlays/overlay/popover.class.js';
import type { LyraGraph } from '../graph/graph.class.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.class.js';
import './knowledge-graph-explorer.js';

const people = [
  { id: 'marie', label: 'Marie' },
  { id: 'pierre', label: 'Pierre' },
];
const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };

// This file's page has not loaded the optional d3 peer yet, so the first test below meets the
// graph's real loading skeleton. Keep it first: a later test would find the peer already cached.
describe('knowledge graph explorer preset activation while the graph loads', () => {
  it('abandons a preset wait that cannot schedule frames and activates normally afterwards', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const requestFrame = window.requestAnimationFrame;
    const graphOf = (explorer: LyraKnowledgeGraphExplorer) => explorer.shadowRoot?.querySelector<LyraGraph>('[part="graph"]');
    const skeletonShown = (explorer: LyraKnowledgeGraphExplorer): boolean =>
      !!graphOf(explorer)?.shadowRoot?.querySelector('lr-skeleton');
    const el = document.createElement('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;
    el.nodes = people;
    el.selectedNodeId = 'marie';
    let restoreWindow: (() => void) | undefined;
    try {
      host.append(el);
      // The first wait finds no window to schedule frames on.
      restoreWindow = stubNoOwnerWindow(el as never);
      await el.updateComplete;
      await aTimeout(0);
      restoreWindow();
      restoreWindow = undefined;
      // The second wait finds a window that refuses to schedule frames while the skeleton shows.
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        if (skeletonShown(el)) throw new Error('animation frames unavailable');
        return requestFrame.call(window, callback);
      }) as typeof window.requestAnimationFrame;
      el.selectedNodeId = 'pierre';
      await el.updateComplete;
      await aTimeout(0);
    } finally {
      restoreWindow?.();
      window.requestAnimationFrame = requestFrame;
    }
    await waitUntil(() => graphOf(el)?.shadowRoot?.querySelectorAll('[part="node"]').length === people.length, 'graph rendered', { timeout: 8000 });
    expect(el.selectedNodeId).to.equal('pierre');

    // An abandoned wait must not wedge later activations.
    el.selectedNodeId = null;
    await el.updateComplete;
    el.selectedNodeId = 'marie';
    await waitUntil(() => el.shadowRoot!.querySelector('[part="detail-card"]') !== null, 'preset activates once frames work', { timeout: 8000 });
  });
});

describe('knowledge graph explorer 3D direct activation', () => {
  it('anchors a native click to the node position projected after the camera moved', async () => {
    const nodes = [
      { id: 'front', label: 'Front', position: { x: 0, y: 0, z: 0 } },
      { id: 'behind', label: 'Behind', position: { x: 0, y: 0, z: 301 } },
    ];
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="3d" .camera=${camera} .nodes=${nodes}></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    const popover = el.shadowRoot!.querySelector<LyraPopover>('[part="detail-popover"]')!;
    expect(graph.getNodeScreenPosition('behind'), 'the node starts behind the near plane').to.equal(undefined);

    let anchor: { x: number; y: number } | undefined;
    const original = popover.showAt;
    popover.showAt = function (rect) { anchor = rect; return original.call(this, rect); };
    try {
      // Activation and the native click arrive in one task: the camera moves in between.
      graph.dispatchEvent(new CustomEvent('lr-node-activate', { detail: { nodeId: 'behind', x: 0, y: 0, z: 301 }, bubbles: true, composed: true }));
      const zoomOut = graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-action="zoom-out"]')!;
      for (let step = 0; step < 3; step++) zoomOut.click();
      const projected = graph.getNodeScreenPosition('behind');
      expect(projected, 'zooming out brings the node into view').to.not.equal(undefined);
      graph.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      const bounds = graph.getBoundingClientRect();
      expect(anchor).to.not.equal(undefined);
      expect(anchor!.x).to.be.closeTo(bounds.left + projected!.x, 0.5);
      expect(anchor!.y).to.be.closeTo(bounds.top + projected!.y, 0.5);
      expect(el.selectedNodeId).to.equal('behind');
    } finally { popover.showAt = original; }
  });
});
