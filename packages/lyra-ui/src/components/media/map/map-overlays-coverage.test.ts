import { expect, fixtureCleanup, nextFrame, waitUntil } from '@open-wc/testing';
import './map.js';
import { loadMapControl } from './map-loader.js';
import {
  ScriptedOverlayMap,
  originalGetContext,
  liveScriptedMap,
  loadStyle,
  layerWithSuffix,
  COLLECTION,
  choropleth,
  click,
} from '../../../../test/map-scripted-engine.js';


describe('map overlay failure recovery', () => {
  const intersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const canvasGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

  beforeEach(() => {
    ScriptedOverlayMap.instances = [];
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value(this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
        if (contextId === 'webgl2') return {};
        return originalGetContext.call(this, contextId as never, ...(rest as []));
      },
    });
  });

  afterEach(() => {
    fixtureCleanup();
    if (intersectionObserver) Object.defineProperty(window, 'IntersectionObserver', intersectionObserver);
    else delete (window as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    if (canvasGetContext) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', canvasGetContext);
  });

  it('skips an unreadable gradient mark without losing the readable marks', async () => {
    const { el } = await liveScriptedMap((map) => {
      map.legendGradient = [[0, '#ffffff'], [100, '#ff0000']];
    });
    const ticks = new Proxy([25, 75], {
      getOwnPropertyDescriptor(_target, key) {
        if (key === '1') throw new TypeError('revoked tick');
        return Reflect.getOwnPropertyDescriptor(_target, key);
      },
    });
    el.legendGradientTicks = ticks;
    await el.updateComplete;
    expect(el.legendGradientTicks.map((tick) => tick.value)).to.deep.equal([25]);
    expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]')).to.have.length(1);
    el.legendGradientTicks = [50];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]')).to.have.length(1);
  });

  it('ignores a revoked no-data style while retaining the admitted choropleth', async () => {
    const noData = new Proxy({ color: '#cccccc', label: 'Missing' }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'label') throw new TypeError('revoked no-data style');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const harness = await liveScriptedMap((el) => {
      el.choropleth = choropleth({ noData });
      el.choroplethLegend = true;
    });
    await loadStyle(harness);
    const fill = layerWithSuffix(harness.engine, '-fill');
    const paint = fill.paint['fill-color'] as unknown[];
    expect(paint[0]).to.equal('case');
    expect(paint[2]).to.deep.equal(['interpolate', ['linear'], ['get', 'pop'], 0, '#ffffff', 100, '#ff0000']);
    expect(Boolean(harness.el.shadowRoot!.querySelector('[part="legend-derived"]'))).to.equal(true);
    expect(harness.el.shadowRoot!.textContent).not.to.contain('Missing');
  });

  it('ignores an unreadable control while keeping the valid one active', async () => {
    const { el, engine } = await liveScriptedMap((map) => { map.controls = { navigation: true }; });
    await waitUntil(() => engine.controls.length === 1, 'navigation control never attached');
    const first = engine.controls[0]!.control;
    el.controls = new Proxy({ navigation: true, scale: true }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'scale') throw new TypeError('revoked controls');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    await el.updateComplete;
    expect(first.removed).to.equal(false);
    expect(engine.controls).to.have.length(1);
    el.controls = { scale: true };
    await waitUntil(() => first.removed && engine.controls.length === 1, 'scale control never attached after recovery');
    expect(engine.controls[0]!.control.kind).to.equal('scale');
  });

  it('keeps the map usable after the peer refuses control removal and addition', async () => {
    const { el, engine } = await liveScriptedMap((map) => { map.controls = { navigation: true }; });
    await waitUntil(() => engine.controls.length === 1, 'navigation control never attached');
    const staleControl = engine.controls[0]!.control;
    const originalRemove = engine.removeControl.bind(engine);
    const originalAdd = engine.addControl.bind(engine);
    const removedControls: unknown[] = [];
    const attemptedControls: unknown[] = [];
    let addAttempts = 0;
    engine.removeControl = control => { removedControls.push(control); throw new TypeError('peer removed its controls'); };
    engine.addControl = control => { addAttempts++; attemptedControls.push(control); throw new TypeError('peer refused scale control'); };
    try {
      el.controls = { scale: true };
      await el.updateComplete;
      await waitUntil(() => addAttempts === 1, 'peer control addition was never attempted');
      expect(removedControls.filter(control => control === staleControl).length).to.equal(1);
      expect(attemptedControls.length).to.equal(1);
      expect(removedControls.filter(control => control === attemptedControls[0]).length).to.equal(1);
      expect(removedControls.length).to.equal(2);
      expect(engine.controls).to.have.length(1);
      expect(el.jumpTo({ center: [8, 9], zoom: 4 })).to.equal(true);
      await waitUntil(() => engine.commandCalls.length > 0, 'camera command did not reach the peer');
      expect(engine.commandCalls.at(-1)).to.deep.equal({ method: 'jumpTo', options: { center: [8, 9], zoom: 4 } });
    } finally {
      engine.removeControl = originalRemove;
      engine.addControl = originalAdd;
    }
    engine.removeControl(staleControl);
    el.controls = { navigation: true };
    await waitUntil(() => engine.controls.length === 1, 'later navigation control never attached');
    expect(engine.controls[0]!.control.kind).to.equal('navigation');
  });

  it('drops a rejected world constraint when the peer also refuses the zoom-one retry', async () => {
    const { el, engine } = await liveScriptedMap((map) => {
      map.zoom = 0.4;
      map.center = [3, 4];
    });
    const originalSetZoom = engine.setZoom.bind(engine);
    engine.rejectMaxBounds = () => engine.zoom < 1;
    engine.setZoom = (zoom) => {
      if (zoom === 1) throw new TypeError('peer refused recovery zoom');
      return originalSetZoom(zoom);
    };
    const warningKey = 'lyra-map-max-bounds-rejected';
    const warningStore = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
    const wasWarned = warningStore?.has(warningKey);
    warningStore?.delete(warningKey);
    const expectedWarning = '<lr-map>: maxBounds left maplibre-gl without a usable camera, so it was dropped and the '
      + 'camera restored. This is a peer limitation, not a bad value -- it shows up at sub-1 '
      + 'fractional zooms in wide containers. Raise the zoom, narrow the box, or leave maxBounds '
      + 'unset.';
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      if (args.length === 1 && args[0] === expectedWarning) {
        warnings.push(expectedWarning);
      } else originalWarn.apply(console, args);
    };
    try {
      el.maxBounds = [[-60, -40], [60, 40]];
      await el.updateComplete;
    } finally {
      console.warn = originalWarn;
      engine.setZoom = originalSetZoom;
      if (wasWarned) warningStore?.add(warningKey);
      else warningStore?.delete(warningKey);
    }
    expect(warnings).to.have.length(1);
    expect(engine.maxBoundsCalls.at(-1)).to.equal(null);
    expect(engine.zoom).to.equal(0.4);
    expect(engine.center).to.deep.equal({ lng: 3, lat: 4 });
  });

  it('ignores a cluster that disappears while its expansion zoom is requested', async () => {
    const harness = await liveScriptedMap((el) => {
      el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
    });
    await loadStyle(harness);
    const source = [...harness.engine.sources.values()][0]!;
    const requestedIds: number[] = [];
    source.getClusterExpansionZoom = (clusterId) => {
      requestedIds.push(clusterId);
      throw new TypeError('cluster disappeared');
    };
    harness.engine.hits = [{
      layer: { id: layerWithSuffix(harness.engine, '-cluster').id },
      properties: { cluster_id: 7, point_count: 3 },
      geometry: { type: 'Point', coordinates: [3, 4] },
    }];
    click(harness.engine);
    await harness.el.updateComplete;
    expect(requestedIds).to.deep.equal([7]);
    expect(harness.engine.commandCalls).to.have.length(0);
    expect(harness.el.map === (harness.engine as unknown)).to.equal(true);
  });

  it('hides an offscreen anchor immediately when animation frames are unavailable', async () => {
    const card = document.createElement('div');
    card.slot = 'anchor';
    card.textContent = 'Map details';
    const { el, engine } = await liveScriptedMap((map) => {
      map.anchorLngLat = [5, 5];
    }, [card]);
    await loadStyle({ el, engine });
    const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    await waitUntil(() => !anchor.hidden, 'anchor never became visible');
    await nextFrame();
    const originalFrame = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: undefined });
    try {
      engine.center = { lng: 100, lat: 0 };
      engine.fire('move');
      expect(anchor.hidden).to.equal(true);
    } finally {
      if (originalFrame) Object.defineProperty(window, 'requestAnimationFrame', originalFrame);
      else delete (window as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    }
  });

  it('loads the modular controls on demand from their separate entry points', async () => {
    const navigation = await loadMapControl('navigation', 'modular', undefined);
    const scale = await loadMapControl('scale', 'modular', undefined);
    expect(navigation).to.be.a('function');
    expect(scale).to.be.a('function');
  });
});
