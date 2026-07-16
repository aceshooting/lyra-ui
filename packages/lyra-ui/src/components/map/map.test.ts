import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './map.js';
import type { LyraMap } from './map.js';

const RASTER_STYLE = {
  version: 8,
  sources: {
    demo: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
    },
  },
  layers: [{ id: 'demo', type: 'raster', source: 'demo' }],
};

it('shows a loading skeleton and aria-busy while maplibre-gl loads, then swaps to the container', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="container"]')).to.not.exist;

  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
});

it('constructs a maplibregl.Map and exposes it via the map getter', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(el.map).to.exist;
});

it('does not construct the underlying maplibregl.Map (and its WebGL context) until the element is observed intersecting the viewport', async () => {
  // A real IntersectionObserver already reports this test's fixture-mounted
  // element as intersecting almost immediately (it's actually on-screen in
  // the headless test page), which would make this scenario impossible to
  // reproduce deterministically. Swap in a fully fake observer instead --
  // one that never delivers a real notification on its own -- so this test
  // controls exactly when (and whether) intersection is reported, the same
  // spy-the-observer-constructor technique lite-chart.test.ts uses for
  // ResizeObserver, but stubbed rather than extending the real class since
  // the real class's own genuine observation is exactly what must be ruled
  // out here.
  const observedTargets: Element[] = [];
  const callbacks: IntersectionObserverCallback[] = [];
  const OriginalIO = window.IntersectionObserver;
  class FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      callbacks.push(callback);
    }
    observe(target: Element): void {
      observedTargets.push(target);
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;

  try {
    const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
    el.mapStyle = RASTER_STYLE;
    await el.updateComplete;
    expect(observedTargets).to.include(el);

    // maplibre-gl itself loads regardless of visibility -- only the actual
    // `new Map()` construction is gated on it -- so the container renders
    // (loading flips false) even though no intersection has been reported.
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="container"]') != null,
      'container never rendered',
      { timeout: 2000 },
    );
    // Let the microtask queue drain so connectedCallback()'s own internal
    // `await this.updateComplete` (which runs tryConstructMap() right after)
    // has had its chance to run and bail on `!this.visible`.
    await el.updateComplete;
    expect(el.map).to.be.undefined;

    // Now simulate the element scrolling into view.
    callbacks[0]([{ isIntersecting: true } as unknown as IntersectionObserverEntry], new OriginalIO(() => {}));
    await waitUntil(() => el.map != null, 'map never constructed after becoming visible', { timeout: 2000 });
    expect(el.map).to.exist;
  } finally {
    (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = OriginalIO;
  }
});

it('calls setCenter/setZoom on the underlying map when center/zoom change after mount', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  let centerArg: unknown;
  let zoomArg: unknown;
  el.map!.setCenter = ((c: unknown) => {
    centerArg = c;
    return el.map;
  }) as typeof el.map.setCenter;
  el.map!.setZoom = ((z: unknown) => {
    zoomArg = z;
    return el.map;
  }) as typeof el.map.setZoom;

  el.center = [3, 4];
  el.zoom = 7;
  await el.updateComplete;

  expect(centerArg).to.deep.equal([3, 4]);
  expect(zoomArg).to.equal(7);
});

it('does not leak a second maplibregl.Map when disconnected and reconnected before the loader promise resolves', async () => {
  const el = document.createElement('lyra-map') as LyraMap;
  el.mapStyle = RASTER_STYLE;
  // Disconnect + reconnect synchronously, in the same tick as the initial
  // connect — before the (cached) loadMaplibre() promise has any chance to
  // settle — to reproduce a fast remount racing the lazy-loaded peer dep.
  document.body.appendChild(el);
  document.body.removeChild(el);
  document.body.appendChild(el);

  try {
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

    // Only the final (reconnected) attempt should have constructed a live
    // maplibregl.Map/canvas — the superseded attempt(s) must never have
    // constructed their own Map against the same container.
    expect(el.shadowRoot!.querySelectorAll('.maplibregl-canvas').length).to.equal(1);
  } finally {
    el.remove();
  }
});

it('fires lyra-map-load once the underlying map loads', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  let fired = false;
  el.addEventListener('lyra-map-load', () => (fired = true));
  el.map!.fire('load');
  expect(fired).to.be.true;
});

it('renders a legend swatch per entry', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.legend = [
    { color: '#f00', label: 'High' },
    { color: '#0f0', label: 'Low' },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(2);
});

it('does not let a LegendEntry.color value inject extra CSS declarations via the swatch style attribute', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.legend = [{ color: 'red; position: fixed; top: 0px', label: 'Bad' }];
  await el.updateComplete;
  const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
  // Read the parsed inline style declaration directly — this is what actually
  // detects a second CSS declaration having been injected into the style
  // attribute via string concatenation.
  expect(swatch.style.position).to.equal('');
  expect(swatch.style.top).to.equal('');
});

it('does not accept a non-color CSS value (e.g. url()) as a legend swatch background', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.legend = [{ color: 'url(https://attacker.example/beacon.gif)', label: 'Bad' }];
  await el.updateComplete;
  const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
  expect(swatch.style.background).to.equal('');
});

it('does not render the legend panel when legend is empty (the default)', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  await el.updateComplete;
  // A Lit template's own whitespace/comment nodes mean `[part="legend"]:empty` in CSS
  // never matches (it always has child nodes), so the panel must be omitted from the
  // render output entirely rather than hidden via an `:empty` selector.
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
});

it('renders the legend panel once entries are set, and removes it again once cleared', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.legend = [{ color: '#f00', label: 'High' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.exist;

  el.legend = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
});

describe('aria-label forwarding', () => {
  it('falls back to the localized default when neither label nor a host aria-label is set', async () => {
    const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Map');
  });

  it('uses a .strings override for the localized default when neither label nor a host aria-label is set', async () => {
    const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
    el.strings = { map: 'Carte' };
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Carte');
  });

  it('uses the label prop when set', async () => {
    const el = (await fixture(html`<lyra-map label="Delivery regions"></lyra-map>`)) as LyraMap;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Delivery regions');
  });

  it('forwards a host aria-label attribute onto [part="base"] when label is unset', async () => {
    const el = (await fixture(html`<lyra-map aria-label="Forwarded label"></lyra-map>`)) as LyraMap;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Forwarded label');
  });

  it('prefers the forwarded host aria-label over the label prop when both are set', async () => {
    const el = (await fixture(
      html`<lyra-map label="Delivery regions" aria-label="Forwarded label"></lyra-map>`,
    )) as LyraMap;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Forwarded label');
  });
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  el.legend = [
    { color: '#f00', label: 'High' },
    { color: '#0f0', label: 'Low' },
  ];
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await expect(el).to.be.accessible();
});

it('adds a choropleth source + fill layer, and re-applies the color expression on update', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('demo-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('demo-choropleth-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  expect(el.map!.getSource('demo-choropleth')).to.exist;
  expect(el.map!.getPaintProperty('demo-choropleth-fill', 'fill-color')).to.deep.equal([
    'interpolate',
    ['linear'],
    ['get', 'value'],
    0,
    '#000000',
    10,
    '#ffffff',
  ]);

  // Same sourceId, different stops — the fill-color expression must be re-applied,
  // not just the underlying GeoJSON data.
  el.choropleth = choropleth('demo-choropleth', [
    [0, '#111111'],
    [10, '#eeeeee'],
  ]);
  await el.updateComplete;
  await waitUntil(
    () => {
      const expr = el.map!.getPaintProperty('demo-choropleth-fill', 'fill-color') as unknown[];
      return expr[4] === '#111111';
    },
    'fill-color expression never updated',
    { timeout: 2000 },
  );

  expect(el.map!.getPaintProperty('demo-choropleth-fill', 'fill-color')).to.deep.equal([
    'interpolate',
    ['linear'],
    ['get', 'value'],
    0,
    '#111111',
    10,
    '#eeeeee',
  ]);
});

it('does not mark an empty-stops choropleth as applied, so a later non-empty update for the same sourceId still creates the fill layer', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('empty-stops', []);
  await el.updateComplete;

  // An empty `stops` array can't build a valid `interpolate` expression, so no
  // fill layer should be considered applied for it.
  expect(el.map!.getLayer('empty-stops-fill')).to.not.exist;

  el.choropleth = choropleth('empty-stops', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(
    () => el.map!.getLayer('empty-stops-fill') != null,
    'layer never added once stops became non-empty',
    { timeout: 2000 },
  );

  expect(el.map!.getSource('empty-stops')).to.exist;
  expect(el.map!.getPaintProperty('empty-stops-fill', 'fill-color')).to.deep.equal([
    'interpolate',
    ['linear'],
    ['get', 'value'],
    0,
    '#000000',
    10,
    '#ffffff',
  ]);
});

it('adds the choropleth GeoJSON source without promoteId, so a top-level Feature.id is preserved instead of requiring a duplicate properties.id', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  let addSourceOptions: unknown;
  const originalAddSource = el.map!.addSource.bind(el.map);
  el.map!.addSource = ((id: string, options: unknown) => {
    addSourceOptions = options;
    return originalAddSource(id, options as never);
  }) as typeof el.map.addSource;

  el.choropleth = choropleth('promote-id-check', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getSource('promote-id-check') != null, 'source never added', {
    timeout: 2000,
  });

  expect(addSourceOptions).to.not.have.property('promoteId');
});

it('fires lyra-map-click with the lngLat and no feature when there is no choropleth', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lyra-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 1, lat: 2 }, point: { x: 0, y: 0 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([1, 2]);
  expect(detail!.feature).to.be.undefined;
});

it('attaches the clicked choropleth feature to lyra-map-click when one exists at the point', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('click-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('click-choropleth-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  // queryRenderedFeatures requires the layer to actually be painted on screen,
  // which real raster/vector tiles aren't guaranteed to be in a headless test —
  // stub it to deterministically simulate a hit under the click point.
  const fakeFeature = {
    type: 'Feature',
    properties: { value: 5 },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
  el.map!.queryRenderedFeatures = (() => [fakeFeature]) as typeof el.map.queryRenderedFeatures;

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lyra-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 3, lat: 4 }, point: { x: 10, y: 10 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([3, 4]);
  expect(detail!.feature).to.equal(fakeFeature);
});

it('does not query the choropleth fill layer on click before it has been added to the style', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  // Set choropleth immediately — before the map's 'load' event has fired — so
  // applyChoropleth() hasn't run yet and the `-fill` layer doesn't exist.
  el.choropleth = choropleth('early-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(el.map!.getLayer('early-choropleth-fill')).to.not.exist;

  let queried = false;
  const original = el.map!.queryRenderedFeatures.bind(el.map);
  el.map!.queryRenderedFeatures = ((...args: Parameters<typeof original>) => {
    queried = true;
    return original(...args);
  }) as typeof el.map.queryRenderedFeatures;

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lyra-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 5, lat: 6 }, point: { x: 0, y: 0 } });

  // Querying a layer id that doesn't exist yet in the style fires a maplibre-gl
  // error event; the click handler must check the layer exists first instead.
  expect(queried).to.be.false;
  expect(detail).to.exist;
  expect(detail!.feature).to.be.undefined;
});

it('removes the choropleth layer and source when choropleth is cleared', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('regions', [
    [0, '#fff'],
    [10, '#000'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('regions-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  expect(el.map!.getLayer('regions-fill')).to.exist;
  expect(el.map!.getSource('regions')).to.exist;

  el.choropleth = undefined;
  await el.updateComplete;

  expect(el.map!.getLayer('regions-fill')).to.not.exist;
  expect(el.map!.getSource('regions')).to.not.exist;
});

it('removes the old choropleth layer/source when sourceId changes', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('regions-a', [
    [0, '#fff'],
    [10, '#000'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('regions-a-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  el.choropleth = choropleth('regions-b', [
    [0, '#fff'],
    [10, '#000'],
  ]);
  await el.updateComplete;

  expect(el.map!.getLayer('regions-a-fill')).to.not.exist;
  expect(el.map!.getSource('regions-a')).to.not.exist;
  expect(el.map!.getLayer('regions-b-fill')).to.exist;
  expect(el.map!.getSource('regions-b')).to.exist;
});

it('calls setStyle when mapStyle changes after the map has mounted', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  let calledWith: unknown;
  el.map!.setStyle = ((style: unknown) => {
    calledWith = style;
    return el.map;
  }) as typeof el.map.setStyle;

  const NEXT_STYLE = { ...RASTER_STYLE, sources: { demo2: RASTER_STYLE.sources.demo } };
  el.mapStyle = NEXT_STYLE as typeof RASTER_STYLE;
  await el.updateComplete;

  expect(calledWith).to.equal(NEXT_STYLE);
});

it('accepts the string style-URL form of mapStyle and passes it through to setStyle, not just the StyleSpecification object form', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  let calledWith: unknown;
  el.map!.setStyle = ((style: unknown) => {
    calledWith = style;
    return el.map;
  }) as typeof el.map.setStyle;

  el.mapStyle = 'https://example.test/lyra-map-style.json';
  await el.updateComplete;

  expect(calledWith).to.equal('https://example.test/lyra-map-style.json');
});

it('constructs the underlying maplibregl.Map with a string style-URL mapStyle set from initial mount, and maplibre-gl actually requests and loads it as a style', async () => {
  // Fully stubbed (never touches the real network, so this doesn't depend on
  // outbound network access being available in CI) -- proves the string
  // flowed all the way into maplibre-gl's own style-loading request and
  // successfully loaded, not merely that `new Map({ style })` accepted a
  // string without throwing synchronously.
  const requestedUrls: string[] = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('lyra-map-style.json')) {
      requestedUrls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(RASTER_STYLE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;

  const el = document.createElement('lyra-map') as LyraMap;
  el.mapStyle = 'https://example.test/lyra-map-style.json';
  document.body.appendChild(el);
  try {
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    await waitUntil(
      () => requestedUrls.length > 0,
      'the string mapStyle was never requested as a style',
      { timeout: 2000 },
    );
    await waitUntil(
      () => el.map!.isStyleLoaded(),
      'the style loaded from the string mapStyle never finished loading',
      { timeout: 2000 },
    );
  } finally {
    el.remove();
    window.fetch = originalFetch;
  }
});

it('re-applies the choropleth once the new style finishes loading after a mapStyle change', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('style-reload', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('style-reload-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  // A real setStyle() call wipes every layer/source maplibre-gl knows about;
  // once its own 'style.load' fires, the previously-applied choropleth must
  // be re-added rather than left missing. (Keeps the same "demo" source id
  // so the new style itself is valid — only the raster layer's paint
  // changes — unlike the sibling "calls setStyle..." test above, which
  // stubs setStyle() out entirely and so never actually applies its
  // mismatched source/layer ids.)
  const NEXT_STYLE = {
    ...RASTER_STYLE,
    layers: [{ id: 'demo', type: 'raster', source: 'demo', paint: { 'raster-opacity': 0.9 } }],
  };
  el.mapStyle = NEXT_STYLE as typeof RASTER_STYLE;
  await el.updateComplete;

  await waitUntil(() => el.map!.getLayer('style-reload-fill') != null, 'choropleth never re-applied', {
    timeout: 2000,
  });
  expect(el.map!.getSource('style-reload')).to.exist;
});

it('adds a maplibregl.Marker per entry in markers', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    { id: 'a', lngLat: [10, 20], label: 'Station A' },
    { id: 'b', lngLat: [11, 21], label: 'Station B' },
  ];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(2);
});

it('removes markers no longer present and reuses markers that persist', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    { id: 'a', lngLat: [10, 20] },
    { id: 'b', lngLat: [11, 21] },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(2);

  el.markers = [{ id: 'a', lngLat: [10, 20] }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(1);
});

it('updates the reused marker popup when label changes for a persisting id', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20], label: 'Station A' }];
  await el.updateComplete;

  el.markers = [{ id: 'a', lngLat: [10, 20], label: 'Station A renamed' }];
  await el.updateComplete;
  // Same id must reuse the marker instance, not remove/recreate it.
  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(1);

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  expect(el.shadowRoot!.querySelector('.maplibregl-popup-content')!.textContent).to.contain(
    'Station A renamed',
  );
});

it('updates the reused marker popup when unsafeHtml changes for a persisting id', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20], unsafeHtml: '<strong>Station A</strong>' }];
  await el.updateComplete;

  el.markers = [{ id: 'a', lngLat: [10, 20], unsafeHtml: '<strong>Station A2</strong>' }];
  await el.updateComplete;

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  expect(el.shadowRoot!.querySelector('.maplibregl-popup-content')!.textContent).to.contain('Station A2');
});

it('attaches an openable popup when label or html is provided', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20], label: 'Station A' }];
  await el.updateComplete;

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  expect(el.shadowRoot!.querySelector('.maplibregl-popup-content')!.textContent).to.contain('Station A');
});

it('removes all marker DOM on disconnect', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');
  el.markers = [{ id: 'a', lngLat: [10, 20] }];
  await el.updateComplete;
  const shadowRoot = el.shadowRoot!;
  expect(shadowRoot.querySelectorAll('.maplibregl-marker').length).to.equal(1);

  el.remove();

  expect(shadowRoot.querySelectorAll('.maplibregl-marker').length).to.equal(0);
});

it('renders a colored marker and an html popup', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20], color: '#ff0000', unsafeHtml: '<strong>Station A</strong>' }];
  await el.updateComplete;

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  expect(markerEl).to.exist;
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  const popupContent = el.shadowRoot!.querySelector('.maplibregl-popup-content')!;
  expect(popupContent.querySelector('strong')).to.exist;
  expect(popupContent.textContent).to.contain('Station A');
});

it('does not throw or leave a dangling marker when the element disconnects while applyMarkers is running', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20] }];

  // Invoke the internal marker-sync routine directly -- the same routine
  // `updated()` and the map's 'load' handler call fire-and-forget -- and
  // disconnect the element immediately after, in the same synchronous tick.
  // Before the fix, this routine re-awaited `loadMaplibre()` internally, which
  // always yields at least one microtask even once the module is cached;
  // resuming from that await after a disconnect had cleared `this._map`
  // threw (`marker.addTo(undefined)` dereferences the map), rejecting the
  // promise this call returned. Now the routine is fully synchronous, so no
  // such window -- or rejection -- exists; awaiting its (non-)result here
  // must not throw.
  const pending = (el as unknown as { applyMarkers(): Promise<void> | void }).applyMarkers();
  el.remove();

  await pending;
});

it("updates an existing marker's color when it changes", async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [0, 0], color: '#ff0000' }];
  await el.updateComplete;
  const instances = (
    el as unknown as { _markerInstances: Map<string, { getElement(): HTMLElement }> }
  )._markerInstances;
  // Confirm the marker was actually constructed with the original color first,
  // so the assertion below is verifying an in-place update rather than
  // coincidentally matching a marker that was only ever created once.
  expect(instances.get('a')!.getElement().innerHTML).to.include('ff0000');

  el.markers = [{ id: 'a', lngLat: [0, 0], color: '#00ff00' }];
  await el.updateComplete;
  const marker = instances.get('a')!;
  // maplibre-gl's default marker SVG carries the fill on its path -- assert the
  // instance was told about the new color rather than left at construction-time red.
  expect(marker.getElement().innerHTML).to.include('00ff00');
});

it('does not collide two id-less markers placed at the same coordinates', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    { lngLat: [1, 1], label: 'first' },
    { lngLat: [1, 1], label: 'second' },
  ];
  await el.updateComplete;
  const instances = (el as unknown as { _markerInstances: Map<string, unknown> })._markerInstances;
  expect(instances.size).to.equal(2);
});

function choropleth(sourceId: string, stops: [number, string][]) {
  return {
    sourceId,
    field: 'value',
    stops,
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { value: 5 },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    },
  } as unknown as import('./map.js').ChoroplethLayer;
}
