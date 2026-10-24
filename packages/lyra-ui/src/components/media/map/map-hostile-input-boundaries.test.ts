import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import {
  ScriptedOverlayMap,
  originalGetContext,
  liveScriptedMap,
  loadStyle,
  layerWithSuffix,
  COLLECTION,
} from '../../../../test/map-scripted-engine.js';
import type { LyraMap, LyraMapStyleSpecification } from './map.js';

const GLYPH_STYLE = { version: 8, sources: {}, layers: [], glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf' } satisfies LyraMapStyleSpecification;

/** A control engine that also accepts per-layer zoom ranges, as a row with `maxZoom` requires. */
class RangedMap extends ControlMapEngine {
  setLayerZoomRange(): void {}
}

/** Reads a layer collection the way a hostile caller can break it: the length is unreadable. */
function unreadableLength<T>(entries: T[]): T[] {
  return new Proxy(entries, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'length') throw new TypeError('unreadable length');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}

describe('lr-map hostile and malformed input boundaries', () => {
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

  it('reports a legend whose every row was rejected without drawing a swatch', async () => {
    const { el } = await liveScriptedMap((map) => {
      map.strings = { paginationSummary: 'Showing {start} through {end} of {total} {itemLabel}', items: 'rows' };
      map.legend = [null, 'row', { label: '  ', color: '#ff0000', pattern: 'solid' }] as never;
    });
    await el.updateComplete;
    expect(el.legend.length).to.equal(0);
    expect(el.legendProjection).to.deep.equal({ inputCount: 3, renderedCount: 0, omittedCount: 3, truncatedLabelCount: 0, truncated: true });
    expect(el.shadowRoot!.querySelector('[part="legend-limit"]')?.textContent?.trim()).to.equal('Showing 0 through 0 of 3 rows');
    expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(0);
  });

  it('treats a legend or hidden-category assignment that is not a list as empty', async () => {
    const { el } = await liveScriptedMap((map) => {
      map.legend = [{ label: 'Open', color: '#00ff00', pattern: 'solid' }];
      map.hiddenCategories = ['open'];
    });
    expect(el.legend.length).to.equal(1);
    expect(el.hiddenCategories).to.deep.equal(['open']);
    el.legend = 'Open' as never;
    el.hiddenCategories = { 0: 'open' } as never;
    await el.updateComplete;
    expect(el.legend.length).to.equal(0);
    expect(el.legendProjection.inputCount).to.equal(0);
    expect(el.hiddenCategories.length).to.equal(0);
    expect(Boolean(el.shadowRoot!.querySelector('[part="legend"]'))).to.equal(false);
  });

  it('draws no gradient mark while the tick list cannot be measured and recovers on a readable one', async () => {
    const { el } = await liveScriptedMap((map) => { map.legendGradient = [[0, '#ffffff'], [100, '#ff0000']]; });
    el.legendGradientTicks = unreadableLength([25, 75]);
    await el.updateComplete;
    expect(el.legendGradientTicks.length).to.equal(0);
    expect(Boolean(el.shadowRoot!.querySelector('[part="legend-gradient"]'))).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]').length).to.equal(0);
    el.legendGradientTicks = [25, 75];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]').length).to.equal(2);
  });

  it('drops an unusable maxBounds before it reaches the engine and still applies a usable one', async () => {
    const { el, engine } = await liveScriptedMap();
    const usable = [[-10, -5], [10, 5]] as const;
    for (const [name, box] of [
      ['a corner that is not a list', [[0, 0], 'north-east']],
      ['a coordinate that is not a number', [[Number.NaN, 0], [10, 10]]],
      ['a box that is not above and right of its origin', [[10, 0], [0, 10]]],
      ['a longitude beyond the globe', [[-200, 0], [10, 10]]],
      ['a latitude beyond the globe', [[0, 0], [10, 95]]],
    ] as const) {
      engine.maxBoundsCalls.length = 0;
      el.maxBounds = box as never;
      await el.updateComplete;
      expect(engine.maxBoundsCalls, name).to.deep.equal([null]);
    }
    engine.maxBoundsCalls.length = 0;
    el.maxBounds = usable as never;
    await el.updateComplete;
    expect(engine.maxBoundsCalls).to.deep.equal([usable]);
  });

  it('keeps declared zoom limits without touching an engine that cannot apply them', async () => {
    const { el, engine } = await liveScriptedMap();
    const commands = engine.commandCalls.length;
    el.minZoom = 3;
    el.maxZoom = 12;
    await el.updateComplete;
    expect(el.minZoom).to.equal(3);
    expect(el.maxZoom).to.equal(12);
    expect(engine.commandCalls.length).to.equal(commands);
    expect(el.map === (engine as unknown)).to.equal(true);
  });

  it('fits with the default settings when the options argument is not a record', async () => {
    const harness = await liveScriptedMap((map) => { map.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION }]; });
    await loadStyle(harness);
    const { el, engine } = harness;
    expect(el.fitBounds([[-10, -5], [10, 5]], null as never)).to.equal(true);
    expect(engine.commandCalls.at(-1)).to.deep.equal({ method: 'fitBounds', options: { center: [0, 0], zoom: 6 } });
    expect(el.fitToData(7 as never)).to.equal(true);
    expect(engine.commandCalls.at(-1)).to.deep.equal({ method: 'fitBounds', options: { center: [1, 1], zoom: 16 } });
  });

  it('paints an explicit accent tone like the default tone, and skips rows that are not records', async () => {
    const fillFor = async (tone: string | undefined, extra: readonly unknown[] = []): Promise<unknown> => {
      const harness = await liveScriptedMap((map) => {
        map.style.setProperty('--lr-color-brand', '#112233');
        map.style.setProperty('--lr-color-success', '#445566');
        map.dataLayers = [...extra, { sourceId: 'areas', geojson: COLLECTION, ...(tone ? { tone } : {}) }] as never;
      });
      await loadStyle(harness);
      expect(Boolean(harness.el.shadowRoot!.querySelector('[part="configuration-error"]'))).to.equal(false);
      return layerWithSuffix(harness.engine, '-fill').paint['fill-color'];
    };
    expect(await fillFor(undefined)).to.equal('#112233');
    expect(await fillFor('accent')).to.equal('#112233');
    expect(await fillFor('success')).to.equal('#445566');
    expect(await fillFor('accent', [null, 7, 'areas'])).to.equal('#112233');
  });

  it('flags label options that contradict the layer they label, keeps the committed layer and recovers', async () => {
    const label = { field: 'name' };
    const layer = (extra: Record<string, unknown>) => [{ sourceId: 'areas', geojson: COLLECTION, ...extra }];
    const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
    const element = document.createElement('lr-map') as LyraMap;
    element.engine = 'maplibre';
    element.initialization = 'eager';
    element.mapStyle = GLYPH_STYLE;
    element.controls = { attribution: false };
    element.strings = { mapInitializationFailed: 'Layer unavailable' };
    element.dataLayers = layer({ label }) as never;
    (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: RangedMap });
    wrapper.append(element);
    await waitUntil(() => element.map !== undefined);
    const peer = element.map as unknown as RangedMap;
    peer.ready = true;
    peer.fire('load');
    await element.whenStyleReady();
    const error = () => element.shadowRoot!.querySelector('[part="configuration-error"]')?.textContent?.trim();
    const labels = () => [...peer.layers.values()].filter(entry => (entry as { type?: string }).type === 'symbol').length;
    await waitUntil(() => labels() === 1, 'the label layer was never installed');
    expect(error()).to.equal(undefined);
    for (const accepted of [layer({ maxZoom: 5, label: { ...label, minZoom: 5 } }), layer({ label })]) {
      element.dataLayers = accepted as never;
      await element.updateComplete;
      await element.whenIdle();
      expect(error()).to.equal(undefined);
      expect(labels()).to.equal(1);
    }
    for (const [name, rows] of [
      ['a heatmap with a label', layer({ kind: 'heatmap', label })],
      ['a clustered layer with a line-placed label', layer({ cluster: {}, label: { ...label, placement: 'line' } })],
      ['a label that appears above the zoom range of its layer', layer({ maxZoom: 4, label: { ...label, minZoom: 5 } })],
    ] as const) {
      element.dataLayers = rows as never;
      await waitUntil(() => error() !== undefined, `${name} was not reported`);
      expect(error(), name).to.equal('Layer unavailable');
      expect(labels(), name).to.equal(1);
      element.dataLayers = layer({ label }) as never;
      await waitUntil(() => error() === undefined, `${name} did not recover`);
    }
  });
});
