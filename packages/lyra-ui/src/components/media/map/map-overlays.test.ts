import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';
import type { LyraMap } from './map.js';
import { LYRA_DEFAULT_STRINGS, registerLyraLocale } from '../../../internal/localization.js';
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

// Overlay and data contracts between the element and its engine (no-data choropleth paint and
// clicks, derived legends, cluster zoom, declarative controls, the anchor slot, tolerant
// `maxBounds`), driven through a scripted engine installed at the component's `loadLibrary` seam
// so every assertion runs in all three browsers, where headless Firefox and WebKit do not reliably
// provide the WebGL2 context a real engine needs.

// A real engine needs a real WebGL2 context, which headless Firefox and WebKit do not reliably
// provide; the probe runs before any test stubs `getContext`.
const hasWebGL2 = (() => {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    try {
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // The probe succeeded; releasing the context is best-effort.
    }
    return true;
  } catch {
    return false;
  }
})();

const OriginalIntersectionObserver = window.IntersectionObserver;

async function collect(el: LyraMap, type: string, run: () => void): Promise<Record<string, unknown>[]> {
  const details: Record<string, unknown>[] = [];
  const listener = (event: Event) => details.push((event as CustomEvent<Record<string, unknown>>).detail);
  el.addEventListener(type, listener);
  try {
    run();
    await el.updateComplete;
  } finally {
    el.removeEventListener(type, listener);
  }
  return details;
}

const ISOLATES = /[⁦⁩]/g;
const text = (node: Element | null | undefined): string => (node?.textContent ?? '').replace(ISOLATES, '').replace(/\s+/g, ' ').trim();

describe('map overlays and data', () => {
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
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: OriginalIntersectionObserver });
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  describe('choropleth.noData', () => {
    it('paints features without a numeric value with the no-data color and outline', async () => {
      const harness = await liveScriptedMap((el) => {
        el.choropleth = choropleth({ noData: { color: '#cccccc', strokeColor: '#222222', label: 'Not surveyed' } });
      });
      await loadStyle(harness);
      const fill = layerWithSuffix(harness.engine, '-fill');
      const hasValue = ['==', ['typeof', ['get', 'pop']], 'number'];
      const ramp = ['interpolate', ['linear'], ['get', 'pop'], 0, '#ffffff', 100, '#ff0000'];
      expect(fill.paint['fill-color']).to.deep.equal(['case', hasValue, ramp, '#cccccc']);
      expect(fill.paint['fill-outline-color']).to.deep.equal(['case', hasValue, fill.paint['fill-color'], '#222222']);
    });

    it('wraps a step ramp too, and falls back to the neutral tone for an empty noData record', async () => {
      const harness = await liveScriptedMap((el) => {
        el.choropleth = choropleth({ interpolation: 'step', noData: {} });
      });
      await loadStyle(harness);
      const color = layerWithSuffix(harness.engine, '-fill').paint['fill-color'] as unknown[];
      expect(color[0]).to.equal('case');
      expect((color[2] as unknown[])[0]).to.equal('step');
      expect(color[3], 'a concrete color, never a token reference').to.be.a('string').and.not.match(/var\(/);
    });

    it('leaves the paint untouched without noData, and removes an outline that is dropped', async () => {
      const harness = await liveScriptedMap((el) => {
        el.choropleth = choropleth();
      });
      await loadStyle(harness);
      const fill = layerWithSuffix(harness.engine, '-fill');
      expect(fill.paint['fill-color']).to.deep.equal(['interpolate', ['linear'], ['get', 'pop'], 0, '#ffffff', 100, '#ff0000']);
      expect('fill-outline-color' in fill.paint).to.equal(false);

      harness.el.choropleth = choropleth({ noData: { color: '#cccccc', strokeColor: '#222222' } });
      await harness.el.updateComplete;
      expect(layerWithSuffix(harness.engine, '-fill').paint['fill-outline-color']).to.be.an('array');

      harness.el.choropleth = choropleth({ noData: { color: '#cccccc' } });
      await harness.el.updateComplete;
      expect('fill-outline-color' in layerWithSuffix(harness.engine, '-fill').paint).to.equal(false);
    });

    it('reports noData: true for a choropleth click without a numeric value only', async () => {
      const harness = await liveScriptedMap((el) => {
        el.choropleth = choropleth({ noData: {} });
      });
      await loadStyle(harness);
      const fillId = layerWithSuffix(harness.engine, '-fill').id;
      const hit = (properties: Record<string, unknown>) => [{ layer: { id: fillId }, properties }];

      harness.engine.hits = hit({ pop: null });
      const [missing] = await collect(harness.el, 'lr-map-click', () => click(harness.engine));
      expect(missing?.['noData']).to.equal(true);
      expect(missing?.['origin']).to.equal('choropleth');

      harness.engine.hits = hit({});
      const [absent] = await collect(harness.el, 'lr-map-click', () => click(harness.engine));
      expect(absent?.['noData']).to.equal(true);

      harness.engine.hits = hit({ pop: 12 });
      const [valued] = await collect(harness.el, 'lr-map-click', () => click(harness.engine));
      expect('noData' in (valued ?? {})).to.equal(false);

      harness.engine.hits = [];
      const [empty] = await collect(harness.el, 'lr-map-click', () => click(harness.engine));
      expect('noData' in (empty ?? {})).to.equal(false);
    });

    it('never reports noData without the option', async () => {
      const harness = await liveScriptedMap((el) => {
        el.choropleth = choropleth();
      });
      await loadStyle(harness);
      harness.engine.hits = [{ layer: { id: layerWithSuffix(harness.engine, '-fill').id }, properties: { pop: null } }];
      const [detail] = await collect(harness.el, 'lr-map-click', () => click(harness.engine));
      expect('noData' in (detail ?? {})).to.equal(false);
    });
  });

  describe('derived choropleth legend', () => {
    const rows = (el: LyraMap): string[] =>
      [...el.shadowRoot!.querySelectorAll('[part="legend-derived"] .legend-row')].map((row) => text(row));

    it('renders one row per band of a step ramp, with the no-data swatch last', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.choroplethLegend = true;
        map.choropleth = choropleth({
          interpolation: 'step',
          stops: [[10, '#aaaaaa'], [20, '#bbbbbb'], [50, '#cccccc']],
          noData: { label: 'Not surveyed' },
        });
      });
      await el.updateComplete;
      expect(rows(el)).to.deep.equal(['< 20', '20 – 50', '≥ 50', 'Not surveyed']);
      const swatches = [...el.shadowRoot!.querySelectorAll('[part="legend-derived"] [part="legend-swatch"]')];
      expect(swatches.map((swatch) => swatch.getAttribute('data-pattern'))).to.deep.equal(['solid', 'solid', 'solid', 'diagonal']);
      expect(swatches.map((swatch) => (swatch as HTMLElement).style.backgroundColor)).to.have.length(4);
      expect(el.shadowRoot!.querySelector('[part="legend-gradient"]') === null, 'no continuous bar for discrete bands').to.equal(true);
      expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.equal(null);
    });

    it('keeps an explicit step base color as its own "below" band', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.choroplethLegend = true;
        map.choropleth = choropleth({
          interpolation: 'step',
          stepBaseColor: '#999999',
          stops: [[10, '#aaaaaa'], [20, '#bbbbbb']],
        });
      });
      expect(rows(el)).to.deep.equal(['< 10', '10 – 20', '≥ 20']);
    });

    it('renders the localized "No data" caption and follows a strings override', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.choroplethLegend = true;
        map.choropleth = choropleth({ noData: {} });
      });
      expect(rows(el)).to.deep.equal([LYRA_DEFAULT_STRINGS.noData as string]);
      el.strings = { noData: 'Aucune donnée' };
      await el.updateComplete;
      expect(rows(el)).to.deep.equal(['Aucune donnée']);
    });

    it('formats band numbers for the locale and isolates each range from the surrounding direction', async () => {
      registerLyraLocale('de-x-map-legend', { ...LYRA_DEFAULT_STRINGS });
      const { el } = await liveScriptedMap((map) => {
        map.lang = 'de-x-map-legend';
        map.choroplethLegend = true;
        map.choropleth = choropleth({ interpolation: 'step', stops: [[1000, '#aaaaaa'], [2500, '#bbbbbb']] });
      });
      expect(rows(el)).to.deep.equal(['< 2.500', '≥ 2.500']);
      const first = el.shadowRoot!.querySelector('[part="legend-derived"] .legend-row')!;
      expect(first.textContent).to.contain('⁦').and.to.contain('⁩');
    });

    it('derives the gradient bar and its interior ticks for a continuous ramp', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.choroplethLegend = true;
        map.choropleth = choropleth({ stops: [[0, '#ffffff'], [40, '#ffaaaa'], [100, '#ff0000']] });
      });
      const lo = el.shadowRoot!.querySelector('[part="legend-lo"]');
      const hi = el.shadowRoot!.querySelector('[part="legend-hi"]');
      expect(text(lo)).to.equal('0');
      expect(text(hi)).to.equal('100');
      const ticks = [...el.shadowRoot!.querySelectorAll('[part="legend-tick"]')];
      expect(ticks.map((tick) => text(tick))).to.deep.equal(['40']);
      expect((ticks[0] as HTMLElement).style.getPropertyValue('--_lr-map-tick-position')).to.equal('40%');
      expect(rows(el)).to.deep.equal([]);
    });

    it('bounds automatically derived interior ticks to the same limit as authored ticks', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.choroplethLegend = true;
        map.choropleth = choropleth({
          stops: Array.from({ length: 24 }, (_, value) => [value, '#ff0000'] as [number, string]),
        });
      });
      const ticks = [...el.shadowRoot!.querySelectorAll('[part="legend-tick"]')];
      expect(ticks.length).to.equal(16);
      expect(ticks.map((tick) => text(tick))).to.deep.equal(Array.from({ length: 16 }, (_, index) => String(index + 1)));
    });

    it('lets an explicit legendGradient and legendGradientTicks replace the derived ones', async () => {
      // The authored gradient deliberately differs from the layer, which the dev-mode drift
      // diagnostic would report; it is not what this test is about.
      const store = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
      const driftKey = 'lyra-map-legend-choropleth-mismatch';
      const hadDriftKey = store?.has(driftKey);
      store?.add(driftKey);
      try {
        const { el } = await liveScriptedMap((map) => {
          map.choroplethLegend = true;
          map.choropleth = choropleth({ stops: [[0, '#ffffff'], [40, '#ffaaaa'], [100, '#ff0000']] });
          map.legendGradient = [[0, '#000000'], [200, '#ffffff']];
          map.legendGradientTicks = [50, { value: 150, label: 'High' }, 500];
        });
        expect(text(el.shadowRoot!.querySelector('[part="legend-hi"]'))).to.equal('200');
        expect([...el.shadowRoot!.querySelectorAll('[part="legend-tick"]')].map((tick) => text(tick))).to.deep.equal(['50', 'High']);
        expect(el.legendGradientTicks).to.deep.equal([{ value: 50 }, { value: 150, label: 'High' }, { value: 500 }]);

        el.legendGradientTicks = [];
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]')).to.have.length(0);
      } finally {
        if (!hadDriftKey) store?.delete(driftKey);
      }
    });

    it('draws ticks beside a plain legendGradient without choroplethLegend, and ignores them without a bar', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.legendGradient = [[0, '#ffffff'], [100, '#ff0000']];
        map.legendGradientTicks = [25, 75, 25, Number.NaN];
      });
      expect([...el.shadowRoot!.querySelectorAll('[part="legend-tick"]')].map((tick) => text(tick))).to.deep.equal(['25', '75']);
      el.legendGradient = [];
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]')).to.have.length(0);
    });

    it('places ticks on the physical ramp under RTL, mirroring with the flipped bar', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.setAttribute('dir', 'rtl');
        map.legendGradient = [[0, '#ffffff'], [100, '#ff0000']];
        map.legendGradientTicks = [25];
      });
      await nextFrame();
      const bar = el.shadowRoot!.querySelector('[part="legend-gradient"]')!.getBoundingClientRect();
      const tick = el.shadowRoot!.querySelector('[part="legend-tick"]')!.getBoundingClientRect();
      // 25 % from the inline start: a quarter of the way in from the RIGHT edge under RTL.
      const fromRight = (bar.right - (tick.left + tick.width / 2)) / bar.width;
      expect(fromRight, JSON.stringify({ bar: [bar.left, bar.width], tick: [tick.left, tick.width] })).to.be.closeTo(0.25, 0.03);
    });

    it('renders nothing derived while choroplethLegend is off', async () => {
      const { el } = await liveScriptedMap((map) => {
        map.choropleth = choropleth({ interpolation: 'step', stops: [[10, '#aaaaaa'], [20, '#bbbbbb']], noData: {} });
      });
      expect(rows(el)).to.deep.equal([]);
      expect(el.shadowRoot!.querySelector('[part="legend"]') === null).to.equal(true);
      el.choroplethLegend = true;
      await el.updateComplete;
      expect(rows(el)).to.have.length(3);
    });
  });

  describe('cluster.zoomOnClick', () => {
    const clusterHit = (engine: ScriptedOverlayMap) => [{
      layer: { id: layerWithSuffix(engine, '-cluster').id },
      properties: { cluster_id: 7, point_count: 3 },
      geometry: { type: 'Point', coordinates: [3, 4] },
    }];

    for (const callbackStyle of [false, true]) {
      it(`eases into the cluster at its expansion zoom (${callbackStyle ? 'callback' : 'promise'} peer)`, async () => {
        const harness = await liveScriptedMap((el) => {
          el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
        });
        await loadStyle(harness);
        const source = [...harness.engine.sources.values()][0]!;
        source.callbackStyle = callbackStyle;
        source.expansionZoom = 9;
        harness.engine.hits = clusterHit(harness.engine);
        const clicks = await collect(harness.el, 'lr-map-click', () => click(harness.engine));
        expect(clicks[0]?.['origin']).to.equal('cluster');
        await waitUntil(() => harness.engine.commandCalls.length > 0, 'cluster zoom never started');
        expect(harness.engine.commandCalls).to.have.length(1);
        expect(harness.engine.commandCalls[0]).to.deep.equal({
          method: 'easeTo',
          options: { center: [3, 4], zoom: 9 },
        });
        expect(source.expansionRequests).to.deep.equal([7]);
        expect(harness.el.zoom).to.equal(9);
      });
    }

    it('does nothing by default, for other origins and for a missing capability', async () => {
      const harness = await liveScriptedMap((el) => {
        el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: {} }];
      });
      await loadStyle(harness);
      harness.engine.hits = clusterHit(harness.engine);
      click(harness.engine);
      await nextFrame();
      expect(harness.engine.commandCalls).to.have.length(0);

      harness.el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
      await harness.el.updateComplete;
      const source = [...harness.engine.sources.values()][0]!;
      (source as unknown as { getClusterExpansionZoom?: unknown }).getClusterExpansionZoom = undefined;
      harness.engine.hits = clusterHit(harness.engine);
      click(harness.engine);
      await nextFrame();
      expect(harness.engine.commandCalls).to.have.length(0);
    });

    for (const change of ['remove', 'disable', 'replace', 'command', 'center', 'background-click', 'pan', 'zoom', 'boxzoom'] as const) {
      it(`ignores a pending cluster expansion after newer ${change} intent`, async () => {
        const harness = await liveScriptedMap((el) => {
          el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
        });
        await loadStyle(harness);
        const source = [...harness.engine.sources.values()][0]!;
        let release!: (zoom: number) => void;
        source.getClusterExpansionZoom = () => new Promise<number>((resolve) => { release = resolve; });
        harness.engine.hits = clusterHit(harness.engine);
        click(harness.engine);
        if (change === 'remove') harness.el.dataLayers = [];
        if (change === 'disable' || change === 'replace') {
          harness.el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION,
            cluster: { zoomOnClick: change === 'replace', radius: 60 } }];
        }
        if (change === 'command') harness.el.jumpTo({ center: [15, 16], zoom: 6 });
        if (change === 'center') harness.el.center = [15, 16];
        if (change === 'pan' || change === 'zoom') {
          harness.engine.fire('movestart', { originalEvent: new Event(change === 'pan' ? 'pointermove' : 'wheel') });
          harness.engine.center = { lng: 15, lat: 16 };
          harness.engine.zoom = 6;
          harness.engine.fire('move');
        }
        if (change === 'boxzoom') harness.engine.fire('boxzoomstart');
        if (change === 'background-click') {
          harness.engine.hits = [];
          click(harness.engine);
        }
        await harness.el.updateComplete;
        const before = { ...harness.engine.center };
        const callsBefore = harness.engine.commandCalls.length;
        release(9);
        await nextFrame();
        expect(harness.engine.commandCalls.length).to.equal(callsBefore);
        expect(harness.engine.center).to.deep.equal(before);
      });
    }

    for (const method of ['jumpTo', 'easeTo', 'fitBounds'] as const) {
      it(`keeps a synchronous click listener's ${method} ahead of automatic cluster zoom`, async () => {
        const harness = await liveScriptedMap((el) => {
          el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
        });
        await loadStyle(harness);
        const source = [...harness.engine.sources.values()][0]!;
        harness.el.addEventListener('lr-map-click', () => {
          if (method === 'fitBounds') harness.el.fitBounds([[-10, -10], [10, 10]]);
          else harness.el[method]({ center: [15, 16], zoom: 6 });
        });
        harness.engine.hits = clusterHit(harness.engine);
        click(harness.engine);
        await harness.el.updateComplete;
        await nextFrame();
        expect(source.expansionRequests.length).to.equal(0);
        expect(harness.engine.commandCalls.length).to.equal(1);
        expect(harness.engine.commandCalls.some((call) => call.options['zoom'] === 9)).to.equal(false);
      });
    }

    it('lets the newest cluster click win when an earlier lookup settles late', async () => {
      const harness = await liveScriptedMap((el) => {
        el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
      });
      await loadStyle(harness);
      const source = [...harness.engine.sources.values()][0]!;
      const releases: ((zoom: number) => void)[] = [];
      source.getClusterExpansionZoom = () => new Promise<number>((resolve) => releases.push(resolve));
      harness.engine.hits = clusterHit(harness.engine);
      click(harness.engine);
      click(harness.engine);
      releases[0]!(5);
      releases[1]!(8);
      await waitUntil(() => harness.engine.commandCalls.length > 0);
      await nextFrame();
      expect(harness.engine.commandCalls.map((call) => call.options['zoom'])).to.deep.equal([8]);
    });
  });

  describe('declarative controls', () => {
    it('adds the declared controls at their corners and forwards the scale unit', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.controls = { navigation: true, scale: { position: 'bottom-right', unit: 'imperial' } };
      });
      await waitUntil(() => engine.controls.length === 2, 'controls never added');
      const byKind = new Map(engine.controls.map((entry) => [entry.control.kind, entry]));
      expect(byKind.get('navigation')?.position).to.equal('top-right');
      expect(byKind.get('scale')?.position).to.equal('bottom-right');
      expect(byKind.get('scale')?.control.options).to.deep.equal({ unit: 'imperial' });
      expect(el.controls).to.deep.equal({ navigation: true, scale: { position: 'bottom-right', unit: 'imperial' } });
    });

    it('applies the defaults for a bare true and an unknown position or unit', async () => {
      const { engine } = await liveScriptedMap((map) => {
        map.controls = { navigation: { position: 'middle' as never }, scale: { unit: 'nautical' as never } };
      });
      await waitUntil(() => engine.controls.length === 2);
      const byKind = new Map(engine.controls.map((entry) => [entry.control.kind, entry]));
      expect(byKind.get('navigation')?.position).to.equal('top-right');
      expect(byKind.get('scale')?.position).to.equal('bottom-left');
      expect(byKind.get('scale')?.control.options).to.deep.equal({ unit: 'metric' });
    });

    it('replaces a control whose options change, keeps an unchanged one and removes a dropped one', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.controls = { navigation: true, scale: true };
      });
      await waitUntil(() => engine.controls.length === 2);
      const navigation = engine.controls.find((entry) => entry.control.kind === 'navigation')!.control;
      const scale = engine.controls.find((entry) => entry.control.kind === 'scale')!.control;

      el.controls = { navigation: true, scale: { unit: 'imperial' } };
      await waitUntil(() => scale.removed && engine.controls.length === 2);
      expect(navigation.removed, 'an unchanged control is kept').to.equal(false);
      expect(engine.controls.find((entry) => entry.control.kind === 'scale')?.control.options).to.deep.equal({ unit: 'imperial' });

      el.controls = {};
      await waitUntil(() => engine.controls.length === 0);
      expect(navigation.removed).to.equal(true);
    });

    it('adds controls declared after the map exists and none for false', async () => {
      const { el, engine } = await liveScriptedMap();
      expect(engine.controls).to.have.length(0);
      el.controls = { navigation: false, scale: true };
      await waitUntil(() => engine.controls.length === 1);
      expect(engine.controls[0]?.control.kind).to.equal('scale');
    });

    it('relabels the navigation buttons when the language changes and when strings are overridden', async () => {
      registerLyraLocale('fr-x-map-controls', {
        ...LYRA_DEFAULT_STRINGS,
        zoomIn: 'Agrandir',
        zoomOut: 'Réduire',
        mapResetNorth: 'Nord en haut',
      });
      const { el, engine } = await liveScriptedMap((map) => {
        map.controls = { navigation: true };
      });
      await waitUntil(() => engine.controls.length === 1);
      const label = (name: string): string | null =>
        el.shadowRoot!.querySelector(`.maplibregl-ctrl-${name}`)?.getAttribute('aria-label') ?? null;
      await waitUntil(() => label('zoom-in') === LYRA_DEFAULT_STRINGS.zoomIn, 'English labels never applied');
      expect(label('zoom-out')).to.equal(LYRA_DEFAULT_STRINGS.zoomOut);
      expect(label('compass')).to.equal(LYRA_DEFAULT_STRINGS.mapResetNorth);

      el.lang = 'fr-x-map-controls';
      await el.updateComplete;
      await waitUntil(() => label('zoom-in') === 'Agrandir', 'labels did not follow the language');
      expect(label('zoom-out')).to.equal('Réduire');
      expect(label('compass')).to.equal('Nord en haut');

      el.strings = { zoomIn: 'Plus près' };
      await el.updateComplete;
      await waitUntil(() => label('zoom-in') === 'Plus près', 'labels did not follow a strings override');
    });

    it('drops the applied controls with the map and re-adds them on a new one', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.controls = { navigation: true };
      });
      await waitUntil(() => engine.controls.length === 1);
      const wrapper = el.parentElement!;
      el.remove();
      wrapper.append(el);
      await waitUntil(() => el.map != null && el.map !== (engine as unknown), 'map never rebuilt');
      const rebuilt = el.map as unknown as ScriptedOverlayMap;
      await waitUntil(() => rebuilt.controls.length === 1, 'control never re-added');
    });
  });

  describe('LYRA_MAP_EMPTY_STYLE', () => {
    it('is a frozen style with no sources and no layers', () => {
      expect(LYRA_MAP_EMPTY_STYLE).to.deep.equal({ version: 8, sources: {}, layers: [] });
      expect(Object.isFrozen(LYRA_MAP_EMPTY_STYLE)).to.equal(true);
      expect(Object.isFrozen(LYRA_MAP_EMPTY_STYLE.sources)).to.equal(true);
      expect(Object.isFrozen(LYRA_MAP_EMPTY_STYLE.layers)).to.equal(true);
    });

    it('is accepted as mapStyle and handed to the engine as given', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.mapStyle = LYRA_MAP_EMPTY_STYLE;
      });
      expect(engine.options['style']).to.deep.equal(LYRA_MAP_EMPTY_STYLE);
      expect(el.mapStyle).to.deep.equal(LYRA_MAP_EMPTY_STYLE);
    });
  });

  describe('anchor slot', () => {
    const anchorOf = (el: LyraMap): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    const containerRect = (el: LyraMap): DOMRect => el.shadowRoot!.querySelector('[part="container"]')!.getBoundingClientRect();
    const content = (): Element[] => {
      const card = document.createElement('div');
      card.slot = 'anchor';
      card.id = 'details';
      card.style.cssText = 'inline-size: 80px; block-size: 40px';
      card.textContent = 'Details';
      return [card];
    };

    it('stays hidden until anchorLngLat is on screen, then sits above the point', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [0, 0];
      }, content());
      await loadStyle({ el, engine });
      expect(anchorOf(el).hidden).to.equal(true);

      el.anchorLngLat = [5, 5];
      await el.updateComplete;
      const expectedX = (): number => containerRect(el).left + 306;
      await waitUntil(() => {
        const rect = anchorOf(el).getBoundingClientRect();
        return !anchorOf(el).hidden && Math.abs(rect.left + rect.width / 2 - expectedX()) < 2;
      }, 'anchor never centred on the point');
      const rect = anchorOf(el).getBoundingClientRect();
      expect(rect.bottom).to.be.closeTo(containerRect(el).top + 142 - 12, 2);
    });

    it('follows the point through camera moves', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [0, 0];
        map.anchorLngLat = [5, 5];
      }, content());
      await loadStyle({ el, engine });
      const centreX = (): number => {
        const rect = anchorOf(el).getBoundingClientRect();
        return rect.left + rect.width / 2 - containerRect(el).left;
      };
      await waitUntil(() => !anchorOf(el).hidden && Math.abs(centreX() - 306) < 2, 'anchor never placed');

      engine.center = { lng: 10, lat: 0 };
      engine.fire('move');
      await waitUntil(() => Math.abs(centreX() - 206) < 2, 'anchor did not follow the camera');
    });

    it('hides while the point is off screen and when anchorLngLat is cleared, and returns', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [0, 0];
        map.anchorLngLat = [5, 5];
      }, content());
      await loadStyle({ el, engine });
      await waitUntil(() => !anchorOf(el).hidden);

      el.anchorLngLat = [100, 0];
      await el.updateComplete;
      expect(anchorOf(el).hidden, 'point right of the viewport').to.equal(true);

      el.anchorLngLat = [5, 5];
      await el.updateComplete;
      await waitUntil(() => !anchorOf(el).hidden);

      el.anchorLngLat = null;
      await el.updateComplete;
      expect(anchorOf(el).hidden).to.equal(true);

      el.anchorLngLat = [Number.NaN, 5];
      await el.updateComplete;
      expect(anchorOf(el).hidden, 'an unusable position').to.equal(true);
    });

    it('flips below the point near the top edge and stays inside the map near a side edge', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [0, 0];
        map.anchorLngLat = [0, 17];
      }, content());
      await loadStyle({ el, engine });
      await waitUntil(() => !anchorOf(el).hidden);
      const pointY = containerRect(el).top + 22;
      await waitUntil(() => anchorOf(el).getBoundingClientRect().top >= pointY, 'anchor never flipped below the point');

      el.anchorLngLat = [24, 0];
      await el.updateComplete;
      await waitUntil(() => {
        const rect = anchorOf(el).getBoundingClientRect();
        return rect.right <= containerRect(el).right + 0.5 && !anchorOf(el).hidden;
      }, 'anchor overflowed the map edge');
    });

    it('hides again when the map is torn down', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [0, 0];
        map.anchorLngLat = [5, 5];
      }, content());
      await loadStyle({ el, engine });
      await waitUntil(() => !anchorOf(el).hidden);
      const wrapper = el.parentElement!;
      el.remove();
      expect(anchorOf(el).hidden).to.equal(true);
      wrapper.append(el);
    });
  });

  describe('maxBounds below zoom 1', () => {
    async function captureWarnings(run: () => Promise<void>): Promise<string[]> {
      const key = 'lyra-map-max-bounds-rejected';
      const store = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
      const wasWarned = store?.has(key);
      store?.delete(key);
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].startsWith('<lr-map>: maxBounds left maplibre-gl')) {
          warnings.push(args[0]);
        } else originalWarn.apply(console, args);
      };
      try {
        await run();
      } finally {
        console.warn = originalWarn;
        if (wasWarned) store?.add(key);
        else store?.delete(key);
      }
      return warnings;
    }

    const BOX = [[-60, -40], [60, 40]] as [[number, number], [number, number]];

    it('applies a box the peer rejects at a fractional zoom below 1, then restores the camera', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.zoom = 0.4;
        map.center = [3, 4];
      });
      engine.rejectMaxBounds = () => engine.zoom < 1;
      engine.constrainCenter = { lng: 12, lat: 13 };
      const warnings = await captureWarnings(async () => {
        el.maxBounds = BOX;
        await el.updateComplete;
      });
      expect(warnings, 'tolerated, not reverted').to.have.length(0);
      expect(engine.maxBoundsCalls[engine.maxBoundsCalls.length - 1]).to.deep.equal(BOX);
      expect(engine.maxBoundsCalls).to.not.include(undefined);
      expect(engine.zoom).to.equal(0.4);
      expect(engine.center).to.deep.equal({ lng: 3, lat: 4 });
    });

    it('applies the same box at zoom 1 and above on the first call', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.zoom = 2;
      });
      engine.rejectMaxBounds = () => engine.zoom < 1;
      engine.maxBoundsCalls.length = 0;
      el.maxBounds = BOX;
      await el.updateComplete;
      expect(engine.maxBoundsCalls).to.deep.equal([BOX]);
    });

    it('still drops a box the peer rejects at every zoom, and warns once', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.zoom = 0.4;
        map.center = [3, 4];
      });
      engine.rejectMaxBounds = () => true;
      const warnings = await captureWarnings(async () => {
        el.maxBounds = BOX;
        await el.updateComplete;
      });
      expect(warnings).to.have.length(1);
      expect(engine.maxBoundsCalls[engine.maxBoundsCalls.length - 1]).to.equal(null);
      expect(engine.zoom).to.equal(0.4);
      expect(engine.center).to.deep.equal({ lng: 3, lat: 4 });
    });
  });
});

it('LYRA_MAP_EMPTY_STYLE loads in a real engine, the frozen style included', async function () {
  if (!hasWebGL2) this.skip();
  const wrapper = (await fixture(html`<div style="inline-size: 20rem; block-size: 12rem"></div>`)) as HTMLElement;
  const el = document.createElement('lr-map') as LyraMap;
  el.engine = 'maplibre';
  el.mapStyle = LYRA_MAP_EMPTY_STYLE;
  let loaded = false;
  el.addEventListener('lr-map-load', () => {
    loaded = true;
  });
  wrapper.append(el);
  await waitUntil(() => loaded, 'a blank style never loaded', { timeout: 10000 });
  expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
});
