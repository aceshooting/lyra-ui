import { expect } from '@open-wc/testing';
import { sceneModel, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { mapSceneAdmissionErrorCode } from './map-scene-errors.js';

describe('map scene input reflection reentry', () => {
  it('rejects source metadata changed during nested reflection after its text was counted', () => {
    const h = sceneSourceHarness();
    try {
      h.hooks.resolve = () => ({ url: 'https://example.invalid/model.glb', owner: h.owner });
      const models = Array.from({ length: 4 }, (_, index) => ({ ...sceneModel(`asset-${index}`),
        source: { format: 'glb' as const, src: 'x'.repeat(1_048_562) } }));
      const total = () => models.reduce((sum, model) => sum + model.id.length + model.label.length + model.source.src.length, 0);
      expect(total()).to.equal(4_194_304);
      let mutations = 0;
      models[0]!.position = new Proxy(models[0]!.position, {
        ownKeys(target) {
          if (mutations++ === 0) models[3]!.source.src += 'x';
          return Reflect.ownKeys(target);
        },
      });
      let caught: unknown;
      let candidate: ReturnType<typeof stageMapSceneAdmission> | undefined;
      try { candidate = stageMapSceneAdmission({ objects: models }, { request: h.request(), sources: h.sources }); }
      catch (error) { caught = error; }
      candidate?.dispose();
      expect(mutations > 0).to.equal(true);
      expect(total()).to.equal(4_194_305);
      expect(models[3]!.source.src.length <= 1_048_576).to.equal(true);
      expect(caught).to.be.instanceOf(TypeError);
      expect(mapSceneAdmissionErrorCode(caught)).to.equal('invalid');
      expect(h.allocations).to.equal(0);
      expect(h.liveBytes).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('does not discard model-only validation when reflected kind changes to marker', () => {
    const h = sceneSourceHarness();
    try {
      let kindReads = 0;
      const value = new Proxy({ ...sceneModel(), orientation: [0, 0, 0, 0],
        source: { format: 'glb', bytes: 'invalid' } }, {
        getOwnPropertyDescriptor(target, key) {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
          return key === 'kind' && descriptor
            ? { ...descriptor, value: kindReads++ === 0 ? 'model' : 'marker' }
            : descriptor;
        },
      });
      let caught: unknown;
      let candidate: ReturnType<typeof stageMapSceneAdmission> | undefined;
      try { candidate = stageMapSceneAdmission({ objects: [value] }, { request: h.request(), sources: h.sources }); }
      catch (error) { caught = error; }
      candidate?.dispose();
      expect(kindReads > 0).to.equal(true);
      expect(caught).to.be.instanceOf(TypeError);
      expect(mapSceneAdmissionErrorCode(caught)).to.equal('invalid');
      expect(h.allocations).to.equal(0);
      expect(h.resolutions).to.equal(0);
    } finally { h.sources.dispose(); }
  });
});
