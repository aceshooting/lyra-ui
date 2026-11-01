import { expect, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { mapSceneSessionAttachment } from '../../../internal/map-scene-session.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { renderEnvironment, renderTurns } from '../../../../test/map-scene-render-component-fixtures.js';

describe('lr-map scene native allocation', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('publishes exact public native dimensions ratio and actual padding', async () => {
    const { peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const input = (await env.bridge(peer)).host.captureRenderInput();
    expect(input.allocation?.width).to.equal(640); expect(input.allocation?.height).to.equal(480);
    expect(input.allocation?.pixelRatio).to.equal(1.25);
    expect(input.allocation?.padding).to.deep.equal({ top: 3, right: 5, bottom: 7, left: 11 });
    expect(input.allocation!.revision).to.be.greaterThan(0);
    expect([peer.renderCanvas.width, peer.renderCanvas.height]).to.deep.equal([800, 600]);
  });

  it('reuses the existing allocation observer and captures ratio changes before its unchanged-size return', async () => {
    const { element, peer } = await env.mount();
    const before = env.observers.filter(observer => observer.kind === 'resize' && observer.targets.has(peer.container));
    expect(before.length).to.equal(1);
    element.scene = { objects: [sceneMarker()] }; const bridge = await env.bridge(peer);
    const after = env.observers.filter(observer => observer.kind === 'resize' && observer.targets.has(peer.container));
    expect(after.length).to.equal(1); expect(after[0] === before[0]).to.equal(true);
    const revision = bridge.host.captureRenderInput().allocation!.revision;
    Object.defineProperty(peer, 'resize', { configurable: true, value: () => { peer.syncBacking(); } });
    peer.ratio = 2; env.resize(peer); await renderTurns();
    const allocation = bridge.host.captureRenderInput().allocation;
    expect(allocation?.pixelRatio).to.equal(2); expect(allocation?.width).to.equal(640);
    expect(allocation!.revision).to.be.greaterThan(revision);
  });

  it('does not replace packet or notify viewport for unchanged native allocation', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), before = bridge.host.captureRenderInput();
    const notices: number[] = []; const release = mapSceneSessionAttachment(element)!.subscribeViewport(viewport => { notices.push(viewport.allocationRevision); });
    try {
      peer.fire('resize'); env.resize(peer); await renderTurns();
      expect(bridge.host.captureRenderInput() === before).to.equal(true); expect(notices).to.deep.equal([]);
    } finally { release(); }
  });

  it('refuses clamped-ratio backing mismatch and restores only an authoritative allocation with a new revision', async () => {
    const { peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), before = bridge.host.captureRenderInput().allocation!;
    peer.ratio = 2; peer.appliedRatio = 1; peer.resize(); await renderTurns();
    expect(bridge.host.captureRenderInput().allocation).to.equal(undefined);
    expect(bridge.visibility.at(-1)).to.equal(false);
    peer.appliedRatio = undefined; peer.resize(); await renderTurns();
    const restored = bridge.host.captureRenderInput().allocation;
    expect(restored?.pixelRatio).to.equal(2); expect(restored!.revision).to.be.greaterThan(before.revision);
  });

  it('clears zero allocation without using native default dimensions and advances revision on same-size recovery', async () => {
    const { peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), before = bridge.host.captureRenderInput().allocation!;
    peer.width = 0; peer.height = 0; peer.resize(); await renderTurns();
    expect(bridge.host.captureRenderInput().allocation).to.equal(undefined);
    expect(bridge.visibility.at(-1)).to.equal(false);
    peer.width = 640; peer.height = 480; peer.resize(); await renderTurns();
    const restored = bridge.host.captureRenderInput().allocation;
    expect([restored?.width, restored?.height]).to.deep.equal([640, 480]);
    expect(restored!.revision).to.be.greaterThan(before.revision);
  });

  it('fails closed for missing throwing and invalid public allocation getters while retaining accepted targets', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer);
    for (const name of ['getContainer', 'getPixelRatio', 'getPadding'] as const) {
      for (const value of [undefined, () => { throw new Error('Getter unavailable'); }, () => NaN]) {
        Object.defineProperty(peer, name, { configurable: true, value });
        try {
          peer.fire('resize'); await renderTurns();
          expect(bridge.host.captureRenderInput().allocation).to.equal(undefined);
          expect(mapSceneSessionAttachment(element)!.target('target').status).to.equal('accepted');
          expect(peer.removed).to.equal(false);
        } finally { Reflect.deleteProperty(peer, name); }
        peer.fire('resize'); await renderTurns();
        expect(bridge.host.captureRenderInput().allocation?.width).to.equal(640);
      }
    }
  });

  it('uses actual getPadding after a refused native setter instead of the optimistic authored cache', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), before = { ...peer.padding }, reads = peer.reads.padding;
    peer.rejectPadding = true; element.cameraPadding = { top: 43, right: 47, bottom: 53, left: 59 };
    await element.updateComplete; await renderTurns();
    expect(peer.reads.padding).to.be.greaterThan(reads);
    expect(bridge.host.captureRenderInput().allocation?.padding).to.deep.equal(before);
    expect(peer.removed).to.equal(false);
  });

  it('keeps native client allocation independent of transformed screen rectangles', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer);
    element.style.transform = 'scale(2)'; env.resize(peer); await renderTurns();
    expect(peer.container.getBoundingClientRect().width).to.be.greaterThan(peer.width);
    const allocation = bridge.host.captureRenderInput().allocation;
    expect([allocation?.width, allocation?.height, allocation?.pixelRatio]).to.deep.equal([640, 480, 1.25]);
  });

  it('prevents an outer allocation read from overwriting a nested read on the same native objects', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), widths: number[] = [];
    const release = mapSceneSessionAttachment(element)!.subscribeViewport(viewport => { widths.push(viewport.width); });
    let armed = true, reentered = false;
    peer.onRead = name => {
      if (name !== 'padding' || !armed) return;
      armed = false; reentered = true;
      peer.width = 900; peer.height = 600; peer.padding = { top: 29, right: 31, bottom: 37, left: 41 };
      peer.syncBacking(); peer.fire('resize');
    };
    try {
      peer.width = 800; peer.height = 550; peer.padding = { top: 13, right: 17, bottom: 19, left: 23 };
      peer.syncBacking(); peer.fire('move'); await renderTurns();
      expect(reentered).to.equal(true);
      const allocation = bridge.host.captureRenderInput().allocation;
      expect([allocation?.width, allocation?.height, allocation?.padding.top]).to.deep.equal([900, 600, 29]);
      expect(widths.includes(800)).to.equal(false); expect(widths.at(-1)).to.equal(900);
    } finally { peer.onRead = undefined; release(); }
  });

  it('ignores queued old observer and native callbacks after a replacement map owns allocation', async () => {
    const { element, peer, wrapper } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const old = await env.bridge(peer);
    const observers = env.observers.filter(observer => observer.kind === 'resize' && observer.targets.has(peer.container));
    const callbacks = [...peer.events.get('resize') ?? []];
    element.remove(); wrapper.append(element);
    await waitUntil(() => element.map !== undefined && element.map !== (peer as unknown), 'replacement native map', { timeout: 2000 });
    const replacement = env.peers.at(-1)!; replacement.ready = true; replacement.fire('load');
    const current = await env.bridge(replacement), before = current.host.captureRenderInput();
    peer.width = 999; peer.height = 777; peer.syncBacking();
    for (const observer of observers) observer.emit(peer.container, undefined, true);
    for (const callback of callbacks) callback({ type: 'resize' });
    await renderTurns();
    expect(old.host.isCurrent()).to.equal(false);
    expect(current.host.captureRenderInput() === before).to.equal(true);
    expect(current.host.captureRenderInput().allocation?.width).to.equal(640);
  });
});
