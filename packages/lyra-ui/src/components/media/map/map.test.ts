import {
  aTimeout,
  fixture,
  fixtureCleanup,
  expect,
  html,
  oneEvent,
  waitUntil,
} from '@open-wc/testing';
import { render, type PropertyValues } from 'lit';
import './map.js';
import { LyraMap } from './map.js';
import { buildGeoJsonPropertyDiff } from './map.class.js';
import { loadMaplibre } from './map-loader.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { setMapCanvasReadyCallback } from '../../../internal/map-canvas-ready.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

// maplibre-gl requires a real WebGL2 context; headless Firefox/WebKit in CI don't reliably
// provide one (unlike Chromium's software rasterizer), so any test that needs a map to actually
// construct is meaningless there -- skip rather than fail on an environment limitation this suite
// can't control. The component's own supportsWebGL2() guard (map.class.ts) is covered separately,
// below, by forcing this same detection to report unsupported regardless of the real engine.
const hasWebGL2 = (() => {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    try {
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // The probe succeeded; release is best-effort in incomplete headless implementations.
    }
    return true;
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

const LOCAL_STYLE = {
  version: 8,
  sources: {
    demo: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
  },
  layers: [{ id: 'demo', type: 'fill', source: 'demo' }],
};

// MapLibre owns WebGL contexts and workers outside the fixture's DOM subtree. Clearing fixtures
// after every test exercises the component's disconnect cleanup before the next map is mounted.
afterEach(() => fixtureCleanup());

/** Connects a map without allowing its optional peer to construct a real WebGL map. */
async function connectedMapWithoutMaplibre(style = ''): Promise<{ wrapper: HTMLElement; el: LyraMap }> {
  const wrapper = (await fixture(html`<div style=${style}></div>`)) as HTMLElement;
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => new Promise(() => {});
  wrapper.append(el);
  await el.updateComplete;
  return { wrapper, el };
}

function dataLayerResourceId(el: LyraMap, publicSourceId: string): string {
  return (
    el as unknown as { _appliedDataLayerIds: Map<string, string> }
  )._appliedDataLayerIds.get(publicSourceId) ?? '';
}

function choroplethResourceId(el: LyraMap): string {
  return (el as unknown as { _appliedChoroplethSourceId?: string })._appliedChoroplethSourceId ?? '';
}

it('preloads the optional map peer without constructing a map', async () => {
  const loaded = await LyraMap.preload();
  expect(typeof loaded).to.equal('boolean');
});

it('floors an empty peer-owned marker target to 24px in both axes without WebGL', async () => {
  const { el } = await connectedMapWithoutMaplibre();
  const marker = document.createElement('span');
  marker.className = 'maplibregl-marker';
  marker.setAttribute('part', 'marker');
  marker.setAttribute('role', 'button');
  marker.tabIndex = 0;
  el.shadowRoot!.append(marker);

  const rect = marker.getBoundingClientRect();
  expect(rect.width).to.be.at.least(24);
  expect(rect.height).to.be.at.least(24);
});

it('shows a loading skeleton and aria-busy while maplibre-gl loads, then swaps to the container', async function () {
  if (!hasWebGL2) this.skip();
  let resolveLibrary!: (value: Awaited<ReturnType<typeof loadMaplibre>>) => void;
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<Awaited<ReturnType<typeof loadMaplibre>>> }).loadLibrary =
    () => new Promise((resolve) => {
      resolveLibrary = resolve;
    });
  el.strings = { loading: 'Chargement de la carte…' };
  el.mapStyle = LOCAL_STYLE;
  document.body.append(el);
  try {
    await el.updateComplete;
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

    resolveLibrary(await loadMaplibre());
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="container"]') != null).to.be.true;
  } finally {
    el.remove();
  }
});

it('constructs a maplibregl.Map and exposes it via the map getter', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(el.map != null).to.be.true;
});

it('forwards renderWorldCopies only when explicitly authored, preserving the peer default', async () => {
  const OriginalIntersectionObserver = window.IntersectionObserver;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') return {};
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };

  const constructed: Record<string, unknown>[] = [];
  class ConstructionMap {
    private readonly canvas = document.createElement('canvas');
    constructor(options: Record<string, unknown>) { constructed.push(options); }
    on(): this { return this; }
    getCanvas(): HTMLCanvasElement { return this.canvas; }
    resize(): void {}
    remove(): void {}
  }

  const connect = async (worldCopies: boolean | undefined): Promise<LyraMap> => {
    const el = document.createElement('lr-map') as LyraMap;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      Map: ConstructionMap,
    });
    if (worldCopies !== undefined) {
      (el as unknown as { renderWorldCopies?: boolean }).renderWorldCopies = worldCopies;
    }
    el.mapStyle = LOCAL_STYLE;
    document.body.append(el);
    await waitUntil(() => el.map != null, 'fake map never initialized', { timeout: 2000 });
    return el;
  };

  const elements: LyraMap[] = [];
  try {
    elements.push(await connect(undefined), await connect(false), await connect(true));
    expect(Object.prototype.hasOwnProperty.call(constructed[0], 'renderWorldCopies')).to.be.false;
    expect(constructed[1]!['renderWorldCopies']).to.equal(false);
    expect(constructed[2]!['renderWorldCopies']).to.equal(true);
  } finally {
    for (const el of elements) el.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: OriginalIntersectionObserver,
    });
  }
});

it('resizes only the current connected map when its allocated container changes', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  const callbacks: ResizeObserverCallback[] = [];
  const observed: Element[] = [];
  let disconnects = 0;
  class FakeResizeObserver {
    constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
    observe(target: Element): void { observed.push(target); }
    unobserve(): void {}
    disconnect(): void { disconnects += 1; }
  }
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: FakeResizeObserver,
  });

  const { el } = await connectedMapWithoutMaplibre();
  const container = document.createElement('div');
  container.setAttribute('part', 'container');
  el.shadowRoot!.append(container);
  let firstResizes = 0;
  let secondResizes = 0;
  const firstMap = { resize: () => { firstResizes += 1; }, remove(): void {} };
  const secondMap = { resize: () => { secondResizes += 1; }, remove(): void {} };
  const privateMap = el as unknown as {
    _map?: unknown;
    observeMapAllocation(map: unknown, container: HTMLElement): void;
  };

  try {
    privateMap._map = firstMap;
    privateMap.observeMapAllocation(firstMap, container);
    expect(observed[0] === container).to.be.true;
    callbacks[0]([], {} as ResizeObserver);
    expect(firstResizes).to.equal(1);

    el.remove();
    callbacks[0]([], {} as ResizeObserver);
    expect(firstResizes, 'a stale callback cannot resize a disconnected map').to.equal(1);
    expect(disconnects).to.equal(1);

    document.body.append(el);
    await el.updateComplete;
    privateMap._map = secondMap;
    privateMap.observeMapAllocation(secondMap, container);
    callbacks[1]([], {} as ResizeObserver);
    expect(secondResizes).to.equal(1);
    callbacks[0]([], {} as ResizeObserver);
    expect(firstResizes, 'the replaced observer remains inert after reconnect').to.equal(1);
  } finally {
    privateMap._map = undefined;
    el.remove();
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: OriginalResizeObserver,
    });
  }
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
    el.mapStyle = LOCAL_STYLE;
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
    expect(el.map == null).to.be.true;

    // Now simulate the element scrolling into view.
    callbacks[0]([{ isIntersecting: true } as unknown as IntersectionObserverEntry], new OriginalIO(() => {}));
    await waitUntil(() => el.map != null, 'map never constructed after becoming visible', { timeout: 2000 });
    expect(el.map != null).to.be.true;
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

it('probes WebGL2 in the concrete owner realm before and after adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const ambientGetContext = HTMLCanvasElement.prototype.getContext;
  const frameGetContext = frameWindow.HTMLCanvasElement.prototype.getContext;
  const ambientIntersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const frameIntersectionObserver = Object.getOwnPropertyDescriptor(frameWindow, 'IntersectionObserver');
  let ambientProbes = 0;
  let frameProbes = 0;
  let frameProbeReleases = 0;
  let removals = 0;
  let loadCalls = 0;

  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') {
        ambientProbes += 1;
        return null;
      }
      return ambientGetContext.call(this, contextId as never, ...(rest as []));
    };
  (frameWindow.HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  }).getContext = function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
    if (contextId === 'webgl2') {
      frameProbes += 1;
      return {
        getExtension(name: string) {
          if (name !== 'WEBGL_lose_context') return null;
          return {
            loseContext: () => {
              frameProbeReleases += 1;
            },
          };
        },
      };
    }
    return frameGetContext.call(this, contextId as never, ...(rest as []));
  };
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  Object.defineProperty(frameWindow, 'IntersectionObserver', { configurable: true, value: undefined });

  class OwnerRealmMap {
    private readonly canvas = frameDocument.createElement('canvas');
    on(): this { return this; }
    getCanvas(): HTMLCanvasElement { return this.canvas; }
    remove(): void { removals += 1; }
  }
  const module = { Map: OwnerRealmMap };
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => {
    loadCalls += 1;
    return loadCalls === 1 ? new Promise(() => {}) : Promise.resolve(module);
  };
  el.mapStyle = LOCAL_STYLE;
  el.strings = { mapWebglUnavailable: 'Current document lacks WebGL2' };

  try {
    // First render in the ambient document gives nested custom elements a stable original realm;
    // its intentionally pending peer load ensures no ambient capability probe runs.
    document.body.append(el);
    await el.updateComplete;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await waitUntil(() => el.map != null, 'frame-owned map never initialized', { timeout: 2000 });
    expect(frameProbes).to.be.greaterThan(0);
    expect(frameProbeReleases).to.equal(frameProbes);
    expect(ambientProbes).to.equal(0);

    el.remove();
    document.body.append(document.adoptNode(el));
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]')?.textContent?.trim() ===
        'Current document lacks WebGL2',
      'ambient owner did not replace the frame result',
      { timeout: 2000 },
    );
    expect(ambientProbes).to.be.greaterThan(0);
    expect(el.map).to.equal(undefined);
    expect(removals).to.equal(1);
  } finally {
    el.remove();
    HTMLCanvasElement.prototype.getContext = ambientGetContext;
    frameWindow.HTMLCanvasElement.prototype.getContext = frameGetContext;
    if (ambientIntersectionObserver) {
      Object.defineProperty(window, 'IntersectionObserver', ambientIntersectionObserver);
    } else {
      delete (window as unknown as { IntersectionObserver?: typeof IntersectionObserver })
        .IntersectionObserver;
    }
    if (frameIntersectionObserver) {
      Object.defineProperty(frameWindow, 'IntersectionObserver', frameIntersectionObserver);
    } else {
      delete (frameWindow as unknown as { IntersectionObserver?: typeof IntersectionObserver })
        .IntersectionObserver;
    }
    iframe.remove();
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
  el.strings = { mapMissingLibrary: 'Map peer is unavailable' };
  document.body.appendChild(el);
  try {
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'error state never rendered',
      { timeout: 2000 },
    );
    const errorEl = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(errorEl.getAttribute('role')).to.equal(null);
    expect(errorEl.textContent!.trim()).to.equal('Map peer is unavailable');
    expect(assertiveAnnouncements()).to.deep.equal([errorEl.textContent!.trim()]);
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.map == null).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="container"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
  } finally {
    el.remove();
  }
});

it('classifies a rejected optional-peer import the same as an unavailable module', async () => {
  const el = document.createElement('lr-map') as unknown as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
    Promise.reject(new Error('network import failure'));
  el.strings = { mapMissingLibrary: 'Map peer is unavailable' };
  document.body.appendChild(el);
  try {
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'error state never rendered after a rejected peer import',
      { timeout: 2000 },
    );
    const errorEl = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(errorEl.textContent!.trim()).to.equal('Map peer is unavailable');
    expect(assertiveAnnouncements()).to.deep.equal([errorEl.textContent!.trim()]);
    expect(el.map == null).to.be.true;
  } finally {
    el.remove();
  }
});

it('requires explicit mapStyle without constructing a peer map or making an implicit provider choice', async () => {
  let constructorCalls = 0;
  class NeverConstructedMap {
    constructor() {
      constructorCalls += 1;
    }
  }
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
    Map: NeverConstructedMap,
  });
  el.strings = { mapStyleRequired: 'Choose a map provider explicitly' };
  document.body.append(el);
  try {
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'explicit-style error state never rendered',
      { timeout: 2000 },
    );
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
      'Choose a map provider explicitly',
    );
    expect(assertiveAnnouncements()).to.deep.equal(['Choose a map provider explicitly']);
    expect(constructorCalls).to.equal(0);
    expect(el.map).to.equal(undefined);
  } finally {
    el.remove();
  }
});

for (const failureStage of ['constructor', 'setup'] as const) {
  it(`rolls back a ${failureStage} failure, reports it locally, retries, reconnects, and disposes`, async () => {
    const OriginalIntersectionObserver = window.IntersectionObserver;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
      function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
        if (contextId === 'webgl2') return {};
        return originalGetContext.call(this, contextId as never, ...(rest as []));
      };

    let attempts = 0;
    let removals = 0;
    const unhandled: PromiseRejectionEvent[] = [];
    const onUnhandled = (event: PromiseRejectionEvent): void => unhandled.push(event);
    window.addEventListener('unhandledrejection', onUnhandled);
    class TransactionMap {
      private readonly callbacks = new Map<string, Array<(event: unknown) => void>>();
      private readonly canvas = document.createElement('canvas');

      constructor() {
        attempts += 1;
        if (attempts === 1 && failureStage === 'constructor') {
          throw new Error('private constructor failure');
        }
      }

      on(name: string, callback: (event: unknown) => void): this {
        if (attempts === 1 && failureStage === 'setup') {
          throw new Error('private setup failure');
        }
        const callbacks = this.callbacks.get(name) ?? [];
        callbacks.push(callback);
        this.callbacks.set(name, callbacks);
        return this;
      }

      getCanvas(): HTMLCanvasElement {
        return this.canvas;
      }

      remove(): void {
        removals += 1;
      }
    }

    const el = document.createElement('lr-map') as LyraMap;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      Map: TransactionMap,
    });
    el.mapStyle = LOCAL_STYLE;
    el.strings = { mapInitializationFailed: 'Map setup could not finish' };
    document.body.append(el);
    try {
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') != null,
        `${failureStage} failure never reached error state`,
        { timeout: 2000 },
      );
      expect(el.map).to.equal(undefined);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
        'Map setup could not finish',
      );
      expect(removals).to.equal(failureStage === 'setup' ? 1 : 0);
      expect(unhandled).to.deep.equal([]);

      el.mapStyle = { ...LOCAL_STYLE, name: `retry-${failureStage}` };
      await waitUntil(() => el.map != null, `${failureStage} retry never initialized`, {
        timeout: 2000,
      });
      expect(attempts).to.equal(2);

      el.remove();
      expect(removals).to.equal(failureStage === 'setup' ? 2 : 1);
      document.body.append(el);
      await waitUntil(() => el.map != null, `${failureStage} reconnect never initialized`, {
        timeout: 2000,
      });
      expect(attempts).to.equal(3);
    } finally {
      el.remove();
      window.removeEventListener('unhandledrejection', onUnhandled);
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      Object.defineProperty(window, 'IntersectionObserver', {
        configurable: true,
        value: OriginalIntersectionObserver,
      });
    }
  });
}

it('classifies an initial peer style error and disposes the published candidate transaction', async () => {
  const OriginalIntersectionObserver = window.IntersectionObserver;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') return {};
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };
  let errorCallback: ((event: unknown) => void) | undefined;
  let removals = 0;
  class StyleErrorMap {
    private readonly canvas = document.createElement('canvas');
    on(name: string, callback: (event: unknown) => void): this {
      if (name === 'error') errorCallback = callback;
      return this;
    }
    getCanvas(): HTMLCanvasElement { return this.canvas; }
    remove(): void { removals += 1; }
  }
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
    Map: StyleErrorMap,
  });
  el.mapStyle = LOCAL_STYLE;
  el.strings = { mapInitializationFailed: 'Initial style failed' };
  document.body.append(el);
  try {
    await waitUntil(() => el.map != null && errorCallback !== undefined, 'fake map never initialized');
    errorCallback?.({ error: new Error('private style parser detail') });
    await el.updateComplete;
    expect(el.map).to.equal(undefined);
    expect(removals).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
      'Initial style failed',
    );
  } finally {
    el.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: OriginalIntersectionObserver,
    });
  }
});

it('logs a post-load runtime map error via console.error instead of failing an already-loaded map', async () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') return {};
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };
  const handlers: Record<string, ((event: unknown) => void) | undefined> = {};
  class RuntimeErrorMap {
    private readonly canvas = document.createElement('canvas');
    on(name: string, callback: (event: unknown) => void): this {
      handlers[name] = callback;
      return this;
    }
    getCanvas(): HTMLCanvasElement { return this.canvas; }
    remove(): void {}
  }
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
    Map: RuntimeErrorMap,
  });
  el.mapStyle = LOCAL_STYLE;
  document.body.append(el);
  const originalConsoleError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => { calls.push(args); };
  try {
    await waitUntil(() => el.map != null, 'fake map never initialized');
    handlers.load?.(undefined);
    const runtimeError = new Error('runtime tile error');
    handlers.error?.({ error: runtimeError });

    expect(el.map != null).to.be.true;
    expect(calls.length).to.equal(1);
    expect(calls[0]?.[0]).to.equal('lr-map:');
    expect((calls[0]?.[1] as Error)?.message).to.equal('runtime tile error');
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally {
    console.error = originalConsoleError;
    el.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: originalIntersectionObserver,
    });
  }
});

it('rolls back a synchronous dynamic style failure and retries with a fresh map', async () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') return {};
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };
  let constructions = 0;
  let removals = 0;
  class DynamicStyleMap {
    private readonly canvas = document.createElement('canvas');
    private readonly generation = ++constructions;
    on(): this { return this; }
    once(): this { return this; }
    getCanvas(): HTMLCanvasElement { return this.canvas; }
    setStyle(): void {
      if (this.generation === 1) throw new Error('private dynamic style parser detail');
    }
    remove(): void { removals += 1; }
  }
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
    Map: DynamicStyleMap,
  });
  el.mapStyle = LOCAL_STYLE;
  el.strings = { mapInitializationFailed: 'Map style could not be applied' };
  document.body.append(el);
  try {
    await waitUntil(() => el.map != null, 'initial fake map never initialized');
    el.mapStyle = { ...LOCAL_STYLE, name: 'throws' };
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'dynamic style failure never reached the localized error state',
    );
    expect(el.map).to.equal(undefined);
    expect(removals).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
      'Map style could not be applied',
    );

    el.mapStyle = { ...LOCAL_STYLE, name: 'retry' };
    await waitUntil(() => el.map != null, 'dynamic style retry never initialized');
    expect(constructions).to.equal(2);
  } finally {
    el.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: originalIntersectionObserver,
    });
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
it('renders a distinct accessible error state instead of crashing when WebGL2 is unavailable', async () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
      if (contextId === 'webgl2') return null;
      return originalGetContext.call(this, contextId as never, ...(rest as []));
    };
  const el = document.createElement('lr-map') as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  el.strings = { mapWebglUnavailable: 'Owner realm has no WebGL2' };
  document.body.append(el);
  try {
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') != null,
      'error state never rendered',
      { timeout: 2000 },
    );
    expect(el.map == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
      'Owner realm has no WebGL2',
    );
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
  el.mapStyle = LOCAL_STYLE;
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
    const el = (await fixture(html`<lr-map .mapStyle=${LOCAL_STYLE}></lr-map>`)) as LyraMap;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.updated = original;
  }
});

it('calls setCenter/setZoom on the underlying map when center/zoom change after mount', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(Number.isFinite(el.map!.getZoom())).to.be.true;
});

it('clamps a non-finite/out-of-range zoom passed to setZoom on the live map after mount', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
    { color: '#f00', label: 'High', pattern: 'diagonal' },
    { color: '#0f0', label: 'Low', pattern: 'dots' },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(2);
  const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
  expect(legend.getAttribute('role')).to.equal('group');
  expect(legend.getAttribute('aria-label')).to.equal('Map legend');
  expect(legend.getAttribute('aria-controls')).to.equal('map-container');
  expect(legend.querySelector('[role="list"]') != null).to.be.true;
  expect(legend.querySelectorAll('[role="listitem"]')).to.have.length(2);
  expect([...legend.querySelectorAll('[part="legend-swatch"]')].every(
    (swatch) => swatch.getAttribute('aria-hidden') === 'true',
  )).to.be.true;
  expect([...legend.querySelectorAll<HTMLElement>('[part="legend-swatch"]')].every(
    (swatch) => swatch.inert,
  )).to.be.true;
  expect([...legend.querySelectorAll<HTMLElement>('[part="legend-swatch"]')].map(
    (swatch) => swatch.dataset.pattern,
  )).to.deep.equal(['diagonal', 'dots']);
});

it('owns a bounded frozen legend snapshot and exposes an exact truncation result', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  const input = Array.from({ length: 150 }, (_, index) => ({
    color: index % 2 ? '#f00' : '#00f',
    label: `Category ${index}`,
    pattern: 'solid' as const,
  }));
  el.strings = {
    paginationSummary: 'Showing {start} through {end} of {total} {itemLabel}',
    items: 'categories',
  };
  el.legend = input;
  input[0]!.label = 'Caller mutation';
  await el.updateComplete;

  expect(el.legend.length).to.equal(100);
  expect(el.legend[0]!.label).to.equal('Category 0');
  expect(Object.isFrozen(el.legend)).to.be.true;
  expect(Object.isFrozen(el.legend[0])).to.be.true;
  expect(Object.isFrozen(el.legendProjection)).to.be.true;
  expect(el.legendProjection.inputCount).to.equal(150);
  expect(el.legendProjection.renderedCount).to.equal(100);
  expect(el.legendProjection.omittedCount).to.equal(50);
  expect(el.legendProjection.truncatedLabelCount).to.equal(0);
  expect(el.legendProjection.truncated).to.be.true;
  const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
  expect(legend.getAttribute('data-truncated')).to.equal('true');
  expect(legend.querySelectorAll('[role="listitem"]').length).to.equal(100);
  expect(legend.querySelector('[role="listitem"]')?.getAttribute('aria-setsize')).to.equal('150');
  expect(legend.querySelector('[part="legend-limit"]')?.textContent?.trim()).to.equal(
    'Showing 1 through 100 of 150 categories',
  );
});

it('bounds labels and contains malformed or hostile legend records', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  const hostile = new Proxy({}, {
    get(): never {
      throw new Error('hostile legend getter');
    },
  });
  el.legend = [
    { color: '#f00', label: 'x'.repeat(400), pattern: 'diagonal' },
    { color: '#0f0', label: 'Missing pattern' },
    hostile,
    { color: '#00f', label: 'Valid', pattern: 'dots' },
  ] as never;
  await el.updateComplete;

  expect(el.legend.length).to.equal(2);
  expect(el.legend[0]!.label.length).to.equal(256);
  expect(el.legend[0]!.label.endsWith('…')).to.be.true;
  expect(el.legendProjection.inputCount).to.equal(4);
  expect(el.legendProjection.omittedCount).to.equal(2);
  expect(el.legendProjection.truncatedLabelCount).to.equal(1);
  expect(el.legendProjection.truncated).to.be.true;
});

it('normalizes a legend assignment that fails Array.isArray (a revoked Proxy) to empty instead of throwing', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  el.legend = proxy as never;
  await el.updateComplete;

  expect(el.legend.length).to.equal(0);
  expect(el.legendProjection.inputCount).to.equal(0);
  expect(el.legendProjection.renderedCount).to.equal(0);
  expect(el.legendProjection.omittedCount).to.equal(0);
  expect(el.legendProjection.truncated).to.be.false;
});

it('normalizes a legend assignment whose own length getter throws to empty instead of throwing', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  const hostileLength = new Proxy([{ color: '#f00', label: 'Unreachable', pattern: 'solid' }], {
    get(target, prop, receiver) {
      if (prop === 'length') throw new Error('hostile length getter');
      return Reflect.get(target, prop, receiver);
    },
  });
  el.legend = hostileLength as never;
  await el.updateComplete;

  expect(el.legend.length).to.equal(0);
  expect(el.legendProjection.inputCount).to.equal(0);
  expect(el.legendProjection.renderedCount).to.equal(0);
});

it('keeps every legend category pattern distinct in forced colors', async () => {
  await setForcedColors('active');
  try {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.legend = [
      { color: '#f00', label: 'Solid', pattern: 'solid' },
      { color: '#0f0', label: 'Diagonal', pattern: 'diagonal' },
      { color: '#00f', label: 'Dots', pattern: 'dots' },
      { color: '#ff0', label: 'Crosshatch', pattern: 'crosshatch' },
    ];
    await el.updateComplete;
    const styles = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')]
      .map((swatch) => getComputedStyle(swatch).borderStyle);
    expect(styles).to.deep.equal(['solid', 'dashed', 'dotted', 'double']);
  } finally {
    await setForcedColors('none');
  }
});

it('projects stable parts onto every supported peer-chrome class without erasing tokens', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  const root = document.createElement('div');
  const cases = [
    ['maplibregl-marker', 'marker'],
    ['maplibregl-popup', 'popup'],
    ['maplibregl-popup-content', 'popup-content'],
    ['maplibregl-popup-close-button', 'popup-close-button'],
    ['maplibregl-ctrl-attrib', 'attribution'],
    ['maplibregl-ctrl-attrib-button', 'attribution-toggle'],
  ] as const;
  for (const [className] of cases) {
    const node = document.createElement(className.includes('button') ? 'button' : 'div');
    node.className = className;
    node.setAttribute('part', 'peer-token');
    root.append(node);
  }
  (el as unknown as { syncPeerChromeParts(root: ParentNode): void }).syncPeerChromeParts(root);
  for (const [className, part] of cases) {
    const tokens = root.querySelector(`.${className}`)!.getAttribute('part')!.split(/\s+/);
    expect(tokens.includes('peer-token')).to.be.true;
    expect(tokens.includes(part)).to.be.true;
  }
});

it('projects parts onto peer chrome added after map construction', async () => {
  const { el } = await connectedMapWithoutMaplibre();
  const internals = el as unknown as {
    loading: boolean;
    observePeerChrome(): void;
  };
  internals.loading = false;
  el.requestUpdate();
  await el.updateComplete;
  internals.observePeerChrome();
  const container = el.shadowRoot!.querySelector('[part="container"]')!;
  const attribution = document.createElement('div');
  attribution.className = 'maplibregl-ctrl-attrib';
  const toggle = document.createElement('button');
  toggle.className = 'maplibregl-ctrl-attrib-button';
  attribution.append(toggle);
  container.append(attribution);
  await waitUntil(
    () => attribution.getAttribute('part') === 'attribution' &&
      toggle.getAttribute('part') === 'attribution-toggle',
    'late peer chrome never received stable parts',
  );
});

it('does not let a LyraMapLegendEntry.color value inject extra CSS declarations via the swatch style attribute', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.legend = [{ color: 'red; position: fixed; top: 0px', label: 'Bad', pattern: 'solid' }];
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
  el.legend = [{ color: 'url(https://attacker.example/beacon.gif)', label: 'Bad', pattern: 'solid' }];
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
  expect(el.shadowRoot!.querySelector('[part="legend"]') == null).to.be.true;
});

it('renders the legend panel once entries are set, and removes it again once cleared', async () => {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.legend = [{ color: '#f00', label: 'High', pattern: 'solid' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]') != null).to.be.true;

  el.legend = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]') == null).to.be.true;
});

describe('aria-label forwarding', () => {
  it('falls back to the localized default when neither label nor a host aria-label is set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map .mapStyle=${LOCAL_STYLE}></lr-map>`)) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal(null);
    expect(base.getAttribute('aria-label')).to.equal(null);
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Map');
  });

  it('uses a .strings override for the localized default when neither label nor a host aria-label is set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`
      <lr-map .mapStyle=${LOCAL_STYLE} .strings=${{ map: 'Carte' }}></lr-map>
    `)) as LyraMap;
    await el.updateComplete;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Carte');
  });

  it('uses the label prop when set', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`
      <lr-map label="Delivery regions" .mapStyle=${LOCAL_STYLE}></lr-map>
    `)) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Delivery regions');
  });

  it('keeps a nonempty host aria-label on the host and gives the canvas a purpose name', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`
      <lr-map aria-label="Forwarded label" .mapStyle=${LOCAL_STYLE}></lr-map>
    `)) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.getAttribute('aria-label')).to.equal('Forwarded label');
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Map');
  });

  it('uses the purpose-specific label prop without cloning the overall host name', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(
      html`<lr-map
        label="Delivery regions"
        aria-label="Forwarded label"
        .mapStyle=${LOCAL_STYLE}
      ></lr-map>`,
    )) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    expect(el.getAttribute('aria-label')).to.equal('Forwarded label');
    expect(el.map!.getCanvas().getAttribute('aria-label')).to.equal('Delivery regions');
  });

  it('preserves an explicit empty host aria-label on the MapLibre canvas, updates it live, and restores the label fallback after removal', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(
      html`<lr-map
        label="Delivery regions"
        aria-label=""
        .mapStyle=${LOCAL_STYLE}
      ></lr-map>`,
    )) as LyraMap;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    const canvas = () => el.map?.getCanvas();

    expect(canvas()?.getAttribute('aria-label')).to.equal('');

    el.setAttribute('aria-label', 'Live delivery map');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Live delivery map');
    expect(canvas()?.getAttribute('aria-label')).to.equal('Delivery regions');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(canvas()?.getAttribute('aria-label')).to.equal('Delivery regions');
  });
});

it('is accessible', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  el.legend = [
    { color: '#f00', label: 'High', pattern: 'diagonal' },
    { color: '#0f0', label: 'Low', pattern: 'dots' },
  ];
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await expect(el).to.be.accessible();
});

it('adds a choropleth source + fill layer, and re-applies the color expression on update', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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

  expect(el.map!.getSource('demo-choropleth') != null).to.be.true;
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
    const sources = new Map<string, typeof fakeSource>([
      ['regions', fakeSource],
      ['lr-data-layer-0', fakeSource],
    ]);
    const layers = new Set([
      'regions-fill',
      'lr-data-layer-0-fill',
      'lr-data-layer-0-line',
      'lr-data-layer-0-circle',
    ]);
    const fakeMap = {
      getSource(sourceId: string): typeof fakeSource | undefined {
        return sources.get(sourceId);
      },
      getLayer(layerId: string): object | undefined {
        return layers.has(layerId) ? {} : undefined;
      },
      setPaintProperty(layerId: string, name: string, value: unknown): void {
        paintCalls.push({ layerId, name, value });
      },
      remove(): void {},
    };
    const privateMap = el as unknown as {
      _map?: unknown;
      _appliedDataLayerIds: Map<string, string>;
      applyChoropleth(): void;
      applyDataLayers(): void;
    };
    privateMap._map = fakeMap;
    privateMap._appliedDataLayerIds = new Map([['zones', 'lr-data-layer-0']]);
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
      paintCalls.find((call) => call.layerId === 'lr-data-layer-0-fill' && call.name === 'fill-opacity')
        ?.value,
    ).to.equal(0.42);
  } finally {
    wrapper.remove();
  }
});

it('paints a data layer fill and stroke from separate colors when both are given', async () => {
  // A fill and its outline want opposite things on a choropleth-plus-overlay map: the fill competes
  // for area and must sit quiet, while the 1px outline competes with nothing and is the only thing
  // keeping a no-data region's shape readable. Deriving one from the other measured 1.41:1 against
  // a light basemap -- under WCAG 1.4.11's 3:1 floor for graphical objects.
  const { wrapper, el } = await connectedMapWithoutMaplibre();
  try {
    const added: { id: string; paint: Record<string, unknown> }[] = [];
    const fakeMap = {
      getSource: (): undefined => undefined,
      addSource(): void {},
      getLayer: (): undefined => undefined,
      addLayer(spec: { id: string; paint?: Record<string, unknown> }): void {
        added.push({ id: spec.id, paint: spec.paint ?? {} });
      },
      setPaintProperty(): void {},
      remove(): void {},
    };
    const privateMap = el as unknown as { _map?: unknown; applyDataLayers(): void };
    privateMap._map = fakeMap;
    el.dataLayers = [{
      sourceId: 'zones',
      geojson: { type: 'FeatureCollection', features: [] },
      color: 'rgb(1, 2, 3)',
      strokeColor: 'rgb(9, 8, 7)',
    }] as never;
    await el.updateComplete;
    privateMap.applyDataLayers();

    const fill = added.find((layer) => layer.id.endsWith('-fill'));
    const line = added.find((layer) => layer.id.endsWith('-line'));
    const circle = added.find((layer) => layer.id.endsWith('-circle'));
    expect(fill?.paint['fill-color'], 'the fill takes color').to.equal('rgb(1, 2, 3)');
    expect(line?.paint['line-color'], 'the outline takes strokeColor').to.equal('rgb(9, 8, 7)');
    expect(circle?.paint['circle-color'], 'points follow the stroke too').to.equal('rgb(9, 8, 7)');
  } finally {
    wrapper.remove();
  }
});

it('falls back through strokeColor to color to tone', async () => {
  const { wrapper, el } = await connectedMapWithoutMaplibre();
  try {
    const added: { id: string; paint: Record<string, unknown> }[] = [];
    const fakeMap = {
      getSource: (): undefined => undefined,
      addSource(): void {},
      getLayer: (): undefined => undefined,
      addLayer(spec: { id: string; paint?: Record<string, unknown> }): void {
        added.push({ id: spec.id, paint: spec.paint ?? {} });
      },
      setPaintProperty(): void {},
      remove(): void {},
    };
    const privateMap = el as unknown as { _map?: unknown; applyDataLayers(): void };
    privateMap._map = fakeMap;
    el.dataLayers = [{
      sourceId: 'zones',
      geojson: { type: 'FeatureCollection', features: [] },
      color: 'rgb(1, 2, 3)',
    }] as never;
    await el.updateComplete;
    privateMap.applyDataLayers();

    const line = added.find((layer) => layer.id.endsWith('-line'));
    expect(line?.paint['line-color'], 'an unset strokeColor follows color').to.equal('rgb(1, 2, 3)');
  } finally {
    wrapper.remove();
  }
});

it('leaves a tone-only data layer painting exactly as before', async () => {
  const { wrapper, el } = await connectedMapWithoutMaplibre();
  try {
    const added: { id: string; paint: Record<string, unknown> }[] = [];
    const fakeMap = {
      getSource: (): undefined => undefined,
      addSource(): void {},
      getLayer: (): undefined => undefined,
      addLayer(spec: { id: string; paint?: Record<string, unknown> }): void {
        added.push({ id: spec.id, paint: spec.paint ?? {} });
      },
      setPaintProperty(): void {},
      remove(): void {},
    };
    const privateMap = el as unknown as { _map?: unknown; applyDataLayers(): void };
    privateMap._map = fakeMap;
    el.dataLayers = [{
      sourceId: 'zones',
      tone: 'success',
      geojson: { type: 'FeatureCollection', features: [] },
    }];
    await el.updateComplete;
    privateMap.applyDataLayers();

    const fill = added.find((layer) => layer.id.endsWith('-fill'));
    const line = added.find((layer) => layer.id.endsWith('-line'));
    expect(
      fill?.paint['fill-color'] === line?.paint['line-color'],
      'with no explicit colors, fill and stroke still share the tone',
    ).to.be.true;
    expect(String(fill?.paint['fill-color'] ?? ''), 'and it is a real color').to.not.equal('');
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
      _appliedDataLayerIds: Map<string, string>;
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
    privateMap._appliedDataLayerIds = new Map([['zones', 'lr-data-layer-0']]);

    wrapper.setAttribute('data-theme', 'dark');
    wrapper.style.setProperty('--lr-map-choropleth-fill-opacity', '0.42');
    wrapper.style.setProperty('--lr-theme-color-success-fill-loud', 'rgb(4, 5, 6)');
    await aTimeout(0);

    const successColor = getComputedStyle(el).getPropertyValue('--lr-color-success').trim();
    expect(getComputedStyle(el).getPropertyValue('--lr-map-choropleth-fill-opacity').trim()).to.equal('0.42');
    expect(paintCalls).to.deep.equal([
      { layerId: 'regions-fill', name: 'fill-opacity', value: 0.42 },
      { layerId: 'lr-data-layer-0-fill', name: 'fill-color', value: successColor },
      { layerId: 'lr-data-layer-0-fill', name: 'fill-opacity', value: 0.42 },
      { layerId: 'lr-data-layer-0-line', name: 'line-color', value: successColor },
      { layerId: 'lr-data-layer-0-circle', name: 'circle-color', value: successColor },
    ]);
    expect(nonPaintCalls).to.deep.equal([]);
  } finally {
    wrapper.remove();
  }
});

it('does not mark an empty-stops choropleth as applied, so a later non-empty update for the same sourceId still creates the fill layer', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('empty-stops', []);
  await el.updateComplete;

  // An empty `stops` array can't build a valid `interpolate` expression, so no
  // fill layer should be considered applied for it.
  expect(el.map!.getLayer('empty-stops-fill') == null).to.be.true;

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

  expect(el.map!.getSource('empty-stops') != null).to.be.true;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 1, lat: 2 }, point: { x: 0, y: 0 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([1, 2]);
  expect(detail!.feature).to.be.undefined;
});

it('detaches and freezes lr-map-click coordinates while retaining the feature identity', () => {
  type MapClickDetail = {
    readonly lngLat: readonly [number, number];
    readonly feature: object | undefined;
  };
  type MapClickEmitter = {
    emit(name: 'lr-map-click', detail: MapClickDetail): CustomEvent<MapClickDetail>;
  };

  const el = document.createElement('lr-map') as LyraMap;
  const lngLat: [number, number] = [7, 8];
  const feature = { id: 'station' };
  const source = { lngLat, feature };
  const event = (el as unknown as MapClickEmitter).emit('lr-map-click', source);

  lngLat[0] = 99;
  expect(event.detail === source).to.equal(false);
  expect(event.detail.lngLat === lngLat).to.equal(false);
  expect(event.detail.lngLat).to.deep.equal([7, 8]);
  expect(event.detail.feature === feature).to.equal(true);
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(Object.isFrozen(event.detail.lngLat)).to.equal(true);
});

it('attaches the clicked choropleth feature to lr-map-click when one exists at the point', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
  el.choropleth = choropleth('vanishing-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntilMapLoaded(el);
  await waitUntil(() => el.map!.getLayer('vanishing-choropleth-fill') != null, 'layer never added', {
    timeout: 2000,
  });
  // Deterministically reproduces "the click handler's own _appliedFillLayerId bookkeeping still
  // names a layer, but that id no longer exists in the live style" -- previously this test tried
  // to observe that same state by reading el.map before its real async 'load' event (and
  // therefore applyChoropleth()) had fired, racing real browser/GL timing. That race was the
  // actual cause of two separate CI failures (a WebKit full-engine shard, then Safari's "Test All
  // Browsers" job): on a fast runner 'load' can win before any poll notices, so the layer already
  // existed by the time the old assertion ran. Removing the real maplibre-gl layer directly, once
  // it has genuinely been added, exercises the exact same click-handler branch
  // (candidate!.getLayer(fillLayerId) ? query : []) with no timing dependency at all.
  el.map!.removeLayer('vanishing-choropleth-fill');
  expect(el.map!.getLayer('vanishing-choropleth-fill') == null).to.be.true;

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
  el.mapStyle = LOCAL_STYLE;
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

  expect(el.map!.getLayer('regions-fill') != null).to.be.true;
  expect(el.map!.getSource('regions') != null).to.be.true;

  el.choropleth = undefined;
  await el.updateComplete;

  expect(el.map!.getLayer('regions-fill') == null).to.be.true;
  expect(el.map!.getSource('regions') == null).to.be.true;
});

it('removes the old choropleth layer/source when sourceId changes', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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

  expect(el.map!.getLayer('regions-a-fill') == null).to.be.true;
  expect(el.map!.getSource('regions-a') == null).to.be.true;
  expect(el.map!.getLayer('regions-b-fill') != null).to.be.true;
  expect(el.map!.getSource('regions-b') != null).to.be.true;
});

it('calls setStyle when mapStyle changes after the map has mounted', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  let calledWith: unknown;
  el.map!.setStyle = ((style: unknown) => {
    calledWith = style;
    return el.map;
  }) as typeof el.map.setStyle;

  const NEXT_STYLE = { ...LOCAL_STYLE, sources: { demo2: LOCAL_STYLE.sources.demo } };
  el.mapStyle = NEXT_STYLE as typeof LOCAL_STYLE;
  await el.updateComplete;

  expect(calledWith).to.deep.equal(NEXT_STYLE);
  expect(calledWith).not.to.equal(NEXT_STYLE);
  expect(Object.isFrozen(calledWith)).to.be.true;
  expect(
    Object.isFrozen((calledWith as typeof NEXT_STYLE).sources)
  ).to.be.true;
});

it('accepts the string style-URL form of mapStyle and passes it through to setStyle, not just the StyleSpecification object form', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
        new Response(JSON.stringify(LOCAL_STYLE), {
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
  el.mapStyle = LOCAL_STYLE;
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
  // so the new style itself is valid — only the base layer's paint
  // changes — unlike the sibling "calls setStyle..." test above, which
  // stubs setStyle() out entirely and so never actually applies its
  // mismatched source/layer ids.)
  const NEXT_STYLE = {
    ...LOCAL_STYLE,
    layers: [{ id: 'demo', type: 'fill', source: 'demo', paint: { 'fill-opacity': 0.9 } }],
  };
  el.mapStyle = NEXT_STYLE as typeof LOCAL_STYLE;
  await el.updateComplete;

  await waitUntil(() => el.map!.getLayer('style-reload-fill') != null, 'choropleth never re-applied', {
    timeout: 2000,
  });
  expect(el.map!.getSource('style-reload') != null).to.be.true;
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
  } as unknown as import('./map.js').LyraMapGeoJsonDataLayer;

  it('defaults to an empty array with zero behavior change', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    expect(el.dataLayers).to.deep.equal([]);
  });

  it('retains the first unique nonempty data-layer sourceId before reconciliation', async function () {
    if (!hasWebGL2) this.skip();
    const el = await fixture<LyraMap>(html`<lr-map></lr-map>`);
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => Boolean(dataLayerResourceId(el, 'zones')), 'source never added', { timeout: 2000 });

    const sourceId = dataLayerResourceId(el, 'zones');
    const source = el.map!.getSource(sourceId) as { setData: (geojson: unknown) => void };
    const updates: unknown[] = [];
    const originalSetData = source.setData.bind(source);
    source.setData = (geojson: unknown) => {
      updates.push(geojson);
      originalSetData(geojson);
    };
    const firstGeojson = { type: 'FeatureCollection', features: [] } as const;
    const duplicateGeojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null, properties: { duplicate: true } }],
    } as const;

    el.dataLayers = [
      { sourceId: '', geojson: firstGeojson },
      { sourceId: ' zones ', geojson: firstGeojson },
      { sourceId: 'zones', geojson: duplicateGeojson },
    ] as unknown as typeof el.dataLayers;
    await el.updateComplete;

    expect(updates).to.deep.equal([firstGeojson]);
    const applied = (el as unknown as { _appliedDataLayerIds: Map<string, string> })._appliedDataLayerIds;
    expect([...applied.keys()]).to.deep.equal(['zones']);
  });

  it('keeps a colliding base-style source owned by its style across add and removal', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [{ ...POLY_LAYER, sourceId: 'demo' }];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => {
      const dataSourceId = dataLayerResourceId(el, 'demo');
      return Boolean(dataSourceId && el.map!.getSource(dataSourceId));
    }, 'component-owned source never became available', { timeout: 2000 });

    const dataSourceId = dataLayerResourceId(el, 'demo');
    expect(dataSourceId === 'demo').to.be.false;
    expect(el.map!.getSource('demo') != null).to.be.true;
    expect(el.map!.getSource(dataSourceId) != null).to.be.true;

    el.dataLayers = [];
    await el.updateComplete;

    expect(el.map!.getSource('demo') != null).to.be.true;
    expect(el.map!.getSource(dataSourceId) == null).to.be.true;
  });

  it('adds a source and fill/line/circle layers per entry once the style loads', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => {
      const sourceId = dataLayerResourceId(el, 'zones');
      return el.map!.getLayer(`${sourceId}-fill`) != null;
    }, 'fill layer never added', {
      timeout: 2000,
    });

    const sourceId = dataLayerResourceId(el, 'zones');
    expect(el.map!.getSource(sourceId) != null).to.be.true;
    expect(el.map!.getLayer(`${sourceId}-fill`) != null).to.be.true;
    expect(el.map!.getLayer(`${sourceId}-line`) != null).to.be.true;
  });

  it('removing an entry (dataLayers reassigned without it) removes its source/layers, leaking nothing', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => {
      const sourceId = dataLayerResourceId(el, 'zones');
      return el.map!.getLayer(`${sourceId}-fill`) != null;
    }, 'fill layer never added', {
      timeout: 2000,
    });
    const sourceId = dataLayerResourceId(el, 'zones');

    el.dataLayers = [];
    await el.updateComplete;

    expect(el.map!.getSource(sourceId) == null).to.be.true;
    expect(el.map!.getLayer(`${sourceId}-fill`) == null).to.be.true;
    expect(el.map!.getLayer(`${sourceId}-line`) == null).to.be.true;
    expect(el.map!.getLayer(`${sourceId}-circle`) == null).to.be.true;
  });

  it('updates existing source data in place when the same sourceId is reassigned with new geojson', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => {
      const sourceId = dataLayerResourceId(el, 'zones');
      return el.map!.getSource(sourceId) != null;
    }, 'source never added', { timeout: 2000 });

    const sourceId = dataLayerResourceId(el, 'zones');
    const source = el.map!.getSource(sourceId) as { setData: (g: unknown) => void };
    let called = 0;
    const originalSetData = source.setData.bind(source);
    source.setData = (g: unknown) => {
      called++;
      originalSetData(g);
    };

    el.dataLayers = [{ ...POLY_LAYER, geojson: { type: 'FeatureCollection', features: [] } }];
    await el.updateComplete;

    expect(called).to.equal(1);
    expect(el.map!.getSource(sourceId) === source).to.be.true;
  });

  it('re-applies dataLayers after a mapStyle change (style.load handshake)', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [POLY_LAYER];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(() => {
      const sourceId = dataLayerResourceId(el, 'zones');
      return el.map!.getLayer(`${sourceId}-fill`) != null;
    }, 'fill layer never added', {
      timeout: 2000,
    });

    // Same "demo" source id as LOCAL_STYLE so the new style itself stays valid --
    // only the base layer's paint changes -- mirroring the sibling choropleth
    // "re-applies the choropleth once the new style finishes loading" test above.
    const NEXT_STYLE = {
      ...LOCAL_STYLE,
      layers: [{ id: 'demo', type: 'fill', source: 'demo', paint: { 'fill-opacity': 0.9 } }],
    };
    el.mapStyle = NEXT_STYLE as typeof LOCAL_STYLE;
    await el.updateComplete;

    await waitUntil(() => {
      const sourceId = dataLayerResourceId(el, 'zones');
      return el.map!.getLayer(`${sourceId}-fill`) != null;
    }, 'dataLayers never re-applied', {
      timeout: 2000,
    });
    expect(el.map!.getSource(dataLayerResourceId(el, 'zones')) != null).to.be.true;
  });

  it('caps dataLayers at MAX_MAP_DATA_LAYERS, only applying the capped count of sources/layers', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    const CAP = 100; // mirrors map.class.ts's private MAX_MAP_DATA_LAYERS
    el.dataLayers = Array.from({ length: CAP * 2 }, (_, index) => ({
      ...POLY_LAYER,
      sourceId: `zone-${index}`,
    })) as unknown as typeof el.dataLayers;
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(
      () => Boolean(dataLayerResourceId(el, `zone-${CAP - 1}`)),
      'last within-cap data layer never applied',
      { timeout: 5000 },
    );

    const applied = (el as unknown as { _appliedDataLayerIds: Map<string, string> })._appliedDataLayerIds;
    expect(applied.size).to.equal(CAP);
    expect(dataLayerResourceId(el, `zone-${CAP}`)).to.equal('');
  });
});

it('adds a maplibregl.Marker per entry in markers', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
  await expect(el).to.be.accessible();
});

it('exposes every declarative marker as a named button and emits one immutable activation per pointer, Enter, or Space action', async () => {
  const { el } = await connectedMapWithoutMaplibre();
  const markerElement = document.createElement('div');
  const authoredMarker = {
    id: ' station-a ',
    lngLat: [6.13, 49.61] as const,
    label: 'Station A',
    color: '#123456',
  };
  const details: Array<Record<string, unknown>> = [];
  const events: CustomEvent<Record<string, unknown>>[] = [];
  el.addEventListener('lr-map-marker-activate', (event) => {
    const activationEvent = event as CustomEvent<Record<string, unknown>>;
    events.push(activationEvent);
    details.push(activationEvent.detail);
  });
  const privateMap = el as unknown as {
    configureMarkerInteraction(
      element: HTMLElement,
      activation: { id?: string; lngLat: readonly [number, number]; marker: unknown },
    ): void;
  };
  privateMap.configureMarkerInteraction(markerElement, {
    id: 'station-a',
    lngLat: [6.13, 49.61],
    marker: authoredMarker,
  });

  expect(markerElement.getAttribute('role')).to.equal('button');
  expect(markerElement.getAttribute('tabindex')).to.equal('0');
  expect(markerElement.getAttribute('aria-label')).to.equal('Station A');

  markerElement.click();
  markerElement.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, composed: true, cancelable: true,
  }));
  const space = new KeyboardEvent('keydown', {
    key: ' ', bubbles: true, composed: true, cancelable: true,
  });
  markerElement.dispatchEvent(space);

  expect(space.defaultPrevented, 'Space activates without scrolling the page').to.be.true;
  expect(details.map((detail) => detail['source'])).to.deep.equal([
    'pointer',
    'keyboard',
    'keyboard',
  ]);
  expect(details.every((detail) => detail['id'] === 'station-a')).to.be.true;
  expect(details[0]!['lngLat']).to.deep.equal([6.13, 49.61]);
  expect((details[0]!['marker'] as { label?: string }).label).to.equal('Station A');
  expect(Object.isFrozen(details[0])).to.be.true;
  expect(Object.isFrozen(details[0]!['lngLat'])).to.be.true;
  expect(Object.isFrozen(details[0]!['marker'])).to.be.true;
  expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
  expect(events.every((event) => !event.cancelable)).to.be.true;

  const repeated = new KeyboardEvent('keydown', {
    key: 'Enter', repeat: true, bubbles: true, cancelable: true,
  });
  markerElement.dispatchEvent(repeated);
  const vetoed = new KeyboardEvent('keydown', {
    key: ' ', bubbles: true, cancelable: true,
  });
  vetoed.preventDefault();
  markerElement.dispatchEvent(vetoed);
  const canceledClick = new MouseEvent('click', { bubbles: true, cancelable: true });
  canceledClick.preventDefault();
  markerElement.dispatchEvent(canceledClick);
  markerElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(
    details.length,
    'repeat, already-consumed, canceled pointer, and unrelated keys do not activate',
  ).to.equal(3);

  privateMap.configureMarkerInteraction(markerElement, {
    id: undefined,
    lngLat: [2.35, 48.86],
    marker: { lngLat: [2.35, 48.86], label: 'Updated marker' },
  });
  markerElement.click();
  expect(details[3]!['id']).to.equal(undefined);
  expect(details[3]!['lngLat']).to.deep.equal([2.35, 48.86]);
  expect((details[3]!['marker'] as { label?: string }).label).to.equal('Updated marker');
});

it('caps markers at MAX_MAP_MARKERS, creating only the capped count of marker DOM elements', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  const CAP = 2_000; // mirrors map.class.ts's private MAX_MAP_MARKERS
  el.markers = Array.from({ length: CAP * 2 }, (_, index) => ({
    id: `marker-${index}`,
    lngLat: [0, 0] as [number, number],
  }));
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('.maplibregl-marker').length).to.equal(CAP);
});

it('provides shadow-local layout for MapLibre canvas, markers, and popups without document CSS', async function () {
  if (!hasWebGL2) this.skip();
  const module = await loadMaplibre();
  if (!module) throw new Error('maplibre-gl test peer is unavailable');
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary: () => Promise<typeof module> }).loadLibrary = () =>
    Promise.resolve(module);
  el.style.cssText = 'inline-size: 20rem; block-size: 12rem';
  el.mapStyle = LOCAL_STYLE;
  let resolveCanvas!: (canvas: HTMLCanvasElement) => void;
  const canvasReady = new Promise<HTMLCanvasElement>((resolve) => {
    resolveCanvas = resolve;
  });
  setMapCanvasReadyCallback(el, resolveCanvas);
  document.body.append(el);
  (el as unknown as { visible: boolean }).visible = true;

  try {
    const canvas = await canvasReady;
    expect(el.map != null).to.be.true;
    el.map!.fire('load');
    el.markers = [{ id: 'station', lngLat: [10, 20], label: 'Station A' }];
    await el.updateComplete;

    const container = el.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
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
    await waitUntil(
      () => el.shadowRoot!.querySelector('.maplibregl-popup') != null,
      'popup never opened',
    );
    const popup = el.shadowRoot!.querySelector('.maplibregl-popup') as HTMLElement;
    const popupContent = el.shadowRoot!.querySelector('.maplibregl-popup-content') as HTMLElement;
    const popupClose = el.shadowRoot!.querySelector('.maplibregl-popup-close-button') as HTMLElement;
    expect(marker.getAttribute('part')?.split(/\s+/).includes('marker')).to.be.true;
    expect(popup.getAttribute('part')?.split(/\s+/).includes('popup')).to.be.true;
    expect(popupContent.getAttribute('part')?.split(/\s+/).includes('popup-content')).to.be.true;
    expect(popupClose.getAttribute('part')?.split(/\s+/).includes('popup-close-button')).to.be.true;
    expect(getComputedStyle(popup).position).to.equal('absolute');
    expect(getComputedStyle(popup).display).to.equal('flex');
    expect(getComputedStyle(popup).pointerEvents).to.equal('none');
    expect(getComputedStyle(popupContent).pointerEvents).to.equal('auto');
    expect(getComputedStyle(popupClose).position).to.equal('absolute');
  } finally {
    setMapCanvasReadyCallback(el, null);
    el.remove();
  }
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

it('keeps popup anchor tip alignment tied to the physical MapLibre anchor class, not page direction', async () => {
  // maplibre-gl assigns maplibregl-popup-anchor-left/-right at runtime from physical viewport
  // collision detection (which side of the map has room for the popup relative to the marker's
  // screen position) -- it has nothing to do with page text direction. The same anchor class
  // must therefore produce the same flex-direction (tip alignment) under dir="ltr" and
  // dir="rtl" alike.
  const anchorFlexDirection = async (
    dir: 'ltr' | 'rtl',
    anchorClass: string,
  ): Promise<string> => {
    const wrapper = (await fixture(html`<div dir=${dir}></div>`)) as HTMLElement;
    const el = document.createElement('lr-map') as LyraMap;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
      new Promise(() => {});
    wrapper.append(el);
    await el.updateComplete;
    const popup = document.createElement('div');
    popup.className = `maplibregl-popup ${anchorClass}`;
    el.shadowRoot!.append(popup);
    return getComputedStyle(popup).flexDirection;
  };

  const leftLtr = await anchorFlexDirection('ltr', 'maplibregl-popup-anchor-left');
  const leftRtl = await anchorFlexDirection('rtl', 'maplibregl-popup-anchor-left');
  expect(leftLtr).to.equal('row');
  expect(leftRtl).to.equal(leftLtr);

  const rightLtr = await anchorFlexDirection('ltr', 'maplibregl-popup-anchor-right');
  const rightRtl = await anchorFlexDirection('rtl', 'maplibregl-popup-anchor-right');
  expect(rightLtr).to.equal('row-reverse');
  expect(rightRtl).to.equal(rightLtr);
});

it('keeps choropleth and data-layer sources distinct when their public sourceId collides', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  el.dataLayers = [{
    sourceId: 'shared',
    geojson: { type: 'FeatureCollection', features: [] },
  }];
  await el.updateComplete;
  await waitUntilMapLoaded(el);
  await waitUntil(
    () => {
      const choroplethSourceId = choroplethResourceId(el);
      const dataSourceId = dataLayerResourceId(el, 'shared');
      return Boolean(
        choroplethSourceId &&
        dataSourceId &&
        choroplethSourceId !== dataSourceId &&
        el.map!.getLayer(`${choroplethSourceId}-fill`) &&
        el.map!.getLayer(`${dataSourceId}-line`),
      );
    },
    'colliding layers never became distinct',
    { timeout: 2000 },
  );
  expect(el.map!.getSource(choroplethResourceId(el)) != null).to.be.true;
  expect(el.map!.getSource(dataLayerResourceId(el, 'shared')) != null).to.be.true;
});

it('keeps the choropleth source distinct from every colliding public data source id', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  el.dataLayers = [
    { sourceId: 'shared', geojson: { type: 'FeatureCollection', features: [] } },
    { sourceId: 'lr-choropleth-shared', geojson: { type: 'FeatureCollection', features: [] } },
  ];
  await el.updateComplete;
  await waitUntilMapLoaded(el);
  await waitUntil(
    () => {
      const first = dataLayerResourceId(el, 'shared');
      const second = dataLayerResourceId(el, 'lr-choropleth-shared');
      const choroplethSourceId = choroplethResourceId(el);
      return Boolean(
        first &&
        second &&
        choroplethSourceId &&
        first !== second &&
        choroplethSourceId !== first &&
        choroplethSourceId !== second &&
        el.map!.getSource(choroplethSourceId),
      );
    },
    'component-owned data source ids did not become distinct',
    { timeout: 2000 },
  );

  expect(el.map!.getSource(choroplethResourceId(el)) != null).to.be.true;
  expect(el.map!.getSource(dataLayerResourceId(el, 'shared')) != null).to.be.true;
  expect(el.map!.getSource(dataLayerResourceId(el, 'lr-choropleth-shared')) != null).to.be.true;
});

it('can replace a choropleth with a same-id data layer in one reactive update', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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

  const dataSourceId = dataLayerResourceId(el, 'shared');
  expect(el.map!.getSource('shared') == null).to.be.true;
  expect(el.map!.getSource(dataSourceId) != null).to.be.true;
  expect(el.map!.getLayer(`${dataSourceId}-fill`) != null).to.be.true;
  expect(el.map!.getLayer(`${dataSourceId}-line`) != null).to.be.true;
  expect(el.map!.getLayer(`${dataSourceId}-circle`) != null).to.be.true;
});

it('preserves colliding choropleth and data-layer namespaces across clear and style reload', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  el.choropleth = choropleth('shared', [[0, '#000000'], [1, '#ffffff']]);
  el.dataLayers = [{
    sourceId: 'shared',
    geojson: { type: 'FeatureCollection', features: [] },
  }];
  await el.updateComplete;
  await waitUntilMapLoaded(el);

  el.mapStyle = {
    ...LOCAL_STYLE,
    layers: [{ id: 'demo', type: 'fill', source: 'demo', paint: { 'fill-opacity': 0.8 } }],
  } as typeof LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(
    () => {
      const choroplethSourceId = choroplethResourceId(el);
      return Boolean(
        choroplethSourceId &&
        el.map!.getSource(choroplethSourceId) &&
        el.map!.getSource(dataLayerResourceId(el, 'shared')),
      );
    },
    'colliding sources were not restored after style reload',
    { timeout: 2000 },
  );

  const choroplethSourceId = choroplethResourceId(el);
  el.choropleth = undefined;
  await el.updateComplete;
  const dataSourceId = dataLayerResourceId(el, 'shared');
  expect(el.map!.getSource(choroplethSourceId) == null).to.be.true;
  expect(el.map!.getSource(dataSourceId) != null).to.be.true;
  expect(el.map!.getLayer(`${dataSourceId}-line`) != null).to.be.true;
});

it('removes markers no longer present and reuses markers that persist', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  expect(textMarker!.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(htmlMarker!.getAttribute('aria-haspopup')).to.equal('dialog');
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
  expect(htmlMarker!.getAttribute('aria-haspopup')).to.equal(null);
  expect(htmlMarker!.getAttribute('aria-expanded')).to.equal(null);
  expect(htmlMarker!.getAttribute('role')).to.equal('button');
  expect(htmlMarker!.getAttribute('tabindex')).to.equal('0');
});

it('attaches an openable popup when label or html is provided', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{ id: 'a', lngLat: [10, 20], label: 'Station A' }];
  await el.updateComplete;

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  const space = new KeyboardEvent('keydown', {
    key: ' ',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  markerEl.dispatchEvent(space);
  expect(space.defaultPrevented, 'Space activation must not also scroll the page').to.be.true;
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  expect(el.shadowRoot!.querySelector('.maplibregl-popup-content')!.textContent).to.contain('Station A');
});

it('keeps one keyboard popup toggle while marker activation prevents Space scroll', async () => {
  const { el } = await connectedMapWithoutMaplibre();
  const markerElement = document.createElement('button');
  let hasPopup = true;
  let toggles = 0;
  markerElement.setAttribute('aria-expanded', 'false');
  const marker = {
    getPopup: (): object | undefined => hasPopup ? {} : undefined,
  };
  // Stand in for MapLibre's own target-phase keyboard activation. The component boundary handler
  // must suppress the browser Space scroll default without stopping this one peer-owned toggle.
  markerElement.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && marker.getPopup()) {
      toggles += 1;
      markerElement.setAttribute(
        'aria-expanded',
        markerElement.getAttribute('aria-expanded') === 'true' ? 'false' : 'true',
      );
    }
  });
  (el as unknown as {
    configureMarkerInteraction: (
      element: HTMLElement,
      activation: { id?: string; lngLat: readonly [number, number]; marker: unknown },
    ) => void;
  }).configureMarkerInteraction(markerElement, {
    id: 'keyboard-marker',
    lngLat: [0, 0],
    marker: { id: 'keyboard-marker', lngLat: [0, 0], label: 'Keyboard marker' },
  });

  const space = new KeyboardEvent('keydown', {
    key: ' ',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  markerElement.dispatchEvent(space);
  expect(space.defaultPrevented).to.be.true;
  expect(toggles).to.equal(1);
  expect(markerElement.getAttribute('aria-expanded')).to.equal('true');

  const enter = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  markerElement.dispatchEvent(enter);
  expect(enter.defaultPrevented).to.be.false;
  expect(toggles).to.equal(2);
  expect(markerElement.getAttribute('aria-expanded')).to.equal('false');

  hasPopup = false;
  const plainSpace = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
  markerElement.dispatchEvent(plainSpace);
  expect(plainSpace.defaultPrevented).to.be.true;
  expect(toggles).to.equal(2);
});

it('removes all marker DOM on disconnect', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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

it('renders a colored marker and derives its accessible name from visible popup HTML', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [{
    id: 'a',
    lngLat: [10, 20],
    color: '#ff0000',
    unsafeHtml: '<strong>Station A</strong><script>hidden script name</script><span hidden>Hidden</span>',
  }];
  await el.updateComplete;

  const markerEl = el.shadowRoot!.querySelector('.maplibregl-marker') as HTMLElement;
  expect((markerEl) != null).to.equal(true);
  expect(markerEl.getAttribute('aria-label')).to.equal('Station A');
  markerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitUntil(
    () => el.shadowRoot!.querySelector('.maplibregl-popup-content') != null,
    'popup never opened',
  );
  const popupContent = el.shadowRoot!.querySelector('.maplibregl-popup-content')!;
  expect((popupContent.querySelector('strong')) != null).to.equal(true);
  expect(popupContent.textContent).to.contain('Station A');
});

it('keeps the host name on the host and a localized purpose name on the real MapLibre focus owner', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`
    <lr-map
      aria-label="Delivery map"
      lang="fr-FR"
      .strings=${{ map: 'Carte', close: 'Fermer' }}
    ></lr-map>
  `)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  const canvas = el.map!.getCanvas() as HTMLCanvasElement;
  const container = el.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(el.getAttribute('aria-label')).to.equal('Delivery map');
  expect(canvas.getAttribute('aria-label')).to.equal('Carte');
  expect(container.getAttribute('lang')).to.equal('fr-FR');
  expect(base.getAttribute('role')).to.equal(null);
  expect(base.getAttribute('aria-label')).to.equal(null);

  el.setAttribute('aria-label', 'Carte des livraisons');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Carte des livraisons');
  expect(canvas.getAttribute('aria-label')).to.equal('Carte');
});

it('synchronizes popup-capable marker disclosure semantics and localized popup ownership', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`
    <lr-map lang="fr-FR" .strings=${{ close: 'Fermer' }}></lr-map>
  `)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
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
  expect(popup.closest('[lang="fr-FR"]') != null).to.be.true;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
          .legend=${[{ color: '#f00', label: 'LongestUnbrokenLegendLabel'.repeat(80), pattern: 'solid' }]}
        ></lr-map>
      </div>
      <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%">
        <lr-map
          style="block-size: var(--lr-size-12rem)"
          .legend=${[{ color: '#00f', label: 'أطولتسميةوسيلةإيضاحمتصلة'.repeat(80), pattern: 'dots' }]}
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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
  el.mapStyle = LOCAL_STYLE;
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

it('retains the first unique nonempty explicit marker id while preserving idless occurrences', async function () {
  if (!hasWebGL2) this.skip();
  const el = await fixture<LyraMap>(html`<lr-map></lr-map>`);
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  el.map!.fire('load');

  el.markers = [
    { id: '', lngLat: [0, 0], label: 'Empty explicit id' },
    { id: ' station ', lngLat: [1, 1], label: 'First explicit id' },
    { id: 'station', lngLat: [2, 2], label: 'Duplicate explicit id' },
    { lngLat: [3, 3], label: 'First idless' },
    { lngLat: [3, 3], label: 'Second idless' },
  ];
  await el.updateComplete;

  const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.maplibregl-marker')]
    .map((marker) => marker.getAttribute('aria-label'));
  expect(labels).to.have.members(['First explicit id', 'First idless', 'Second idless']);
  expect(labels).to.have.length(3);
});

async function waitUntilMapLoaded(el: LyraMap): Promise<void> {
  const internal = el as unknown as { _styleLoaded: boolean };
  if (!internal._styleLoaded) await oneEvent(el, 'lr-map-load');
  if (!el.map || !internal._styleLoaded) {
    throw new Error('map load handshake completed without a map');
  }
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
  } as unknown as import('./map.js').LyraMapChoroplethLayer;
}

describe('continuous choropleth legend', () => {
  const STOPS = [
    [0, '#f7fbff'],
    [50, '#6baed6'],
    [100, '#08306b'],
  ] as const;

  it('renders no legend panel at all when nothing asks for one', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    await el.updateComplete;
    // Compared as a boolean, never as a node: a failing chai assertion carrying a DOM node as
    // actual/expected hangs the whole file until the per-file watchdog.
    expect(
      el.shadowRoot!.querySelector('[part="legend"]') === null,
      'unset default is unchanged'
    ).to.be.true;
  });

  it('renders a gradient bar with endpoint captions from the choropleth stops', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.legendGradient = STOPS;
    await el.updateComplete;

    const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="legend-gradient"]');
    expect(bar, 'the ramp bar renders').to.exist;
    const image = bar!.style.backgroundImage;
    expect(image, 'every stop reaches the gradient').to.contain('linear-gradient');
    expect(image).to.contain('0%');
    expect(image).to.contain('100%');
    // 50 of a 0..100 span sits at its true proportion, not at an evenly-spaced third.
    expect(image, 'intermediate stops sit at their value proportion').to.contain('50%');

    expect(
      el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent!.trim(),
      'low caption defaults to the lowest stop value'
    ).to.equal('0');
    expect(
      el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent!.trim(),
      'high caption defaults to the highest stop value'
    ).to.equal('100');
  });

  it('lets the endpoint captions be overridden', async () => {
    const el = (await fixture(
      html`<lr-map
        legend-gradient-lo-label="none"
        legend-gradient-hi-label="≥ 100"
      ></lr-map>`
    )) as LyraMap;
    el.legendGradient = STOPS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent!.trim()).to.equal('none');
    expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent!.trim()).to.equal('≥ 100');
  });

  it('sorts stops ascending and drops unusable ones', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.legendGradient = [
      null,
      [50],
      [75, 42],
      [100, '#08306b'],
      [Number.NaN, '#ff0000'],
      [0, '#f7fbff'],
      [25, 'not-a-color'],
    ] as unknown as readonly (readonly [number, string])[];
    await el.updateComplete;
    expect(
      el.legendGradient.map(([value]) => value),
      'sorted ascending, non-finite and unparsable-colour stops removed'
    ).to.deep.equal([0, 100]);

    el.legendGradient = null as never;
    await el.updateComplete;
    expect(el.legendGradient).to.deep.equal([]);
  });

  it('renders no bar for fewer than two usable stops, since a flat block describes nothing', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.legendGradient = [[5, '#08306b']] as unknown as readonly (readonly [number, string])[];
    await el.updateComplete;
    expect(el.legendGradient.length).to.equal(0);
    expect(
      el.shadowRoot!.querySelector('[part="legend-gradient"]') === null,
      'no bar rendered'
    ).to.be.true;
  });

  it('hides the ramp bar from assistive tech, leaving the captions to carry the meaning', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.legendGradient = STOPS;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="legend-gradient"]')!;
    expect(bar.getAttribute('aria-hidden')).to.equal('true');
    expect(bar.hasAttribute('inert'), 'not a tab stop either').to.be.true;
  });

  it('opens the legend panel for slotted legend content alone', async () => {
    const el = (await fixture(
      html`<lr-map><div slot="legend" id="custom">Custom key</div></lr-map>`
    )) as LyraMap;
    await el.updateComplete;
    await aTimeout(0);
    expect(
      el.shadowRoot!.querySelector('[part="legend"]'),
      'the panel renders so slotted content sits inside the map layout'
    ).to.exist;
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="legend"]')!;
    expect(
      slot.assignedElements({ flatten: true }).map((node) => node.id),
      'the custom legend is assigned'
    ).to.deep.equal(['custom']);
  });
});

describe('choropleth interpolation', () => {
  const GEOJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { population: 5 },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      },
    ],
  } as never;

  const paintExprFor = async (interpolation?: string) => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const applied: unknown[] = [];
    // Stand in for the maplibre instance: applyChoropleth() only needs the handful of methods it
    // calls, and this keeps the assertion on the emitted expression rather than on a real GL context.
    (el as unknown as { _map: unknown })._map = {
      getSource: () => undefined,
      addSource: () => {},
      getLayer: () => undefined,
      addLayer: (spec: { paint?: Record<string, unknown> }) => {
        applied.push(spec.paint?.['fill-color']);
      },
      setPaintProperty: () => {},
      getStyle: () => ({ layers: [] }),
    };
    el.choropleth = {
      sourceId: 'regions',
      geojson: GEOJSON,
      field: 'population',
      stops: [[0, '#eee'], [100, '#036']],
      ...(interpolation ? { interpolation } : {}),
    } as never;
    (el as unknown as { applyChoropleth: () => void }).applyChoropleth();
    return applied[0] as unknown[];
  };

  it('interpolates linearly by default, unchanged', async () => {
    const expr = await paintExprFor();
    expect(expr[0]).to.equal('interpolate');
    expect(expr[1], 'the unset default stays linear').to.deep.equal(['linear']);
  });

  it('emits an exponential interpolation for logarithmic, compressing a heavy tail', async () => {
    // maplibre has no ['log'] interpolation; ['exponential', base<1] is the documented way to
    // weight the ramp toward the low end, which is the effect a log scale is wanted for.
    const expr = await paintExprFor('logarithmic');
    expect(expr[0]).to.equal('interpolate');
    expect((expr[1] as unknown[])[0]).to.equal('exponential');
    expect((expr[1] as unknown[])[1], 'a sub-1 base').to.be.lessThan(1);
  });

  it('emits a step expression for discrete bands rather than a ramp', async () => {
    // A continuous ramp puts colors on the map that appear nowhere in a banded legend, and renders
    // two regions in the same advertised band as visibly different colors.
    const expr = await paintExprFor('step' as never);
    expect(expr[0], 'discrete bands, not a ramp').to.equal('step');
    expect(expr[1]).to.deep.equal(['get', 'population']);
    expect(expr[2], 'the base output defaults to the first stop color').to.equal('#eee');
    expect(expr.slice(3), 'thresholds stay in the data own units').to.deep.equal([
      0,
      '#eee',
      100,
      '#036',
    ]);
  });

  it('keeps stops in the data own units under either interpolation', async () => {
    // The whole point: a consumer must not have to pre-transform to log10 and then hand-relabel
    // the legend back into real units.
    const linear = await paintExprFor();
    const log = await paintExprFor('logarithmic');
    expect(linear.slice(3), 'linear stop values').to.deep.equal([0, '#eee', 100, '#036']);
    expect(log.slice(3), 'identical stop values under log').to.deep.equal([0, '#eee', 100, '#036']);
  });
});

// `lr-map-click` used to query only the choropleth fill layer, so clicking a `dataLayers` polygon
// produced `feature: undefined` -- indistinguishable from clicking empty ocean. That broke the
// pattern the two properties invite: choropleth for features that have a value, a data layer for
// features that exist but have none.
describe('lr-map-click across choropleth and dataLayers', () => {
  const ZONES = {
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
  } as unknown as import('./map.js').LyraMapGeoJsonDataLayer;

  async function readyMap(): Promise<LyraMap> {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    await el.updateComplete;
    await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
    await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });
    return el;
  }

  /** Data layers get generated internal ids (`lr-data-layer-N`), so a test must resolve the
   *  authored `sourceId` through the component rather than assuming the public name. */
  const resolvedSourceId = (el: LyraMap, publicSourceId: string): string =>
    (el as unknown as { _appliedDataLayerIds: Map<string, string> })._appliedDataLayerIds.get(
      publicSourceId
    ) ?? '';

  async function withZones(): Promise<{ el: LyraMap; zones: string }> {
    const el = await readyMap();
    el.dataLayers = [ZONES];
    await el.updateComplete;
    await waitUntil(() => resolvedSourceId(el, 'zones') !== '', 'data layer never applied', {
      timeout: 2000,
    });
    const zones = resolvedSourceId(el, 'zones');
    await waitUntil(() => el.map!.getLayer(`${zones}-fill`) != null, 'fill layer never added', {
      timeout: 2000,
    });
    return { el, zones };
  }

  it('queries every applied dataLayers layer, not only the choropleth fill', async function () {
    if (!hasWebGL2) this.skip();
    const { el, zones } = await withZones();
    el.choropleth = choropleth('both-choropleth', [
      [0, '#000000'],
      [10, '#ffffff'],
    ]);
    await el.updateComplete;
    await waitUntil(() => el.map!.getLayer('both-choropleth-fill') != null, 'choropleth layer', {
      timeout: 2000,
    });

    let queried: string[] = [];
    el.map!.queryRenderedFeatures = ((_point: unknown, options?: { layers?: string[] }) => {
      queried = options?.layers ?? [];
      return [];
    }) as typeof el.map.queryRenderedFeatures;
    el.map!.fire('click', { lngLat: { lng: 1, lat: 2 }, point: { x: 5, y: 5 } });

    expect(queried, 'choropleth fill still queried').to.include('both-choropleth-fill');
    expect(queried, 'data layer fill queried').to.include(`${zones}-fill`);
    expect(queried, 'data layer line queried').to.include(`${zones}-line`);
    expect(queried, 'data layer circle queried').to.include(`${zones}-circle`);
  });

  it('attributes a data-layer hit to its authored sourceId', async function () {
    if (!hasWebGL2) this.skip();
    const { el, zones } = await withZones();
    const hit = {
      type: 'Feature',
      properties: { name: 'no data' },
      geometry: { type: 'Point', coordinates: [0, 0] },
      layer: { id: `${zones}-fill` },
    };
    el.map!.queryRenderedFeatures = (() => [hit]) as typeof el.map.queryRenderedFeatures;

    let detail: { feature?: unknown; origin?: string; sourceId?: string } | undefined;
    el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
    el.map!.fire('click', { lngLat: { lng: 0, lat: 0 }, point: { x: 5, y: 5 } });

    expect(detail!.feature, 'the data-layer polygon is now identifiable').to.equal(hit);
    expect(detail!.origin).to.equal('data-layer');
    expect(detail!.sourceId).to.equal('zones');
  });

  it('attributes a choropleth hit to the choropleth, with no sourceId', async function () {
    if (!hasWebGL2) this.skip();
    const el = await readyMap();
    el.choropleth = choropleth('attributed-choropleth', [
      [0, '#000000'],
      [10, '#ffffff'],
    ]);
    await el.updateComplete;
    await waitUntil(
      () => el.map!.getLayer('attributed-choropleth-fill') != null,
      'layer never added',
      { timeout: 2000 }
    );

    const hit = {
      type: 'Feature',
      properties: { value: 5 },
      geometry: { type: 'Point', coordinates: [0, 0] },
      layer: { id: 'attributed-choropleth-fill' },
    };
    el.map!.queryRenderedFeatures = (() => [hit]) as typeof el.map.queryRenderedFeatures;

    let detail: { origin?: string; sourceId?: string } | undefined;
    el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
    el.map!.fire('click', { lngLat: { lng: 0, lat: 0 }, point: { x: 5, y: 5 } });

    expect(detail!.origin).to.equal('choropleth');
    expect(detail!.sourceId).to.equal(undefined);
  });

  it('leaves origin and sourceId undefined when nothing was hit', async function () {
    if (!hasWebGL2) this.skip();
    const { el } = await withZones();
    el.map!.queryRenderedFeatures = (() => []) as typeof el.map.queryRenderedFeatures;

    let detail: { feature?: unknown; origin?: string; sourceId?: string } | undefined;
    el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
    el.map!.fire('click', { lngLat: { lng: 0, lat: 0 }, point: { x: 5, y: 5 } });

    expect(detail!.feature).to.equal(undefined);
    expect(detail!.origin).to.equal(undefined);
    expect(detail!.sourceId).to.equal(undefined);
  });
});

// setData() unconditionally re-tiles a whole source. For an animated choropleth -- advancing a step
// every few hundred milliseconds -- that re-tiles every polygon each frame when only the values
// driving the colour ramp changed.
describe('incremental GeoJSON updates', () => {
  const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
  const collection = (value: number, geom: unknown = geometry) => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 'a', geometry: geom, properties: { value } }],
  });

  it('emits a property-only diff when geometry is reused', () => {
    const diff = buildGeoJsonPropertyDiff(collection(1), collection(2));
    expect(diff).to.not.equal(null);
    expect(diff!.update).to.have.length(1);
    expect(diff!.update[0]!.id).to.equal('a');
    expect(diff!.update[0]!.addOrUpdateProperties).to.deep.equal([{ key: 'value', value: 2 }]);
  });

  it('reports no updates when nothing changed, so the caller can skip the call entirely', () => {
    const diff = buildGeoJsonPropertyDiff(collection(1), collection(1));
    expect(diff!.update).to.have.length(0);
  });

  it('accepts semantically unchanged geometry after the ownership boundary detached it', () => {
    const moved = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
    const diff = buildGeoJsonPropertyDiff(collection(1), collection(2, moved));
    expect(diff).to.not.equal(null);
    expect(diff!.update[0]!.addOrUpdateProperties).to.deep.equal([{ key: 'value', value: 2 }]);
  });

  it('refuses the fast path when retained geometry or bbox values actually change', () => {
    const changedGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]],
    };
    expect(buildGeoJsonPropertyDiff(collection(1), collection(2, changedGeometry))).to.equal(null);

    const withBbox = (bbox: readonly number[]) => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'a', bbox, geometry, properties: { value: 1 } },
      ],
    });
    expect(buildGeoJsonPropertyDiff(withBbox([0, 0, 1, 1]), withBbox([0, 0, 2, 2]))).to.equal(
      null
    );
  });

  it('refuses the fast path when a feature has no addressable id', () => {
    const withoutId = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry, properties: { value: 1 } }],
    };
    expect(buildGeoJsonPropertyDiff(withoutId, withoutId)).to.equal(null);
  });

  it('adds and removes stable-id features without replacing the source', () => {
    const two = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'a', geometry, properties: { value: 1 } },
        { type: 'Feature', id: 'b', geometry, properties: { value: 2 } },
      ],
    };
    const added = buildGeoJsonPropertyDiff(collection(1), two);
    expect(added).to.not.equal(null);
    expect(added!.add?.map((feature) => feature.id)).to.deep.equal(['b']);
    expect(added!.remove ?? []).to.deep.equal([]);

    const removed = buildGeoJsonPropertyDiff(two, collection(1));
    expect(removed).to.not.equal(null);
    expect(removed!.remove).to.deep.equal(['b']);
    expect(removed!.add ?? []).to.deep.equal([]);
  });

  it('preserves observable feature order by minimally removing and re-adding the changed suffix', () => {
    const feature = (id: string) => ({
      type: 'Feature',
      id,
      geometry,
      properties: { value: id },
    });
    const before = {
      type: 'FeatureCollection',
      features: [feature('a'), feature('b'), feature('c')],
    };
    const after = {
      type: 'FeatureCollection',
      features: [feature('b'), feature('a'), feature('c')],
    };

    const diff = buildGeoJsonPropertyDiff(before, after);
    expect(diff).to.not.equal(null);
    expect(diff!.remove).to.deep.equal(['a', 'c']);
    expect(diff!.add?.map((entry) => entry.id)).to.deep.equal(['a', 'c']);
    expect(diff!.update).to.deep.equal([]);
  });

  it('refuses duplicate ids because MapLibre cannot address them without dropping a feature', () => {
    const duplicate = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'a', geometry, properties: { value: 1 } },
        { type: 'Feature', id: 'a', geometry, properties: { value: 2 } },
      ],
    };
    expect(buildGeoJsonPropertyDiff(collection(1), duplicate)).to.equal(null);
  });

  it('falls back once semantic geometry comparison exhausts its bounded work', () => {
    const geometryWith = (coordinates: readonly number[]) => ({
      type: 'LineString',
      coordinates,
    });
    const before = collection(1, geometryWith(Array.from({ length: 50_001 }, () => 0)));
    const after = collection(2, geometryWith(Array.from({ length: 50_001 }, () => 0)));
    expect(buildGeoJsonPropertyDiff(before, after)).to.equal(null);
  });

  it('reports removed properties so a stale key cannot survive the update', () => {
    const before = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 'a', geometry, properties: { value: 1, stale: true } }],
    };
    const diff = buildGeoJsonPropertyDiff(before, collection(1));
    expect(diff!.update[0]!.removeProperties).to.deep.equal(['stale']);
  });

  it('refuses non-collections rather than guessing', () => {
    expect(buildGeoJsonPropertyDiff(null, collection(1))).to.equal(null);
    expect(buildGeoJsonPropertyDiff(collection(1), undefined)).to.equal(null);
  });

  it('routes add/remove-only diffs through updateData instead of setData', () => {
    const el = document.createElement('lr-map') as LyraMap;
    const two = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'a', geometry, properties: { value: 1 } },
        { type: 'Feature', id: 'b', geometry, properties: { value: 2 } },
      ],
    };
    const applied = (el as unknown as { _appliedGeoJson: Map<string, unknown> })._appliedGeoJson;
    applied.set('source', collection(1));
    const diffs: unknown[] = [];
    let replacements = 0;
    const source = {
      setData: () => {
        replacements += 1;
      },
      updateData: (diff: unknown) => {
        diffs.push(diff);
      },
    };
    const push = (el as unknown as {
      pushGeoJson: (source: typeof source, id: string, value: unknown) => void;
    }).pushGeoJson.bind(el);

    push(source, 'source', two);
    push(source, 'source', collection(1));

    expect(replacements).to.equal(0);
    expect(diffs).to.have.length(2);
    expect((diffs[0] as { add?: unknown[] }).add).to.have.length(1);
    expect((diffs[1] as { remove?: unknown[] }).remove).to.deep.equal(['b']);
  });

  it('keeps incremental data updates when Lit rebinds unchanged map collections by identity', async () => {
    const mapStyle = LOCAL_STYLE;
    const center = [6, 49] as const;
    let choropleth = {
      sourceId: 'timeline-regions',
      geojson: collection(1),
      field: 'value',
      stops: [[0, '#000000'], [10, '#ffffff']] as const,
    };
    let dataLayers = [{ sourceId: 'timeline-points', geojson: collection(1) }];
    const mount = document.createElement('div');
    const view = () => html`
      <lr-map
        .mapStyle=${mapStyle}
        .center=${center}
        .choropleth=${choropleth}
        .dataLayers=${dataLayers}
      ></lr-map>
    `;

    // Render while detached so the instance loader can be replaced before connectedCallback.
    // Re-rendering this same template below exercises Lit's real declarative property writes.
    render(view(), mount);
    const el = mount.querySelector('lr-map') as LyraMap;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
      new Promise(() => {});
    document.body.append(mount);

    try {
      await el.updateComplete;
      let setStyleCalls = 0;
      let setDataCalls = 0;
      let updateDataCalls = 0;
      let setCenterCalls = 0;
      const sources = new Map<string, {
        data: unknown;
        setData(value: unknown): void;
        updateData(diff: unknown): void;
      }>();
      const layers = new Map<string, Record<string, unknown>>();
      const map = {
        once: () => map,
        setStyle: () => {
          setStyleCalls += 1;
          return map;
        },
        setCenter: () => {
          setCenterCalls += 1;
          return map;
        },
        getSource: (id: string) => sources.get(id),
        addSource: (id: string, spec: { data: unknown }) => {
          const source = {
            data: spec.data,
            setData(value: unknown) {
              setDataCalls += 1;
              this.data = value;
            },
            updateData(_diff: unknown) {
              updateDataCalls += 1;
            },
          };
          sources.set(id, source);
        },
        removeSource: (id: string) => sources.delete(id),
        getLayer: (id: string) => layers.get(id),
        addLayer: (layer: Record<string, unknown>) => layers.set(String(layer['id']), layer),
        removeLayer: (id: string) => layers.delete(id),
        setPaintProperty: () => map,
        getStyle: () => ({ layers: [] }),
        getCanvas: () => document.createElement('canvas'),
      };
      const privateMap = el as unknown as {
        _map: unknown;
        _styleLoaded: boolean;
        applyChoropleth(): void;
        applyDataLayers(): void;
      };
      privateMap._map = map;
      privateMap._styleLoaded = true;
      privateMap.applyDataLayers();
      privateMap.applyChoropleth();

      choropleth = { ...choropleth, geojson: collection(2) };
      dataLayers = [{ ...dataLayers[0]!, geojson: collection(2) }];
      render(view(), mount);
      await el.updateComplete;

      expect(setStyleCalls, 'the unchanged style must not win the update branch').to.equal(0);
      expect(setCenterCalls, 'the unchanged tuple must remain referentially stable').to.equal(0);
      expect(setDataCalls, 'neither source should be fully replaced').to.equal(0);
      expect(updateDataCalls, 'choropleth and dataLayers each update incrementally').to.equal(2);
    } finally {
      mount.remove();
    }
  });
});

// `maxBounds` regression coverage. Both halves below shipped broken in 11.2.0 and were reported
// together because the first was the only thing hiding the second.
//
// 1. `maxBounds` is `attribute: false`, so a property binding is the only way to set it -- which
//    means its one and only appearance in `changed` is the FIRST update. <lr-map> builds its peer
//    asynchronously (a lazy `import('maplibre-gl')` plus WebGL init), so `this._map` is still
//    undefined then. `updated()`'s `&& this._map` guard short-circuited, the property never
//    changed again, and it was never retried: a documented property that read back as set and did
//    nothing, permanently, with no warning.
// 2. The guard reads the camera back AFTER `setMaxBounds()` to catch a non-finite zoom. At the
//    conditions its own warning text names (sub-1 fractional zooms in wide containers) maplibre-gl
//    6.x does not return a broken camera -- it THROWS, so the readback line is never reached and,
//    with no try/catch, the exception escapes `updated()` into the consumer's render cycle.
it('applies a declaratively-set maxBounds once the map exists, not only on a later change', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  // Set before the peer can possibly have loaded: this is the normal path for an `attribute:
  // false` property, not an edge case.
  el.maxBounds = [
    [-10, -10],
    [10, 10],
  ];
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  const applied = (el.map as unknown as { getMaxBounds?: () => unknown }).getMaxBounds?.();
  expect(applied, 'maxBounds never reached the peer').to.not.equal(null);
  expect(applied, 'maxBounds never reached the peer').to.not.equal(undefined);
});

it('routes a throwing setMaxBounds into the same revert-and-warn path as a non-finite camera', async function () {
  if (!hasWebGL2) this.skip();
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.mapStyle = LOCAL_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  const zoomBefore = el.map!.getZoom();
  const calls: unknown[] = [];
  (el.map as unknown as { setMaxBounds: (b: unknown) => unknown }).setMaxBounds = (bounds) => {
    calls.push(bounds);
    // Exactly what maplibre-gl 6.x does at a sub-1 fractional zoom in a wide container.
    if (bounds !== null) throw new TypeError("Cannot read properties of null (reading '0')");
    return el.map;
  };

  // Must not escape into the consumer's render cycle.
  el.maxBounds = [
    [-180, -85],
    [180, 85],
  ];
  await el.updateComplete;

  expect(calls.length, 'the throw must be followed by a revert').to.be.at.least(2);
  expect(calls[calls.length - 1], 'the constraint must be dropped after a throw').to.equal(null);
  expect(Number.isFinite(el.map!.getZoom()), 'the camera must survive').to.be.true;
  expect(el.map!.getZoom()).to.be.closeTo(zoomBefore, 0.001);
});

// ---------------------------------------------------------------------------
// Marker clustering and the heatmap layer kind. Both are strictly additive: an entry that sets
// neither `cluster` nor `kind` must still emit exactly today's unclustered fill/line/circle split,
// which the first test below pins.
// ---------------------------------------------------------------------------
describe('dataLayers clustering and heatmap', () => {
  interface StubLayer {
    id: string;
    type: string;
    source: string;
    filter?: unknown;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }

  /**
   * Stands in for the maplibre instance, exactly as the choropleth interpolation suite above does:
   * applyDataLayers() only needs the handful of methods it calls, and this keeps the assertions on
   * the emitted source options and layer specs rather than on a real GL context (so these run on
   * every engine, WebGL2 or not). `setPaintProperty` deliberately throws for an unknown layer --
   * the real peer fires an error event there, which is exactly the regression a theme repaint that
   * assumes fill/line/circle would cause for a heatmap or cluster entry.
   */
  function stubMaplibreMap(el: LyraMap, options: { glyphs?: string } = {}) {
    const sources = new Map<string, Record<string, unknown>>();
    const layers = new Map<string, StubLayer>();
    const map = {
      getSource: (id: string) =>
        sources.has(id)
          ? {
              setData: (data: unknown) => {
                sources.get(id)!['data'] = data;
              },
            }
          : undefined,
      addSource: (id: string, source: Record<string, unknown>) => {
        if (sources.has(id)) throw new Error('duplicate source id');
        sources.set(id, { ...source });
      },
      removeSource: (id: string) => {
        sources.delete(id);
      },
      getLayer: (id: string) => layers.get(id),
      addLayer: (layer: StubLayer) => {
        layers.set(layer.id, { ...layer });
      },
      removeLayer: (id: string) => {
        layers.delete(id);
      },
      setPaintProperty: (layerId: string, name: string, value: unknown) => {
        const layer = layers.get(layerId);
        if (!layer) throw new Error(`setPaintProperty on missing layer ${layerId}`);
        layer.paint = { ...(layer.paint ?? {}), [name]: value };
      },
      getStyle: () => ({ layers: [], ...(options.glyphs ? { glyphs: options.glyphs } : {}) }),
    };
    (el as unknown as { _map: unknown })._map = map;
    (el as unknown as { _styleLoaded: boolean })._styleLoaded = true;
    return { sources, layers };
  }

  const POINTS = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 1,
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { magnitude: 3 },
      },
      {
        type: 'Feature',
        id: 2,
        geometry: { type: 'Point', coordinates: [0.01, 0.01] },
        properties: { magnitude: 9 },
      },
    ],
  };

  const entry = (extra: Record<string, unknown>) =>
    [{ sourceId: 'pins', geojson: POINTS, ...extra }] as unknown as LyraMap['dataLayers'];

  const suffixes = (layers: Map<string, StubLayer>, sourceId: string): string[] =>
    [...layers.keys()].filter((id) => id.startsWith(sourceId)).map((id) => id.slice(sourceId.length)).sort();

  it('leaves a data layer unclustered and geometry-split when cluster and kind are unset', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources, layers } = stubMaplibreMap(el, { glyphs: 'https://example.invalid/{range}.pbf' });
    el.dataLayers = entry({});
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(sources.get(sourceId)!['cluster'], 'no clustering unless asked for').to.equal(undefined);
    expect(suffixes(layers, sourceId), 'exactly the pre-existing three layers').to.deep.equal([
      '-circle',
      '-fill',
      '-line',
    ]);
    expect(layers.get(`${sourceId}-circle`)!.filter, 'the plain point filter').to.deep.equal([
      '==',
      ['geometry-type'],
      'Point',
    ]);
  });

  it('clusters the source and emits cluster, count and unclustered-point layers', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources, layers } = stubMaplibreMap(el, { glyphs: 'https://example.invalid/{range}.pbf' });
    el.dataLayers = entry({ cluster: {} });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const source = sources.get(sourceId)!;
    expect(source['cluster'], 'clustering is a source option').to.equal(true);
    expect(source['clusterRadius']).to.equal(50);
    expect(source['clusterMaxZoom']).to.equal(14);
    expect(suffixes(layers, sourceId)).to.deep.equal(['-circle', '-cluster', '-cluster-count']);
    expect(layers.get(`${sourceId}-cluster`)!.filter).to.deep.equal(['has', 'point_count']);
    expect(layers.get(`${sourceId}-circle`)!.filter, 'unclustered points only').to.deep.equal([
      'all',
      ['==', ['geometry-type'], 'Point'],
      ['!', ['has', 'point_count']],
    ]);
    expect(layers.get(`${sourceId}-cluster-count`)!.layout!['text-field']).to.deep.equal([
      'get',
      'point_count_abbreviated',
    ]);
  });

  it('filters malformed cluster font fallbacks while preserving the usable font order', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el, { glyphs: 'https://example.invalid/{range}.pbf' });
    el.dataLayers = entry({
      cluster: {
        countFont: ['Inter', '', 42, 'Noto Sans'],
      },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(layers.get(`${sourceId}-cluster-count`)!.layout!['text-font']).to.deep.equal([
      'Inter',
      'Noto Sans',
    ]);
  });

  it('omits a hostile data-layer record without aborting later valid layers', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources } = stubMaplibreMap(el);
    const hostile = new Proxy({}, {
      get(_target, property): never {
        throw new Error(`hostile ${String(property)} getter`);
      },
    });
    el.dataLayers = [hostile, ...entry({})] as unknown as LyraMap['dataLayers'];
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(sourceId).to.not.equal('');
    expect(sources.has(sourceId)).to.be.true;
  });

  it('emits step expressions for cluster radius and colour keyed on point_count', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources, layers } = stubMaplibreMap(el);
    el.dataLayers = entry({
      cluster: {
        radius: 80,
        maxZoom: 9,
        radiusSteps: [[0, 10], [25, 20]],
        colorSteps: [[0, '#111111'], [25, '#222222']],
      },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(sources.get(sourceId)!['clusterRadius']).to.equal(80);
    expect(sources.get(sourceId)!['clusterMaxZoom']).to.equal(9);
    const paint = layers.get(`${sourceId}-cluster`)!.paint!;
    expect(paint['circle-radius']).to.deep.equal([
      'step',
      ['get', 'point_count'],
      10,
      0,
      10,
      25,
      20,
    ]);
    expect(paint['circle-color']).to.deep.equal([
      'step',
      ['get', 'point_count'],
      '#111111',
      0,
      '#111111',
      25,
      '#222222',
    ]);
  });

  it('omits the cluster count layer when the style provides no glyphs', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({ cluster: {} });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(suffixes(layers, sourceId), 'no text layer without a glyph source').to.deep.equal([
      '-circle',
      '-cluster',
    ]);
  });

  it('emits a single heatmap layer, with weight, ramp and radius, when kind is heatmap', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources, layers } = stubMaplibreMap(el);
    el.dataLayers = entry({
      kind: 'heatmap',
      heatmap: {
        weightField: 'magnitude',
        weightRange: [0, 10],
        radius: 40,
        intensity: 2,
        opacity: 0.75,
        stops: [[0, 'rgba(0, 0, 0, 0)'], [1, '#ff0000']],
      },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(sources.get(sourceId)!['cluster'], 'a density surface is never clustered').to.equal(undefined);
    expect(suffixes(layers, sourceId)).to.deep.equal(['-heatmap']);
    const heatmap = layers.get(`${sourceId}-heatmap`)!;
    expect(heatmap.type).to.equal('heatmap');
    expect(heatmap.paint!['heatmap-weight']).to.deep.equal([
      'interpolate',
      ['linear'],
      ['get', 'magnitude'],
      0,
      0,
      10,
      1,
    ]);
    expect(heatmap.paint!['heatmap-radius']).to.equal(40);
    expect(heatmap.paint!['heatmap-intensity']).to.equal(2);
    expect(heatmap.paint!['heatmap-opacity']).to.equal(0.75);
    expect(heatmap.paint!['heatmap-color']).to.deep.equal([
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(0, 0, 0, 0)',
      1,
      '#ff0000',
    ]);
  });

  it('defaults an unconfigured heatmap to a fully transparent density floor and the peer weight', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({ kind: 'heatmap' });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const paint = layers.get(`${sourceId}-heatmap`)!.paint!;
    const ramp = paint['heatmap-color'] as unknown[];
    expect(ramp[3], 'the ramp starts at density zero').to.equal(0);
    expect(ramp[4], 'and paints nothing there').to.equal('rgba(0, 0, 0, 0)');
    expect(ramp.length, 'a real multi-stop ramp').to.be.greaterThan(6);
    expect(paint['heatmap-weight'], 'no weight field means the peer default of 1').to.equal(undefined);
    expect(paint['heatmap-radius'], 'the existing scalar default remains').to.equal(30);
    expect(paint['heatmap-intensity'], 'the existing scalar default remains').to.equal(1);
    expect(
      Object.prototype.hasOwnProperty.call(paint, 'heatmap-opacity'),
      'unset opacity leaves MapLibre\'s established default untouched',
    ).to.be.false;
  });

  it('emits bounded zoom interpolation for heatmap radius and intensity', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({
      kind: 'heatmap',
      heatmap: {
        radius: [[13, 40], [7, 14]],
        intensity: [[13, 3], [7, 1]],
      },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const paint = layers.get(`${sourceId}-heatmap`)!.paint!;
    expect(paint['heatmap-radius']).to.deep.equal([
      'interpolate', ['linear'], ['zoom'], 7, 14, 13, 40,
    ]);
    expect(paint['heatmap-intensity']).to.deep.equal([
      'interpolate', ['linear'], ['zoom'], 7, 1, 13, 3,
    ]);
  });

  it('collapses one usable heatmap zoom stop to its bounded scalar value', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({
      kind: 'heatmap',
      heatmap: { radius: [[7, 250]], intensity: [[12, -1]] },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const paint = layers.get(`${sourceId}-heatmap`)!.paint!;
    expect(paint['heatmap-radius']).to.equal(200);
    expect(paint['heatmap-intensity']).to.equal(0);
  });

  it('normalizes hostile heatmap zoom stops and resets dropped opacity to the peer default', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({
      kind: 'heatmap',
      heatmap: {
        radius: [[Number.NaN, 20], [7, Number.POSITIVE_INFINITY]],
        intensity: [[25, 200], [-5, -4], [7, 2], [7, 5]],
        opacity: 9,
      },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const paint = layers.get(`${sourceId}-heatmap`)!.paint!;
    expect(paint['heatmap-radius'], 'no usable stops use the established scalar default').to.equal(30);
    expect(paint['heatmap-intensity']).to.deep.equal([
      'interpolate', ['linear'], ['zoom'], 0, 0, 7, 2, 24, 100,
    ]);
    expect(paint['heatmap-opacity']).to.equal(1);

    el.dataLayers = entry({ kind: 'heatmap' });
    await el.updateComplete;
    expect(
      layers.get(`${sourceId}-heatmap`)!.paint!['heatmap-opacity'],
      'dropping an authored value restores MapLibre\'s opacity default',
    ).to.equal(1);
  });

  it('ignores cluster on a heatmap entry rather than aggregating the density input', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources, layers } = stubMaplibreMap(el, { glyphs: 'https://example.invalid/{range}.pbf' });
    el.dataLayers = entry({ kind: 'heatmap', cluster: {} });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(sources.get(sourceId)!['cluster']).to.equal(undefined);
    expect(suffixes(layers, sourceId)).to.deep.equal(['-heatmap']);
  });

  it('restores the uniform weight when an update drops the heatmap weight field', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({ kind: 'heatmap', heatmap: { weightField: 'magnitude' } });
    await el.updateComplete;
    const sourceId = dataLayerResourceId(el, 'pins');
    expect(layers.get(`${sourceId}-heatmap`)!.paint!['heatmap-weight']).to.deep.equal([
      'get',
      'magnitude',
    ]);

    el.dataLayers = entry({ kind: 'heatmap' });
    await el.updateComplete;

    expect(
      layers.get(`${sourceId}-heatmap`)!.paint!['heatmap-weight'],
      'a dropped weight field must stop weighting by it',
    ).to.equal(1);
  });

  it('recreates the source when clustering is switched on, since MapLibre cannot re-cluster in place', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { sources, layers } = stubMaplibreMap(el);
    el.dataLayers = entry({});
    await el.updateComplete;
    const firstId = dataLayerResourceId(el, 'pins');

    el.dataLayers = entry({ cluster: { radius: 30 } });
    await el.updateComplete;
    const secondId = dataLayerResourceId(el, 'pins');

    expect(secondId === firstId, 'a fresh private id, not a reused one').to.be.false;
    expect(sources.has(firstId), 'the unclustered source is torn down').to.be.false;
    expect(suffixes(layers, firstId), 'nothing leaks from the previous shape').to.deep.equal([]);
    expect(sources.get(secondId)!['cluster']).to.equal(true);
    expect(sources.get(secondId)!['clusterRadius']).to.equal(30);
  });

  it('repaints heatmap and cluster layers on a theme change without touching layers they never created', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = [
      { sourceId: 'pins', geojson: POINTS, cluster: {} },
      { sourceId: 'density', geojson: POINTS, kind: 'heatmap' },
    ] as unknown as LyraMap['dataLayers'];
    await el.updateComplete;

    // The stub throws on a paint write to a layer that was never added, which is what the peer's
    // own error event reports; a repaint that assumed fill/line/circle would hit it here.
    (el as unknown as { refreshThemePaint: () => void }).refreshThemePaint();

    const clusterId = dataLayerResourceId(el, 'pins');
    const densityId = dataLayerResourceId(el, 'density');
    expect(layers.get(`${clusterId}-cluster`)!.paint!['circle-color'] !== undefined).to.be.true;
    expect(layers.get(`${densityId}-heatmap`)!.paint!['heatmap-color'] !== undefined).to.be.true;
  });

  it('re-applies clustered and heatmap data layers after a mapStyle change', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [
      { sourceId: 'pins', geojson: POINTS, cluster: {} },
      { sourceId: 'density', geojson: POINTS, kind: 'heatmap' },
    ] as unknown as LyraMap['dataLayers'];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(
      () => el.map!.getLayer(`${dataLayerResourceId(el, 'pins')}-cluster`) != null,
      'cluster layer never added',
      { timeout: 2000 },
    );

    const NEXT_STYLE = {
      ...LOCAL_STYLE,
      layers: [{ id: 'demo', type: 'fill', source: 'demo', paint: { 'fill-opacity': 0.9 } }],
    };
    el.mapStyle = NEXT_STYLE as typeof LOCAL_STYLE;
    await el.updateComplete;

    await waitUntil(
      () => {
        const clusterId = dataLayerResourceId(el, 'pins');
        const densityId = dataLayerResourceId(el, 'density');
        return (
          Boolean(clusterId) &&
          Boolean(densityId) &&
          el.map!.getLayer(`${clusterId}-cluster`) != null &&
          el.map!.getLayer(`${densityId}-heatmap`) != null
        );
      },
      'clustered/heatmap layers never re-applied after the style swap',
      { timeout: 3000 },
    );
    expect(el.map!.getSource(dataLayerResourceId(el, 'pins')) != null).to.be.true;
  });

  it('hit-tests the cluster circle but never the heatmap layer MapLibre cannot query', async function () {
    if (!hasWebGL2) this.skip();
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    el.mapStyle = LOCAL_STYLE;
    el.dataLayers = [
      { sourceId: 'pins', geojson: POINTS, cluster: {} },
      { sourceId: 'density', geojson: POINTS, kind: 'heatmap' },
    ] as unknown as LyraMap['dataLayers'];
    await el.updateComplete;
    await waitUntilMapLoaded(el);
    await waitUntil(
      () => el.map!.getLayer(`${dataLayerResourceId(el, 'pins')}-cluster`) != null,
      'cluster layer never added',
      { timeout: 2000 },
    );
    const clusterId = dataLayerResourceId(el, 'pins');
    const densityId = dataLayerResourceId(el, 'density');

    let queried: string[] = [];
    const hit = {
      type: 'Feature',
      properties: { point_count: 12, point_count_abbreviated: '12' },
      geometry: { type: 'Point', coordinates: [0, 0] },
      layer: { id: `${clusterId}-cluster` },
    };
    el.map!.queryRenderedFeatures = ((_point: unknown, options?: { layers?: string[] }) => {
      queried = options?.layers ?? [];
      return [hit];
    }) as typeof el.map.queryRenderedFeatures;

    let detail: { origin?: string; sourceId?: string; feature?: unknown } | undefined;
    el.addEventListener('lr-map-click', (e) => (detail = (e as CustomEvent).detail));
    el.map!.fire('click', { lngLat: { lng: 0, lat: 0 }, point: { x: 5, y: 5 } });

    expect(queried, 'the cluster circle is clickable').to.include(`${clusterId}-cluster`);
    expect(queried, 'a heatmap returns no features, so it is never queried').to.not.include(
      `${densityId}-heatmap`,
    );
    expect(detail!.origin, 'a cluster hit is attributable').to.equal('cluster');
    expect(detail!.sourceId).to.equal('pins');
    expect((detail!.feature as { properties?: { point_count?: number } }).properties!.point_count).to.equal(12);
  });

  /**
   * Records each layer's paint AS ADDED, before the paint-only half of the same apply overwrites it
   * through `setPaintProperty`. Both halves build the cluster colour independently, so a fix applied
   * to only one of them would still leave the observable end state correct -- this is what makes the
   * add-time expression assertable at all.
   */
  function captureAddedLayerPaint(el: LyraMap): Map<string, Record<string, unknown>> {
    const added = new Map<string, Record<string, unknown>>();
    const map = (el as unknown as { _map: { addLayer: (layer: StubLayer) => void } })._map;
    const addLayer = map.addLayer.bind(map);
    map.addLayer = (layer: StubLayer) => {
      added.set(layer.id, { ...(layer.paint ?? {}) });
      addLayer(layer);
    };
    return added;
  }

  it('resolves a var() colour in cluster.colorSteps against the host, on add and on repaint', async () => {
    const el = (await fixture(
      html`<lr-map style="--lr-color-brand: rgb(1, 2, 3); --lr-color-danger: rgb(4, 5, 6)"></lr-map>`,
    )) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    const added = captureAddedLayerPaint(el);
    el.dataLayers = entry({
      cluster: {
        colorSteps: [[0, 'var(--lr-color-brand)'], [25, 'var(--lr-color-danger)']],
      },
    });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const resolved = [
      'step',
      ['get', 'point_count'],
      'rgb(1, 2, 3)',
      0,
      'rgb(1, 2, 3)',
      25,
      'rgb(4, 5, 6)',
    ];
    expect(
      added.get(`${sourceId}-cluster`)!['circle-color'],
      'maplibre paints to a WebGL canvas and cannot parse a raw var()',
    ).to.deep.equal(resolved);
    expect(
      layers.get(`${sourceId}-cluster`)!.paint!['circle-color'],
      'the paint-only half resolves the same way',
    ).to.deep.equal(resolved);

    el.style.setProperty('--lr-color-brand', 'rgb(7, 8, 9)');
    (el as unknown as { refreshThemePaint: () => void }).refreshThemePaint();
    expect(
      (layers.get(`${sourceId}-cluster`)!.paint!['circle-color'] as unknown[])[2],
      'a retheme moves the cluster breaks with everything else',
    ).to.equal('rgb(7, 8, 9)');
  });

  it('honours a single-stop heatmap ramp above the auto-prepended transparent floor', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({ kind: 'heatmap', heatmap: { stops: [[1, '#ff0000']] } });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(
      layers.get(`${sourceId}-heatmap`)!.paint!['heatmap-color'],
      'one stop plus the floor is already a valid two-stop ramp',
    ).to.deep.equal(['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)', 1, '#ff0000']);
  });

  it('resolves a var() colour in a single-stop heatmap ramp against the host', async () => {
    const el = (await fixture(
      html`<lr-map style="--lr-color-danger: rgb(4, 5, 6)"></lr-map>`,
    )) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({ kind: 'heatmap', heatmap: { stops: [[0.5, 'var(--lr-color-danger)']] } });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    expect(layers.get(`${sourceId}-heatmap`)!.paint!['heatmap-color']).to.deep.equal([
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(0, 0, 0, 0)',
      0.5,
      'rgb(4, 5, 6)',
    ]);
  });

  it('falls back to the token ramp for a lone heatmap stop at density zero', async () => {
    const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
    const { layers } = stubMaplibreMap(el);
    el.dataLayers = entry({ kind: 'heatmap', heatmap: { stops: [[0, '#ff0000']] } });
    await el.updateComplete;

    const sourceId = dataLayerResourceId(el, 'pins');
    const ramp = layers.get(`${sourceId}-heatmap`)!.paint!['heatmap-color'] as unknown[];
    expect(ramp.includes('#ff0000'), 'a lone floor stop describes no gradient at all').to.be.false;
    expect(ramp[3], 'the token ramp still starts at density zero').to.equal(0);
    expect(ramp[4]).to.equal('rgba(0, 0, 0, 0)');
    expect(ramp.length, 'a real multi-stop ramp').to.be.greaterThan(6);
  });
});
