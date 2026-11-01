import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { mapSceneSessionAttachment } from '../../../internal/map-scene-session.js';
import { sceneMarker, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { renderEnvironment, renderTurns } from '../../../../test/map-scene-render-component-fixtures.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';

describe('lr-map scene renderer lifetime', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('suppresses initially unobserved visibility before queued bridge work and enables it after intersection', async () => {
    env.automaticVisibility = false;
    const { peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer);
    expect(bridge.visibility[0]).to.equal(false);
    expect(env.trace.indexOf('bridge:visible:false')).to.be.lessThan(env.trace.indexOf('bridge:capture'));
    env.visible(peer, true); await renderTurns();
    expect(bridge.visibility.at(-1)).to.equal(true);
  });

  it('combines continuing intersection and document visibility instead of one-shot construction visibility', async () => {
    const { peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer);
    await waitUntil(() => bridge.visibility.at(-1) === true, 'initial visible observation', { timeout: 1000 });
    env.visible(peer, false); await renderTurns(); expect(bridge.visibility.at(-1)).to.equal(false);
    env.hidden(true); env.visible(peer, true); await renderTurns(); expect(bridge.visibility.at(-1)).to.equal(false);
    const repaints = peer.repaints; await renderTurns(); expect(peer.repaints).to.equal(repaints);
    env.hidden(false); await renderTurns(); expect(bridge.visibility.at(-1)).to.equal(true);
  });

  it('retires marker work and demand observers for nonmarker intent then recreates from the cached import', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const first = await env.bridge(peer);
    element.scene = { objects: [scenePath()] }; await element.updateComplete; await renderTurns();
    expect(first.disposed).to.equal(true); expect(peer.removed).to.equal(false);
    expect(env.observers.filter(observer => observer.kind === 'intersection' && observer.targets.has(peer.container) && !observer.stopped).length).to.equal(0);
    element.scene = { objects: [sceneMarker('again')] };
    const second = await env.bridge(peer);
    expect(second === first).to.equal(false); expect(env.imports).to.equal(1);
    expect(second.host.captureRenderInput().markers.map(marker => marker.id)).to.deep.equal(['again']);
  });

  it('disposes the bridge before removing the native map on disconnect', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer); env.trace.length = 0;
    element.remove(); await renderTurns();
    expect(bridge.disposed).to.equal(true); expect(peer.removed).to.equal(true);
    expect(env.trace.indexOf('bridge:dispose')).to.be.lessThan(env.trace.indexOf('native:remove'));
    expect(bridge.calls.filter(call => call === 'dispose').length).to.equal(1);
    expect(bridge.host.isCurrent()).to.equal(false);
  });

  it('invalidates bridge style before native style mutation while preserving accepted facade and controller', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), attachment = mapSceneSessionAttachment(element)!;
    const target = attachment.target('target'); env.trace.length = 0;
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Replacement style' };
    await element.updateComplete; await element.whenStyleReady(); await renderTurns();
    expect(env.trace.indexOf('bridge:style')).to.be.greaterThan(-1);
    expect(env.trace.indexOf('bridge:style')).to.be.lessThan(env.trace.indexOf('native:style'));
    expect(env.records.length).to.equal(1); expect(bridge.disposed).to.equal(false);
    expect(mapSceneSessionAttachment(element) === attachment).to.equal(true);
    const next = attachment.target('target');
    expect(target.status === 'accepted' && next.status === 'accepted' && target.target === next.target).to.equal(true);
  });

  it('retires a handle returned by a factory that synchronously disconnects its element', async () => {
    const { element, peer } = await env.mount();
    env.onFactory = () => { element.remove(); };
    element.scene = { objects: [sceneMarker()] };
    await waitUntil(() => env.records.length === 1, 'factory invoked', { timeout: 1000 }); await renderTurns();
    expect(env.records[0]!.disposed).to.equal(true); expect(peer.removed).to.equal(true);
    expect(env.records[0]!.calls.filter(call => call === 'dispose').length).to.equal(1);
  });

  it('ignores old bridge errors and status after native reconnect without disturbing replacement intent', async () => {
    const { element, peer, wrapper } = await env.mount(element => { element.scene = { objects: [sceneMarker('old')] }; });
    const old = await env.bridge(peer), oldInput = old.host.captureRenderInput();
    element.remove(); element.scene = { objects: [sceneMarker('new')] }; wrapper.append(element);
    await waitUntil(() => element.map !== undefined && element.map !== (peer as unknown), 'new native map', { timeout: 2000 });
    const nextPeer = env.peers.at(-1)!; nextPeer.ready = true; nextPeer.fire('load');
    const next = await env.bridge(nextPeer), states: string[] = [];
    element.addEventListener('lr-map-scene-state', event => { if (event instanceof CustomEvent) states.push((event.detail as { state: string }).state); });
    old.host.onError('context-lost'); old.host.onState({ state: 'installed', acceptedSceneRevision: oldInput.acceptedSceneRevision,
      presentationRevision: oldInput.presentationRevision, allocationRevision: oldInput.allocation?.revision, markerInstallationRevision: 1 });
    await element.updateComplete; await renderTurns();
    expect(old.host.isCurrent()).to.equal(false); expect(next.host.isCurrent()).to.equal(true);
    expect(next.disposed || nextPeer.removed).to.equal(false); expect(states).to.deep.equal([]);
    expect(mapSceneSessionAttachment(element)!.target('new').status).to.equal('accepted');
  });

  it('rebinds continuing observers to the adopted owner document and retires the old native installation', async () => {
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const old = await env.bridge(peer);
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Scene renderer realm"></iframe>`);
    const doc = frame.contentDocument!, view = frame.contentWindow! as Window & typeof globalThis;
    env.installRealm(view); element.remove(); doc.adoptNode(element); doc.body.append(element);
    await waitUntil(() => element.map !== undefined && element.map !== (peer as unknown), 'adopted native map', { timeout: 2000 });
    const replacement = env.peers.at(-1)!; replacement.ready = true; replacement.fire('load');
    const current = await env.bridge(replacement);
    expect(old.disposed).to.equal(true); expect(current.host.isCurrent()).to.equal(true);
    expect(env.observers.some(observer => observer.kind === 'intersection' && observer.document === doc && observer.targets.has(replacement.container) && !observer.stopped)).to.equal(true);
    expect(env.observers.some(observer => observer.kind === 'intersection' && observer.targets.has(peer.container) && !observer.stopped)).to.equal(false);
    env.hidden(true, doc); await renderTurns(); expect(current.visibility.at(-1)).to.equal(false);
  });

  it('updates reduced-motion presentation through the existing inherited preference without target resets', async () => {
    const { element, peer, wrapper } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    const bridge = await env.bridge(peer), before = bridge.host.captureRenderInput();
    const target = mapSceneSessionAttachment(element)!.target('target');
    expect(before.reducedMotion).to.equal(false); wrapper.setAttribute('data-lr-motion', 'reduce');
    await waitUntil(() => bridge.host.captureRenderInput().reducedMotion, 'reduced motion packet', { timeout: 1000 });
    const after = bridge.host.captureRenderInput(), next = mapSceneSessionAttachment(element)!.target('target');
    expect(after.presentationRevision).to.be.greaterThan(before.presentationRevision);
    expect(target.status === 'accepted' && next.status === 'accepted' && target.target === next.target).to.equal(true);
  });

  it('contains factory failure without removing the basemap or starting an automatic retry loop', async () => {
    let factories = 0;
    env.setImporter(async () => ({ createSceneBridge() { factories++; throw new Error('Factory unavailable'); } }));
    const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker()] }; });
    await waitUntil(() => factories === 1, 'factory attempted', { timeout: 1000 }); await renderTurns();
    expect(peer.removed).to.equal(false); expect(mapSceneSessionAttachment(element)!.target('target').status).to.equal('accepted');
    expect(element.shadowRoot!.querySelector('[part="scene-panel"]') !== null).to.equal(true);
    await renderTurns(); expect(factories).to.equal(1);
    element.scene = { objects: [{ ...sceneMarker(), label: 'Explicit retry' }] };
    await waitUntil(() => factories === 2, 'new accepted request retries', { timeout: 1000 });
    expect(env.imports).to.equal(1);
  });
});
