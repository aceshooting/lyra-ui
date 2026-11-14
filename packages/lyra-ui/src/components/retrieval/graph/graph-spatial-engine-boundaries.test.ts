import { expect, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { GraphSpatialController } from './graph-spatial-controller.js';
import { LyraGraph } from './graph.js';
import type { LyraGraphCamera, LyraGraphPosition } from './graph-model.js';
void LyraGraph;

const camera = (): LyraGraphCamera => ({ yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } });
type Failure = 'data' | 'style' | 'state' | 'resize' | 'appearance' | undefined;
function setup() {
  let callbacks!: Engine3dHost, canvas: HTMLCanvasElement | undefined;
  let failure: Failure, disposed = 0, loaded = false;
  const cameras: LyraGraphCamera[] = [], fits: (number | undefined)[] = [], sizes: [number, number][] = [];
  const positions = new Map<number, LyraGraphPosition>([[0, { x: -30, y: 0, z: 0 }], [1, { x: 30, y: 0, z: 0 }]]);
  const screens = new Map<number, { x: number; y: number }>([[0, { x: 60, y: 80 }], [1, { x: 180, y: 80 }]]);
  const states: { readonly focus: number; readonly hover: number }[] = [];
  const fail = (method: Failure) => { if (failure === method) throw new Error('Renderer diagnostic must stay private'); };
  const engine: Engine3dInstance & { setAppearance(value: unknown): void } = {
    contract: 1,
    async mount(container, host) { callbacks = host; canvas = container.ownerDocument.createElement('canvas'); container.append(canvas); },
    setData() { fail('data'); loaded = true; },
    setStyle() { fail('style'); }, setState(value) { fail('state'); states.push(value); },
    setAppearance() { fail('appearance'); }, resize(width, height) { fail('resize'); sizes.push([width, height]); },
    setCamera(value) { cameras.push(value as LyraGraphCamera); },
    fit(padding) { fits.push(padding); return { ...camera(), distance: 900 }; },
    positionOf(row) { return positions.get(row) ?? null; }, project(row) { return screens.get(row) ?? null; },
    pick() { return 2; }, dispose() { disposed++; canvas?.remove(); },
  };
  class InjectedSpatial extends GraphSpatialController {
    constructor(...args: ConstructorParameters<typeof GraphSpatialController>) {
      super(args[0], { ...args[1], engineServices: { available: () => true, create: async () => engine } });
    }
  }
  const graph = document.createElement('lr-graph') as LyraGraph;
  graph.style.cssText = 'display:block;inline-size:360px;block-size:280px'; graph.width = 360; graph.height = 280;
  graph.view = '3d'; graph.engine = 'webgl'; graph.camera = camera();
  graph.nodes = [{ id: 'a', label: 'Alpha', position: positions.get(0)! }, { id: 'b', label: 'Beta', position: positions.get(1)! }];
  graph.edges = [{ id: 'e', source: 'a', target: 'b' }];
  (graph as unknown as { loadSpatialController(): Promise<{ GraphSpatialController: typeof GraphSpatialController }> }).loadSpatialController = async () => ({ GraphSpatialController: InjectedSpatial });
  return { graph, engine, positions, screens, cameras, fits, states, sizes, callbacks: () => callbacks,
    loaded: () => loaded, disposed: () => disposed, fail: (value: Failure) => { failure = value; } };
}
async function settle(graph: LyraGraph): Promise<void> { await graph.updateComplete; await nextFrame(); await nextFrame(); }
async function mount(value: ReturnType<typeof setup>): Promise<void> {
  await fixture(value.graph);
  await waitUntil(() => value.loaded() && value.cameras.length > 0, 'optional renderer receives data and camera', { timeout: 3000 });
  await settle(value.graph);
}

describe('graph spatial engine boundaries', () => {
  for (const fence of ['hidden', 'inert', 'aria-hidden'] as const) {
    it(`defers an initially ${fence} renderer until its author fence opens without IntersectionObserver`, async () => {
      const saved = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
      Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
      const value = setup();
      let fallbacks = 0;
      value.graph.addEventListener('lr-engine-fallback', () => fallbacks++);
      value.graph.setAttribute(fence, fence === 'aria-hidden' ? 'true' : '');
      try {
        await fixture(value.graph);
        await waitUntil(() => value.graph.shadowRoot!.querySelector('[data-webgl-host]') !== null);
        await settle(value.graph);
        expect(value.loaded()).to.equal(false);
        expect(value.sizes).to.deep.equal([]);
        value.graph.removeAttribute(fence);
        await waitUntil(() => value.loaded() && value.cameras.length > 0, 'removing the authored fence starts the deferred renderer');
        await settle(value.graph);
        const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
        expect(value.sizes.at(-1)).to.deep.equal([surface.clientWidth, surface.clientHeight]);
        expect(surface.clientWidth).to.be.greaterThan(0);
        expect(surface.clientHeight).to.be.greaterThan(0);
        expect(await value.graph.focusNode('b')).to.equal(true);
        expect(value.graph.shadowRoot!.querySelectorAll('[data-webgl-host] > canvas:not([data-graph-labels])').length).to.equal(1);
        expect(value.disposed()).to.equal(0);
        expect(fallbacks).to.equal(0);
      } finally {
        value.graph.remove();
        if (saved) Object.defineProperty(window, 'IntersectionObserver', saved);
        else Reflect.deleteProperty(window, 'IntersectionObserver');
      }
    });
  }

  for (const capability of ['setGlow', 'setNodeMeshes'] as const) {
    it(`keeps the ordinary scene usable when the optional ${capability} capability getter throws`, async () => {
      const value = setup();
      Object.defineProperty(value.engine, capability, { get(): never { throw new Error('Private capability failure'); } });
      value.graph.strings = { graphGlowUnavailable: 'Glow is unavailable', graphCustomNodesUnavailable: 'Custom nodes are unavailable' };
      if (capability === 'setGlow') value.graph.glow = true; else value.graph.nodeRenderer = () => null;
      await mount(value);
      const text = capability === 'setGlow' ? 'Glow is unavailable' : 'Custom nodes are unavailable';
      await waitUntil(() => value.graph.shadowRoot!.textContent!.includes(text));
      expect(value.disposed()).to.equal(0);
      expect(await value.graph.focusNode('b')).to.equal(true);
      expect(value.graph.shadowRoot!.textContent).not.to.include('Private capability failure');
    });
  }

  for (const retirement of ['disable', 'view', 'disconnect'] as const) {
    it(`does not enable glow when capability inspection causes ${retirement} and recovers afterward`, async () => {
      const value = setup();
      await mount(value);
      const parent = value.graph.parentNode!;
      const enabled: boolean[] = [];
      let first = true, inspected = false;
      Object.defineProperty(value.engine, 'setGlow', { configurable: true, get() {
        inspected = true;
        if (first) {
          first = false;
          if (retirement === 'disable') value.graph.glow = false;
          else if (retirement === 'view') value.graph.view = 'list';
          else value.graph.remove();
        }
        return async (state: boolean) => { enabled.push(state); };
      } });
      value.graph.glow = true;
      await waitUntil(() => inspected, 'requested glow inspects its optional capability');
      await settle(value.graph);
      expect(enabled.includes(true)).to.equal(false);
      if (retirement === 'disconnect') parent.appendChild(value.graph);
      if (retirement === 'view') value.graph.view = '3d';
      value.graph.glow = true;
      await waitUntil(() => enabled.includes(true), 'the current request can enable glow after recovery');
      expect(await value.graph.focusNode('b')).to.equal(true);
      expect(value.graph.shadowRoot!.querySelectorAll('[data-webgl-host] > canvas:not([data-graph-labels])').length).to.equal(1);
    });
  }

  for (const asynchronous of [false, true]) {
    it(`retires a renderer whose glow update ${asynchronous ? 'rejects' : 'throws'} and retains accessible navigation`, async () => {
      const value = setup();
      Object.defineProperty(value.engine, 'setGlow', { value: () => {
        if (asynchronous) return Promise.reject(new Error('Private glow failure'));
        throw new Error('Private glow failure');
      } });
      const reasons: string[] = [];
      value.graph.addEventListener('lr-engine-fallback', event => { reasons.push(event.detail.reason); });
      await mount(value); value.graph.glow = true;
      await waitUntil(() => value.disposed() === 1 && reasons.length === 1);
      await settle(value.graph);
      expect(reasons).to.deep.equal(['error']);
      expect(await value.graph.focusNode('a')).to.equal(true);
      expect(value.graph.shadowRoot!.textContent).not.to.include('Private glow failure');
      expect(value.graph.shadowRoot!.querySelectorAll('canvas[part="spatial-canvas"]').length).to.equal(1);
    });
  }

  for (const completion of ['resolve', 'reject'] as const) {
    it(`ignores a pending glow ${completion} after the graph disconnects`, async () => {
      const value = setup(); let finish!: () => void, started = false;
      Object.defineProperty(value.engine, 'setGlow', { value: () => {
        started = true;
        return new Promise<void>((resolve, reject) => { finish = completion === 'resolve' ? resolve : () => reject(new Error('Obsolete glow failure')); });
      } });
      let fallbacks = 0; value.graph.addEventListener('lr-engine-fallback', () => { fallbacks++; });
      await mount(value); value.graph.glow = true; await waitUntil(() => started);
      value.graph.remove(); expect(value.disposed()).to.equal(1);
      finish(); await nextFrame(); await nextFrame();
      expect(fallbacks).to.equal(0); expect(value.disposed()).to.equal(1);
    });
  }

  it('retires an engine when suspending its hidden surface fails and restores usable built-in rendering', async () => {
    const value = setup(); await mount(value);
    const reasons: string[] = [];
    value.graph.addEventListener('lr-engine-fallback', event => { reasons.push(event.detail.reason); });
    value.fail('resize'); value.graph.hidden = true;
    await waitUntil(() => value.disposed() === 1);
    value.graph.hidden = false; await settle(value.graph);
    await waitUntil(() => reasons.length === 1);
    expect(reasons).to.deep.equal(['error']);
    expect(await value.graph.focusNode('a')).to.equal(true);
  });

  for (const method of ['data', 'style', 'state', 'resize'] as const) it(`releases an engine whose ${method} update throws and exposes a usable fallback`, async () => {
    const value = setup(); value.fail(method);
    const fallbacks: { reason: string }[] = [];
    value.graph.addEventListener('lr-engine-fallback', event => fallbacks.push(event.detail));
    await fixture(value.graph);
    await waitUntil(() => value.disposed() === 1 && fallbacks.length === 1, 'renderer failure is retired and reported', { timeout: 3000 });
    await settle(value.graph);
    expect(fallbacks[0]!.reason).to.equal('error');
    expect(value.graph.shadowRoot!.textContent).not.to.include('Renderer diagnostic');
    expect(value.graph.shadowRoot!.querySelectorAll('canvas[part="spatial-canvas"]').length).to.equal(1);
    expect(await value.graph.focusNode('a')).to.equal(true);
    value.callbacks().pick(0, { ctrl: false, shift: false, double: false });
    expect(value.disposed()).to.equal(1);
  });

  it('falls back after an appearance update fails without losing live engine positions', async () => {
    const value = setup(); await mount(value);
    value.positions.set(0, { x: 91, y: 27, z: -4 }); value.positions.delete(1);
    value.fail('appearance'); value.graph.style.setProperty('--lr-graph-node-fill', '#ff0000');
    value.graph.requestUpdate();
    await waitUntil(() => value.disposed() === 1, 'appearance failure retires renderer', { timeout: 3000 });
    await settle(value.graph);
    expect(value.graph.getNodePosition3d('a')).to.deep.equal({ x: 91, y: 27, z: -4 });
    expect(value.graph.getNodePosition3d('b')).to.deep.equal({ x: 30, y: 0, z: 0 });
    expect(await value.graph.focusNode('missing')).to.equal(false);
  });

  it('maps local edge picks and rejects invalid indices without manufacturing node events', async () => {
    const value = setup(); const edges: unknown[] = []; let nodes = 0;
    value.graph.addEventListener('lr-edge-activate', event => edges.push(event.detail));
    value.graph.addEventListener('lr-node-activate', () => nodes++);
    await mount(value);
    for (const index of [null, -1, 0.5, 99]) value.callbacks().pick(index, { ctrl: false, shift: false, double: false });
    value.callbacks().pick(2, { ctrl: false, shift: false, double: false });
    expect(edges).to.deep.equal([{ sourceNodeId: 'a', targetNodeId: 'b', edgeId: 'e' }]); expect(nodes).to.equal(0);
    value.callbacks().hover(2); await settle(value.graph); expect(value.states.at(-1)!.hover).to.equal(2);
    value.callbacks().hover(99); await settle(value.graph); expect(value.states.at(-1)!.hover).to.equal(-1);
    value.graph.focusNodeId = 'missing'; await settle(value.graph); expect(value.states.at(-1)!.focus).to.equal(-1);
  });

  it('rejects picks outside the typed column scene', async () => {
    const value = setup(); value.graph.graphColumns = { ids: ['column'], source: new Uint32Array(), target: new Uint32Array() };
    let actions = 0; value.graph.addEventListener('lr-node-activate', () => actions++); value.graph.addEventListener('lr-edge-activate', () => actions++);
    await mount(value);
    value.callbacks().pick(1, { ctrl: false, shift: false, double: false });
    value.callbacks().hover(1); await settle(value.graph);
    expect(actions).to.equal(0); expect(value.states.at(-1)!.hover).to.equal(-1);
  });

  it('forwards fit padding and preserves its distance for a subsequent focus without zoom', async () => {
    const value = setup(); await mount(value);
    value.graph.fit({ padding: 37 }); await settle(value.graph);
    expect(value.fits.at(-1)).to.equal(37);
    expect(value.cameras.at(-1)!.distance).to.equal(900);
    expect(await value.graph.focusNode('b')).to.equal(true); await settle(value.graph);
    expect(value.cameras.at(-1)!.distance).to.equal(900);
    expect(value.cameras.at(-1)!.target).to.deep.equal({ x: 30, y: 0, z: 0 });
    value.graph.camera = undefined; await settle(value.graph);
    expect(value.fits.at(-1)).to.equal(undefined);
    expect(value.cameras.at(-1)!.target).to.deep.equal({ x: 0, y: 0, z: 0 });
    value.graph.remove(); expect(await value.graph.focusNode('a')).to.equal(false);
  });

  it('omits labels with absent engine positions or projections while retaining valid labels', async () => {
    const value = setup(); value.graph.nodeLabels = 'always'; value.graph.withEdgeLabels = true;
    await mount(value);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
    expect(surface.clientWidth, 'allocated label surface width').to.be.greaterThan(0);
    expect(surface.clientHeight, 'allocated label surface height').to.be.greaterThan(0);
    // Toolbar wrapping reduces the drawing allocation independently of the host height.
    value.screens.set(0, { x: surface.clientWidth * 0.2, y: surface.clientHeight * 0.5 });
    value.screens.set(1, { x: surface.clientWidth * 0.6, y: surface.clientHeight * 0.5 });
    const context = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!.getContext('2d')!;
    const fillText = context.fillText, labels: string[] = [];
    context.fillText = function(text, x, y, maxWidth) {
      labels.push(text); if (maxWidth === undefined) fillText.call(this, text, x, y); else fillText.call(this, text, x, y, maxWidth);
    };
    try {
      value.graph.camera = { ...camera(), distance: 505 };
      await waitUntil(() => labels.includes('Alpha') && labels.includes('Beta'), 'both in-bounds labels paint before an engine capability is removed');
      labels.length = 0;
      value.positions.delete(1); value.graph.camera = { ...camera(), distance: 510 }; await settle(value.graph);
      await waitUntil(() => labels.includes('Alpha'), 'the node with a position and projection still paints');
      expect(labels).to.include('Alpha'); expect(labels).not.to.include('Beta');
      labels.length = 0; value.positions.set(1, { x: 30, y: 0, z: 0 }); value.screens.delete(0);
      value.graph.camera = { ...camera(), distance: 520 }; await settle(value.graph);
      await waitUntil(() => labels.includes('Beta'), 'the node with its restored position still paints');
      expect(labels).to.include('Beta'); expect(labels).not.to.include('Alpha');
      expect(value.graph.getNodeScreenPosition('a')).to.equal(undefined);
      expect(value.graph.getNodePosition3d('missing')).to.equal(undefined);
      expect(value.disposed()).to.equal(0);
    } finally { context.fillText = fillText; }
  });

  it('returns no spatial screen point in list mode and treats fitting an empty scene as a no-op', async () => {
    const graph = document.createElement('lr-graph') as LyraGraph; graph.view = 'list';
    await fixture(graph); await settle(graph);
    graph.fit(); expect(await graph.focusNode('missing')).to.equal(false);
    expect(graph.getNodeScreenPosition('missing')).to.equal(undefined);
    expect(graph.getNodePosition3d('missing')).to.equal(undefined);
    expect(graph.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length).to.equal(0);
  });

  for (const shape of ['straight', 'curved', 'loop', 'dangling'] as const) {
    it(`paints a ${shape} edge label with its dimming while preserving the node label opacity`, async () => {
      const value = setup(); value.graph.nodeLabels = 'always'; value.graph.withEdgeLabels = true;
      value.graph.edgeLabelMinZoom = 0.001;
      value.graph.edges = [{ id: 'edge', source: 'a', target: shape === 'loop' ? 'a' : shape === 'dangling' ? 'missing' : 'b',
        label: 'Connection', ...(shape === 'curved' ? { curvature: 0.5 } : {}) }];
      value.graph.dimmedEdgeIds = ['edge']; value.graph.dimmedNodeIds = ['b'];
      value.graph.style.setProperty('--lr-graph-dimmed-opacity', '0.25');
      await mount(value);
      const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
      value.screens.set(0, { x: surface.clientWidth * 0.2, y: surface.clientHeight * 0.5 });
      value.screens.set(1, { x: surface.clientWidth * 0.6, y: surface.clientHeight * 0.5 });
      const context = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!.getContext('2d')!;
      const fill = context.fillText;
      const labels: { text: string; x: number; y: number; alpha: number }[] = [];
      context.fillText = function(text, x, y, maxWidth) {
        labels.push({ text, x, y, alpha: this.globalAlpha });
        if (maxWidth === undefined) fill.call(this, text, x, y); else fill.call(this, text, x, y, maxWidth);
      };
      try {
        value.graph.camera = { ...camera(), distance: 510 };
        await waitUntil(() => labels.some(label => label.text === 'Connection') && labels.some(label => label.text === 'Beta'));
        const edge = labels.find(label => label.text === 'Connection')!;
        expect(Number.isFinite(edge.x) && Number.isFinite(edge.y)).to.equal(true);
        expect(edge.alpha).to.be.closeTo(0.25, 0.001);
        expect(labels.find(label => label.text === 'Alpha')!.alpha).to.equal(1);
        expect(labels.find(label => label.text === 'Beta')!.alpha).to.be.closeTo(0.25, 0.001);
        expect(context.globalAlpha).to.equal(1);
        expect(value.disposed()).to.equal(0);
      } finally { context.fillText = fill; }
    });
  }

  it('withholds edge labels for invisible edges and behind-camera endpoints while continuing to paint the scene', async () => {
    const value = setup(); value.graph.nodeLabels = 'always'; value.graph.withEdgeLabels = true;
    value.graph.edgeLabelMinZoom = 0.001;
    value.graph.edges = [
      { id: 'visible', source: 'a', target: 'b', label: 'Visible' },
      { id: 'transparent', source: 'a', target: 'b', label: 'Transparent', color: '#0000' },
      { id: 'unlabeled', source: 'a', target: 'b' },
    ];
    await mount(value);
    const context = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!.getContext('2d')!;
    const fill = context.fillText, transform = context.setTransform;
    const labels: string[] = []; let frames = 0;
    context.fillText = function(text, x, y, maxWidth) {
      labels.push(text); if (maxWidth === undefined) fill.call(this, text, x, y); else fill.call(this, text, x, y, maxWidth);
    };
    context.setTransform = function(...args: unknown[]) { frames++; Reflect.apply(transform, this, args); };
    try {
      value.graph.camera = { ...camera(), distance: 510 };
      await waitUntil(() => labels.includes('Visible'));
      expect(labels).not.to.include('Transparent');
      labels.length = 0; const before = frames;
      value.positions.set(0, { x: -30, y: 0, z: 10_000 });
      value.positions.set(1, { x: 30, y: 0, z: 10_000 });
      value.graph.camera = { ...camera(), distance: 520 };
      await waitUntil(() => frames > before);
      expect(labels).not.to.include('Visible'); expect(labels).not.to.include('Transparent');
      expect(value.disposed()).to.equal(0);
    } finally { context.fillText = fill; context.setTransform = transform; }
  });

  it('suspends and restores the native surface after visibility changes without IntersectionObserver', async () => {
    const saved = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    const value = setup();
    try {
      await mount(value);
      const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
      expect(value.sizes.at(-1)).to.deep.equal([surface.clientWidth, surface.clientHeight]);
      value.graph.hidden = true;
      await waitUntil(() => value.sizes.at(-1)?.[0] === 0 && value.sizes.at(-1)?.[1] === 0);
      value.graph.hidden = false;
      await waitUntil(() => (value.sizes.at(-1)?.[0] ?? 0) > 0);
      expect(value.sizes.at(-1)).to.deep.equal([surface.clientWidth, surface.clientHeight]);
      expect(await value.graph.focusNode('b')).to.equal(true);
      expect(value.disposed()).to.equal(0);
    } finally {
      value.graph.remove();
      if (saved) Object.defineProperty(window, 'IntersectionObserver', saved);
      else Reflect.deleteProperty(window, 'IntersectionObserver');
    }
  });

  it('ignores secondary pointers and sub-threshold movement without abandoning the active drag', async () => {
    const value = setup(); value.graph.engine = 'builtin'; await fixture(value.graph); await settle(value.graph);
    const surface = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('canvas[part="spatial-canvas"]')!;
    const changes: LyraGraphCamera[] = []; value.graph.addEventListener('lr-camera-change', event => changes.push(event.detail.camera));
    const pointer = (type: string, id: number, x: number, button = 0) => surface.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: 20, button }));
    pointer('pointerup', 1, 20);
    pointer('pointerdown', 2, 20, 2); pointer('pointermove', 2, 80);
    pointer('pointerdown', 1, 20); pointer('pointerdown', 2, 20);
    pointer('pointermove', 2, 80); pointer('pointerup', 2, 80);
    pointer('pointermove', 1, 22); await settle(value.graph);
    expect(changes.length).to.equal(0);
    pointer('pointermove', 1, 60); await settle(value.graph);
    expect(changes.length).to.equal(1); expect(changes[0]!.yaw).to.be.greaterThan(0);
    pointer('pointerup', 1, 60);
  });

  it('orbits vertically in both directions and leaves unrelated keys to the page', async () => {
    const value = setup(); await mount(value);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
    await focusByKeyboard(surface);
    const key = (name: string) => { const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }); surface.dispatchEvent(event); return event.defaultPrevented; };
    expect(key('ArrowDown')).to.equal(true); await settle(value.graph);
    expect(value.cameras.at(-1)!.pitch).to.be.lessThan(0);
    expect(key('ArrowUp')).to.equal(true); await settle(value.graph);
    expect(value.cameras.at(-1)!.pitch).to.be.closeTo(0, 1e-8);
    const before = value.cameras.length;
    expect(key('Tab')).to.equal(false); await settle(value.graph);
    expect(value.cameras.length).to.equal(before);
  });
});

for (const transition of ['reconnect', 'replace-surface'] as const) {
  it(`ignores a retired intersection observer after ${transition} while honoring current visibility`, async () => {
    const Original = window.IntersectionObserver;
    const observers: { observer: IntersectionObserver; target: Element; deliver(visible: boolean): void }[] = [];
    class RetainedIntersectionObserver extends Original {
      private readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options); this.callback = callback;
      }
      override observe(target: Element): void {
        super.observe(target);
        observers.push({ observer: this, target, deliver: visible => {
          const rect = target.getBoundingClientRect();
          this.callback([{ target, time: performance.now(), rootBounds: null, boundingClientRect: rect,
            intersectionRect: rect, intersectionRatio: visible ? 1 : 0, isIntersecting: visible }], this);
        } });
      }
    }
    window.IntersectionObserver = RetainedIntersectionObserver;
    const value = setup();
    try {
      await mount(value);
      const oldSurface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
      const retired = observers.find(entry => entry.target === oldSurface)!;
      expect(Boolean(retired)).to.equal(true);
      const oldCallbacks = value.callbacks();
      const priorSizes = value.sizes.length;
      if (transition === 'reconnect') {
        const parent = value.graph.parentNode!; value.graph.remove(); parent.appendChild(value.graph);
      } else {
        value.graph.view = 'list'; await settle(value.graph);
        value.graph.view = '3d';
      }
      await waitUntil(() => value.callbacks() !== oldCallbacks && value.sizes.length > priorSizes);
      await settle(value.graph);
      const currentSurface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
      const current = observers.filter(entry => entry.target === currentSurface).at(-1)!;
      expect(current.observer === retired.observer).to.equal(false);
      const before = value.sizes.length;
      retired.deliver(false);
      expect(value.sizes.length).to.equal(before);
      expect(value.sizes.at(-1)!.every(size => size > 0)).to.equal(true);
      current.deliver(false);
      expect(value.sizes.at(-1)).to.deep.equal([0, 0]);
      current.deliver(true);
      await waitUntil(() => value.sizes.at(-1)!.every(size => size > 0));
      expect(await value.graph.focusNode('a')).to.equal(true);
      expect(value.disposed()).to.equal(1);
    } finally {
      try { value.graph.remove(); for (const entry of observers) entry.observer.disconnect(); }
      finally { window.IntersectionObserver = Original; }
    }
  });
}

it('ignores queued resize work from a disconnected observer and retains the replacement observer', async () => {
  const Original = window.ResizeObserver;
  const observers: { target: Element; observer: ResizeObserver; replay(): void; count(): number }[] = [];
  class RetainedResizeObserver extends Original {
    private readonly replayRecords: () => void;
    private readonly countRecords: () => number;
    constructor(callback: ResizeObserverCallback) {
      let latest: ResizeObserverEntry[] = [];
      super((entries, observer) => { latest = entries; callback(entries, observer); });
      this.replayRecords = () => callback(latest, this);
      this.countRecords = () => latest.length;
    }
    override observe(target: Element, options?: ResizeObserverOptions): void {
      super.observe(target, options);
      observers.push({ target, observer: this, replay: this.replayRecords, count: this.countRecords });
    }
  }
  window.ResizeObserver = RetainedResizeObserver;
  const value = setup();
  try {
    await mount(value);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
    const retired = observers.find(entry => entry.target === surface)!;
    await waitUntil(() => retired.count() > 0);
    const oldCallbacks = value.callbacks();
    const parent = value.graph.parentNode!; value.graph.remove(); parent.appendChild(value.graph);
    await waitUntil(() => value.callbacks() !== oldCallbacks);
    await settle(value.graph);
    const current = observers.filter(entry => entry.target === surface).at(-1)!;
    expect(current.observer === retired.observer).to.equal(false);
    await waitUntil(() => current.count() > 0);
    const request = window.requestAnimationFrame;
    let scheduled = 0;
    window.requestAnimationFrame = callback => { scheduled++; return request.call(window, callback); };
    try {
      retired.replay();
      expect(scheduled).to.equal(0);
      current.replay();
      expect(scheduled).to.equal(1);
    } finally { window.requestAnimationFrame = request; }
    await settle(value.graph);
    expect(value.sizes.at(-1)!.every(size => size > 0)).to.equal(true);
    expect(value.disposed()).to.equal(1);
  } finally {
    try { value.graph.remove(); for (const entry of observers) entry.observer.disconnect(); }
    finally { window.ResizeObserver = Original; }
  }
});
