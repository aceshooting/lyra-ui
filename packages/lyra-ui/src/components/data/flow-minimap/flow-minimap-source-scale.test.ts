import { expect, fixture, html } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './flow-minimap.js';
import type { LyraFlowMinimap } from './flow-minimap.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-types.js';
import type { LyraGraphOverview, LyraSourceBounds } from '../../../data-sources.js';

type SourceSnapshot = FlowStructureSnapshot & { source?: {
  coverage: 'aggregate'; total: { nodes: number; edges: number };
  worldBounds: LyraSourceBounds; overview: LyraGraphOverview | null;
} };
const world = { x: -5000, y: -2000, width: 10000, height: 4000 };
function snapshot(overview: LyraGraphOverview | null, bounds = world): SourceSnapshot {
  return {
    nodes: [{ id: 'scene-only', x: 10, y: 20, width: 100, height: 50 }], edges: [],
    viewport: { x: 0, y: 0, zoom: 1, width: 320, height: 200, minZoom: 0.1, maxZoom: 4 },
    locked: false, orientation: 'horizontal', layerGap: 40, nodeGap: 40,
    source: { coverage: 'aggregate', total: { nodes: 1_000_000, edges: 1_000_000 }, worldBounds: bounds, overview },
  };
}
async function setup(initial: SourceSnapshot) {
  const root = await fixture<HTMLElement>(html`<div style="inline-size:320px"></div>`);
  const canvas = document.createElement('lr-flow-canvas');
  let callback: (value: SourceSnapshot) => void = () => {};
  const calls: { x: number; y: number; zoom: number }[] = [];
  let zooms = 0;
  Object.assign(canvas, {
    readonly: false,
    registerCompanion(next: (value: SourceSnapshot) => void) { callback = next; next(initial); return () => {}; },
    setViewport(value: { x: number; y: number; zoom: number }) { calls.push(value); },
    zoomIn() { zooms += 1; }, zoomOut() { zooms -= 1; }, fit() {},
  });
  root.append(canvas);
  const minimap = document.createElement('lr-flow-minimap');
  canvas.append(minimap);
  await minimap.updateComplete;
  return { root, canvas, minimap, calls, zooms: () => zooms, publish: (value: SourceSnapshot) => callback(value), initialPublish: callback };
}
const map = (el: LyraFlowMinimap) => el.shadowRoot!.querySelector<SVGSVGElement>('[part="map"]')!;
const hit = (el: LyraFlowMinimap) => el.shadowRoot!.querySelector<SVGRectElement>('[part="viewport-hit-area"]')!;

describe('flow minimap bounded source overview', () => {
  it('draws 1024 aggregate bins in exact global bounds without painting scene nodes', async () => {
    const bins = Array.from({ length: 1024 }, (_, i) => ({ bounds: { x: -5000 + i * 10000 / 1024, y: -2000, width: 10000 / 1024, height: 4000 }, count: i ? 976 : 1552 }));
    const state = snapshot({ bounds: world, bins });
    const { minimap, publish } = await setup(state);
    expect(map(minimap).getAttribute('viewBox')).to.equal('-5000 -2000 10000 4000');
    expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(0);
    expect(minimap.shadowRoot!.querySelectorAll('[part="aggregate-bin"]').length).to.equal(1024);
    const first = minimap.shadowRoot!.querySelector('[part="aggregate-bin"]');
    publish({ ...state, viewport: { ...state.viewport, x: -50 } });
    await minimap.updateComplete;
    expect(minimap.shadowRoot!.querySelector('[part="aggregate-bin"]') === first).to.equal(true);
    expect(minimap.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('x')).to.equal('50');
    recordScaleMeasurement('lr-flow-minimap', 'n=1000000 source aggregate overview bins', {
      sourceNodes: state.source!.total.nodes,
      aggregateBins: minimap.shadowRoot!.querySelectorAll('[part="aggregate-bin"]').length,
      sceneNodes: minimap.shadowRoot!.querySelectorAll('[part="node"]').length,
    });
  });

  it('shows unavailable separately from an accepted empty overview and restores legacy nodes on unset', async () => {
    const { minimap, publish } = await setup(snapshot(null));
    expect(minimap.shadowRoot!.querySelector('[part="source-unavailable"]')?.textContent?.trim()).to.equal('Workflow overview unavailable.');
    expect(map(minimap).getAttribute('viewBox')).to.equal('-5000 -2000 10000 4000');
    expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(0);
    minimap.strings = { flowMinimapSourceUnavailable: 'Vue indisponible' };
    await minimap.updateComplete;
    expect(minimap.shadowRoot!.querySelector('[part="source-unavailable"]')?.textContent?.trim()).to.equal('Vue indisponible');
    const empty = snapshot({ bounds: world, bins: [] });
    empty.source = { ...empty.source!, total: { nodes: 0, edges: 0 } };
    publish(empty);
    await minimap.updateComplete;
    expect(minimap.shadowRoot!.querySelector('[part="source-unavailable"]') === null).to.equal(true);
    const legacy = snapshot(null); delete legacy.source;
    publish(legacy); await minimap.updateComplete;
    expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(1);
    expect(map(minimap).getAttribute('viewBox')).to.equal('-10 0 140 90');
  });

  it('maps negative-origin pointer coordinates and physical RTL keys to the current viewport', async () => {
    const { minimap, calls, zooms } = await setup(snapshot(null));
    minimap.dir = 'rtl'; await minimap.updateComplete;
    const point = map(minimap).createSVGPoint(); point.x = -2500; point.y = -1000;
    const client = point.matrixTransform(map(minimap).getScreenCTM()!);
    map(minimap).dispatchEvent(new MouseEvent('click', { clientX: client.x, clientY: client.y }));
    // MouseEvent client coordinates are integral; one CSS pixel spans many world units.
    const pixel = world.width / map(minimap).getBoundingClientRect().width;
    expect(calls[0]!.x).to.be.closeTo(2660, pixel);
    expect(calls[0]!.y).to.be.closeTo(1100, pixel);
    hit(minimap).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(calls[1]).to.deep.equal({ x: -32, y: 0, zoom: 1 });
    map(minimap).dispatchEvent(new WheelEvent('wheel', { deltaY: -1, cancelable: true }));
    expect(zooms()).to.equal(1);
  });

  it('keeps degenerate global axes finite and centered while retaining exact bin geometry', async () => {
    const bounds = { x: -40, y: -80, width: 0, height: 0 };
    const { minimap } = await setup(snapshot({ bounds, bins: [{ bounds, count: 1_000_000 }] }, bounds));
    expect(map(minimap).getAttribute('viewBox')).to.equal('-40.5 -80.5 1 1');
    const bin = minimap.shadowRoot!.querySelector('[part="aggregate-bin"]')!;
    expect(bin.getAttribute('x')).to.equal('-40');
    expect(bin.getAttribute('width')).to.equal('0');
    expect(hit(minimap).getAttribute('width')).to.equal('320');
  });

  it('rejects an old subscription after reconnecting to the same canvas', async () => {
    const { minimap, canvas, initialPublish } = await setup(snapshot(null));
    minimap.remove(); canvas.append(minimap); await minimap.updateComplete;
    initialPublish(snapshot({ bounds: world, bins: [{ bounds: world, count: 1_000_000 }] }));
    await minimap.updateComplete;
    expect(minimap.shadowRoot!.querySelectorAll('[part="aggregate-bin"]').length).to.equal(0);
    expect(minimap.shadowRoot!.querySelector('[part="source-unavailable"]') !== null).to.equal(true);
  });

  it('rejects detached controls and preserves source framing after resize', async () => {
    const { minimap, canvas, calls } = await setup(snapshot(null));
    const oldMap = map(minimap);
    const oldHit = hit(minimap);
    minimap.remove(); await minimap.updateComplete;
    canvas.append(minimap); await minimap.updateComplete;
    oldMap.dispatchEvent(new MouseEvent('click'));
    oldHit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(calls.length).to.equal(0);
    minimap.style.inlineSize = '300px';
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => requestAnimationFrame(resolve));
    const point = map(minimap).createSVGPoint(); point.x = 2500; point.y = 1000;
    const client = point.matrixTransform(map(minimap).getScreenCTM()!);
    map(minimap).dispatchEvent(new MouseEvent('click', { clientX: client.x, clientY: client.y }));
    const pixel = world.width / map(minimap).getBoundingClientRect().width;
    expect(calls[0]!.x).to.be.closeTo(-2340, pixel);
    expect(calls[0]!.y).to.be.closeTo(-900, pixel);
    expect(minimap.getBoundingClientRect().width).to.be.at.most(320);
    await expect(minimap).to.be.accessible();
  });


  it('drags in world coordinates and cancels the gesture when its source extent changes', async () => {
    const initial = snapshot(null);
    const { minimap, calls, publish } = await setup({ ...initial, viewport: { ...initial.viewport, zoom: 2 } });
    const target = hit(minimap);
    target.setPointerCapture = () => {};
    const scale = map(minimap).getScreenCTM()!.a;
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: 20, clientY: 20, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 30, clientY: 25 }));
    expect(calls.length).to.equal(1);
    expect(calls[0]!.x).to.be.closeTo(-20 / scale, 0.01);
    expect(calls[0]!.y).to.be.closeTo(-10 / scale, 0.01);
    const refreshed = snapshot(null, { ...world });
    publish({ ...refreshed, viewport: { ...refreshed.viewport, zoom: 2 } });
    await minimap.updateComplete;
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 40, clientY: 30 }));
    expect(calls.length).to.equal(2);
    publish(snapshot(null, { ...world, width: 20000 }));
    await minimap.updateComplete;
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 50, clientY: 40 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
    expect(calls.length).to.equal(2);
    expect(map(minimap).getAttribute('viewBox')).to.equal('-5000 -2000 20000 4000');
  });


  it('preserves positive fractional world extents and centers their physical map', async () => {
    const bounds = { x: -0.5, y: -0.25, width: 0.25, height: 0.5 };
    const { minimap, calls } = await setup(snapshot(null, bounds));
    expect(map(minimap).getAttribute('viewBox')).to.equal('-0.5 -0.25 0.25 0.5');
    const rect = map(minimap).getBoundingClientRect();
    map(minimap).dispatchEvent(new MouseEvent('click', { clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    expect(calls[0]!.x).to.be.closeTo(160.375, 0.02);
    expect(calls[0]!.y).to.be.closeTo(100, 0.02);
  });

  for (const capability of ['readonly', 'setViewport'] as const) {
    it(`rejects a click after ${capability} getter reparents the minimap`, async () => {
      const first = await setup(snapshot(null));
      const second = await setup(snapshot(null));
      let armed = true;
      let oldCalls = 0;
      Object.defineProperty(first.canvas, capability, { configurable: true, get() {
        if (armed) { armed = false; second.canvas.append(first.minimap); }
        return capability === 'readonly' ? false : () => { oldCalls++; };
      } });
      map(first.minimap).dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40 }));
      await first.minimap.updateComplete;
      expect(first.calls.length).to.equal(0);
      expect(second.calls.length).to.equal(0);
      expect(oldCalls).to.equal(0);
    });
  }


  it('preserves tiny positive source axes when endpoint arithmetic rounds to the origin', async () => {
    const bounds = { x: 1000000, y: -1000000, width: 1e-12, height: 1e-12 };
    const { minimap } = await setup(snapshot(null, bounds));
    expect(map(minimap).getAttribute('viewBox')).to.equal('1000000 -1000000 1e-12 1e-12');
  });

});
