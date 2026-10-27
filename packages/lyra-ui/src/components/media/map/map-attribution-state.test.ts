import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine, FakeAttributionControl, FakeMapControl } from '../../../../test/map-control-engine.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE, type LyraMapControls } from './map.js';
void LyraMap;

/** Peer-shaped compact disclosure: the summary flips compact-show, then details toggles open. */
class NativeAttribution extends FakeAttributionControl {
  static readonly created: NativeAttribution[] = [];
  readonly root = document.createElement('details');
  constructor(options?: Record<string, unknown>) { super(options); NativeAttribution.created.push(this); }
  onAdd(): HTMLElement {
    const compact = this.options?.['compact'] !== false;
    this.root.className = `maplibregl-ctrl maplibregl-ctrl-attrib${compact ? ' maplibregl-compact maplibregl-compact-show' : ''}`;
    this.root.open = true;
    const summary = document.createElement('summary'); summary.className = 'maplibregl-ctrl-attrib-button';
    const inner = document.createElement('div'); inner.className = 'maplibregl-ctrl-attrib-inner'; inner.textContent = 'Survey contributors';
    this.root.replaceChildren(summary, inner);
    return this.root;
  }
  activate(): void {
    if (!this.root.classList.contains('maplibregl-compact')) return;
    const show = this.root.classList.contains('maplibregl-compact-show');
    this.root.toggleAttribute('open', show); this.root.classList.toggle('maplibregl-compact-show', !show);
    this.root.open = !this.root.open;
  }
  /** The peer's drag minimization removes compact-show while details stays open. */
  minimize(): void { this.root.classList.remove('maplibregl-compact-show'); }
}
class ChromeMap extends ControlMapEngine {
  static override initialReady = true;
  constructor(options: Record<string, unknown>) {
    super(options);
    const chrome = document.createElement('div'); chrome.className = 'maplibregl-control-container';
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      const node = document.createElement('div'); node.className = `maplibregl-ctrl-${corner}`; chrome.append(node);
    }
    (options['container'] as HTMLElement).append(this.canvas, chrome);
  }
  override addControl(control: FakeMapControl, position?: string): void {
    super.addControl(control);
    const root = (control as Partial<NativeAttribution>).onAdd?.();
    const corner = (this.options['container'] as HTMLElement).querySelector(`.maplibregl-ctrl-${position ?? 'bottom-right'}`)!;
    if (root) corner.append(root);
  }
  override removeControl(control: FakeMapControl): void { super.removeControl(control); (control as Partial<NativeAttribution>).root?.remove(); }
}
const originalContext = HTMLCanvasElement.prototype.getContext;
const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
async function mutations(): Promise<void> { await new Promise<void>(resolve => setTimeout(resolve, 0)); }
async function mount(controls?: LyraMapControls) {
  const wrapper = await fixture<HTMLElement>(html`<section style="inline-size:390px"></section>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'inline-size:100%;block-size:300px';
  element.engine = 'maplibre'; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  if (controls !== undefined) element.controls = controls;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({
    Map: ChromeMap, AttributionControl: NativeAttribution, NavigationControl: FakeMapControl,
  });
  const events: { expanded: boolean; bubbles: boolean; composed: boolean; cancelable: boolean }[] = [];
  wrapper.addEventListener('lr-map-attribution-toggle', event => {
    events.push({ ...(event as CustomEvent<{ expanded: boolean }>).detail, bubbles: event.bubbles, composed: event.composed, cancelable: event.cancelable });
  });
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined);
  await element.whenControlsReady(); await mutations();
  const expanded = () => events.map(event => event.expanded);
  return { element, wrapper, events, expanded, latest: () => NativeAttribution.created.at(-1)! };
}

describe('lr-map owned attribution disclosure state', () => {
  beforeEach(() => {
    NativeAttribution.created.length = 0;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
    } as typeof originalContext;
  });
  afterEach(() => {
    fixtureCleanup(); HTMLCanvasElement.prototype.getContext = originalContext;
    if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });

  it('reports the default control once per settled transition, coalescing synchronous native mutations', async () => {
    const h = await mount();
    const control = h.latest();
    expect(control.root.open).to.equal(true);
    expect(h.events).to.deep.equal([]);
    control.activate(); await mutations();
    expect(h.events).to.deep.equal([{ expanded: false, bubbles: true, composed: true, cancelable: false }]);
    control.activate(); control.activate(); await mutations();
    control.root.classList.remove('maplibregl-compact-show'); control.root.open = false; await mutations();
    expect(h.expanded()).to.deep.equal([false]);
    control.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([false, true]);
  });
  it('follows the rendered disclosure when native drag minimization leaves details open', async () => {
    const h = await mount({ attribution: { compact: true } });
    const control = h.latest();
    control.minimize(); await mutations();
    expect(control.root.open).to.equal(true);
    expect(h.expanded()).to.deep.equal([false]);
    expect(control.root.part.contains('attribution-expanded')).to.equal(false);
    control.activate(); await mutations();
    expect(control.root.open).to.equal(true);
    expect(h.expanded()).to.deep.equal([false, true]);
    expect(control.root.part.contains('attribution-expanded')).to.equal(true);
  });
  it('applies the initial seed silently and leaves the next native activation intact', async () => {
    const h = await mount({ attribution: { compact: true, initialExpanded: false } });
    const control = h.latest();
    expect([control.root.open, control.root.classList.contains('maplibregl-compact-show')]).to.deep.equal([false, false]);
    expect(control.root.part.contains('attribution-expanded')).to.equal(false);
    expect(h.events).to.deep.equal([]);
    control.activate(); await mutations();
    expect([control.root.open, control.root.classList.contains('maplibregl-compact-show')]).to.deep.equal([true, true]);
    control.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([true, false]);
    expect(control.root.textContent).to.include('Survey contributors');
  });
  it('never hides a noncompact credit surface with the initial seed', async () => {
    const h = await mount({ attribution: { compact: false, initialExpanded: false } });
    expect(h.latest().root.open).to.equal(true);
    expect(h.latest().root.part.contains('attribution-expanded')).to.equal(true);
    expect(h.events).to.deep.equal([]);
  });
  it('keeps the user-selected state on position-only changes and baselines a replacement silently', async () => {
    const h = await mount({ attribution: { compact: true, initialExpanded: false } });
    const first = h.latest();
    first.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([true]);
    h.element.controls = { attribution: { compact: true, initialExpanded: false, position: 'top-left' } };
    await h.element.whenControlsReady(); await mutations();
    expect(h.latest() === first).to.equal(true);
    expect(first.root.closest('.maplibregl-ctrl-top-left') !== null).to.equal(true);
    expect(first.root.open).to.equal(true);
    h.element.controls = { attribution: { compact: true, initialExpanded: true, position: 'top-left' } };
    await h.element.whenControlsReady(); await mutations();
    const second = h.latest();
    expect(second === first).to.equal(false);
    expect(second.root.open).to.equal(true);
    first.activate(); first.activate(); first.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([true]);
    second.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([true, false]);
  });
  it('reapplies the configured seed on reconnect without reporting the retired root', async () => {
    const h = await mount({ attribution: { compact: true, initialExpanded: false } });
    const first = h.latest();
    first.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([true]);
    h.element.remove(); first.activate(); await mutations();
    h.wrapper.append(h.element);
    await waitUntil(() => NativeAttribution.created.length === 2 && h.latest().root.isConnected);
    await h.element.whenControlsReady(); await mutations();
    const second = h.latest();
    expect([second.root.open, second.root.classList.contains('maplibregl-compact-show')]).to.deep.equal([false, false]);
    expect(h.expanded()).to.deep.equal([true]);
    second.activate(); await mutations();
    expect(h.expanded()).to.deep.equal([true, true]);
  });
  it('ignores imperatively added attribution controls and keeps malformed seeds on the default credits', async () => {
    const h = await mount({ attribution: { compact: true } });
    const extra = new NativeAttribution({ compact: true });
    (h.element.map as unknown as ChromeMap).addControl(extra, 'top-left');
    await mutations();
    extra.activate(); await mutations();
    expect(h.events).to.deep.equal([]);
    h.element.controls = { attribution: { initialExpanded: 'false' } } as unknown as LyraMapControls;
    await h.element.whenControlsReady().catch(() => undefined); await h.element.updateComplete; await mutations();
    expect(h.element.shadowRoot!.querySelector('[part~="configuration-error"]')?.textContent).to.equal('A map control could not be loaded');
    const fallback = h.latest();
    expect(fallback.options).to.deep.equal({});
    expect(fallback.root.open).to.equal(true);
    expect(h.events).to.deep.equal([]);
  });
});
