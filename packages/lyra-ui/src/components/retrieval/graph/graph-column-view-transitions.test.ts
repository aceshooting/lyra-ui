import { expect, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';
import type { LyraGraphColumns } from '../../../internal/typed-columns.js';

function columns(id = 'column'): LyraGraphColumns {
  return { ids: [id], labels: [`${id} label`], x: new Float32Array([12]), y: new Float32Array([24]), z: new Float32Array([36]), source: new Uint32Array(), target: new Uint32Array() };
}
function graph(): LyraGraph {
  const element = new LyraGraph();
  element.view = 'list';
  element.nodes = [{ id: 'local', label: 'Local node', position: { x: 1, y: 2, z: 3 } }];
  return element;
}
const rows = (element: LyraGraph) => [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="spatial-list-item"]')];
async function settled(element: LyraGraph): Promise<void> {
  await element.updateComplete;
  await nextFrame();
  await element.updateComplete;
}
async function listed(element: LyraGraph, id: string): Promise<void> {
  await waitUntil(() => rows(element).some(row => row.dataset['nodeId'] === id), 'the admitted node is visible in the list');
}
async function blocked(element: LyraGraph, id: string): Promise<void> {
  let changes = 0;
  const changed = () => { changes++; };
  element.addEventListener('lr-camera-change', changed);
  try {
    expect(await element.focusNode(id, { zoom: 2 })).to.equal(false);
    element.fit();
    expect(element.getNodePosition(id)).to.equal(undefined);
    expect(element.getNodePosition3d(id)).to.equal(undefined);
    expect(element.getNodeScreenPosition(id)).to.equal(undefined);
    expect(changes).to.equal(0);
  } finally { element.removeEventListener('lr-camera-change', changed); }
}

describe('graph column view transitions', () => {
  it('keeps authored column coordinates available before connection and after list admission', async () => {
    const element = graph();
    element.graphColumns = columns();
    const before = element.getNodePosition3d('column');
    expect(before).to.deep.equal({ x: 12, y: 24, z: 36 });
    expect(Object.isFrozen(before)).to.equal(true);
    expect(element.getNodePosition3d('missing')).to.equal(undefined);
    expect(element.getNodePosition3d('local')).to.equal(undefined);
    await fixture(element);
    await listed(element, 'column');
    expect(element.getNodePosition3d('column')).to.deep.equal(before);
    expect(rows(element).map(row => row.textContent?.trim())).to.deep.equal(['column label']);
  });

  it('retains deterministic unplaced column coordinates across connection', async () => {
    const element = graph();
    element.graphColumns = { ids: ['unplaced'], source: new Uint32Array(), target: new Uint32Array() };
    const before = element.getNodePosition3d('unplaced');
    expect(before).not.to.equal(undefined);
    expect([before!.x, before!.y, before!.z].every(Number.isFinite)).to.equal(true);
    expect(Object.isFrozen(before)).to.equal(true);
    await fixture(element);
    await listed(element, 'unplaced');
    expect(element.getNodePosition3d('unplaced')).to.deep.equal(before);
  });

  it('reports missing local coordinates before connection and exposes admitted local data afterward', async () => {
    const element = graph();
    expect(element.getNodePosition3d('missing')).to.equal(undefined);
    expect(element.getNodePosition3d('local')).to.deep.equal({ x: 1, y: 2, z: 3 });
    await fixture(element);
    await listed(element, 'local');
    expect(element.getNodePosition3d('local')).to.deep.equal({ x: 1, y: 2, z: 3 });
  });

  it('blocks column navigation in the unsupported 2D view and recovers in list view', async () => {
    const element = graph();
    element.graphColumns = columns();
    element.view = '2d';
    await fixture(element);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    expect(element.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim().length).to.be.greaterThan(0);
    expect(rows(element).length).to.equal(0);
    await blocked(element, 'column');
    element.view = 'list';
    await listed(element, 'column');
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(await element.focusNode('column')).to.equal(true);
    expect(element.getNodePosition('column')).to.deep.equal({ x: 12, y: 24 });
  });

  it('rejects invalid replacement columns and restores controlled selection with a valid snapshot', async () => {
    const element = graph();
    const initial = columns();
    element.graphColumns = initial;
    element.selectionMode = 'single';
    element.selectedNodeIds = ['column'];
    await fixture(element);
    await listed(element, 'column');
    element.graphColumns = initial;
    await settled(element);
    expect(rows(element)[0]!.getAttribute('aria-pressed')).to.equal('true');
    element.graphColumns = { ids: ['duplicate', 'duplicate'], source: new Uint32Array(), target: new Uint32Array() };
    await settled(element);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    expect(rows(element).length).to.equal(0);
    await blocked(element, 'column');
    element.graphColumns = columns();
    await listed(element, 'column');
    expect(rows(element)[0]!.getAttribute('aria-pressed')).to.equal('true');
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(await element.focusNode('column')).to.equal(true);
    expect(element.getNodePosition3d('local')).to.equal(undefined);
  });

  it('keeps typed data readable when builtin 3D cannot render columns and permits explicit list recovery', async () => {
    const element = graph();
    element.graphColumns = columns();
    element.view = '3d';
    await fixture(element);
    await listed(element, 'column');
    expect(element.shadowRoot!.querySelectorAll('[part="engine-notice"]').length).to.equal(1);
    expect(element.shadowRoot!.querySelector('[part="engine-notice"]')!.textContent!.trim().length).to.be.greaterThan(0);
    expect(element.shadowRoot!.querySelectorAll('canvas[part="spatial-canvas"]').length).to.equal(0);
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-action="list"]')!.click();
    await settled(element);
    expect(element.view).to.equal('list');
    expect(await element.focusNode('column')).to.equal(true);
    expect(rows(element).map(row => row.dataset['nodeId'])).to.deep.equal(['column']);
    expect(element.getNodePosition3d('column')).to.deep.equal({ x: 12, y: 24, z: 36 });
  });
});
