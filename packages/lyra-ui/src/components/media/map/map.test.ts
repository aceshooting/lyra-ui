import { aTimeout, fixture, expect, html, waitUntil } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './map.js';
import type { LyraMap } from './map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

// maplibre-gl requires a real WebGL2 context; headless Firefox/WebKit in CI don't reliably
// provide one (unlike Chromium's software rasterizer), so any test that needs a map to actually
// construct is meaningless there -- skip rather than fail on an environment limitation this suite
// can't control. The component's own supportsWebGL2() guard (map.class.ts) is covered separately,
// below, by forcing this same detection to report unsupported regardless of the real engine.
const hasWebGL2 = (() => {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
})();

function assertiveAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  );
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

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

/** Connects a map without allowing its optional peer to construct a real WebGL map. */
async function connectedMapWithoutMaplibre(style = ''): Promise<{ wrapper: HTMLElement; el: LyraMap }> {
  const wrapper = (await fixture(html`<div style=${style}></div>`)) as HTMLElement;
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => new Promise(() => {});
  wrapper.append(el);
  await el.updateComplete;
  return { wrapper, el };
}

it('shows a loading skeleton and aria-busy while maplibre-gl loads, then swaps to the container', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(
    html`<lr-map .strings=${{ loading: 'Chargement de la carte…' }}></lr-map>`,
  )) as LyraMap;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const skeleton = el.shadowRoot!.querySelector('lr-skeleton')!;
  expect(skeleton !== null).to.be.true;
  const updatedSkeleton = skeleton as HTMLElement & {
    announce: boolean;
    updateComplete: Promise<unknown>;
  };
  await updatedSkeleton.updateComplete;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(base.getAttribute('aria-busy')).to.equal('true');
  expect(updatedSkeleton.announce).to.be.false;
  expect(
    el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length,
  ).to.equal(0);
  expect(
    updatedSkeleton.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]')
      .length,
  ).to.equal(0);
  expect(el.shadowRoot!.querySelector('.sr-only')?.textContent?.trim()).to.equal(
    'Chargement de la carte…',
  );
  expect(el.shadowRoot!.querySelectorAll('[part="container"]').length).to.equal(0);

  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  expect(el.getAttribute('aria-busy')).to.equal('false');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('false');
  expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
});

it('constructs a maplibregl.Map and exposes it via the map getter', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(el.map).to.exist;
});

it('does not construct the underlying maplibregl.Map (and its WebGL context) until the element is observed intersecting the viewport', async function () {
  if (!hasWebGL2) this.skip();
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
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('uses the adopted owner realm for intersection observation, token reads, and teardown', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const originalIntersectionObserver = Object.getOwnPropertyDescriptor(
    frameWindow,
    'IntersectionObserver',
  );
  let observerConstructions = 0;
  let observerDisconnects = 0;
  let observedInOwnerRealm = false;
  class OwnerIntersectionObserver {
    constructor(_callback: IntersectionObserverCallback) {
      observerConstructions += 1;
    }
    observe(target: Element): void {
      observedInOwnerRealm = target.ownerDocument === frameDocument;
    }
    unobserve(): void {}
    disconnect(): void {
      observerDisconnects += 1;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  Object.defineProperty(frameWindow, 'IntersectionObserver', {
    configurable: true,
    value: OwnerIntersectionObserver,
  });

  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
    new Promise(() => {});
  try {
    document.body.append(el);
    await el.updateComplete;
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(observerConstructions).to.equal(1);
    expect(observedInOwnerRealm).to.be.true;

    let addedLayer: { paint?: { 'fill-opacity'?: number } } | undefined;
    const fakeMap = {
      remove(): void {},
      getSource(): undefined {
        return undefined;
      },
      addSource(): void {},
      getLayer(): undefined {
        return undefined;
      },
      addLayer(layer: { paint?: { 'fill-opacity'?: number } }): void {
        addedLayer = layer;
      },
    };
    const originalGetComputedStyleDescriptor = Object.getOwnPropertyDescriptor(
      frameWindow,
      'getComputedStyle',
    );
    const originalGetComputedStyle = frameWindow.getComputedStyle.bind(frameWindow);
    let ownerStyleReads = 0;
    Object.defineProperty(frameWindow, 'getComputedStyle', {
      configurable: true,
      value: (element: Element, pseudo?: string | null) => {
        ownerStyleReads += 1;
        const style = originalGetComputedStyle(element, pseudo);
        return new Proxy(style, {
          get(target, property) {
            if (property === 'getPropertyValue') {
              return (name: string) =>
                name === '--lr-map-choropleth-fill-opacity'
                  ? '0.42'
                  : target.getPropertyValue(name);
            }
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    });
    try {
      const privateMap = el as unknown as {
        _map?: typeof fakeMap;
        applyChoropleth(): void;
      };
      privateMap._map = fakeMap;
      el.choropleth = choropleth('owner-realm', [[0, '#000000']]);
      privateMap.applyChoropleth();
      expect(ownerStyleReads).to.be.greaterThan(0);
      expect(addedLayer?.paint?.['fill-opacity']).to.equal(0.42);
      privateMap._map = undefined;
    } finally {
      if (originalGetComputedStyleDescriptor) {
        Object.defineProperty(frameWindow, 'getComputedStyle', originalGetComputedStyleDescriptor);
      } else {
        delete (frameWindow as unknown as { getComputedStyle?: typeof getComputedStyle })
          .getComputedStyle;
      }
    }
  } finally {
    el.remove();
    if (originalIntersectionObserver) {
      Object.defineProperty(frameWindow, 'IntersectionObserver', originalIntersectionObserver);
    } else {
      delete (frameWindow as unknown as { IntersectionObserver?: typeof IntersectionObserver })
        .IntersectionObserver;
    }
    iframe.remove();
    expect(observerDisconnects).to.equal(1);
  }
});

// Regression coverage for the lifecycle-optional-peer-missing-fails-silently defect class --
// when the optional peer `maplibre-gl` fails to load, <lr-map> must fail closed into a visible,
// accessible error state instead of silently rendering an empty container with no on-page
// indication anything is wrong. Its interrupting announcement belongs in the pre-mounted shared
// light-DOM sink, not in a shadow-root live region.
it('renders a visible, accessible error state instead of a blank container when the maplibre-gl peer fails to load', async () => {
  // Deliberately not using `fixture()` (which connects the element and fires its own real
  // connectedCallback() immediately): `loadLibrary` must be overridden *before* the element ever
  // connects, since connectedCallback() calls it unconditionally and synchronously on connect --
  // same technique box-plot.test.ts uses for the identical "construct detached, stub the loader,
  // then connect" need.
  const el = document.createElement('lr-map') as unknown as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
  document.body.appendChild(el);
  try {
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'error state never rendered',
      { timeout: 2000 },
    );
    const errorEl = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(errorEl.getAttribute('role')).to.equal(null);
    expect(errorEl.textContent!.trim().length).to.be.greaterThan(0);
    expect(assertiveAnnouncements()).to.deep.equal([errorEl.textContent!.trim()]);
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.map).to.be.undefined;
    expect(el.shadowRoot!.querySelectorAll('[part="container"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
  } finally {
    el.remove();
  }
});

// Regression coverage for a real crash: maplibre-gl doesn't fail construction cleanly when
// WebGL2 is unavailable (a genuine, non-CI-specific browser/hardware limitation) -- it fires a
// GPUInitializationError internally and still returns a Map instance with no `painter`, which
// then throws out of disconnectedCallback()'s `this._map.remove()` as an uncaught error instead of
// a normal, catchable failure. Forces the same detection map.class.ts's supportsWebGL2() uses to
// report unsupported, independent of this engine's real capability, so the assertion is
// deterministic everywhere rather than depending on whether the test runner's own WebGL2 support
// happens to be available.
it('renders the same accessible error state instead of crashing when WebGL2 is unavailable', async () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') return null;
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  try {
    el.mapStyle = RASTER_STYLE;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'error state never rendered',
      { timeout: 2000 },
    );
    expect(el.map).to.be.undefined;
    expect(el.shadowRoot!.querySelectorAll('[part="container"]').length).to.equal(0);
    // The regression: disconnecting must not throw even though a WebGL2-unavailable environment
    // was detected and construction was skipped entirely.
    expect(() => el.remove()).to.not.throw();
  } finally {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }
});

it('fails closed when the WebGL2 capability probe itself throws', async () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let webgl2ProbeCalls = 0;
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') {
        webgl2ProbeCalls++;
        throw new Error('WebGL2 probing is blocked');
      }
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({});
  document.body.append(el);
  try {
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'error state never rendered after a capability-probe failure',
      { timeout: 2000 },
    );
    expect(webgl2ProbeCalls).to.be.greaterThan(0);
    expect(el.map == null).to.be.true;
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelectorAll('[part="container"]').length).to.equal(0);
  } finally {
    el.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }
});

// Regression coverage for the lifecycle-super-call-omitted defect class -- no user-visible
// symptom today, but a future shared updated() behavior on LyraElement would silently never run
// for <lr-map> if its own override shadows the base hook instead of calling it. Scoped by
// tagName (not the fixture()-returned element reference): <lr-map> renders an <lr-skeleton>
// child in its shadow DOM, which itself extends LyraElement directly and overrides updated() on
// its own, so an unscoped check risks conflating a *different* element's own call.
it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
  const original = proto.updated;
  let calledOnSelf = false;
  proto.updated = function (this: LyraElement, changed: PropertyValues): void {
    if (this.tagName === 'LR-MAP') calledOnSelf = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.updated = original;
  }
});

it('calls setCenter/setZoom on the underlying map when center/zoom change after mount', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

// Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
// -- a non-finite/out-of-range `zoom` used to flow straight into the maplibregl.Map constructor's
// `zoom` option and a live `setZoom()` call instead of clamping into the range ([0, 22]) the
// underlying map itself is configured with (no minZoom/maxZoom option is passed here, so those
// are maplibre-gl's own defaults).
it('normalizes a non-finite initial zoom before constructing the underlying maplibregl.Map', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map zoom="NaN"></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(Number.isFinite(el.map!.getZoom())).to.be.true;
});

it('clamps a non-finite/out-of-range zoom passed to setZoom on the live map after mount', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  let zoomArg: unknown;
  el.map!.setZoom = ((z: unknown) => {
    zoomArg = z;
    return el.map;
  }) as typeof el.map.setZoom;

  el.zoom = Number.NaN;
  await el.updateComplete;
  expect(Number.isFinite(zoomArg as number)).to.be.true;

  el.zoom = 999;
  await el.updateComplete;
  expect(zoomArg).to.equal(22);

  el.zoom = -5;
  await el.updateComplete;
  expect(zoomArg).to.equal(0);
});

it('normalizes malformed and out-of-range center values before live map updates', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  let centerArg: unknown;
  el.map!.setCenter = ((center: unknown) => {
    centerArg = center;
    return el.map;
  }) as typeof el.map.setCenter;
  el.center = [Number.POSITIVE_INFINITY, -999];
  await el.updateComplete;
  expect(centerArg).to.deep.equal([0, -90]);
  el.center = ['bad', 25] as unknown as [number, number];
  await el.updateComplete;
  expect(centerArg).to.deep.equal([0, 25]);

  el.center = { longitude: 3, latitude: 4 } as unknown as [number, number];
  await el.updateComplete;
  expect(centerArg).to.deep.equal([0, 0]);
});

it('does not leak a second maplibregl.Map when disconnected and reconnected before the loader promise resolves', async function () {
  if (!hasWebGL2) this.skip();
  const el = document.createElement('lr-map') as LyraMap;
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

it('fires lr-map-load once the underlying map loads', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  let fired = false;
  el.addEventListener('lr-map-load', () => (fired = true));
  el.map!.fire('load');
  expect(fired).to.be.true;
});

it('renders a legend swatch per entry', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.legend = [
    { color: '#f00', label: 'High' },
    { color: '#0f0', label: 'Low' },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(2);
});

it('does not let a LegendEntry.color value inject extra CSS declarations via the swatch style attribute', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.legend = [{ color: 'url(https://attacker.example/beacon.gif)', label: 'Bad' }];
  await el.updateComplete;
  const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
  expect(swatch.style.background).to.equal('');
});

it('does not render the legend panel when legend is empty (the default)', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  await el.updateComplete;
  // A Lit template's own whitespace/comment nodes mean `[part="legend"]:empty` in CSS
  // never matches (it always has child nodes), so the panel must be omitted from the
  // render output entirely rather than hidden via an `:empty` selector.
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
});

it('renders the legend panel once entries are set, and removes it again once cleared', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.legend = [{ color: '#f00', label: 'High' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.exist;

  el.legend = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
});

describe('aria-label forwarding', () => {
  it('falls back to the localized default when neither label nor a host aria-label is set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal(null);
    expect(base.getAttribute('aria-label')).to.equal(null);
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Map');
  });

  it('uses a .strings override for the localized default when neither label nor a host aria-label is set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.strings = { map: 'Carte' };
    await el.updateComplete;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Carte');
  });

  it('uses the label prop when set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map label="Delivery regions"></lr-map>`)) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Delivery regions');
  });

  it('forwards a host aria-label attribute onto the MapLibre canvas when label is unset', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map aria-label="Forwarded label"></lr-map>`)) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Forwarded label');
  });

  it('prefers the forwarded host aria-label over the label prop when both are set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(
      html`<lr-map label="Delivery regions" aria-label="Forwarded label"></lr-map>`,
    )) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Forwarded label');
  });

  it('preserves an explicit empty host aria-label on the MapLibre canvas, updates it live, and restores the label fallback after removal', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(
      html`<lr-map label="Delivery regions" aria-label=""></lr-map>`,
    )) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    const canvas = () => el.map?.getCanvas();

    expect(canvas()?.getAttribute('aria-label')).to.equal('');

    el.setAttribute('aria-label', 'Live delivery map');
    await el.updateComplete;
    expect(canvas()?.getAttribute('aria-label')).to.equal('Live delivery map');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(canvas()?.getAttribute('aria-label')).to.equal('Delivery regions');
  });
});

it('is accessible', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  el.legend = [
    { color: '#f00', label: 'High' },
    { color: '#0f0', label: 'Low' },
  ];
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await expect(el).to.be.accessible();
});

it('adds a choropleth source + fill layer, and re-applies the color expression on update', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('updates fill opacity when existing choropleth and data layers are reused', async () => {
  const { wrapper, el } = await connectedMapWithoutMaplibre('--lr-map-choropleth-fill-opacity: 0.42');
  try {
    const paintCalls: Array<{ layerId: string; name: string; value: unknown }> = [];
    const fakeSource = { setData(): void {} };
    const fakeMap = {
      getSource(): typeof fakeSource {
        return fakeSource;
      },
      getLayer(): object {
        return {};
      },
      setPaintProperty(layerId: string, name: string, value: unknown): void {
        paintCalls.push({ layerId, name, value });
      },
      remove(): void {},
    };
    const privateMap = el as unknown as {
      _map?: unknown;
      applyChoropleth(): void;
      applyDataLayers(): void;
    };
    privateMap._map = fakeMap;
    el.choropleth = choropleth('regions', [[0, '#000000'], [10, '#ffffff']]);
    el.dataLayers = [{
      sourceId: 'zones',
      geojson: { type: 'FeatureCollection', features: [] },
    }];
    await el.updateComplete;

    privateMap.applyChoropleth();
    privateMap.applyDataLayers();

    expect(
      paintCalls.find((call) => call.layerId === 'regions-fill' && call.name === 'fill-opacity')?.value,
    ).to.equal(0.42);
    expect(
      paintCalls.find((call) => call.layerId === 'zones-fill' && call.name === 'fill-opacity')?.value,
    ).to.equal(0.42);
  } finally {
    wrapper.remove();
  }
});

it('repaints applied layers once after an ancestor theme mutation without touching map structure or data', async () => {
  const { wrapper, el } = await connectedMapWithoutMaplibre();
  try {
    // Let connection/render mutations drain before arming the fake map; the assertion below then
    // belongs solely to the one synchronous ancestor-theme change batch.
    await aTimeout(0);
    const paintCalls: Array<{ layerId: string; name: string; value: unknown }> = [];
    const nonPaintCalls: string[] = [];
    const fakeMap = {
      getSource(): undefined {
        nonPaintCalls.push('getSource');
        return undefined;
      },
      addSource(): void {
        nonPaintCalls.push('addSource');
      },
      removeSource(): void {
        nonPaintCalls.push('removeSource');
      },
      getLayer(): undefined {
        nonPaintCalls.push('getLayer');
        return undefined;
      },
      addLayer(): void {
        nonPaintCalls.push('addLayer');
      },
      removeLayer(): void {
        nonPaintCalls.push('removeLayer');
      },
      setStyle(): void {
        nonPaintCalls.push('setStyle');
      },
      setPaintProperty(layerId: string, name: string, value: unknown): void {
        paintCalls.push({ layerId, name, value });
      },
      remove(): void {},
    };
    const privateMap = el as unknown as {
      _map?: unknown;
      _styleLoaded: boolean;
      _appliedFillLayerId?: string;
      _appliedDataLayerIds: Set<string>;
    };
    el.dataLayers = [{
      sourceId: 'zones',
      tone: 'success',
      geojson: { type: 'FeatureCollection', features: [] },
    }];
    await el.updateComplete;
    privateMap._map = fakeMap;
    privateMap._styleLoaded = true;
    privateMap._appliedFillLayerId = 'regions-fill';
    privateMap._appliedDataLayerIds = new Set(['zones']);

    wrapper.setAttribute('data-theme', 'dark');
    wrapper.style.setProperty('--lr-map-choropleth-fill-opacity', '0.42');
    wrapper.style.setProperty('--lr-theme-color-success-fill-loud', 'rgb(4, 5, 6)');
    await aTimeout(0);

    const successColor = getComputedStyle(el).getPropertyValue('--lr-color-success').trim();
    expect(getComputedStyle(el).getPropertyValue('--lr-map-choropleth-fill-opacity').trim()).to.equal('0.42');
    expect(paintCalls).to.deep.equal([
      { layerId: 'regions-fill', name: 'fill-opacity', value: 0.42 },
      { layerId: 'zones-fill', name: 'fill-color', value: successColor },
      { layerId: 'zones-fill', name: 'fill-opacity', value: 0.42 },
      { layerId: 'zones-line', name: 'line-color', value: successColor },
      { layerId: 'zones-circle', name: 'circle-color', value: successColor },
    ]);
    expect(nonPaintCalls).to.deep.equal([]);
  } finally {
    wrapper.remove();
  }
});

it('does not mark an empty-stops choropleth as applied, so a later non-empty update for the same sourceId still creates the fill layer', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('adds the choropleth GeoJSON source without promoteId, so a top-level Feature.id is preserved instead of requiring a duplicate properties.id', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('fires lr-map-click with the lngLat and no feature when there is no choropleth', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 1, lat: 2 }, point: { x: 0, y: 0 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([1, 2]);
  expect(detail!.feature).to.be.undefined;
});

it('attaches the clicked choropleth feature to lr-map-click when one exists at the point', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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
  el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 3, lat: 4 }, point: { x: 10, y: 10 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([3, 4]);
  expect(detail!.feature).to.equal(fakeFeature);
});

it('does not query the choropleth fill layer on click before it has been added to the style', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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
  el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 5, lat: 6 }, point: { x: 0, y: 0 } });

  // Querying a layer id that doesn't exist yet in the style fires a maplibre-gl
  // error event; the click handler must check the layer exists first instead.
  expect(queried).to.be.false;
  expect(detail).to.exist;
  expect(detail!.feature).to.be.undefined;
});

it('removes the choropleth layer and source when choropleth is cleared', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('removes the old choropleth layer/source when sourceId changes', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('calls setStyle when mapStyle changes after the map has mounted', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('accepts the string style-URL form of mapStyle and passes it through to setStyle, not just the StyleSpecification object form', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  let calledWith: unknown;
  el.map!.setStyle = ((style: unknown) => {
    calledWith = style;
    return el.map;
  }) as typeof el.map.setStyle;

  el.mapStyle = 'https://example.test/lr-map-style.json';
  await el.updateComplete;

  expect(calledWith).to.equal('https://example.test/lr-map-style.json');
});

it('constructs the underlying maplibregl.Map with a string style-URL mapStyle set from initial mount, and maplibre-gl actually requests and loads it as a style', async function () {
  if (!hasWebGL2) this.skip();
  // Fully stubbed (never touches the real network, so this doesn't depend on
  // outbound network access being available in CI) -- proves the string
  // flowed all the way into maplibre-gl's own style-loading request and
  // successfully loaded, not merely that `new Map({ style })` accepted a
  // string without throwing synchronously.
  const requestedUrls: string[] = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('lr-map-style.json')) {
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

  const el = document.createElement('lr-map') as LyraMap;
  el.mapStyle = 'https://example.test/lr-map-style.json';
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

it('re-applies the choropleth once the new style finishes loading after a mapStyle change', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

describe('dataLayers', () => {
  const POLY_LAYER = {
    sourceId: 'zones',
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
          properties: {},
        },
      ],
    },
  } as unknown as import('./map.js').GeoJsonDataLayer;

  it('defaults to an empty array with zero behavior change', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    expect(el.dataLayers).to.deep.equal([]);
  });

  it('adds a source and fill/line/circle layers per entry once the style loads', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = RASTER_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => el.map!.getLayer('zones-fill') != null, 'fill layer never added', {
      timeout: 2000,
    });

    expect(el.map!.getSource('zones')).to.exist;
    expect(el.map!.getLayer('zones-fill')).to.exist;
    expect(el.map!.getLayer('zones-line')).to.exist;
  });

  it('removing an entry (dataLayers reassigned without it) removes its source/layers, leaking nothing', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = RASTER_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => el.map!.getLayer('zones-fill') != null, 'fill layer never added', {
      timeout: 2000,
    });

    el.dataLayers = [];
    await el.updateComplete;

    expect(el.map!.getSource('zones')).to.not.exist;
    expect(el.map!.getLayer('zones-fill')).to.not.exist;
    expect(el.map!.getLayer('zones-line')).to.not.exist;
    expect(el.map!.getLayer('zones-circle')).to.not.exist;
  });

  it('updates existing source data in place when the same sourceId is reassigned with new geojson', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = RASTER_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => el.map!.getSource('zones') != null, 'source never added', { timeout: 2000 });

    const source = el.map!.getSource('zones') as { setData: (g: unknown) => void };
    let called = 0;
    const originalSetData = source.setData.bind(source);
    source.setData = (g: unknown) => {
      called++;
      originalSetData(g);
    };

    el.dataLayers = [{ ...POLY_LAYER, geojson: { type: 'FeatureCollection', features: [] } }];
    await el.updateComplete;

    expect(called).to.equal(1);
    expect(el.map!.getSource('zones')).to.equal(source);
  });

  it('re-applies dataLayers after a mapStyle change (style.load handshake)', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = RASTER_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => el.map!.getLayer('zones-fill') != null, 'fill layer never added', {
      timeout: 2000,
    });

    // Same "demo" source id as RASTER_STYLE so the new style itself stays valid --
    // only the raster layer's paint changes -- mirroring the sibling choropleth
    // "re-applies the choropleth once the new style finishes loading" test above.
    const NEXT_STYLE = {
      ...RASTER_STYLE,
      layers: [{ id: 'demo', type: 'raster', source: 'demo', paint: { 'raster-opacity': 0.9 } }],
    };
    el.mapStyle = NEXT_STYLE as typeof RASTER_STYLE;
    await el.updateComplete;

    await waitUntil(() => el.map!.getLayer('zones-fill') != null, 'dataLayers never re-applied', {
      timeout: 2000,
    });
    expect(el.map!.getSource('zones')).to.exist;
  });
});

it('adds a maplibregl.Marker per entry in markers', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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
  const labels = [...el.shadowRoot!.querySelectorAll('.maplibregl-marker')].map(
    (marker) => marker.getAttribute('aria-label'),
  );
  expect(labels).to.deep.equal(['Station A', 'Station B']);
});

it('provides shadow-local layout for MapLibre canvas, markers, and popups without document CSS', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(
    html`<lr-map style="inline-size: 20rem; block-size: 12rem"></lr-map>`,
  )) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');
  el.markers = [{ id: 'station', lngLat: [10, 20], label: 'Station A' }];
  await el.updateComplete;

  const container = el.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
  const canvas = el.shadowRoot!.querySelector('.maplibregl-canvas') as HTMLCanvasElement;
  const marker = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  const controlCorner = el.shadowRoot!.querySelector(
    '.maplibregl-ctrl-bottom-right',
  ) as HTMLElement;

  expect(container.clientWidth).to.be.greaterThan(0);
  expect(container.clientHeight).to.be.greaterThan(0);
  expect(canvas.clientWidth).to.equal(container.clientWidth);
  expect(canvas.clientHeight).to.equal(container.clientHeight);
  expect(getComputedStyle(canvas).position).to.equal('absolute');
  expect(getComputedStyle(marker).position).to.equal('absolute');
  expect(getComputedStyle(controlCorner).position).to.equal('absolute');
  expect(getComputedStyle(controlCorner).pointerEvents).to.equal('none');

  marker.click();
  await waitUntil(() => el.shadowRoot!.querySelector('.maplibregl-popup') != null, 'popup never opened');
  const popup = el.shadowRoot!.querySelector('.maplibregl-popup') as HTMLElement;
  const popupContent = el.shadowRoot!.querySelector('.maplibregl-popup-content') as HTMLElement;
  const popupClose = el.shadowRoot!.querySelector('.maplibregl-popup-close-button') as HTMLElement;
  expect(getComputedStyle(popup).position).to.equal('absolute');
  expect(getComputedStyle(popup).display).to.equal('flex');
  expect(getComputedStyle(popup).pointerEvents).to.equal('none');
  expect(getComputedStyle(popupContent).pointerEvents).to.equal('auto');
  expect(getComputedStyle(popupClose).position).to.equal('absolute');
});

it('lets inherited CSS properties theme popup-close-button hover and active states without changing their defaults', async () => {
  const { wrapper, el } = await connectedMapWithoutMaplibre();
  const popup = document.createElement('div');
  const close = document.createElement('button');
  popup.className = 'maplibregl-popup-content';
  popup.style.inlineSize = '10rem';
  popup.style.blockSize = '8rem';
  close.className = 'maplibregl-popup-close-button';
  close.type = 'button';
  close.textContent = 'Close';
  popup.append(close);
  el.shadowRoot!.append(popup);

  const resolvedInShadow = (declaration: string, property: string): string => {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };

  const rect = close.getBoundingClientRect();
  const centre: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  expect(rect.width, 'the close button has real geometry to point at').to.be.greaterThan(0);
  try {
    await sendMouse({ type: 'move', position: centre });
    expect(getComputedStyle(close).backgroundColor).to.equal(
      resolvedInShadow('background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(close).color).to.equal(
      resolvedInShadow('color: var(--lr-color-brand)', 'color'),
    );
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(close).backgroundColor).to.equal(
      resolvedInShadow(
        'background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
        'background-color',
      ),
    );
    expect(getComputedStyle(close).color).to.equal(
      resolvedInShadow('color: var(--lr-color-brand)', 'color'),
    );
    await sendMouse({ type: 'up' });

    wrapper.style.setProperty('--lr-map-popup-close-button-hover-bg', 'rgb(1, 2, 3)');
    wrapper.style.setProperty('--lr-map-popup-close-button-hover-color', 'rgb(4, 5, 6)');
    wrapper.style.setProperty('--lr-map-popup-close-button-active-bg', 'rgb(7, 8, 9)');
    wrapper.style.setProperty('--lr-map-popup-close-button-active-color', 'rgb(10, 11, 12)');
    expect(getComputedStyle(close).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(close).color).to.equal('rgb(4, 5, 6)');

    await sendMouse({ type: 'down' });
    expect(getComputedStyle(close).backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(close).color).to.equal('rgb(10, 11, 12)');
    await sendMouse({ type: 'up' });
  } finally {
    await resetMouse();
    wrapper.remove();
  }
});

it('keeps choropleth and data-layer sources distinct when their public sourceId collides', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  el.dataLayers = [{
    sourceId: 'shared',
    geojson: { type: 'FeatureCollection', features: [] },
  }];
  await el.updateComplete;
  await waitUntilMapLoaded(el);
  await waitUntil(
    () => Boolean(el.map!.getLayer('shared-fill') && el.map!.getLayer('shared-line')),
    'colliding layers never became distinct',
    { timeout: 2000 },
  );
  expect(el.map!.getSource('shared')).to.exist;
  expect(el.map!.getSource('lr-choropleth-shared')).to.exist;
});

it('keeps the choropleth namespace distinct from both a colliding data source and its first fallback id', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  el.dataLayers = [
    { sourceId: 'shared', geojson: { type: 'FeatureCollection', features: [] } },
    { sourceId: 'lr-choropleth-shared', geojson: { type: 'FeatureCollection', features: [] } },
  ];
  await el.updateComplete;
  await waitUntilMapLoaded(el);
  await waitUntil(
    () => Boolean(el.map!.getSource('lr-choropleth-lr-choropleth-shared')),
    'choropleth did not move past both occupied data-layer ids',
    { timeout: 2000 },
  );

  expect(el.map!.getSource('shared')).to.exist;
  expect(el.map!.getSource('lr-choropleth-shared')).to.exist;
  expect(el.map!.getSource('lr-choropleth-lr-choropleth-shared')).to.exist;
});

it('can replace a choropleth with a same-id data layer in one reactive update', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  await el.updateComplete;
  await waitUntilMapLoaded(el);
  await waitUntil(() => Boolean(el.map!.getLayer('shared-fill')), 'choropleth never applied', {
    timeout: 2000,
  });

  el.choropleth = undefined;
  el.dataLayers = [{
    sourceId: 'shared',
    geojson: { type: 'FeatureCollection', features: [] },
  }];
  await el.updateComplete;

  expect(el.map!.getSource('shared')).to.exist;
  expect(el.map!.getLayer('shared-fill')).to.exist;
  expect(el.map!.getLayer('shared-line')).to.exist;
  expect(el.map!.getLayer('shared-circle')).to.exist;
});

it('preserves colliding choropleth and data-layer namespaces across clear and style reload', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  el.dataLayers = [{
    sourceId: 'shared',
    geojson: { type: 'FeatureCollection', features: [] },
  }];
  await el.updateComplete;
  await waitUntilMapLoaded(el);

  el.mapStyle = {
    ...RASTER_STYLE,
    layers: [{ id: 'demo', type: 'raster', source: 'demo', paint: { 'raster-opacity': 0.8 } }],
  } as typeof RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(
    () => Boolean(el.map!.getSource('shared') && el.map!.getSource('lr-choropleth-shared')),
    'colliding sources were not restored after style reload',
    { timeout: 2000 },
  );

  el.choropleth = undefined;
  await el.updateComplete;
  expect(el.map!.getSource('lr-choropleth-shared')).to.not.exist;
  expect(el.map!.getSource('shared')).to.exist;
  expect(el.map!.getLayer('shared-line')).to.exist;
});

it('removes markers no longer present and reuses markers that persist', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('updates the reused marker popup when label changes for a persisting id', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('updates the reused marker popup when unsafeHtml changes for a persisting id', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('adds popup semantics when persisted plain markers later gain label or unsafeHtml content', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    { id: 'text', lngLat: [10, 20] },
    { id: 'html', lngLat: [11, 21] },
  ];
  await el.updateComplete;
  const [initialTextMarker, initialHtmlMarker] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('.maplibregl-marker'),
  ];
  expect(Boolean(initialTextMarker)).to.be.true;
  expect(Boolean(initialHtmlMarker)).to.be.true;

  el.markers = [
    { id: 'text', lngLat: [10, 20], label: 'Text marker' },
    { id: 'html', lngLat: [11, 21], label: 'HTML marker', unsafeHtml: '<strong>Trusted HTML</strong>' },
  ];
  await el.updateComplete;

  const markers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.maplibregl-marker')];
  const textMarker = markers.find(marker => marker.getAttribute('aria-label') === 'Text marker');
  const htmlMarker = markers.find(marker => marker.getAttribute('aria-label') === 'HTML marker');
  expect(Boolean(textMarker)).to.be.true;
  expect(Boolean(htmlMarker)).to.be.true;
  expect(textMarker === initialTextMarker).to.be.true;
  expect(htmlMarker === initialHtmlMarker).to.be.true;
  expect(textMarker!.getAttribute('aria-controls')).to.be.a('string').and.not.equal('');
  expect(htmlMarker!.getAttribute('aria-controls')).to.be.a('string').and.not.equal('');
  expect(textMarker!.getAttribute('aria-expanded')).to.equal('false');
  expect(htmlMarker!.getAttribute('aria-expanded')).to.equal('false');

  textMarker!.click();
  await waitUntil(
    () => [...el.shadowRoot!.querySelectorAll('.maplibregl-popup-content')]
      .some(popup => popup.textContent?.includes('Text marker') === true),
    'text popup never opened after the persisted marker gained a label',
  );
  expect(textMarker!.getAttribute('aria-expanded')).to.equal('true');
  htmlMarker!.click();
  await waitUntil(
    () => [...el.shadowRoot!.querySelectorAll('.maplibregl-popup-content')]
      .some(popup => popup.querySelector('strong')?.textContent === 'Trusted HTML'),
    'HTML popup never opened after the persisted marker gained unsafeHtml',
  );
  expect(htmlMarker!.getAttribute('aria-expanded')).to.equal('true');

  el.markers = [
    { id: 'text', lngLat: [10, 20], label: 'Text marker' },
    { id: 'html', lngLat: [11, 21] },
  ];
  await el.updateComplete;
  expect(htmlMarker!.getAttribute('aria-controls')).to.equal(null);
  expect(htmlMarker!.getAttribute('aria-expanded')).to.equal(null);
});

it('attaches an openable popup when label or html is provided', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('removes all marker DOM on disconnect', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it('renders a colored marker and an html popup', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20], color: '#ff0000', unsafeHtml: '<strong>Station A</strong>' }];
  await el.updateComplete;

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  expect((markerEl) != null).to.equal(true);
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  const popupContent = el.shadowRoot!.querySelector('.maplibregl-popup-content')!;
  expect((popupContent.querySelector('strong')) != null).to.equal(true);
  expect(popupContent.textContent).to.contain('Station A');
});

it('puts the host-first localized map name and effective locale on the real MapLibre focus owner', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`
    <lr-map
      aria-label="Delivery map"
      lang="fr-FR"
      .strings=${{ map: 'Carte', close: 'Fermer' }}
    ></lr-map>
  `)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  const canvas = el.map!.getCanvas() as HTMLCanvasElement;
  const container = el.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(canvas.getAttribute('aria-label')).to.equal('Delivery map');
  expect(container.getAttribute('lang')).to.equal('fr-FR');
  expect(base.getAttribute('role')).to.equal(null);
  expect(base.getAttribute('aria-label')).to.equal(null);

  el.setAttribute('aria-label', 'Carte des livraisons');
  await el.updateComplete;
  expect(canvas.getAttribute('aria-label')).to.equal('Carte des livraisons');
});

it('synchronizes popup-capable marker disclosure semantics and localized popup ownership', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`
    <lr-map lang="fr-FR" .strings=${{ close: 'Fermer' }}></lr-map>
  `)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');
  el.markers = [{ id: 'station', lngLat: [10, 20], label: 'Gare centrale' }];
  await el.updateComplete;

  const marker = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  const popupId = marker.getAttribute('aria-controls');
  expect(marker.getAttribute('aria-expanded')).to.equal('false');
  expect(popupId).to.be.a('string').and.not.equal('');

  marker.click();
  await waitUntil(() => el.shadowRoot!.querySelector('.maplibregl-popup') != null, 'popup never opened');
  const popup = el.shadowRoot!.querySelector('.maplibregl-popup') as HTMLElement;
  expect(popup.id).to.equal(popupId);
  expect(popup.getAttribute('role')).to.equal('dialog');
  expect(popup.closest('[lang="fr-FR"]')).to.exist;
  expect(marker.getAttribute('aria-expanded')).to.equal('true');
  const popupClose = popup.querySelector('.maplibregl-popup-close-button') as HTMLButtonElement;
  expect(popupClose.getAttribute('part')).to.equal('popup-close-button');
  expect(getComputedStyle(popupClose).minInlineSize).to.equal('40px');
  expect(getComputedStyle(popupClose).minBlockSize).to.equal('40px');
  expect(
    popupClose.getAttribute('aria-label'),
  ).to.equal('Fermer');

  marker.click();
  await waitUntil(() => marker.getAttribute('aria-expanded') === 'false', 'marker never collapsed');
});

it('skips malformed/non-finite markers without aborting valid marker reconciliation', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    null,
    { id: 'missing', lngLat: undefined },
    { id: 'infinite', lngLat: [Number.POSITIVE_INFINITY, 20] },
    { id: 'bad-latitude', lngLat: [10, 91] },
    { id: 'valid', lngLat: [11, 21], label: 'Valid' },
  ] as unknown as typeof el.markers;
  await el.updateComplete;

  const markers = [...el.shadowRoot!.querySelectorAll('.maplibregl-marker')];
  expect(markers.length).to.equal(1);
  expect(markers[0]!.getAttribute('aria-label')).to.equal('Valid');
});

it('clears stale markers without throwing when a non-array runtime value is assigned', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'valid', lngLat: [10, 20], label: 'Valid marker' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(1);

  el.markers = { entries: 'not an array' } as unknown as typeof el.markers;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(0);
});

it('keeps explicit marker ids separate from synthesized idless-coordinate identities', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    { id: '0,0#0', lngLat: [10, 20], label: 'Explicit' },
    { lngLat: [0, 0], label: 'Idless' },
  ];
  await el.updateComplete;

  const labels = [...el.shadowRoot!.querySelectorAll('.maplibregl-marker')].map(
    (marker) => marker.getAttribute('aria-label'),
  );
  expect(labels).to.have.members(['Explicit', 'Idless']);
  expect(labels.length).to.equal(2);
});

it('contains long legend labels in paired 320px LTR and RTL allocations', async () => {
  const pair = (await fixture(html`
    <div style="display: grid; gap: var(--lr-space-l)">
      <div dir="ltr" style="inline-size: 320px; max-inline-size: 100%">
        <lr-map
          style="block-size: var(--lr-size-12rem)"
          .legend=${[{ color: '#f00', label: 'LongestUnbrokenLegendLabel'.repeat(80) }]}
        ></lr-map>
      </div>
      <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%">
        <lr-map
          style="block-size: var(--lr-size-12rem)"
          .legend=${[{ color: '#00f', label: 'أطولتسميةوسيلةإيضاحمتصلة'.repeat(80) }]}
        ></lr-map>
      </div>
    </div>
  `)) as HTMLElement;
  const wrappers = [...pair.querySelectorAll<HTMLElement>('div[dir]')];
  expect(wrappers.length).to.equal(2);
  for (const wrapper of wrappers) {
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  }
});

it('does not throw or leave a dangling marker when the element disconnects while applyMarkers is running', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

it("updates an existing marker's color when it changes", async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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
  expect([...instances.values()][0]!.getElement().innerHTML).to.include('ff0000');

  el.markers = [{ id: 'a', lngLat: [0, 0], color: '#00ff00' }];
  await el.updateComplete;
  const marker = [...instances.values()][0]!;
  // maplibre-gl's default marker SVG carries the fill on its path -- assert the
  // instance was told about the new color rather than left at construction-time red.
  expect(marker.getElement().innerHTML).to.include('00ff00');
});

it('rejects url paint servers from marker colors', async function () {
  if (!hasWebGL2) this.skip();
  const el = await fixture<LyraMap>(html`<lr-map></lr-map>`);
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');
  el.markers = [
    {
      id: 'unsafe',
      lngLat: [0, 0],
      color: 'url("data:image/svg+xml,<svg/>")',
    },
  ];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  expect(marker.innerHTML.toLowerCase()).to.not.contain('url(');
});

it('does not collide two id-less markers placed at the same coordinates', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
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

async function waitUntilMapLoaded(el: LyraMap): Promise<void> {
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });
}

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
