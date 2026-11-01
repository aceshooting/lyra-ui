import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { createMapScenePositionRegistry } from './map-scene-position-registry.js';
import { sceneMarker, sceneModel, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

const operation = fc.record({
  present: fc.boolean(), model: fc.boolean(), longitude: fc.integer({ min: -170, max: 170 }),
  turns: fc.integer({ min: -3, max: 3 }), label: fc.integer({ min: 0, max: 100 }),
});

describe('map scene position registry properties', () => {
  it('matches an independent changed-position model across replacement, removal and reappearance', () => {
    fc.assert(fc.property(fc.array(operation, { minLength: 1, maxLength: 24 }), operations => {
      const h = sceneSourceHarness();
      const registry = createMapScenePositionRegistry({ connection: h.connection, sources: h.sources, isCurrent: h.isCurrent });
      const source = { format: 'glb' as const, bytes: new Uint8Array([1]) };
      let previous: { kind: 'marker' | 'model'; longitude: number; revision: number } | undefined;
      let greatestRevision = 0;
      const notices: { readonly registryRevision: number; readonly changedIds: readonly string[] }[] = [];
      let registryRevision = 0;
      registry.subscribe(notice => { notices.push(notice); });
      operations.forEach((operation, index) => {
        const kind = operation.model ? 'model' : 'marker';
        const expectedChange = operation.present
          ? previous === undefined || previous.kind !== kind || previous.longitude !== operation.longitude
          : previous !== undefined;
        const beforeNotices = notices.length;
        const object = operation.model ? sceneModel('target', source) : sceneMarker();
        const objects = operation.present ? [{ ...object, label: `Label ${operation.label}`,
          position: { lngLat: [operation.longitude + operation.turns * 360, 0] } }] : [];
        const candidate = stageMapSceneAdmission({ objects }, { request: h.next(), sources: h.sources });
        expect(registry.commit(candidate)).to.equal(true);
        expect(registry.acceptedSceneRevision).to.equal(index + 1);
        expect(notices.length - beforeNotices).to.equal(expectedChange ? 1 : 0);
        for (const notice of notices.slice(beforeNotices)) {
          expect([...notice.changedIds]).to.deep.equal(['target']);
          expect(notice.registryRevision).to.be.greaterThan(registryRevision);
          registryRevision = notice.registryRevision;
        }
        const lookup = registry.target('target');
        if (!operation.present) {
          expect(lookup.status).to.equal('absent'); previous = undefined; return;
        }
        if (lookup.status !== 'accepted') throw new Error('Expected accepted target');
        expect(lookup.target.kind).to.equal(kind);
        expect(lookup.target.position.lngLat).to.deep.equal([operation.longitude === 0 ? 0 : operation.longitude, 0]);
        if (expectedChange) expect(lookup.target.acceptedPositionRevision).to.be.greaterThan(greatestRevision);
        else expect(lookup.target.acceptedPositionRevision).to.equal(previous!.revision);
        greatestRevision = lookup.target.acceptedPositionRevision;
        previous = { kind, longitude: operation.longitude, revision: greatestRevision };
      });
      registry.dispose(); h.sources.dispose(); expect(h.liveBytes).to.equal(0);
    }), propertyRuns());
  });

  it('leaves an unchanged target revision stable through arbitrary unrelated moves', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -170, max: 170 }), { minLength: 1, maxLength: 24 }), moves => {
      const h = sceneSourceHarness();
      const registry = createMapScenePositionRegistry({ connection: h.connection, sources: h.sources, isCurrent: h.isCurrent });
      const commit = (longitude: number) => registry.commit(stageMapSceneAdmission({
        objects: [sceneMarker('target', 12), sceneMarker('other', longitude)],
      }, { request: h.next(), sources: h.sources }));
      commit(0);
      const first = registry.target('target');
      if (first.status !== 'accepted') throw new Error('Expected accepted target');
      const revision = first.target.acceptedPositionRevision;
      const changed: string[][] = [];
      registry.subscribe(notice => { changed.push([...notice.changedIds]); });
      moves.forEach(longitude => {
        commit(longitude);
        const actual = registry.target('target');
        if (actual.status !== 'accepted') throw new Error('Expected accepted target');
        expect(actual.target.acceptedPositionRevision).to.equal(revision);
        expect(changed.every(ids => !ids.includes('target'))).to.equal(true);
      });
      registry.dispose(); h.sources.dispose();
    }), propertyRuns());
  });

  it('never lets obsolete candidates overwrite newer accepted facts or retain their provisional backing', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 32 }), fc.integer({ min: -170, max: 170 }), (length, longitude) => {
      const h = sceneSourceHarness();
      const registry = createMapScenePositionRegistry({ connection: h.connection, sources: h.sources, isCurrent: h.isCurrent });
      const stale = stageMapSceneAdmission({ objects: [sceneModel('target', { format: 'glb', bytes: new Uint8Array(length) })] }, {
        request: h.request(), sources: h.sources,
      });
      const current = stageMapSceneAdmission({ objects: [sceneMarker('target', longitude)] }, { request: h.next(), sources: h.sources });
      expect(registry.commit(current)).to.equal(true);
      expect(registry.commit(stale)).to.equal(false);
      const actual = registry.target('target');
      if (actual.status !== 'accepted') throw new Error('Expected accepted target');
      expect(actual.target.kind).to.equal('marker');
      expect(actual.target.position.lngLat).to.deep.equal([longitude === 0 ? 0 : longitude, 0]);
      expect(registry.acceptedSceneRevision).to.equal(1);
      expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(1);
      registry.dispose(); h.sources.dispose();
    }), propertyRuns());
  });
});
