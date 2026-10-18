import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './flow-minimap.js';
import type { LyraFlowMinimap } from './flow-minimap.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-types.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('keeps the map hover treatment while pointing at its separate viewport layer', async () => {
  const minimap = await fixture<LyraFlowMinimap>(html`<lr-flow-minimap style="--lr-color-brand-quiet:rgb(1,2,3)"></lr-flow-minimap>`);
  const work = minimap as unknown as { canvasEl: { readonly: boolean }; snapshot: FlowStructureSnapshot };
  work.canvasEl = { readonly: false };
  work.snapshot = {
    nodes: [{ id: 'n', x: 0, y: 0, width: 100, height: 100 }], edges: [],
    viewport: { x: 0, y: 0, zoom: 1, width: 100, height: 100, minZoom: 0.1, maxZoom: 4 },
    locked: false, orientation: 'horizontal', layerGap: 80, nodeGap: 40,
  };
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector<SVGSVGElement>('[part="map"]')!;
  const hit = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]')!;
  const box = hit.getBoundingClientRect();
  try {
    await sendMouse({ type: 'move', position: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)] });
    await waitUntil(() => getComputedStyle(map).backgroundColor === 'rgb(1, 2, 3)', 'map hover through the viewport layer');
    work.snapshot = { ...work.snapshot, nodes: [] }; await minimap.updateComplete;
    const emptyBox = map.getAttribute('viewBox');
    work.snapshot = { ...work.snapshot, viewport: { ...work.snapshot.viewport, x: -10 } }; await minimap.updateComplete;
    expect(map.getAttribute('viewBox')).to.equal(emptyBox);
    expect(map.querySelectorAll('[part="node"]').length).to.equal(0);
  } finally { await resetMouse(); }
});
