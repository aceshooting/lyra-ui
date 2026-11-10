import { expect, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { mapSceneSessionAttachment } from '../../../internal/map-scene-session.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { deferred, renderEnvironment, renderTurns } from '../../../../test/map-scene-render-component-fixtures.js';
import { __setMapFeatureImporterForTesting, loadMapSceneRenderRuntime } from './map-feature-loader.js';
import * as runtime from './map-scene-render-controller.js';

describe('lr-map scene runtime startup recovery', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => {
    await env.close();
    __setMapFeatureImporterForTesting(loadMapSceneRenderRuntime);
    fixtureCleanup();
  });

  for (const failure of ['import', 'factory'] as const) {
    it(`preserves accepted targets after a runtime ${failure} failure and recovers on new scene intent`, async () => {
      let imports = 0, factories = 0;
      const states: { state: string; code?: string }[] = [];
      __setMapFeatureImporterForTesting(loadMapSceneRenderRuntime, async () => {
        imports++;
        if (failure === 'import' && imports === 1) throw new Error('Scene runtime unavailable');
        return { ...runtime, createMapSceneRenderController(options) {
          factories++;
          if (failure === 'factory' && factories === 1) throw new Error('Scene controller unavailable');
          return runtime.createMapSceneRenderController(options);
        } };
      });
      const { element, peer } = await env.mount(element => {
        element.scene = { objects: [sceneMarker('retained')] };
        element.addEventListener('lr-map-scene-state', event => {
          if (event instanceof CustomEvent) states.push(event.detail as { state: string; code?: string });
        });
      });
      await waitUntil(() => states.at(-1)?.state === 'unavailable', 'startup failure is reported');
      expect(states.at(-1)?.code).to.equal('engine');
      expect(element.shadowRoot!.querySelector('[part="scene-status"]')?.textContent?.trim().length).to.be.greaterThan(0);
      expect(element.shadowRoot!.querySelector('[part="scene-list"]')?.textContent).to.include('retained');
      const attachment = mapSceneSessionAttachment(element)!;
      const before = attachment.target('retained');
      expect(before.status).to.equal('accepted');
      expect(peer.removed).to.equal(false);
      element.requestUpdate(); await element.updateComplete; await renderTurns();
      expect(imports).to.equal(1);
      expect(factories).to.equal(failure === 'import' ? 0 : 1);
      expect(env.records.length).to.equal(0);

      element.scene = { objects: [{ ...sceneMarker('retained'), label: 'Restored renderer' }] };
      const bridge = await env.bridge(peer), input = bridge.host.captureRenderInput();
      bridge.host.onState({ state: 'installed', acceptedSceneRevision: input.acceptedSceneRevision,
        presentationRevision: input.presentationRevision, allocationRevision: input.allocation?.revision,
        markerInstallationRevision: 1 });
      await waitUntil(() => states.at(-1)?.state === 'ready', 'replacement intent restores rendering');
      expect(imports).to.equal(failure === 'import' ? 2 : 1);
      expect(factories).to.equal(failure === 'import' ? 1 : 2);
      expect(element.shadowRoot!.querySelector('[part="scene-status"]') === null).to.equal(true);
      const after = attachment.target('retained');
      expect(before.status === 'accepted' && after.status === 'accepted' && before.target === after.target).to.equal(true);
      expect(peer.removed).to.equal(false);
    });
  }

  for (const completion of ['resolve', 'reject'] as const) {
    it(`discards a late runtime ${completion} after scene demand clears and accepts the next scene`, async () => {
      const gate = deferred<typeof runtime>();
      let attempts = 0;
      __setMapFeatureImporterForTesting(loadMapSceneRenderRuntime, () => {
        attempts++;
        return attempts === 1 ? gate.promise : Promise.resolve(runtime);
      });
      try {
        const { element, peer } = await env.mount(element => { element.scene = { objects: [sceneMarker('obsolete')] }; });
        expect(attempts).to.equal(1);
        const states: string[] = [];
        element.addEventListener('lr-map-scene-state', event => {
          if (event instanceof CustomEvent) states.push((event.detail as { state: string }).state);
        });
        element.scene = undefined;
        if (completion === 'resolve') gate.resolve(runtime); else gate.reject(new Error('Obsolete import failed'));
        await element.updateComplete; await renderTurns();
        expect(states.includes('unavailable')).to.equal(false);
        expect(env.records.length).to.equal(0);
        expect(mapSceneSessionAttachment(element)!.target('obsolete').status).to.equal('absent');
        expect(peer.removed).to.equal(false);
        element.scene = { objects: [sceneMarker('current')] };
        const bridge = await env.bridge(peer);
        expect(bridge.host.captureRenderInput().markers.map(marker => marker.id)).to.deep.equal(['current']);
        expect(attempts).to.equal(completion === 'resolve' ? 1 : 2);
        expect(env.records.length).to.equal(1);
      } finally { gate.resolve(runtime); }
    });
  }

  it('disposes a controller returned after its factory disconnects the map and reconnects with fresh ownership', async () => {
    let factories = 0, disposals = 0;
    __setMapFeatureImporterForTesting(loadMapSceneRenderRuntime, async () => ({ ...runtime,
      createMapSceneRenderController(options) {
        factories++;
        const controller = runtime.createMapSceneRenderController(options);
        if (factories === 1) options.element.remove();
        return { ...controller, dispose() { disposals++; controller.dispose(); } };
      },
    }));
    const { element, peer, wrapper } = await env.mount();
    element.scene = { objects: [sceneMarker('initial')] };
    await waitUntil(() => disposals === 1, 'late controller retired');
    expect(peer.removed).to.equal(true);
    expect(element.isConnected).to.equal(false);
    expect(mapSceneSessionAttachment(element)).to.equal(undefined);
    wrapper.append(element);
    await waitUntil(() => element.map !== undefined && element.map !== (peer as unknown), 'new native map');
    const replacement = env.peers.at(-1)!; replacement.ready = true; replacement.fire('load');
    const bridge = await env.bridge(replacement);
    expect(bridge.host.captureRenderInput().markers.map(marker => marker.id)).to.deep.equal(['initial']);
    expect(factories).to.equal(2);
    expect(disposals).to.equal(1);
    element.remove();
    expect(disposals).to.equal(2);
    expect(bridge.disposed).to.equal(true);
  });
});
