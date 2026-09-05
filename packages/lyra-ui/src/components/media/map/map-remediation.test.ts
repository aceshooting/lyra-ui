import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './map.js';
import type { LyraMap } from './map.js';

async function connectedMap(): Promise<{ wrapper: HTMLElement; el: LyraMap }> {
  const wrapper = await fixture<HTMLElement>(html`<div style="--stop-a: rgb(1, 2, 3); --stop-b: rgb(4, 5, 6); --step-base: rgb(7, 8, 9);"></div>`);
  const el = document.createElement('lr-map');
  (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = () => new Promise(() => {});
  wrapper.append(el);
  await el.updateComplete;
  return { wrapper, el };
}

for (const direction of ['ltr', 'rtl']) {
  for (const peerClass of ['maplibregl-marker', 'maplibregl-popup']) {
    it(`keeps the ${peerClass} transform at the physical map origin in ${direction}`, async () => {
      const { wrapper, el } = await connectedMap();
      wrapper.dir = direction;
      const container = document.createElement('div');
      container.style.cssText = 'display: block; position: relative; width: 320px; height: 200px;';
      el.shadowRoot!.append(container);
      const overlay = document.createElement('div');
      overlay.className = peerClass;
      // Peer marker/popup transforms translate from the physical top-left canvas origin.
      overlay.style.cssText = 'width: 40px; height: 24px; transform: translate(-50%, -100%) translate(80px, 100px);';
      container.append(overlay);
      const mapRect = container.getBoundingClientRect();
      const rect = overlay.getBoundingClientRect();
      expect(rect.left + rect.width / 2 - mapRect.left).to.be.closeTo(80, 0.1);
      expect(rect.bottom - mapRect.top).to.be.closeTo(100, 0.1);
      expect(getComputedStyle(overlay).direction).to.equal(direction);
    });
  }
}

for (const interpolation of ['linear', 'logarithmic', 'step'] as const) {
  for (const explicitBase of interpolation === 'step' ? [false, true] : [false]) {
    it(`refreshes canonical ${interpolation} stop colors on ancestor changes (explicit base ${explicitBase})`, async () => {
      const { wrapper, el } = await connectedMap();
      el.choropleth = {
        sourceId: 'regions', field: 'value', interpolation,
        geojson: { type: 'FeatureCollection', features: [] },
        stops: [[1, 'var(--stop-a)'], [10, 'var(--stop-b)']],
        ...(explicitBase ? { stepBaseColor: 'var(--step-base)' } : {}),
      };
      await el.updateComplete;
      await aTimeout(0);
      const nonPaint: string[] = [];
      const colors: unknown[] = [];
      const opacity: unknown[] = [];
      let addedLayer: { paint: Record<string, unknown> } | undefined;
      const peer = {
        getSource() { nonPaint.push('getSource'); return undefined; },
        addSource() { nonPaint.push('addSource'); },
        getLayer() { nonPaint.push('getLayer'); return addedLayer; },
        addLayer(layer: { paint: Record<string, unknown> }) { nonPaint.push('addLayer'); addedLayer = layer; },
        setPaintProperty(_id: string, name: string, value: unknown) {
          if (name === 'fill-color') colors.push(value);
          if (name === 'fill-opacity') opacity.push(value);
        },
        remove() {},
      };
      const internal = el as unknown as { _map: unknown; _styleLoaded: boolean; applyChoropleth(): void };
      internal._map = peer;
      internal._styleLoaded = true;
      internal.applyChoropleth();
      const initial = addedLayer!.paint['fill-color'];
      const before = JSON.stringify(initial);
      expect(before).to.include('rgb(1, 2, 3)');
      expect(before).to.include('rgb(4, 5, 6)');
      nonPaint.length = 0;
      wrapper.setAttribute('data-lr-theme', 'dark');
      wrapper.style.setProperty('--stop-a', 'rgb(11, 12, 13)');
      wrapper.style.setProperty('--stop-b', 'rgb(14, 15, 16)');
      wrapper.style.setProperty('--step-base', 'rgb(17, 18, 19)');
      wrapper.style.setProperty('--lr-map-choropleth-fill-opacity', '0.42');
      await waitUntil(() => colors.length > 0, 'theme change should repaint the choropleth colors');
      const expression = colors[colors.length - 1] as unknown[];
      const expectedStops = [1, 'rgb(11, 12, 13)', 10, 'rgb(14, 15, 16)'];
      expect(expression).to.deep.equal(interpolation === 'step'
        ? ['step', ['get', 'value'], explicitBase ? 'rgb(17, 18, 19)' : 'rgb(11, 12, 13)', ...expectedStops]
        : ['interpolate', (initial as unknown[])[1], ['get', 'value'], ...expectedStops]);
      expect(opacity[opacity.length - 1]).to.equal(0.42);
      expect(nonPaint).to.deep.equal([]);
      expect(internal._map === peer).to.equal(true);
      wrapper.remove();
    });
  }
}
