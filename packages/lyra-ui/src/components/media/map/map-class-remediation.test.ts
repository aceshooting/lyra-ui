import { LYRA_DEFAULT_STRINGS, registerLyraLocale } from '../../../internal/localization.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import './map-anchor.js';
import { mapCameraSessionAttachment } from '../../../internal/map-camera-session.js';
import { admitMapViewpoint } from '../../../internal/map-camera-session-data.js';
import { loadMapOwnedFeatureRuntime, loadMapControlRuntime } from './map-feature-loader.js';
import { LYRA_MAP_EMPTY_STYLE, LyraMap } from './map.js';

import { ControlMapEngine, FakeGeolocateControl as Geolocate, FakeAttributionControl as Attribution } from '../../../../test/map-control-engine.js';

class ControlMap extends ControlMapEngine {
  autoRender = true;
  repaintCount = 0;
  override triggerRepaint(): void {
    this.repaintCount++;
    if (this.autoRender) queueMicrotask(() => {
      if (!this.removed) { this.paint(); this.fire('render'); this.fire('idle'); }
    });
  }
  paint(): void {
    const context = this.canvas.getContext('2d')!;
    context.fillStyle = '#275dab';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

const originalContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
async function setup(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element); wrapper.append(element); await element.updateComplete;
  return { element, wrapper };
}
async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const result = await setup(element => { element.initialization = 'eager'; configure(element); });
  await waitUntil(() => result.element.map !== undefined);
  const peer = result.element.map as unknown as ControlMap;
  await result.element.updateComplete; peer.idle = true; peer.fire('idle');
  await result.element.whenIdle();
  return { ...result, peer };
}
async function rejects(work: Promise<Blob>, code: string) {
  let caught: unknown;
  try { await work; } catch (error) { caught = error; }
  expect((caught as { code?: string } | undefined)?.code).to.equal(code);
}
const banner = (element: LyraMap) => element.shadowRoot!.querySelector('[part="configuration-error"]');

describe('map controls, overlays and locale updates', () => {
  beforeEach(() => {
    ControlMap.initialReady = true; ControlMap.prepare = undefined;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup();
    HTMLCanvasElement.prototype.getContext = originalContext; HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  it('paints a configuration error above the map container where a sighted user can read it', async () => {
    const { element } = await mount();
    await rejects(element.exportImage({ type: 'invalid' } as unknown as Parameters<LyraMap['exportImage']>[0]), 'invalid-options');
    await waitUntil(() => banner(element) !== null);
    const message = banner(element)!, rect = message.getBoundingClientRect();
    expect(rect.width).to.be.greaterThan(0);
    const hit = element.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit === message || message.contains(hit)).to.equal(true);
  });

  it('does not raise the export error banner for a rejected concurrent call', async () => {
    const { element, peer } = await mount(); peer.autoRender = false;
    const codes: string[] = [];
    element.addEventListener('lr-map-export-error', event => codes.push((event as CustomEvent<{ code: string }>).detail.code));
    const first = element.exportImage({ attribution: false });
    await rejects(element.exportImage({ attribution: false }), 'busy');
    await waitUntil(() => peer.repaintCount === 1); peer.paint(); peer.fire('render');
    expect((await first).type).to.equal('image/png');
    await element.updateComplete;
    expect(banner(element) === null).to.equal(true);
    expect(codes).to.deep.equal(['busy']);
  });

  it('names an unlabeled marker with the marker string, not the map name, after every semantics sync', async () => {
    const { element } = await mount(el => { el.strings = { mapMarker: 'Repere cartographique' }; });
    const markerElement = document.createElement('div');
    const internals = element as unknown as {
      _markerInstances: Map<string, unknown>; _markerLabels: Map<string, string | undefined>;
      configureMarkerInteraction(node: HTMLElement, activation: { lngLat: readonly [number, number]; marker: { lngLat: readonly [number, number]; label?: string } }): void;
      syncMapSemantics(markers?: boolean): void;
    };
    for (const label of [undefined, '   ']) {
      internals.configureMarkerInteraction(markerElement, { lngLat: [0, 0], marker: { lngLat: [0, 0], label } });
      expect(markerElement.getAttribute('aria-label')).to.equal('Repere cartographique');
    }
    internals._markerInstances.set('k', { getElement: () => markerElement, remove: () => undefined, getPopup: () => undefined });
    internals._markerLabels.set('k', undefined);
    internals.syncMapSemantics(true);
    try { expect(markerElement.getAttribute('aria-label')).to.equal('Repere cartographique'); }
    finally { internals._markerInstances.clear(); internals._markerLabels.clear(); }
  });

  it('keeps the popup tip on the marker side of the popup in every anchor under dir=rtl', async () => {
    const tipSide = async (dir: 'ltr' | 'rtl', anchor: string) => {
      const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir} style="width:320px;height:240px"></div>`);
      const element = document.createElement('lr-map') as LyraMap; element.engine = 'maplibre';
      (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => new Promise(() => {});
      wrapper.append(element); await element.updateComplete;
      const popup = document.createElement('div'); popup.className = `maplibregl-popup maplibregl-popup-anchor-${anchor}`;
      const tip = document.createElement('div'); tip.className = 'maplibregl-popup-tip';
      const content = document.createElement('div'); content.className = 'maplibregl-popup-content'; content.textContent = 'Popup content';
      popup.append(tip, content); element.shadowRoot!.append(popup);
      const t = tip.getBoundingClientRect(), c = content.getBoundingClientRect();
      return { x: Math.sign(t.left + t.width / 2 - (c.left + c.width / 2)), y: Math.sign(t.top + t.height / 2 - (c.top + c.height / 2)) };
    };
    for (const anchor of ['left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(await tipSide('rtl', anchor), anchor).to.deep.equal(await tipSide('ltr', anchor));
    }
  });

  it('stacks the pick controls above the legend so the primary action is never covered', async () => {
    const { element } = await mount(el => { el.pickMode = true; el.legend = [{ color: '#ff0000', label: 'A long legend row label', pattern: 'solid' }]; });
    await waitUntil(() => element.shadowRoot!.querySelector('[part="pick-center"]') !== null && element.shadowRoot!.querySelector('[part="legend"]') !== null);
    const button = element.shadowRoot!.querySelector('[part="pick-center"]')!;
    const rect = button.getBoundingClientRect();
    const hit = element.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit === button || button.contains(hit)).to.equal(true);
  });

  for (const mode of ['pick', 'drawing'] as const) {
    it(`keeps the legend, scene and bottom corner reachable with ${mode} controls`, async () => {
      const { element } = await mount(el => {
        el.style.cssText = 'inline-size:320px;block-size:420px';
        el.scene = { objects: [] };
        el.legendInteractive = true;
        el.legend = [{ label: 'Roads', value: 'roads', color: 'red', pattern: 'solid' }];
        if (mode === 'pick') el.pickMode = true;
        else el.drawMode = 'line';
      });
      const root = element.shadowRoot!;
      const controls = document.createElement('div');
      controls.className = 'maplibregl-control-container';
      const corner = document.createElement('div');
      corner.className = 'maplibregl-ctrl-bottom-left';
      const native = document.createElement('button');
      native.className = 'maplibregl-ctrl';
      native.textContent = 'Native map action';
      corner.append(native);
      controls.append(corner);
      root.querySelector('[part="container"]')!.append(controls);
      await waitUntil(() => corner.part.contains('controls-bottom-left') &&
        parseFloat(getComputedStyle(corner).getPropertyValue('--_lr-map-controls-bottom')) >= native.offsetHeight);
      for (const control of [native, ...['legend-toggle', 'scene-toggle', mode === 'pick' ? 'pick-cancel' : 'drawing-cancel']
        .map(part => root.querySelector<HTMLButtonElement>(`[part~="${part}"]`)!)]) {
        const rect = control.getBoundingClientRect();
        const hit = root.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        expect(control.contains(hit), control.textContent).to.equal(true);
      }
    });
  }

  it('hands focus to the map canvas when cancelling pick mode removes the focused button', async () => {
    const { element, peer } = await mount(el => { el.pickMode = true; });
    peer.canvas.tabIndex = 0; element.shadowRoot!.querySelector('[part="container"]')!.append(peer.canvas);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="pick-cancel"]') !== null);
    const cancel = element.shadowRoot!.querySelector<HTMLElement>('[part="pick-cancel"]')!;
    await focusByKeyboard(cancel);
    cancel.click(); await element.updateComplete;
    expect(element.pickMode).to.equal(false);
    expect(element.shadowRoot!.querySelector('[part="pick-controls"]') === null).to.equal(true);
    expect(element.shadowRoot!.activeElement === peer.canvas).to.equal(true);
  });

  it('returns pick focus to the activation button before the map is constructed', async () => {
    const { element, wrapper } = await setup(el => { el.initialization = 'interaction'; el.pickMode = true; });
    const cancel = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-cancel"]')!;
    await focusByKeyboard(cancel, wrapper);
    element.pickMode = false;
    await element.updateComplete;
    expect(element.map === undefined).to.equal(true);
    const activate = element.shadowRoot!.querySelector('[part="initialization-activate"]');
    expect(activate !== null && element.shadowRoot!.activeElement === activate).to.equal(true);
  });

  it('honours the host disabled gate for marker activation and legend controls', async () => {
    const { element } = await mount(el => {
      el.legendInteractive = true; el.legendCollapsible = true;
      el.legend = [{ color: '#ff0000', label: 'Row', pattern: 'solid', value: 'row' }];
    });
    const internals = element as unknown as {
      _markerInstances: Map<string, unknown>;
      configureMarkerInteraction(node: HTMLElement, activation: { lngLat: readonly [number, number]; marker: { lngLat: readonly [number, number] } }): void;
    };
    const markerElement = document.createElement('div'); let activations = 0;
    element.addEventListener('lr-map-marker-activate', () => activations++);
    internals.configureMarkerInteraction(markerElement, { lngLat: [0, 0], marker: { lngLat: [0, 0] } });
    markerElement.click(); expect(activations).to.equal(1);
    element.setAttribute('disabled', ''); await waitUntil(() => element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="legend-toggle"]')?.disabled === true);
    markerElement.click(); expect(activations).to.equal(1);
    expect(element.shadowRoot!.querySelector<HTMLButtonElement>('[part="legend-disclosure"]')!.disabled).to.equal(true);
  });

  it('ignores assignment to read-only members and observes a legend gradient assigned through the property', () => {
    const element = document.createElement('lr-map') as unknown as Record<string, unknown>;
    for (const name of ['markersTruncated', 'styleLayers', 'styleSources', 'map', 'legendProjection']) {
      const original = element[name];
      expect(() => { element[name] = 'unsupported'; }, name).not.to.throw();
      expect(element[name] === original, name).to.equal(true);
    }
    expect(LyraMap.elementProperties.has('legendGradient')).to.equal(true);
  });

  it('renders a legend gradient assigned before the element upgrades', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const name = 'test-map-upgrade-gradient';
    const element = document.createElement(name) as LyraMap;
    element.setAttribute('initialization', 'interaction');
    element.legendGradient = [[0, 'red'], [1, 'blue']];
    wrapper.append(element);
    if (!customElements.get(name)) customElements.define(name, class extends LyraMap {});
    await element.updateComplete;
    expect(Object.hasOwn(element, 'legendGradient')).to.equal(false);
    expect(element.shadowRoot!.querySelector('[part="legend-gradient"]') !== null).to.equal(true);
  });

  it('lets a camera-interrupt listener that issues a newer command win over the interrupting one', async () => {
    await loadMapOwnedFeatureRuntime(); await loadMapControlRuntime();
    const { element } = await mount();
    const lease = mapCameraSessionAttachment(element)!.acquire({ complete: () => undefined, interrupt: () => true, motion: () => undefined });
    lease.prepare({}, admitMapViewpoint({ center: [5, 5], zoom: 6, bearing: 0, pitch: 0 }), { kind: 'jump' });
    let reactions = 0;
    element.addEventListener('lr-map-camera-interrupt', () => { if (reactions++ === 0) element.jumpTo({ center: [2, 2], zoom: 4 }); });
    element.jumpTo({ center: [1, 1], zoom: 3 }); await element.updateComplete;
    expect(reactions).to.be.greaterThan(0);
    expect(element.center).to.deep.equal([2, 2]); expect(element.zoom).to.equal(4);
  });

  it('does not turn a whitespace-only anchor name into an unnamed group', async () => {
    const anchor = await fixture<HTMLElement>(html`<lr-map-anchor label="   "></lr-map-anchor>`);
    const base = anchor.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('role')).to.equal(false); expect(base.hasAttribute('aria-label')).to.equal(false);
    anchor.setAttribute('aria-label', ' Place '); await (anchor as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Place');
  });
  it('announces pick cancellation after the control changes the mode', async () => {
    const { element } = await mount(el => { el.pickMode = true; });
    const trace: unknown[] = [];
    const click = () => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-cancel"]')!.click();
    element.addEventListener('lr-map-pick-cancel', event => {
      trace.push([element.pickMode, event.detail, Object.isFrozen(event.detail)]);
    });
    element.addEventListener('lr-map-pick-cancel-request', event => {
      trace.push([element.pickMode, event.detail, Object.isFrozen(event.detail)]);
      event.preventDefault();
    }, { once: true });
    click();
    expect(element.pickMode).to.equal(true);
    element.addEventListener('lr-map-pick-cancel-request', () => { element.pickMode = true; }, { once: true });
    click();
    expect(element.pickMode).to.equal(true);
    click();
    expect(trace).to.deep.equal([[true, { source: 'control' }, true], [false, { source: 'control' }, true]]);

  });

  it('suppresses stale pick, category and disclosure controls', async () => {
    const { element } = await mount(el => {
      el.pickMode = true; el.legendCollapsible = true; el.legendInteractive = true;
      el.legend = [{ color: 'red', label: 'Roads', value: 'roads', pattern: 'solid' }];
    });
    const button = (name: string) => element.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${name}"]`)!;
    const cancel = button('pick-cancel'), row = button('legend-toggle'), panel = button('legend-disclosure');
    const changes: string[] = [];
    element.addEventListener('lr-map-pick-cancel', event => changes.push(event.type));
    element.addEventListener('lr-map-pick-cancel-request', () => element.setAttribute('disabled', ''), { once: true });
    cancel.click();
    expect(element.pickMode).to.equal(true);
    expect(changes).to.deep.equal([]);
    cancel.dispatchEvent(new MouseEvent('click'));
    panel.dispatchEvent(new MouseEvent('click'));
    expect(element.legendOpen).to.equal(true);
    element.removeAttribute('disabled');
    element.addEventListener('lr-map-legend-toggle-request', () => element.setAttribute('disabled', ''), { once: true });
    row.click();
    expect(element.hiddenCategories).to.deep.equal([]);
  });

  it('leaves category visibility and disclosure with the listener that writes during a request', async () => {
    const { element } = await mount(el => {
      el.legendCollapsible = true; el.legendInteractive = true;
      el.legend = [{ color: 'red', label: 'Roads', value: 'roads', pattern: 'solid' }];
    });
    const click = (part: string) => element.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${part}"]`)!.click();
    element.addEventListener('lr-map-legend-toggle-request', () => { element.hiddenCategories = element.hiddenCategories; }, { once: true });
    click('legend-toggle');
    expect(element.hiddenCategories).to.deep.equal([]);
    element.addEventListener('lr-map-legend-panel-toggle-request', () => { element.legendOpen = true; }, { once: true });
    click('legend-disclosure');
    expect(element.legendOpen).to.equal(true);
    element.addEventListener('lr-map-legend-panel-toggle-request', () => { element.legendCollapsible = false; }, { once: true });
    click('legend-disclosure');
    expect(element.legendOpen).to.equal(true);
  });

  it('abandons a category toggle when its listener replaces the legend entry', async () => {
    const { element } = await mount(el => {
      el.legendInteractive = true;
      el.legend = [{ color: 'red', label: 'Roads', value: 'roads', pattern: 'solid' }];
    });
    let requests = 0;
    element.addEventListener('lr-map-legend-toggle-request', () => {
      requests++;
      element.legend = [{ color: 'blue', label: 'Water', value: 'water', pattern: 'solid' }];
    }, { once: true });
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="legend-toggle"]')!.click();
    expect(requests).to.equal(1);
    expect(element.hiddenCategories).to.deep.equal([]);
    await element.updateComplete;
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="legend-toggle"]')!.click();
    expect(element.hiddenCategories).to.deep.equal(['water']);
  });

  for (const target of ['legend-toggle', 'legend-disclosure'] as const) {
    it(`discards a pending ${target} request when its listener reconnects the map`, async () => {
      const { element, wrapper } = await mount(el => {
        el.legendInteractive = true;
        el.legendCollapsible = true;
        el.legend = [{ label: 'Roads', value: 'roads', color: 'red', pattern: 'solid' }];
      });
      const request = target === 'legend-toggle' ? 'lr-map-legend-toggle-request' : 'lr-map-legend-panel-toggle-request';
      let reconnected = false;
      element.addEventListener(request, () => {
        element.remove();
        wrapper.append(element);
        reconnected = true;
      }, { once: true });
      element.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${target}"]`)!.click();
      expect(reconnected).to.equal(true);
      expect(element.legendOpen).to.equal(true);
      expect(element.hiddenCategories).to.deep.equal([]);
    });
  }

  it('keeps scene and activation usable when focus inspection is unavailable', async () => {
    const { element } = await setup(el => { el.initialization = 'interaction'; });
    const root = element.shadowRoot!;
    Object.defineProperty(root, 'activeElement', { configurable: true, get() { throw new Error('focus unavailable'); } });
    try {
      element.scene = { objects: [] };
      root.querySelector<HTMLButtonElement>('[part="initialization-activate"]')!.click();
      await waitUntil(() => element.map !== undefined);
      expect(root.querySelector('[part="scene-panel"]') !== null).to.equal(true);
    } finally { Reflect.deleteProperty(root, 'activeElement'); }
  });

  it('escapes translated scale units as text in the native control locale', async () => {
    const { element } = await mount(el => { el.strings = { mapScaleFeet: 'ft <‘" & m>' }; });
    const units = (element as unknown as { controlLocale(): Record<string, string> }).controlLocale();
    const output = document.createElement('span');
    output.innerHTML = units['ScaleControl.Feet']!;
    expect(output.childElementCount).to.equal(0);
    expect(output.textContent).to.equal('ft <‘" & m>');
  });

  it('preserves author-owned busy state across loading and unrelated updates', async () => {
    const { element } = await mount(el => el.setAttribute('aria-busy', 'true'));
    expect(element.getAttribute('aria-busy')).to.equal('true');
    expect(element.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('false');
    element.removeAttribute('aria-busy'); await element.updateComplete;
    expect(element.getAttribute('aria-busy')).to.equal('false');
    element.setAttribute('aria-busy', 'true'); element.pickMode = false; await element.updateComplete;
    expect(element.getAttribute('aria-busy')).to.equal('true');
  });

  it('preserves space for the ramp between long captions at a narrow allocation', async () => {
    const { element } = await mount(el => {
      el.style.inlineSize = '320px';
      el.legendGradient = [[0, 'red'], [1, 'blue']];
      el.legendGradientLoLabel = 'Lower'.repeat(40); el.legendGradientHiLabel = 'Upper'.repeat(40);
    });
    const rect = (part: string) => element.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect();
    const bar = rect('legend-gradient'), legend = rect('legend');
    expect(bar.width).to.be.greaterThan(4);
    expect(rect('legend-hi').right).to.be.at.most(legend.right);
  });

  it('cancels queued camera and pointer reports in the window that issued them after adoption', async () => {
    const { element, peer } = await mount();
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const other = frame.contentWindow!;
    const state = element as unknown as {
      scheduleMoveReport(peer: ControlMap): void;
      schedulePointerReport(peer: ControlMap, event: unknown): void;
    };
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame, otherCancel = other.cancelAnimationFrame;
    const issued: number[] = [], cancelled: number[] = [], foreign: number[] = [];
    try {
      window.requestAnimationFrame = () => { const id = 900000 + issued.length; issued.push(id); return id; };
      window.cancelAnimationFrame = id => { if (issued.includes(id)) cancelled.push(id); else cancel.call(window, id); };
      other.cancelAnimationFrame = id => { foreign.push(id); };
      state.scheduleMoveReport(peer);
      state.schedulePointerReport(peer, { lngLat: { lng: 1, lat: 2 }, point: { x: 10, y: 20 } });
      expect(issued.length).to.equal(2);
      frame.contentDocument!.adoptNode(element);
      expect(cancelled.sort()).to.deep.equal(issued);
      expect(foreign.filter(id => issued.includes(id))).to.deep.equal([]);
    } finally {
      window.requestAnimationFrame = request;
      window.cancelAnimationFrame = cancel;
      other.cancelAnimationFrame = otherCancel;
    }
  });

  it('samples choropleth opacity once for multiple paint reconciliations within a theme pass', async () => {
    const { element } = await mount();
    const state = element as unknown as { syncPaintTheme(): boolean; refreshThemePaint(): boolean };
    const property = '--lr-map-choropleth-fill-opacity';
    element.style.setProperty(property, '0.47');
    const read = CSSStyleDeclaration.prototype.getPropertyValue;
    let reads = 0;
    try {
      CSSStyleDeclaration.prototype.getPropertyValue = function(name) {
        if (name === property) reads++;
        return read.call(this, name);
      };
      state.syncPaintTheme();
      state.refreshThemePaint();
      state.refreshThemePaint();
      expect(reads).to.equal(1);
    } finally { CSSStyleDeclaration.prototype.getPropertyValue = read; }
  });

  it('projects the peer subtree in one scan and handles elements adopted from a frame', async () => {
    const { element } = await mount();
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const group = frame.contentDocument!.createElement('div');
    group.innerHTML = '<button class="maplibregl-ctrl-zoom-in"><span class="maplibregl-ctrl-icon"></span></button>';
    group.className = 'maplibregl-ctrl-group';
    const container = element.shadowRoot!.querySelector('[part="container"]')!;
    const scan = group.querySelectorAll.bind(group); let scans = 0;
    group.querySelectorAll = <E extends Element>(selector: string) => { scans++; return scan<E>(selector); };
    container.append(group);
    await waitUntil(() => group.firstElementChild!.part.contains('zoom-in'));
    expect(group.part.contains('navigation')).to.equal(true);
    expect(group.firstElementChild!.firstElementChild!.part.contains('zoom-in-icon')).to.equal(true);
    expect(scans).to.equal(1);
    group.setAttribute('disabled', '');
    group.removeAttribute('disabled');
    await waitUntil(() => scans > 1);
    expect(scans).to.equal(2);
  });

  it('decorates a peer button again when its existing text node changes', async () => {
    const { element } = await mount(el => { el.strings = { zoomIn: 'Enlarge map' }; });
    const button = document.createElement('button');
    button.className = 'maplibregl-ctrl-zoom-in';
    const caption = document.createTextNode('+');
    button.append(caption);
    element.shadowRoot!.querySelector('[part="container"]')!.append(button);
    await waitUntil(() => button.getAttribute('aria-label') === 'Enlarge map');
    button.setAttribute('aria-label', 'Peer label');
    caption.data = 'Zoom';
    await waitUntil(() => button.getAttribute('aria-label') === 'Enlarge map');
    expect(caption.data).to.equal('Zoom');
  });

  it('refreshes the peer controls once per semantics update including marker updates', async () => {
    const { element } = await mount(el => { el.strings = { zoomIn: 'Enlarge map' }; });
    const container = element.shadowRoot!.querySelector<HTMLElement>('[part="container"]')!;
    const zoom = document.createElement('button');
    zoom.className = 'maplibregl-ctrl-zoom-in';
    container.append(zoom);
    const query = container.querySelectorAll.bind(container);
    let scans = 0;
    container.querySelectorAll = <E extends Element>(selector: string) => { scans++; return query<E>(selector); };
    try {
      for (const markers of [false, true]) {
        zoom.setAttribute('aria-label', 'Peer zoom');
        scans = 0;
        (element as unknown as { syncMapSemantics(markers: boolean): void }).syncMapSemantics(markers);
        expect(zoom.getAttribute('aria-label')).to.equal('Enlarge map');
        expect(scans).to.equal(1);
      }
    } finally { Reflect.deleteProperty(container, 'querySelectorAll'); }
  });

  it('ships only the English fallback keys used by map surfaces', () => {
    const strings = (LyraMap as unknown as { defaultStrings: Record<string, string> }).defaultStrings;
    for (const unused of ['collapse', 'date', 'search', 'select']) expect(Object.hasOwn(strings, unused), unused).to.equal(false);
    for (const used of ['mapHashConflict', 'mapSceneMarker', 'mapScaleFeet', 'mapDrawingTooFewVertices']) expect(typeof strings[used]).to.equal('string');
  });

  it('constructs scene state only when a scene is first supplied on the connection', async () => {
    const { element } = await mount();
    const state = element as unknown as { geographicSceneOwner?: object };
    expect(state.geographicSceneOwner === undefined).to.equal(true);
    element.scene = { objects: [] };
    expect(state.geographicSceneOwner !== undefined).to.equal(true);
  });

  it('prefers a usable anchor label when the host name is whitespace', async () => {
    const element = await fixture<HTMLElement>(html`<lr-map-anchor aria-label="  " label=" Place "></lr-map-anchor>`);
    expect(element.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Place');
  });

  it('respects an empty host name as an explicit opt-out on a labeled anchor', async () => {
    const element = await fixture<HTMLElement>(html`<lr-map-anchor aria-label="" label="Place"></lr-map-anchor>`);
    const panel = element.shadowRoot!.querySelector('[part="base"]')!;
    expect(panel.hasAttribute('aria-label')).to.equal(false);
    expect(panel.hasAttribute('role')).to.equal(false);
  });

  it('keeps a derived legend snapshot on unrelated updates and refreshes localized captions', async () => {
    const { element } = await mount(el => {
      el.choroplethLegend = true;
      el.choropleth = { geojson: { type: 'FeatureCollection', features: [] }, sourceId: 'districts', field: 'value', stops: [[0, 'red'], [1, 'blue']] };
    });
    const state = element as unknown as { derivedLegend: object };
    const previous = state.derivedLegend;
    element.pickMode = true; await element.updateComplete;
    expect(state.derivedLegend === previous).to.equal(true);
    registerLyraLocale('fr-x-map-cache', { ...LYRA_DEFAULT_STRINGS });
    element.locale = 'fr-x-map-cache'; await element.updateComplete;
    expect(state.derivedLegend === previous).to.equal(false);
  });

});
