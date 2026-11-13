import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import type { Chart3dEngineData, LyraChart3dCamera } from './chart-3d-data.js';
import { Chart3dEngineController, chart3dEngineEnvironment, chart3dPointsLoader } from './chart-3d-engine.js';

interface Renderer {
  callbacks?: Engine3dHost;
  data: unknown[];
  styles: unknown[];
  steps: string[];
  disposed: number;
  hook?: (step: string) => void;
}
const data = (value = 0): Chart3dEngineData => ({ positions: Float32Array.of(value, 0, 0), mode: '3d', axes: [] });
const camera: LyraChart3dCamera = { yaw: 0, pitch: 0, distance: 2, target: { x: 0, y: 0, z: 0 } };

describe('3D renderer capability and ownership boundaries', () => {
  const available = chart3dEngineEnvironment.available;
  const visible = chart3dEngineEnvironment.visible;
  let intersection: PropertyDescriptor | undefined;
  let controller: Chart3dEngineController;
  let container: HTMLElement;
  let renderers: Renderer[];
  let notices: string[];

  beforeEach(async () => {
    intersection = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    chart3dEngineEnvironment.available = () => true;
    chart3dEngineEnvironment.visible = () => true;
    renderers = []; notices = [];
    const host = await fixture<HTMLElement>(html`<div style="color: rgb(12, 34, 56); inline-size: 360px; block-size: 180px;"></div>`);
    container = document.createElement('div'); host.append(container);
    controller = new Chart3dEngineController(host, { changed() {}, fallback(detail) { notices.push(detail.reason); }, pick() {}, camera() {} });
    chart3dPointsLoader.override(async () => ({ createEngine(): Engine3dInstance {
      const state: Renderer = { data: [], styles: [], steps: [], disposed: 0 }; renderers.push(state);
      const step = (name: string) => { state.steps.push(name); state.hook?.(name); };
      return {
        contract: 1,
        async mount(_target, callbacks) { state.callbacks = callbacks; step('mount'); },
        setData(value) { state.data.push(value); step('data'); },
        setStyle(value) { state.styles.push(value); step('style'); },
        setCamera() { step('camera'); },
        setState() { step('state'); },
        resize() { step('resize'); },
        dispose() { state.disposed++; step('dispose'); },
      };
    } }));
  });

  afterEach(() => {
    try { for (const renderer of renderers) renderer.hook = undefined; controller.disconnect(); }
    finally {
      chart3dPointsLoader.override(undefined);
      chart3dEngineEnvironment.available = available; chart3dEngineEnvironment.visible = visible;
      if (intersection) Object.defineProperty(window, 'IntersectionObserver', intersection);
      else Reflect.deleteProperty(window, 'IntersectionObserver');
    }
  });

  async function start(value = data()): Promise<Renderer> {
    controller.update(value, container, 'webgl', -1, -1, camera);
    await waitUntil(() => controller.ready);
    return renderers.at(-1)!;
  }

  for (const operation of ['update', 'disconnect'] as const) {
    it(`keeps the successor requested by peer disposal during ${operation}`, async () => {
      const previous = await start();
      const successor = data(9);
      previous.hook = step => {
        if (step !== 'dispose') return;
        previous.hook = undefined;
        controller.update(successor, container, 'webgl', 0, 0, camera);
      };
      if (operation === 'update') controller.update(data(3), container, 'builtin', -1, -1);
      else controller.disconnect();
      await waitUntil(() => renderers.length === 2 && controller.ready);
      expect(previous.disposed).to.equal(1);
      expect(renderers[1]!.data.length).to.equal(1);
      expect(renderers[1]!.data[0] === successor).to.equal(true);
      expect(controller.selection.renderer).to.equal('webgl');
      expect(notices).to.deep.equal([]);
    });
  }

  it('ignores a queued intersection from a retired admission and waits for the replacement target', async () => {
    if (!intersection?.value) throw new Error('The native observer is required for this fixture.');
    const Native = intersection.value as typeof IntersectionObserver;
    const deliveries: (() => void)[] = [];
    class QueuedIntersectionObserver extends Native {
      private readonly deliver: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { super(callback, options); this.deliver = callback; }
      override observe(target: Element): void {
        const rect = target.getBoundingClientRect();
        deliveries.push(() => this.deliver([{ target, time: performance.now(), rootBounds: null, boundingClientRect: rect,
          intersectionRect: rect, intersectionRatio: 1, isIntersecting: true }], this));
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: QueuedIntersectionObserver });
    controller.update(data(), container, 'webgl', -1, -1);
    const successor = data(4);
    controller.update(successor, container, 'webgl', -1, -1);
    expect(deliveries.length).to.equal(2);
    deliveries[0]!();
    expect(controller.loading).to.equal(false); expect(renderers.length).to.equal(0);
    deliveries[1]!();
    await waitUntil(() => controller.ready);
    expect(renderers.length).to.equal(1); expect(renderers[0]!.data[0] === successor).to.equal(true);
    deliveries[0]!();
    expect(controller.ready).to.equal(true); expect(notices).to.deep.equal([]);
  });

  for (const interruption of ['style', 'camera', 'context-loss'] as const) {
    it(`does not publish readiness when restoration is interrupted by ${interruption}`, async () => {
      const peer = await start();
      peer.callbacks!.lost!('context-lost');
      expect(controller.ready).to.equal(false);
      peer.steps = [];
      peer.hook = step => {
        if (step !== (interruption === 'style' ? 'style' : 'camera')) return;
        peer.hook = undefined;
        if (interruption === 'context-loss') peer.callbacks!.lost!('context-lost');
        else controller.disconnect();
      };
      peer.callbacks!.restored!();
      expect(controller.ready).to.equal(false);
      expect(peer.steps).to.deep.equal(interruption === 'style' ? ['style', 'dispose'] :
        interruption === 'camera' ? ['style', 'camera', 'dispose'] : ['style', 'camera']);
      expect(peer.disposed).to.equal(interruption === 'context-loss' ? 0 : 1);
      if (interruption === 'context-loss') {
        peer.callbacks!.restored!();
        expect(controller.ready).to.equal(true); expect(controller.notice).to.equal(null);
      } else {
        await start(data(2));
        expect(renderers.length).to.equal(2);
        peer.callbacks!.restored!();
        expect(controller.ready).to.equal(true);
      }
    });
  }

  it('passes resolved host colors and sizes to the peer without a style probe or canvas conversion', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null });
    try {
      const peer = await start();
      const style = peer.styles[0] as { foreground: string; palette: string[]; pointSize: number; fontSize: number };
      expect(style.foreground).to.equal('rgb(12, 34, 56)');
      expect(style.palette).to.deep.equal(Array<string>(8).fill('rgb(12, 34, 56)'));
      expect(style.pointSize).to.equal(360);
      expect(Number.isFinite(style.fontSize)).to.equal(true);
      expect(controller.ready).to.equal(true); expect(notices).to.deep.equal([]);
    } finally { Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', descriptor); }
  });
});
