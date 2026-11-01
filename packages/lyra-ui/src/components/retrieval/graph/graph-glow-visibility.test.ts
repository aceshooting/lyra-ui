import { expect, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import type { Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { GraphSpatialController } from './graph-spatial-controller.js';
import { LyraGraph } from './graph.js';
import type { LyraGraphNodeMesh } from './graph-node-renderer.js';
void LyraGraph;

describe('graph glow visibility lifecycle', () => {
  it('suspends offscreen glow and mesh callbacks, then restores cached geometry without callbacks', async () => {
    const original = window.IntersectionObserver;
    const observers: { observer: IntersectionObserver; callback: IntersectionObserverCallback; target?: Element }[] = [];
    class Intersection implements IntersectionObserver {
      readonly root = null; readonly rootMargin = '0px'; readonly scrollMargin = '0px'; readonly thresholds = [0];
      private readonly entry: typeof observers[number];
      constructor(callback: IntersectionObserverCallback) { this.entry = { observer: this, callback }; observers.push(this.entry); }
      observe(target: Element) { this.entry.target = target; queueMicrotask(() => this.entry.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this)); }
      unobserve() {} disconnect() {} takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    window.IntersectionObserver = Intersection;
    const glows: boolean[] = []; let calls = 0, data = 0;
    const mesh = (): LyraGraphNodeMesh => ({ positions: new Float32Array([0,0,0, .5,0,0, 0,.5,0]), normals: new Float32Array([0,0,1]) });
    const engine: Engine3dInstance & { setAppearance(value: unknown): void; setNodeMeshes(value: readonly (LyraGraphNodeMesh | null)[] | undefined): void; setGlow(value: boolean): Promise<void> } = {
      contract: 1, async mount() {}, setData() { data++; }, setAppearance() {}, setNodeMeshes() {}, async setGlow(value) { glows.push(value); }, setStyle() {}, resize() {}, setCamera() {}, dispose() {},
    };
    class Spatial extends GraphSpatialController { constructor(...args: ConstructorParameters<typeof GraphSpatialController>) { super(args[0], { ...args[1], engineServices: { available: () => true, create: async () => engine } }); } }
    const graph = document.createElement('lr-graph') as LyraGraph;
    graph.style.cssText = 'display:block;inline-size:360px;block-size:280px'; graph.width = 360; graph.height = 280;
    graph.nodes = [{ id: 'a' }, { id: 'b' }]; graph.engine = 'webgl'; graph.view = '3d'; graph.glow = true;
    graph.nodeRenderer = () => { calls++; return mesh(); };
    (graph as unknown as { loadSpatialController(): Promise<{ GraphSpatialController: typeof GraphSpatialController }> }).loadSpatialController = async () => ({ GraphSpatialController: Spatial });
    try {
      await fixture(graph); await waitUntil(() => data > 0 && calls === 2 && glows.at(-1) === true);
      const observed = observers.find(entry => entry.target?.hasAttribute('data-webgl-host'))!;
      const intersect = (visible: boolean) => observed.callback([{ target: observed.target!, isIntersecting: visible } as IntersectionObserverEntry], observed.observer);
      intersect(false); await waitUntil(() => glows.at(-1) === false);
      graph.selectedNodeIds = ['a']; await graph.updateComplete; await nextFrame(); expect(calls).to.equal(2);
      intersect(true); await waitUntil(() => glows.at(-1) === true); expect(calls).to.equal(2);
      graph.hidden = true; await graph.updateComplete;
      await waitUntil(() => glows.at(-1) === false);
      graph.nodeRenderer = () => { calls++; return mesh(); }; await graph.updateComplete; await nextFrame(); expect(calls).to.equal(2);
      graph.hidden = false; await graph.updateComplete; intersect(true);
      await waitUntil(() => glows.at(-1) === true && calls === 4);
      graph.inert = true; await graph.updateComplete; await waitUntil(() => glows.at(-1) === false);
      graph.inert = false; await graph.updateComplete; intersect(true); await waitUntil(() => glows.at(-1) === true); expect(calls).to.equal(4);
      const surface = observed.target as HTMLElement;
      surface.style.minInlineSize = '0px'; surface.style.inlineSize = '0px';
      expect(surface.clientWidth).to.equal(0);
      await waitUntil(() => glows.at(-1) === false);
      surface.style.removeProperty('inline-size'); surface.style.removeProperty('min-inline-size'); intersect(true); await waitUntil(() => glows.at(-1) === true); expect(calls).to.equal(4);
    } finally { graph.remove(); window.IntersectionObserver = original; }
  });
});
