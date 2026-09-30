import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraMap, LyraMapInstance } from './map.class.js';
import './map.js';

const blankStyle = { version: 8 as const, sources: {}, layers: [] };

it('skips a throwing hidden category without hiding later valid legend rows', async () => {
  const categories = ['broken', 'valid'];
  Object.defineProperty(categories, '0', { get() { throw new Error('caller category unavailable'); } });
  const element = await fixture<LyraMap>(html`<lr-map legend-interactive legend-control-role="checkbox"
    .legend=${[{ label: 'Valid', value: 'valid', color: '#ff0000', pattern: 'solid' }]}
    .hiddenCategories=${categories}></lr-map>`);
  await element.updateComplete;
  expect(element.hiddenCategories).to.deep.equal(['valid']);
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="legend-toggle"]');
  expect(row?.textContent).to.include('Valid');
  expect(row?.getAttribute('aria-checked')).to.equal('false');
});

it('renders duplicate logarithmic gradient positions and recovers after a revoked assignment', async () => {
  const element = await fixture<LyraMap>(html`<lr-map
    .choropleth=${{ sourceId: 'density', geojson: { type: 'FeatureCollection', features: [] }, field: 'density', interpolation: 'logarithmic', stops: [] }}
    .legendGradient=${[[0, '#000000'], [0, '#ff0000'], [10, '#ffffff']]}></lr-map>`);
  await element.updateComplete;
  const gradient = element.shadowRoot!.querySelector<HTMLElement>('[part="legend-gradient"]')!;
  expect(getComputedStyle(gradient).backgroundImage).to.include('rgb(255, 0, 0) 0%');
  expect(getComputedStyle(gradient).backgroundImage).to.include('100%');
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  element.legendGradient = revoked.proxy;
  await element.updateComplete;
  expect(element.legendGradient.length).to.equal(0);
  expect(element.shadowRoot!.querySelectorAll('[part="legend-gradient"]').length).to.equal(0);
  element.legendGradient = [[0, '#000000'], [10, '#ffffff']];
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="legend-gradient"]').length).to.equal(1);
});

it('contains a public peer fit failure and recovers after the required style is restored', async function () {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) this.skip();
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'width:320px;height:200px';
  element.mapStyle = blankStyle;
  const loaded = oneEvent(element, 'lr-map-load');
  document.body.append(element);
  try {
    await loaded;
    const peer = element.map as LyraMapInstance & { fitBounds: (...args: unknown[]) => unknown };
    const fit = peer.fitBounds;
    peer.fitBounds = () => { throw new Error('peer cannot fit this allocation'); };
    try {
      expect(element.fitBounds([[0, 0], [1, 1]], { animate: false })).to.equal(false);
    } finally {
      peer.fitBounds = fit;
    }
    expect(element.fitBounds([[0, 0], [1, 1]], { animate: false })).to.equal(true);
    // A valid style restored between the Lit update and its deferred failure supersedes removal.
    element.mapStyle = undefined;
    await new Promise<void>((resolve) => queueMicrotask(() => { element.mapStyle = blankStyle; resolve(); }));
    await element.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(element.map === peer).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    element.mapStyle = undefined;
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]')?.textContent?.includes('style') === true);
    expect(element.map).to.equal(undefined);
    const restored = oneEvent(element, 'lr-map-load');
    element.mapStyle = blankStyle;
    await restored;
    expect(element.map !== undefined).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    const reconnected = oneEvent(element, 'lr-map-load');
    element.mapStyle = undefined;
    await new Promise<void>((resolve) => queueMicrotask(() => {
      element.remove();
      element.mapStyle = blankStyle;
      document.body.append(element);
      resolve();
    }));
    await reconnected;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(element.map !== undefined).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally {
    element.remove();
  }
});
