import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import type { LyraGraph } from './graph.class.js';
import '../../lr-graph.js';

async function listGraph(columns: boolean): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="list" selection-mode="multiple"
    .nodes=${[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
    .edges=${[{ id: 'ab', source: 'a', target: 'b' }]}
  ></lr-graph>`);
  if (columns) {
    graph.graphColumns = { ids: ['a', 'b'], source: new Uint32Array([0]), target: new Uint32Array([1]) };
  }
  await graph.updateComplete;
  await waitUntil(() => graph.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length === 3,
    'two public node controls and an edge control are rendered', { timeout: 5000 });
  return graph;
}

function item(graph: LyraGraph, kind: 'node' | 'edge'): HTMLButtonElement {
  return graph.shadowRoot!.querySelector<HTMLButtonElement>(kind === 'node'
    ? '[part="spatial-list-item"][data-node-id="a"]'
    : '[part="spatial-list-item"]:not([data-node-id])')!;
}

for (const columns of [false, true]) {
  for (const kind of ['node', 'edge'] as const) {
    for (const retirement of ['selection', 'disconnect'] as const) {
      it(`retires ${columns ? 'column' : 'array'} ${kind} selection followups after activation ${retirement} and accepts a fresh action`, async () => {
        const graph = await listGraph(columns);
        const parent = graph.parentNode!;
        const proposals: unknown[] = [];
        graph.addEventListener('lr-selection-change', event => proposals.push(event.detail));
        item(graph, kind).click();
        expect(proposals.length, 'default activation proposes selection once').to.equal(1);
        expect(graph.selectedNodeIds).to.deep.equal([]);
        expect(graph.selectedEdgeIds).to.deep.equal([]);
        proposals.length = 0;

        graph.addEventListener(kind === 'node' ? 'lr-node-activate' : 'lr-edge-activate', () => {
          if (retirement === 'selection') graph.selectedNodeIds = ['b'];
          else graph.remove();
        }, { once: true });
        item(graph, kind).click();
        expect(proposals.length, 'the retired action emits no obsolete selection proposal').to.equal(0);
        if (retirement === 'selection') expect(graph.selectedNodeIds).to.deep.equal(['b']);
        else parent.appendChild(graph);

        graph.selectedNodeIds = [];
        graph.selectedEdgeIds = [];
        await graph.updateComplete;
        await waitUntil(() => graph.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length === 3);
        item(graph, kind).click();
        expect(proposals.length, 'a fresh current action remains usable').to.equal(1);
      });
    }
  }
}

async function canvasGraph(): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" layout="layered"
    width="400" height="360" style="width:400px;height:360px"
    .nodes=${[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
    .edges=${[{ source: 'a', target: 'b' }]}
  ></lr-graph>`);
  await waitUntil(() => graph.getNodePosition('b') !== undefined, 'layered nodes are positioned', { timeout: 5000 });
  await graph.updateComplete;
  await settlePointer();
  return graph;
}

function point(graph: LyraGraph, id: string): [number, number] {
  const rect = graph.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
  const position = graph.getNodePosition(id)!;
  return [Math.round(rect.left + position.x), Math.round(rect.top + position.y)];
}

describe('graph canvas hover ownership', () => {
  afterEach(async () => resetMouse());
  for (const retirement of ['disconnect', 'renderer'] as const) {
    it(`does not publish the next canvas hover after a leave listener changes ${retirement}`, async () => {
      const graph = await canvasGraph();
      const parent = graph.parentNode!;
      const enters: { nodeId: string; surface: 'canvas' | 'svg' | 'none' }[] = [];
      const leaves: string[] = [];
      graph.addEventListener('lr-node-enter', event => {
        const surface = graph.shadowRoot!.querySelector('[part="canvas"]') ? 'canvas'
          : graph.shadowRoot!.querySelector('[part="svg"]') ? 'svg' : 'none';
        enters.push({ nodeId: event.detail.nodeId, surface });
      });
      graph.addEventListener('lr-node-leave', event => leaves.push(event.detail.nodeId));
      await hoverUntilMatched(graph.shadowRoot!.querySelector('canvas')!, 'Alpha receives initial hover', () => point(graph, 'a'));
      await waitUntil(() => enters.some(event => event.nodeId === 'a' && event.surface === 'canvas'));
      graph.addEventListener('lr-node-leave', () => {
        if (retirement === 'disconnect') graph.remove();
        else graph.renderer = 'svg';
      }, { once: true });
      await sendMouse({ type: 'move', position: point(graph, 'b') });
      await waitUntil(() => leaves.includes('a'), 'moving to Beta retires Alpha');
      await twoFrames();
      const canvasEnters = (): string[] => enters.filter(event => event.surface === 'canvas').map(event => event.nodeId);
      expect(canvasEnters(), 'the retired canvas transition emits no Beta enter').to.deep.equal(['a']);
      if (retirement === 'disconnect') {
        expect(enters, 'a detached graph publishes no new hover').to.deep.equal([{ nodeId: 'a', surface: 'canvas' }]);
      } else {
        await graph.updateComplete;
        await waitUntil(() => graph.shadowRoot!.querySelector('[part="svg"]') !== null);
        const beta = graph.shadowRoot!.querySelector('[part="node"][aria-label="Beta"]')!;
        const beforeFreshSvgHover = enters.length;
        await hoverUntilMatched(beta, 'the fresh SVG surface accepts Beta hover');
        await waitUntil(() => enters.slice(beforeFreshSvgHover).some(event => event.nodeId === 'b' && event.surface === 'svg'));
        expect(beta.hasAttribute('data-hovered'), 'fresh SVG hover paints the current node').to.equal(true);
        expect(canvasEnters(), 'fresh SVG hover does not revive the retired canvas transition').to.deep.equal(['a']);
      }

      await resetMouse();
      if (retirement === 'disconnect') parent.appendChild(graph);
      else graph.renderer = 'canvas';
      await graph.updateComplete;
      await waitUntil(() => graph.shadowRoot!.querySelector('canvas') !== null && graph.getNodePosition('a') !== undefined);
      await settlePointer();
      await hoverUntilMatched(graph.shadowRoot!.querySelector('canvas')!, 'fresh canvas accepts Alpha hover', () => point(graph, 'a'));
      await waitUntil(() => canvasEnters().length === 2);
      expect(canvasEnters()).to.deep.equal(['a', 'a']);
    });
  }
});
