import { expect, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { sceneMarker, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { renderEnvironment, renderTurns } from '../../../../test/map-scene-render-component-fixtures.js';
import type { RenderBridgeHost } from '../../../../test/map-scene-render-component-fixtures.js';
import type { LyraMap } from './map.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';
import { invalidateLyraTheme } from '../../../internal/theme-watcher.js';

interface SceneStatus { readonly state: string; readonly code?: string }
function statusLog(element: LyraMap): SceneStatus[] {
  const states: SceneStatus[] = [];
  element.addEventListener('lr-map-scene-state', event => {
    if (event instanceof CustomEvent) states.push(event.detail as SceneStatus);
  });
  return states;
}
function report(host: RenderBridgeHost, state: 'installed' | 'pending' | 'unavailable', revision?: number) {
  const input = host.captureRenderInput();
  return { state, acceptedSceneRevision: revision ?? input.acceptedSceneRevision,
    presentationRevision: input.presentationRevision, allocationRevision: input.allocation?.revision,
    markerInstallationRevision: 1 };
}

describe('lr-map scene renderer recovery', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('ignores stale and future reports from the active bridge after a newer scene is installed', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker('first')] }; });
    const bridge = await env.bridge(peer), oldRevision = bridge.host.captureRenderInput().acceptedSceneRevision;
    const states = statusLog(element);
    element.scene = { objects: [sceneMarker('second')] };
    await element.updateComplete; await renderTurns();
    const current = bridge.host.captureRenderInput();
    bridge.host.onState(report(bridge.host, 'installed'));
    await waitUntil(() => states.at(-1)?.state === 'ready', 'current scene installed');
    for (const revision of [oldRevision, current.acceptedSceneRevision + 1]) {
      for (const state of ['pending', 'installed', 'unavailable'] as const) {
        bridge.host.onState(report(bridge.host, state, revision));
        await renderTurns(); await element.updateComplete;
        expect(states.at(-1)?.state, `${state} report for revision ${revision}`).to.equal('ready');
        expect(Boolean(element.shadowRoot!.querySelector('[part="scene-status"]'))).to.equal(false);
      }
    }
    expect(bridge.host.captureRenderInput().markers.map(row => row.id)).to.deep.equal(['second']);
  });

  it('contains malformed and unreadable reports without erasing installed markers', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), states = statusLog(element);
    bridge.host.onState(report(bridge.host, 'installed'));
    await waitUntil(() => states.at(-1)?.state === 'ready', 'marker installed');
    const unreadable = new Proxy({}, { get() { throw new Error('Unreadable renderer report'); } });
    for (const value of [null, 7, {}, unreadable,
      { ...report(bridge.host, 'installed'), acceptedSceneRevision: -1 },
      { ...report(bridge.host, 'installed'), acceptedSceneRevision: 0.5 },
      { ...report(bridge.host, 'installed'), state: 'unknown' }]) {
      // Optional runtimes are an untyped boundary, including their status callbacks.
      bridge.host.onState(value as Parameters<RenderBridgeHost['onState']>[0]);
    }
    await renderTurns();
    expect(states.map(value => value.state)).to.deep.equal(['ready']);
    expect(bridge.disposed || peer.removed).to.equal(false);
  });

  for (const code of ['limit', 'context-lost', 'engine'] as const) {
    it(`recovers from a current ${code} report after a successful marker installation`, async () => {
      const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
      const bridge = await env.bridge(peer), states = statusLog(element);
      const failure = { ...report(bridge.host, 'unavailable'), code };
      bridge.host.onState(failure);
      await waitUntil(() => states.at(-1)?.state === 'unavailable', 'renderer failure reported');
      expect(states.at(-1)?.code).to.equal(code);
      bridge.host.onError('context-lost');
      bridge.host.onState(report(bridge.host, 'installed'));
      await waitUntil(() => states.at(-1)?.state === 'ready', 'installation clears context loss');
      bridge.host.onError('render');
      await renderTurns();
      expect(states.at(-1)?.state).to.equal('ready');
      expect(env.records.length).to.equal(1);
    });
  }

  it('disposes an incomplete bridge handle and retries only on new scene intent', async () => {
    let attempts = 0, disposals = 0;
    env.setImporter(async () => ({ createSceneBridge() {
      attempts++;
      return { dispose() { disposals++; throw new Error('Cleanup refused'); } };
    } }));
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    await waitUntil(() => disposals === 1, 'incomplete handle disposed');
    await renderTurns();
    expect(attempts).to.equal(1);
    expect(peer.removed).to.equal(false);
    element.scene = { objects: [sceneMarker('retry')] };
    await waitUntil(() => disposals === 2, 'replacement intent retries factory');
    expect(attempts).to.equal(2);
  });

  it('keeps line rendering and native teardown working when bridge lifecycle methods throw', async () => {
    let disposed = 0, invalidated = 0, visibility = 0;
    env.setImporter(async () => ({ createSceneBridge() {
      return {
        dispose() { disposed++; throw new Error('Dispose refused'); },
        invalidateStyle() { invalidated++; throw new Error('Style refused'); },
        setVisible() { visibility++; throw new Error('Visibility refused'); },
        requestFrame() {},
      };
    } }));
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker(), scenePath()] }; });
    await waitUntil(() => visibility > 0, 'bridge visibility attempted');
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Replacement' };
    await element.updateComplete; await element.whenStyleReady(); await renderTurns();
    expect(invalidated).to.equal(1);
    element.scene = { objects: [scenePath()] };
    await element.updateComplete; await renderTurns();
    expect(disposed).to.equal(1);
    expect([...peer.layers.keys()].some(id => id.startsWith('lr-scene-lines-'))).to.equal(true);
    expect(peer.removed).to.equal(false);
    element.remove();
    expect(peer.removed).to.equal(true);
    expect(disposed).to.equal(1);
  });

  it('converts modern CSS colors to sRGB and applies marker opacity once', async () => {
    const { peer } = await env.mount(element => {
      element.scene = { objects: [{ ...sceneMarker(), color: 'color(srgb 1 0 0.5 / 0.5)', opacity: 0.4 }] };
    });
    const bridge = await env.bridge(peer), rgba = bridge.host.captureRenderInput().markers[0]!.rgba;
    expect(rgba[0]).to.be.closeTo(1, 1 / 255);
    expect(rgba[1]).to.equal(0);
    expect(rgba[2]).to.be.closeTo(0.5, 2 / 255);
    expect(rgba[3]).to.be.closeTo(0.2, 1 / 255);
  });

  for (const failure of ['missing context', 'failed readback'] as const) {
    it(`recovers modern-color presentation after ${failure} without recreating the bridge`, async () => {
      const original = HTMLCanvasElement.prototype.getContext;
      let probes = 0;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        if (this.width === 1 && this.height === 1 && args[0] === '2d') {
          probes++;
          if (failure === 'missing context') return null;
          const context = Reflect.apply(original, this, args);
          if (!(context instanceof CanvasRenderingContext2D)) throw new Error('Expected 2D context');
          context.getImageData = () => { throw new Error('Color readback unavailable'); };
          return context;
        }
        return Reflect.apply(original, this, args);
      } as typeof original;
      try {
        const { element, peer } = await env.mount(element => {
          element.scene = { objects: [{ ...sceneMarker(), color: 'color(srgb 0 1 0)' }] };
        });
        const bridge = await env.bridge(peer);
        expect(probes).to.be.greaterThan(0);
        expect(bridge.host.captureRenderInput().markers.length).to.equal(0);
        expect(peer.removed).to.equal(false);
        HTMLCanvasElement.prototype.getContext = original;
        invalidateLyraTheme(element);
        await waitUntil(() => bridge.host.captureRenderInput().markers.length === 1, 'color presentation restored');
        expect(bridge.host.captureRenderInput().markers[0]!.rgba).to.deep.equal([0, 1, 0, 1]);
        expect(env.records.length).to.equal(1);
      } finally { HTMLCanvasElement.prototype.getContext = original; }
    });
  }

  it('keeps marker drawing suspended when document visibility cannot be observed', async () => {
    const { element, peer } = await env.mount();
    const original = document.addEventListener;
    let attempts = 0;
    document.addEventListener = function (this: Document, ...args: Parameters<typeof original>) {
      if (args[0] === 'visibilitychange') { attempts++; throw new Error('Visibility observation unavailable'); }
      Reflect.apply(original, this, args);
    } as typeof original;
    try {
      element.scene = { objects: [sceneMarker()] };
      const bridge = await env.bridge(peer);
      env.visible(peer, true); await renderTurns();
      expect(attempts).to.be.greaterThan(0);
      expect(bridge.host.captureRenderInput().markers.length).to.equal(1);
      expect(bridge.visibility).to.deep.equal([false]);
      expect(peer.removed).to.equal(false);
      element.remove(); expect(peer.removed).to.equal(true); expect(bridge.disposed).to.equal(true);
    } finally { document.addEventListener = original; }
  });

  it('keeps native map cleanup working when the active bridge refuses disposal', async () => {
    let disposals = 0;
    env.setImporter(async () => ({ createSceneBridge(...args: Parameters<ReturnType<typeof env.module>['createSceneBridge']>) {
      const bridge = env.module().createSceneBridge(...args);
      return { ...bridge, dispose() { disposals++; throw new Error('Bridge cleanup refused'); } };
    } }));
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer);
    element.remove(); await renderTurns();
    expect(disposals).to.equal(1); expect(peer.removed).to.equal(true);
    expect(bridge.host.signal.aborted).to.equal(true); expect(bridge.host.isCurrent()).to.equal(false);
    expect(env.observers.filter(observer => !observer.stopped && observer.targets.has(peer.container)).length).to.equal(0);
  });

  it('ignores a queued intersection notification after its native installation is retired', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer);
    const observers = env.observers.filter(observer => observer.kind === 'intersection' && observer.targets.has(peer.container));
    expect(observers.length).to.be.greaterThan(0);
    element.remove(); const visibility = [...bridge.visibility];
    for (const observer of observers) observer.emit(peer.container, true, true);
    await renderTurns();
    expect(bridge.visibility).to.deep.equal(visibility); expect(peer.removed).to.equal(true);
    expect(bridge.host.isCurrent()).to.equal(false);
  });

  for (const failure of ['missing context', 'failed readback'] as const) {
    it(`recovers line presentation after ${failure} without replacing the native map`, async () => {
      const original = HTMLCanvasElement.prototype.getContext;
      let probes = 0;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        if (this.width === 1 && this.height === 1 && args[0] === '2d') {
          probes++;
          if (failure === 'missing context') return null;
          const context = Reflect.apply(original, this, args);
          if (!(context instanceof CanvasRenderingContext2D)) throw new Error('Expected 2D context');
          context.getImageData = () => { throw new Error('Line color readback unavailable'); };
          return context;
        }
        return Reflect.apply(original, this, args);
      } as typeof original;
      try {
        const { element, peer } = await env.mount(element => {
          element.scene = { objects: [{ ...scenePath(), color: 'color(srgb 0 1 0)' }] };
        });
        expect(probes).to.be.greaterThan(0);
        expect([...peer.layers.keys()].filter(id => id.startsWith('lr-scene-lines-')).length).to.equal(0);
        expect(peer.removed).to.equal(false);
        const states = statusLog(element);
        HTMLCanvasElement.prototype.getContext = original;
        invalidateLyraTheme(element);
        await waitUntil(() => [...peer.layers.keys()].some(id => id.startsWith('lr-scene-lines-')), 'line color presentation restored');
        await waitUntil(() => states.at(-1)?.state === 'ready', 'line renderer ready after recovery');
        expect(env.peers.length).to.equal(1); expect(env.records.length).to.equal(0);
      } finally { HTMLCanvasElement.prototype.getContext = original; }
    });
  }

  it('retains ground lines when the optional native terrain query throws', async () => {
    let reads = 0;
    const { element, peer } = await env.mount(element => { element.scene = { objects: [scenePath()] }; }, peer => {
      peer.getTerrain = () => { reads++; throw new Error('Terrain query unavailable'); };
    });
    expect(reads).to.be.greaterThan(0);
    expect([...peer.layers.keys()].some(id => id.startsWith('lr-scene-lines-'))).to.equal(true);
    expect(peer.removed).to.equal(false);
    element.remove(); expect(peer.removed).to.equal(true);
  });

  for (const kind of ['marker', 'path'] as const) {
    it(`recovers a ${kind} after its application color token becomes available`, async () => {
      const { element, peer } = await env.mount(element => {
        const object = kind === 'marker' ? sceneMarker() : scenePath();
        element.scene = { objects: [{ ...object, color: 'var(--scene-delayed-color)' }] };
      });
      const bridge = kind === 'marker' ? await env.bridge(peer) : undefined;
      if (bridge) expect(bridge.host.captureRenderInput().markers.length).to.equal(0);
      expect([...peer.layers.keys()].filter(id => id.startsWith('lr-scene-lines-')).length).to.equal(0);
      const states = statusLog(element);
      element.style.setProperty('--scene-delayed-color', 'rgb(10, 20, 30)');
      invalidateLyraTheme(element);
      if (bridge) {
        await waitUntil(() => bridge.host.captureRenderInput().markers.length === 1, 'marker color becomes available');
        expect(bridge.host.captureRenderInput().markers[0]!.rgba).to.deep.equal([10 / 255, 20 / 255, 30 / 255, 1]);
        bridge.host.onState(report(bridge.host, 'installed'));
      } else {
        await waitUntil(() => [...peer.layers.keys()].some(id => id.startsWith('lr-scene-lines-')), 'line color becomes available');
      }
      await waitUntil(() => states.at(-1)?.state === 'ready', 'scene recovers its presentation');
      expect(peer.removed).to.equal(false); expect(env.peers.length).to.equal(1);
    });
  }

});
