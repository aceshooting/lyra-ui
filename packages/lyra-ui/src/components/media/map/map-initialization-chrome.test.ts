import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { ControlMapEngine, FakeMapControl, FakeGeolocateControl, FakeAttributionControl } from '../../../../test/map-control-engine.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { loadMapControlRuntime } from './map-feature-loader.js';
import { MapControlsLifecycle } from './map-controls-lifecycle.js';
void LyraMap;

const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const getContext = HTMLCanvasElement.prototype.getContext;
async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.initialization = 'interaction'; element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.style.cssText = 'inline-size:320px;block-size:240px';
  let constructions = 0;
  class DeferredMap extends ControlMapEngine {
    static override initialReady = true;
    constructor(options: Record<string, unknown>) { super(options); constructions++; }
  }
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({
    Map: DeferredMap, NavigationControl: FakeMapControl, ScaleControl: FakeMapControl,
    GeolocateControl: FakeGeolocateControl, AttributionControl: FakeAttributionControl,
  });
  configure(element); wrapper.append(element); await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelector('[part="initialization-placeholder"]') !== null);
  expect(constructions, 'map construction waits for activation').to.equal(0);
  return { element, wrapper, root: element.shadowRoot!, constructions: () => constructions };
}
type HeldControl = { readonly kind: string; readonly resolve: (constructor: typeof FakeMapControl | null) => void };
/** Replaces the lazy control loader with held imports, through the element's own lifecycle seam. */
function holdControls(element: LyraMap): HeldControl[] {
  const requests: HeldControl[] = [];
  (element as unknown as { controlLifecycle: MapControlsLifecycle }).controlLifecycle =
    new MapControlsLifecycle(kind => new Promise<typeof FakeMapControl | null>(resolve => { requests.push({ kind, resolve }); }));
  return requests;
}
function outlines(root: ParentNode): (string | null)[] {
  return [...root.querySelectorAll('[part~="initialization-control"]')].map(node => node.getAttribute('data-control'));
}
function part<T extends HTMLElement = HTMLElement>(root: ParentNode, name: string): T {
  const value = root.querySelector<T>(`[part~="${name}"]`);
  if (!value) throw new Error(`Missing part ${name}`);
  return value;
}
describe('lr-map deferred initialization chrome', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : getContext.call(this, id as never, ...(rest as []));
    } as typeof getContext;
    await resetMouse();
  });
  afterEach(() => {
    fixtureCleanup(); HTMLCanvasElement.prototype.getContext = getContext;
    if (observerDescriptor) Object.defineProperty(window, 'IntersectionObserver', observerDescriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });
  it('keeps unset controls empty and exposes the skeleton and independent activation label', async () => {
    const h = await mount();
    expect(h.element.controls).to.equal(undefined);
    expect(h.root.querySelectorAll('[part~="initialization-control"]').length).to.equal(0);
    expect(part(h.root, 'initialization-skeleton').localName).to.equal('lr-skeleton');
    const button = part<HTMLButtonElement>(h.root, 'initialization-activate');
    expect(button.getAttribute('aria-label')).to.equal('Show interactive map');
    expect(part(h.root, 'initialization-activate-label').textContent).to.equal('Show interactive map');
    expect(h.constructions()).to.equal(0);
  });
  it('places admitted controls by corner and ascending order with stable ties, then updates them', async () => {
    const h = await mount(element => { element.controls = {
      navigation: { position: 'top-left', order: 2 }, geolocate: { position: 'top-left', order: -1 },
      scale: { position: 'bottom-right' }, attribution: { position: 'bottom-right' },
    }; });
    const kinds = (corner: string) => [...part(h.root, `controls-${corner}`).querySelectorAll<HTMLElement>('[data-control]')].map(node => node.dataset['control']);
    expect(kinds('top-left')).to.deep.equal(['geolocate', 'navigation']);
    expect(kinds('bottom-right')).to.deep.equal(['scale', 'attribution']);
    expect(kinds('top-right')).to.deep.equal([]); expect(kinds('bottom-left')).to.deep.equal([]);
    expect(part(h.root, 'initialization-controls').getAttribute('aria-hidden')).to.equal('true');
    h.element.controls = { navigation: { position: 'bottom-left' }, geolocate: { position: 'bottom-left', order: 1 } };
    await h.element.updateComplete;
    expect(kinds('top-left')).to.deep.equal([]); expect(kinds('bottom-left')).to.deep.equal(['navigation', 'geolocate']);
    expect(h.constructions()).to.equal(0);
  });
  it('exposes per-control placeholder parts for native group dimensions without scripting the shadow tree', async () => {
    const h = await mount(element => { element.controls = { navigation: true, scale: true, geolocate: true, attribution: true }; });
    const navigation = part(h.root, 'initialization-navigation'), scale = part(h.root, 'initialization-scale');
    expect(getComputedStyle(part(h.root, 'controls-top-right')).gap).to.equal('0px');
    const style = document.createElement('style');
    style.textContent = 'lr-map::part(initialization-navigation) { block-size:108px } lr-map::part(initialization-scale) { inline-size:172px }';
    h.wrapper.prepend(style);
    expect(getComputedStyle(navigation).blockSize).to.equal('108px');
    expect(getComputedStyle(scale).inlineSize).to.equal('172px');
    expect(part(h.root, 'initialization-geolocate').getAttribute('data-control')).to.equal('geolocate');
    expect(part(h.root, 'initialization-attribution').getAttribute('data-control')).to.equal('attribution');
    expect(h.root.querySelectorAll('[part~="initialization-control"]').length).to.equal(4);
    expect(h.constructions()).to.equal(0);
  });
  it('anchors asymmetric bottom corner placeholders to the same bottom edge', async () => {
    const h = await mount(element => { element.controls = {
      navigation: { position: 'bottom-left' }, geolocate: { position: 'bottom-right' },
    }; });
    const style = document.createElement('style');
    style.textContent = 'lr-map::part(initialization-navigation) { block-size:108px }';
    h.wrapper.prepend(style);
    const navigation = part(h.root, 'initialization-navigation');
    const geolocate = part(h.root, 'initialization-geolocate');
    const navRect = navigation.getBoundingClientRect(), geoRect = geolocate.getBoundingClientRect();
    expect(navRect.height).to.be.greaterThan(geoRect.height);
    expect(Math.abs(navRect.bottom - geoRect.bottom)).to.be.lessThan(1);
    const allocation = h.element.getBoundingClientRect();
    expect(Math.abs(allocation.bottom - geoRect.bottom - parseFloat(getComputedStyle(geolocate).marginBlockEnd))).to.be.lessThan(1);
    expect(h.constructions()).to.equal(0);
  });
  it('mirrors logical corner allocation in RTL and permits shared corner part styling', async () => {
    const h = await mount(element => { element.dir = 'rtl'; element.controls = { navigation: { position: 'top-left' }, scale: { position: 'top-left' } }; });
    const style = document.createElement('style');
    style.textContent = 'lr-map::part(controls-top-left) { margin-inline-start:19px; gap:13px }';
    h.wrapper.prepend(style);
    const corner = part(h.root, 'controls-top-left');
    const rect = h.element.getBoundingClientRect(), placed = corner.getBoundingClientRect();
    expect(Math.abs(rect.right - placed.right - 19)).to.be.lessThan(1);
    expect(getComputedStyle(corner).gap).to.equal('13px');
    const controls = corner.querySelectorAll<HTMLElement>('[data-control]');
    expect(controls[1]!.getBoundingClientRect().top).to.be.greaterThan(controls[0]!.getBoundingClientRect().top);
    h.element.remove(); expect(h.constructions()).to.equal(0);
    h.wrapper.append(h.element); await h.element.updateComplete;
    await waitUntil(() => h.root.querySelector('[part="initialization-placeholder"]') !== null);
    expect(h.constructions()).to.equal(0);
    expect(part(h.root, 'controls-top-left').querySelectorAll('[data-control]').length).to.equal(2);
  });
  it('keeps requested control outlines after activation until lazy controls are installed', async () => {
    await loadMapControlRuntime();
    const h = await mount(element => { element.controls = { navigation: true, attribution: false }; });
    const requests = holdControls(h.element);
    try {
      await focusByKeyboard(part(h.root, 'initialization-activate'));
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => requests.length === 1 && h.constructions() === 1);
      await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal(['navigation']);
      const decoration = part(h.root, 'initialization-controls');
      expect(decoration.getAttribute('aria-hidden')).to.equal('true');
      expect(decoration.inert).to.equal(true);
      expect(getComputedStyle(decoration).pointerEvents).to.equal('none');
      expect(h.root.querySelector('[part~="initialization-placeholder"]') === null).to.equal(true);
      expect(h.root.querySelector('[part~="initialization-activate"]') === null).to.equal(true);
      expect(h.root.querySelector('[part~="initialization-skeleton"]') === null).to.equal(true);
      expect(h.element.map === undefined).to.equal(false);
      expect((h.element.map as unknown as ControlMapEngine).controls.size).to.equal(0);
      requests[0]!.resolve(FakeMapControl);
      await h.element.whenControlsReady(); await h.element.updateComplete;
      expect((h.element.map as unknown as ControlMapEngine).controls.size).to.equal(1);
      expect(outlines(h.root)).to.deep.equal([]);
      expect(h.root.querySelector('[part~="initialization-controls"]') === null).to.equal(true);
    } finally { for (const request of requests) request.resolve(FakeMapControl); }
  });
  it('keeps implicit default attribution without an outline while its control loads', async () => {
    await loadMapControlRuntime();
    const h = await mount();
    const requests = holdControls(h.element);
    try {
      await focusByKeyboard(part(h.root, 'initialization-activate'));
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => requests.length === 1 && h.constructions() === 1);
      await h.element.updateComplete;
      expect(requests.map(request => request.kind)).to.deep.equal(['attribution']);
      expect(outlines(h.root)).to.deep.equal([]);
      expect(h.root.querySelector('[part~="initialization-placeholder"]') === null).to.equal(true);
    } finally { for (const request of requests) request.resolve(FakeAttributionControl); }
  });
  it('clears pending outlines when control installation fails and keeps localized feedback', async () => {
    await loadMapControlRuntime();
    const h = await mount(element => { element.controls = { navigation: true, attribution: false }; });
    const requests = holdControls(h.element);
    await focusByKeyboard(part(h.root, 'initialization-activate'));
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => requests.length === 1 && h.constructions() === 1);
    await h.element.updateComplete;
    expect(outlines(h.root)).to.deep.equal(['navigation']);
    let failure = '';
    requests[0]!.resolve(null);
    await h.element.whenControlsReady().catch((error: Error) => { failure = error.name; });
    await h.element.updateComplete;
    expect(failure).to.equal('MapReadinessError');
    expect(outlines(h.root)).to.deep.equal([]);
    expect(part(h.root, 'configuration-error').textContent).to.equal('A map control could not be loaded');
    expect(h.element.map === undefined).to.equal(false);
  });
  it('replaces superseded pending outlines and ignores the superseded completion', async () => {
    await loadMapControlRuntime();
    const h = await mount(element => { element.controls = { navigation: true, attribution: false }; });
    const requests = holdControls(h.element);
    try {
      await focusByKeyboard(part(h.root, 'initialization-activate'));
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => requests.length === 1 && h.constructions() === 1);
      h.element.controls = { scale: { position: 'top-left' }, attribution: false };
      await waitUntil(() => requests.length === 2);
      await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal(['scale']);
      requests[0]!.resolve(FakeMapControl);
      await new Promise<void>(resolve => setTimeout(resolve, 0)); await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal(['scale']);
      expect(part(h.root, 'controls-top-left').querySelectorAll('[data-control]').length).to.equal(1);
      requests[1]!.resolve(FakeMapControl);
      await h.element.whenControlsReady(); await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal([]);
    } finally { for (const request of requests) request.resolve(FakeMapControl); }
  });
  it('outlines only newly requested controls beside retained installed ones', async () => {
    await loadMapControlRuntime();
    const h = await mount(element => { element.controls = { navigation: true, attribution: false }; });
    const requests = holdControls(h.element);
    try {
      await focusByKeyboard(part(h.root, 'initialization-activate'));
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => requests.length === 1 && h.constructions() === 1);
      requests[0]!.resolve(FakeMapControl);
      await h.element.whenControlsReady(); await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal([]);
      h.element.controls = { navigation: true, scale: true, attribution: false };
      await waitUntil(() => requests.length === 2);
      await h.element.updateComplete;
      expect(requests[1]!.kind).to.equal('scale');
      expect(outlines(h.root)).to.deep.equal(['scale']);
      requests[1]!.resolve(FakeMapControl);
      await h.element.whenControlsReady(); await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal([]);
      expect((h.element.map as unknown as ControlMapEngine).controls.size).to.equal(2);
    } finally { for (const request of requests) request.resolve(FakeMapControl); }
  });
  it('drops pending outlines on disconnect so a stale completion cannot clear the next connection', async () => {
    await loadMapControlRuntime();
    const h = await mount(element => { element.controls = { navigation: true, attribution: false }; });
    const requests = holdControls(h.element);
    try {
      await focusByKeyboard(part(h.root, 'initialization-activate'));
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => requests.length === 1 && h.constructions() === 1);
      h.element.remove();
      h.wrapper.append(h.element); await h.element.updateComplete;
      await waitUntil(() => h.root.querySelector('[part="initialization-activate"]') !== null);
      expect(outlines(h.root)).to.deep.equal(['navigation']);
      await focusByKeyboard(part(h.root, 'initialization-activate'));
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => requests.length === 2 && h.constructions() === 2);
      requests[0]!.resolve(FakeMapControl);
      await new Promise<void>(resolve => setTimeout(resolve, 0)); await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal(['navigation']);
      expect((h.element.map as unknown as ControlMapEngine).controls.size).to.equal(0);
      requests[1]!.resolve(FakeMapControl);
      await h.element.whenControlsReady(); await h.element.updateComplete;
      expect(outlines(h.root)).to.deep.equal([]);
      expect((h.element.map as unknown as ControlMapEngine).controls.size).to.equal(1);
    } finally { for (const request of requests) request.resolve(FakeMapControl); }
  });
  it('allows hiding the localized visible prompt while preserving its name and keyboard or pointer activation', async () => {
    for (const activation of ['Enter', 'Space', 'pointer']) {
      const h = await mount(element => { element.strings = { mapActivate: 'Start interactive map' }; });
      const style = document.createElement('style');
      style.textContent = 'lr-map::part(initialization-activate-label) { display:none } lr-map::part(initialization-skeleton) { opacity:0.4 }';
      h.wrapper.prepend(style);
      const label = part(h.root, 'initialization-activate-label'), button = part<HTMLButtonElement>(h.root, 'initialization-activate');
      expect(getComputedStyle(label).display).to.equal('none');
      expect(getComputedStyle(part(h.root, 'initialization-skeleton')).opacity).to.equal('0.4');
      expect(button.getAttribute('aria-label')).to.equal('Start interactive map');
      expect(label.textContent).to.equal('Start interactive map');
      if (activation === 'pointer') {
        const rect = button.getBoundingClientRect();
        await sendMouse({ type: 'click', position: [Math.round(rect.left + 8), Math.round(rect.top + 8)] });
      } else { await focusByKeyboard(button); await sendKeys({ press: activation }); }
      await waitUntil(() => h.constructions() === 1);
      h.element.remove(); style.remove();
    }
  });
});
