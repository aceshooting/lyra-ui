import { expect, fixture, html } from '@open-wc/testing';
import './flow-minimap.js';
import type { LyraFlowMinimap } from './flow-minimap.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-types.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

interface Work {
  snapshot: FlowStructureSnapshot;
  canvasEl: { readonly: boolean; setViewport(value: unknown): void };
  onViewportPointerDown(event: PointerEvent): void;
  onViewportPointerMove(event: PointerEvent): void;
  onViewportPointerUp(event: PointerEvent): void;
}
async function mount() {
  const minimap = await fixture<LyraFlowMinimap>(html`<lr-flow-minimap></lr-flow-minimap>`);
  const work = minimap as unknown as Work;
  work.canvasEl = { readonly: false, setViewport() {} };
  work.snapshot = {
    nodes: Array.from({ length: 1000 }, (_, i) => ({ id: `n${i}`, x: i * 100, y: 0, width: 80, height: 40 })),
    edges: [], viewport: { x: 0, y: 0, zoom: 1, width: 400, height: 300, minZoom: 0.1, maxZoom: 4 }, locked: false,
    orientation: 'horizontal', layerGap: 80, nodeGap: 40,
  };
  await minimap.updateComplete;
  return { minimap, work };
}

describe('flow minimap measured work', () => {
  it('keeps all 1000 overview nodes in a static SVG layer separate from viewport updates', async () => {
    const { minimap, work } = await mount();
    const node = minimap.shadowRoot!.querySelector<SVGRectElement>('[part="node"]')!;
    const viewport = minimap.shadowRoot!.querySelector<SVGRectElement>('[part="viewport"]')!;
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(node.ownerSVGElement!, { attributes: true, childList: true, subtree: true });
    try {
      work.snapshot = { ...work.snapshot, viewport: { ...work.snapshot.viewport, x: -100 } };
      await minimap.updateComplete;
      mutations.push(...observer.takeRecords());
      const rendered = minimap.shadowRoot!.querySelectorAll('[part="node"]').length;
      recordScaleMeasurement('lr-flow-minimap', 'n=1000 viewport update', { rendered, staticLayerMutations: mutations.length });
      expect(rendered).to.equal(1000);
      expect(mutations.length).to.equal(0);
      expect(node.ownerSVGElement === viewport.ownerSVGElement).to.equal(false);
      expect(viewport.getAttribute('x')).to.equal('100');
    } finally { observer.disconnect(); }
  });

  it('reads the screen transform once for a twenty-move viewport gesture', async () => {
    const { minimap, work } = await mount();
    const native = SVGSVGElement.prototype.getScreenCTM;
    let reads = 0;
    SVGSVGElement.prototype.getScreenCTM = function () { reads++; return native.call(this); };
    const hit = minimap.shadowRoot!.querySelector<SVGElement>('[part="viewport-hit-area"]')!;
    const capture = hit.setPointerCapture;
    hit.setPointerCapture = () => {};
    try {
      hit.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: 20, clientY: 20, bubbles: true }));
      for (let i = 1; i <= 20; i++) work.onViewportPointerMove(new PointerEvent('pointermove', { pointerId: 7, clientX: 20 + i, clientY: 20 }));
      recordScaleMeasurement('lr-flow-minimap', 'n=1000 twenty viewport drag moves', { transformReads: reads });
      expect(reads).to.equal(1);
    } finally {
      SVGSVGElement.prototype.getScreenCTM = native;
      hit.setPointerCapture = capture;
      work.onViewportPointerUp(new PointerEvent('pointercancel', { pointerId: 7 }));
    }
  });
});

for (const geometryChange of ['allocation', 'viewBox'] as const) {
it(`refreshes cached gesture geometry after the minimap ${geometryChange} changes`, async () => {
  const { minimap, work } = await mount();
  minimap.style.cssText = 'width:200px;height:140px';
  let latest = { x: 0, y: 0, zoom: 1 };
  work.canvasEl.setViewport = value => { latest = value as typeof latest; };
  const hit = minimap.shadowRoot!.querySelector<SVGElement>('[part="viewport-hit-area"]')!;
  const capture = hit.setPointerCapture; hit.setPointerCapture = () => {};
  try {
    hit.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, clientX: 20, clientY: 20, bubbles: true }));
    if (geometryChange === 'allocation') minimap.style.cssText = 'width:400px;height:280px';
    else {
      work.snapshot = { ...work.snapshot, nodes: work.snapshot.nodes.map(node => ({ ...node, x: node.x * 2 })) };
      await minimap.updateComplete;
    }
    for (let i = 0; i < 2; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const inverse = hit.ownerSVGElement!.getScreenCTM()!.inverse();
    work.onViewportPointerMove(new PointerEvent('pointermove', { pointerId: 3, clientX: 40, clientY: 20 }));
    expect(latest.x).to.be.closeTo(-20 * inverse.a, 0.01);
  } finally {
    hit.setPointerCapture = capture;
    work.onViewportPointerUp(new PointerEvent('pointercancel', { pointerId: 3 }));
  }
});

}
