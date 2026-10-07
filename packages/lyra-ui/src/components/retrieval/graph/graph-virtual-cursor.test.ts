import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { CanvasScene } from './graph-canvas.js';
import type { LyraGraph } from './graph.class.js';
import './graph.js';

async function readyGraph(): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" layout="layered"
    width="320" height="240" style="width:320px;height:240px"></lr-graph>`);
  graph.nodes = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];
  graph.edges = [{ id: 'ab', source: 'a', target: 'b' }];
  await waitUntil(() => !!graph.shadowRoot!.querySelector('[part="cursor-item"]'));
  return graph;
}

it('keeps a single focused cursor across RTL navigation, selection and identity-preserving reorder', async () => {
  const graph = await readyGraph();
  graph.dir = 'rtl';
  graph.selectionMode = 'multiple';
  graph.selectedNodeIds = ['b'];
  await graph.updateComplete;
  const cursor = graph.shadowRoot!.querySelector<HTMLButtonElement>('[part="cursor-item"]')!;
  await focusByKeyboard(cursor);
  await sendKeys({ press: 'ArrowLeft' });
  await graph.updateComplete;
  expect(cursor.getAttribute('aria-label')).to.equal('Beta');
  expect(cursor.getAttribute('aria-pressed')).to.equal('true');
  expect(cursor.parentElement!.getAttribute('aria-posinset')).to.equal('2');
  expect(graph.shadowRoot!.activeElement === cursor).to.equal(true);
  graph.nodes = [...graph.nodes].reverse();
  await graph.updateComplete;
  expect(cursor.getAttribute('aria-label')).to.equal('Beta');
  expect(cursor.parentElement!.getAttribute('aria-posinset')).to.equal('1');
  expect(graph.shadowRoot!.activeElement === cursor).to.equal(true);
  await sendKeys({ press: 'End' });
  await graph.updateComplete;
  let edgeId = '';
  graph.addEventListener('lr-edge-activate', (event) => { edgeId = event.detail.edgeId ?? ''; });
  await sendKeys({ press: 'Space' });
  expect(edgeId).to.equal('ab');
  graph.nodes = [{ id: 'b', label: 'Beta' }];
  graph.edges = [];
  await graph.updateComplete;
  expect(cursor.parentElement!.getAttribute('aria-setsize')).to.equal('1');
  expect(cursor.getAttribute('aria-label')).to.equal('Beta');
  expect(graph.shadowRoot!.activeElement === cursor).to.equal(true);
  await expect(graph).to.be.accessible();
});

it('bounds canvas accessibility DOM at 5,000 nodes and 10,000 links while reaching the last item without rebuilding the scene', async function () {
  this.timeout(120000);
  const graph = await readyGraph();
  graph.nodes = Array.from({ length: 5_000 }, (_, index) => ({ id: `n${index}` }));
  graph.edges = Array.from({ length: 10_000 }, (_, index) => ({
    id: `e${index}`, source: `n${index % 5_000}`, target: `n${(index + 1) % 5_000}`,
  }));
  await graph.updateComplete;
  const root = graph.shadowRoot!;
  const cursor = root.querySelector<HTMLButtonElement>('[part="cursor-item"]')!;
  expect(root.querySelectorAll('[part="data-list"] li').length).to.equal(200);
  expect(root.querySelectorAll('[part="cursor-item"]').length).to.equal(1);
  expect(root.querySelectorAll('*').length).to.be.below(250);
  expect(root.querySelector('[role="note"]')?.textContent).to.equal('Showing 200 of 15,000 graph items.');
  expect(cursor.parentElement!.getAttribute('aria-setsize')).to.equal('15000');
  await focusByKeyboard(cursor);
  await graph.updateComplete;
  type Internals = {
    canvasScene?: CanvasScene;
    pickDirty: boolean;
    drawCanvas(): void;
    redrawPickCanvas(): void;
  };
  const internals = graph as unknown as Internals;
  internals.drawCanvas();
  internals.redrawPickCanvas();
  const scene = internals.canvasScene;
  expect(scene!.nodes.length).to.equal(5_000);
  expect(scene!.links.length).to.equal(10_000);
  const sceneNodes = scene!.nodes;
  expect(internals.pickDirty).to.equal(false);
  let edgeId = '';
  graph.addEventListener('lr-edge-activate', (event) => { edgeId = event.detail.edgeId ?? ''; });
  await sendKeys({ press: 'End' });
  await graph.updateComplete;
  internals.drawCanvas();
  expect(internals.canvasScene === scene).to.equal(true);
  expect(internals.canvasScene!.nodes === sceneNodes).to.equal(true);
  expect(internals.pickDirty).to.equal(false);
  expect(cursor.parentElement!.getAttribute('aria-posinset')).to.equal('15000');
  expect(graph.shadowRoot!.activeElement === cursor).to.equal(true);
  await sendKeys({ press: 'Enter' });
  expect(edgeId).to.equal('e9999');
  await sendKeys({ press: 'Home' });
  await graph.updateComplete;
  expect(cursor.getAttribute('aria-label')).to.equal('n0');
  graph.strings = { graphDataListLimit: '{shown} visibles sur {total}' };
  await graph.updateComplete;
  expect(root.querySelector('[role="note"]')?.textContent).to.equal('200 visibles sur 15,000');
});

for (const renderer of ['svg', 'canvas'] as const) {
  it(`names the ${renderer} role owner using label before the compatibility alias`, async () => {
    const graph = await readyGraph();
    graph.renderer = renderer;
    await graph.updateComplete;
    const surface = () => graph.shadowRoot!.querySelector(`[part="${renderer === 'svg' ? 'svg' : 'canvas'}"]`)!;
    expect(surface().getAttribute('aria-label')).to.match(/2 nodes/);
    graph.accessibleLabel = 'Compatibility';
    await graph.updateComplete;
    expect(graph.getAttribute('role')).to.equal(null);
    expect(surface().getAttribute('aria-label')).to.equal('Compatibility');
    graph.label = 'Relationships';
    await graph.updateComplete;
    expect(surface().getAttribute('aria-label')).to.equal('Relationships');
    graph.label = '';
    await graph.updateComplete;
    expect(surface().getAttribute('aria-label')).to.equal('');
    graph.setAttribute('aria-label', 'Host name');
    await graph.updateComplete;
    expect(graph.getAttribute('role')).to.equal('group');
    expect(surface().hasAttribute('aria-label')).to.equal(false);
    graph.setAttribute('aria-label', '');
    await graph.updateComplete;
    expect(graph.getAttribute('role')).to.equal('group');
    expect(surface().hasAttribute('aria-label')).to.equal(false);
    graph.removeAttribute('aria-label');
    graph.label = null;
    graph.strings = { graphDiagram: 'Diagramme {nodeCount} / {linkCount}' };
    await graph.updateComplete;
    expect(surface().getAttribute('aria-label')).to.equal('Diagramme 2 / 1');
    await expect(graph).to.be.accessible();
  });
}
