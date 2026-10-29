import { expect, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { mapSceneSessionAttachment } from '../../../internal/map-scene-session.js';
import { invalidateLyraTheme } from '../../../internal/theme-watcher.js';
import { sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { renderEnvironment, renderTurns } from '../../../../test/map-scene-render-component-fixtures.js';

describe('lr-map scene renderer connection', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('keeps default empty and unsupported-only intent free of bridge imports and scene allocation reads', async () => {
    const { element, peer } = await env.mount();
    for (const scene of [undefined, { objects: [] }, { objects: [scenePath(), sceneModel()] }]) {
      element.scene = scene; await element.updateComplete; await renderTurns();
    }
    expect(env.imports).to.equal(0); expect(env.records.length).to.equal(0);
    expect([peer.reads.container, peer.reads.ratio, peer.reads.padding]).to.deep.equal([0, 0, 0]);
    expect(env.observers.filter(observer => observer.kind === 'intersection' && observer.targets.has(peer.container)).length).to.equal(0);
    expect(mapSceneSessionAttachment(element)!.target('model').status).to.equal('accepted');
  });

  it('accepts text and target facts synchronously during held import and starts only the latest scene', async () => {
    const gate = env.holdImport();
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker('A')] }; });
    await waitUntil(() => env.imports === 1, 'bridge import requested', { timeout: 1000 });
    const attachment = mapSceneSessionAttachment(element)!;
    element.scene = { objects: [sceneMarker('B', 23)] };
    const target = attachment.target('B');
    expect(target.status === 'accepted' && target.target.position.lngLat[0]).to.equal(23);
    expect(attachment.target('A').status).to.equal('absent'); await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="scene-list"]')!.textContent).to.include('B');
    expect(env.records.length).to.equal(0);
    gate.resolve(env.module()); const bridge = await env.bridge(peer);
    expect(bridge.host.captureRenderInput().markers.map(marker => marker.id)).to.deep.equal(['B']);
    expect(env.imports).to.equal(1);
  });

  it('retries a rejected import only after a new explicit accepted request', async () => {
    let attempts = 0;
    env.setImporter(async () => { attempts++; if (attempts === 1) throw new Error('Unavailable test peer'); return env.module(); });
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    await waitUntil(() => env.imports === 1, 'initial import', { timeout: 1000 }); await renderTurns();
    expect(env.records.length).to.equal(0); expect(mapSceneSessionAttachment(element)!.target('target').status).to.equal('accepted');
    await renderTurns(); expect(env.imports).to.equal(1);
    element.scene = { objects: [{ ...sceneMarker(), label: 'Retry' }] };
    await env.bridge(peer); expect(env.imports).to.equal(2);
  });

  it('rejects malformed namespaces inside the cache boundary so a later request can load a valid factory', async () => {
    let attempts = 0;
    env.setImporter(async () => { attempts++; return attempts === 1 ? { createSceneBridge: 17 } : { default: env.module() }; });
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    await waitUntil(() => env.imports === 1, 'malformed import', { timeout: 1000 }); await renderTurns();
    expect(env.records.length).to.equal(0);
    element.scene = { objects: [{ ...sceneMarker(), color: 'red' }] };
    await env.bridge(peer); expect(env.imports).to.equal(2);
  });

  it('does not create native work when accepted marker demand clears before import completion', async () => {
    const gate = env.holdImport();
    const { element } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    await waitUntil(() => env.imports === 1, 'held import', { timeout: 1000 });
    element.scene = undefined; gate.resolve(env.module()); await element.updateComplete; await renderTurns();
    expect(env.records.length).to.equal(0); expect(mapSceneSessionAttachment(element)!.target('target').status).to.equal('absent');
  });

  it('fences a held startup across reconnect and attaches only to the new native map', async () => {
    const gate = env.holdImport();
    const { element, peer, wrapper } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    await waitUntil(() => env.imports === 1, 'held import', { timeout: 1000 });
    element.remove(); wrapper.append(element);
    await waitUntil(() => element.map !== undefined && element.map !== (peer as unknown), 'replacement map', { timeout: 2000 });
    const replacement = env.peers.at(-1)!; replacement.ready = true; replacement.fire('load');
    gate.resolve(env.module()); await env.bridge(replacement);
    expect(peer.removed).to.equal(true); expect(env.records.length).to.equal(1);
    expect(env.records[0]!.peer === replacement).to.equal(true);
  });

  it('shares the successful import while keeping two native owners and packets independent', async () => {
    const a = await env.mount(element => { element.scene = { objects: [sceneMarker('same', 10)] }; });
    const first = await env.bridge(a.peer);
    const b = await env.mount(element => { element.scene = { objects: [sceneMarker('same', 20)] }; });
    const second = await env.bridge(b.peer);
    expect(env.imports).to.equal(1); expect(first === second).to.equal(false);
    expect([first.host.captureRenderInput().markers[0]!.position.lngLat[0], second.host.captureRenderInput().markers[0]!.position.lngLat[0]]).to.deep.equal([10, 20]);
    a.element.scene = undefined; await renderTurns();
    expect(first.disposed).to.equal(true); expect(second.disposed).to.equal(false);
  });

  it('resolves the existing accent token and explicit CSS alpha before applying opacity once', async () => {
    const { peer } = await env.mount(element => {
      element.style.setProperty('--lr-color-brand', 'rgb(20, 40, 60)');
      element.scene = { objects: [sceneMarker('accent'), { ...sceneMarker('explicit'), color: 'rgba(200, 100, 50, 0.5)', opacity: 0.4 }] };
    });
    const packet = (await env.bridge(peer)).host.captureRenderInput();
    const accent = packet.markers.find(marker => marker.id === 'accent')!, explicit = packet.markers.find(marker => marker.id === 'explicit')!;
    expect(accent.rgba).to.deep.equal([20 / 255, 40 / 255, 60 / 255, 1]);
    expect(explicit.rgba[0]).to.be.closeTo(200 / 255, 0.005);
    expect(explicit.rgba[3]).to.be.closeTo(0.2, 0.002);
    expect(explicit.radiusCss).to.equal(6);
  });

  it('refreshes scene-only theme presentation without changing target identity or public renderer status', async () => {
    const states: string[] = [];
    const { element, peer } = await env.mount(element => {
      element.style.setProperty('--scene-only-color', 'rgb(10, 20, 30)');
      element.scene = { objects: [{ ...sceneMarker(), color: 'var(--scene-only-color)' }] };
      element.addEventListener('lr-map-scene-state', event => { if (event instanceof CustomEvent) states.push((event.detail as { state: string }).state); });
    });
    const bridge = await env.bridge(peer), before = bridge.host.captureRenderInput();
    const target = mapSceneSessionAttachment(element)!.target('target');
    element.style.setProperty('--scene-only-color', 'rgb(80, 100, 120)'); invalidateLyraTheme(element);
    await waitUntil(() => bridge.host.captureRenderInput().markers[0]?.rgba[0] === 80 / 255, 'theme reached scene packet', { timeout: 1000 });
    const after = bridge.host.captureRenderInput();
    expect(after.presentationRevision).to.be.greaterThan(before.presentationRevision);
    const next = mapSceneSessionAttachment(element)!.target('target');
    expect(target.status === 'accepted' && next.status === 'accepted' && target.target === next.target).to.equal(true);
    bridge.host.onState({ state: 'installed', acceptedSceneRevision: after.acceptedSceneRevision, presentationRevision: after.presentationRevision,
      allocationRevision: after.allocation?.revision, markerInstallationRevision: 1 });
    await element.updateComplete;
    expect(states.some(state => state === 'ready' || state === 'partial' || state === 'empty')).to.equal(false);
  });

  it('discards color resolution that reenters with a newer accepted scene', async () => {
    const { element, peer } = await env.mount(element => {
      element.style.setProperty('--scene-reentry-color', 'rgb(10, 20, 30)');
      element.scene = { objects: [{ ...sceneMarker('A'), color: 'var(--scene-reentry-color)' }] };
    });
    const bridge = await env.bridge(peer), original = window.getComputedStyle; let armed = true, reentered = false;
    window.getComputedStyle = (target, pseudo) => {
      if (armed && target instanceof HTMLSpanElement && target.getRootNode() === element.shadowRoot &&
        target.parentElement?.hidden === true && target.style.color.includes('--scene-reentry-color')) {
        armed = false; reentered = true; element.scene = { objects: [{ ...sceneMarker('B', 41), color: 'rgb(90, 100, 110)' }] };
      }
      return original.call(window, target, pseudo);
    };
    try {
      invalidateLyraTheme(element);
      await waitUntil(() => bridge.host.captureRenderInput().markers[0]?.id === 'B', 'new scene presentation', { timeout: 1000 });
      expect(reentered).to.equal(true);
      expect(bridge.host.captureRenderInput().markers[0]!.position.lngLat[0]).to.equal(41);
      expect(bridge.host.captureRenderInput().markers[0]!.rgba[0]).to.be.closeTo(90 / 255, 0.002);
      expect(mapSceneSessionAttachment(element)!.target('A').status).to.equal('absent');
    } finally { window.getComputedStyle = original; }
  });
});
