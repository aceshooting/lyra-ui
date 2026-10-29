import { expect } from '@open-wc/testing';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { sceneArc, sceneMarker, sceneModel, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

describe('map scene descriptor admission', () => {
  it('admits a valid empty scene without creating source work', () => {
    const h = sceneSourceHarness();
    const candidate = stageMapSceneAdmission({ objects: [] }, { request: h.request(), sources: h.sources });
    expect(candidate.objects.length).to.equal(0); expect(candidate.sourceStage.receipts.length).to.equal(0);
    expect(h.allocations).to.equal(0); expect(h.resolutions).to.equal(0);
    candidate.dispose(); h.sources.dispose();
  });

  it('owns canonical position facts and admits every supported object kind', () => {
    const h = sceneSourceHarness();
    const marker = sceneMarker('  Station α  ', 540);
    const input = { objects: [marker, scenePath(), sceneArc(), sceneModel()] };
    const candidate = stageMapSceneAdmission(input, { request: h.request(), sources: h.sources });
    marker.position.lngLat[0] = 0; marker.label = 'changed';
    expect(candidate.objects.map(object => object.kind)).to.deep.equal(['marker', 'path', 'arc', 'model']);
    const first = candidate.objects[0]!;
    if (first.kind !== 'marker') throw new Error('Expected marker');
    expect(first.id).to.equal('  Station α  '); expect(first.label).to.equal('  Station α  ');
    expect(first.position).to.deep.equal({ lngLat: [-180, 0], altitude: 0, altitudeReference: 'sea-level' });
    expect(Object.isFrozen(first.position) && Object.isFrozen(first.position.lngLat)).to.equal(true);
    expect(Object.isFrozen(candidate.objects)).to.equal(true);
    candidate.dispose(); h.sources.dispose(); expect(h.liveBytes).to.equal(0);
  });

  it('retains fully authored marker, path, arc and model channels with nested isolation', () => {
    const h = sceneSourceHarness();
    const marker = { ...sceneMarker('pin'), position: { lngLat: [370, 12], altitude: -20, altitudeReference: 'terrain' },
      color: 'red', opacity: 0.25, interactive: false, showLabel: true, radius: 9 };
    const path = { ...scenePath(), positions: [{ lngLat: [10, 20], altitude: 100, altitudeReference: 'sea-level' },
      { lngLat: [11, 21], altitude: 200, altitudeReference: 'sea-level' }], interpolation: 'linear', width: 7,
      color: 'blue', opacity: 0.4, interactive: false, showLabel: true };
    const arc = { ...sceneArc(), start: { lngLat: [-170, 5], altitude: 20, altitudeReference: 'terrain' },
      end: { lngLat: [170, 6], altitude: 30, altitudeReference: 'terrain' }, height: 1234, width: 4,
      color: 'green', opacity: 0.6, interactive: false, showLabel: true };
    const model = { ...sceneModel(), position: { lngLat: [-370, -12], altitude: 42, altitudeReference: 'sea-level' },
      metersPerUnit: 2, orientation: [0, 0, 0, 2], color: 'white', opacity: 0.8, interactive: false, showLabel: true };
    const candidate = stageMapSceneAdmission({ objects: [marker, path, arc, model] }, { request: h.request(), sources: h.sources });
    const expected = [
      { ...marker, position: { lngLat: [10, 12], altitude: -20, altitudeReference: 'terrain' } },
      { ...path, positions: [{ lngLat: [10, 20], altitude: 100, altitudeReference: 'sea-level' },
        { lngLat: [11, 21], altitude: 200, altitudeReference: 'sea-level' }] },
      { ...arc, start: { lngLat: [-170, 5], altitude: 20, altitudeReference: 'terrain' },
        end: { lngLat: [170, 6], altitude: 30, altitudeReference: 'terrain' } },
      { ...model, position: { lngLat: [-10, -12], altitude: 42, altitudeReference: 'sea-level' },
        orientation: [0, 0, 0, 1], source: candidate.sourceStage.receipts[0] },
    ];
    marker.position.lngLat[0] = 99; marker.radius = 1;
    path.positions[0]!.lngLat[0] = 99; path.width = 1;
    arc.start.altitude = 999; arc.height = 1;
    model.orientation.fill(1); model.metersPerUnit = 9;
    expect(candidate.objects).to.deep.equal(expected);
    candidate.dispose(); h.sources.dispose();
  });

  it('admits exactly the supported format/source choices and rejects incomplete or extra source metadata', () => {
    const h = sceneSourceHarness();
    for (const format of ['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd']) {
      for (const source of [{ format, bytes: new Uint8Array([1]) }, { format, src: `model.${format}` }]) {
        const candidate = stageMapSceneAdmission({ objects: [{ ...sceneModel(), source }] }, { request: h.request(), sources: h.sources });
        expect(candidate.sourceStage.receipts[0]!.format).to.equal(format); candidate.dispose();
      }
    }
    for (const source of [{ format: 'fbx', bytes: new Uint8Array([1]) }, { bytes: new Uint8Array([1]) },
      { format: 'glb' }, { format: 'glb', src: 'a.glb', extra: true },
      { format: 'glb', bytes: new Uint8Array([1]), src: 'a.glb' }]) {
      expect(() => stageMapSceneAdmission({ objects: [{ ...sceneModel(), source }] }, { request: h.request(), sources: h.sources })).to.throw();
    }
    expect(h.liveBytes).to.equal(0); h.sources.dispose();
  });

  it('preserves exact IDs while enforcing UTF-16 length and nonblank admission', () => {
    const h = sceneSourceHarness();
    for (const id of ['a', ' A ', 'A/B# [node]', 'x'.repeat(1024), '😀'.repeat(512)]) {
      const candidate = stageMapSceneAdmission({ objects: [sceneMarker(id)] }, { request: h.request(), sources: h.sources });
      expect(candidate.objects[0]!.id).to.equal(id); candidate.dispose();
    }
    for (const id of ['', ' \n\t ', 'x'.repeat(1025), '😀'.repeat(513), 1, null]) {
      expect(() => stageMapSceneAdmission({ objects: [{ ...sceneMarker(), id }] }, { request: h.request(), sources: h.sources })).to.throw();
    }
    const distinct = stageMapSceneAdmission({ objects: [sceneMarker('A'), sceneMarker('a'), sceneMarker(' A ')] }, { request: h.request(), sources: h.sources });
    expect(distinct.objects.length).to.equal(3); distinct.dispose(); h.sources.dispose();
  });

  it('validates the complete descriptor list before source allocation or URL resolution', () => {
    const h = sceneSourceHarness();
    const inputs = [
      { objects: [sceneModel(), { ...sceneMarker('late'), opacity: NaN }] },
      { objects: [{ ...sceneModel(), source: { format: 'glb', src: 'model.glb' } }, sceneMarker('model')] },
      { objects: [sceneMarker(), { ...sceneMarker('other'), extra: true }] },
      { objects: [sceneMarker(), , sceneMarker('third')] },
    ];
    for (const value of inputs) expect(() => stageMapSceneAdmission(value, { request: h.request(), sources: h.sources })).to.throw();
    expect(h.allocations).to.equal(0); expect(h.resolutions).to.equal(0); h.sources.dispose();
  });

  it('rejects unknown fields and accessor data without executing them', () => {
    const h = sceneSourceHarness(); let reads = 0;
    const marker = sceneMarker();
    Object.defineProperty(marker.position, 'lngLat', { get() { reads++; return [0, 0]; } });
    expect(() => stageMapSceneAdmission({ objects: [marker] }, { request: h.request(), sources: h.sources })).to.throw();
    expect(() => stageMapSceneAdmission({ objects: [], extra: true }, { request: h.request(), sources: h.sources })).to.throw();
    expect(() => stageMapSceneAdmission({ objects: [{ ...sceneMarker(), kind: 'sphere' }] }, { request: h.request(), sources: h.sources })).to.throw();
    expect(reads).to.equal(0); h.sources.dispose();
  });

  it('enforces geographic, paint and model placement boundaries without silent clamping', () => {
    const h = sceneSourceHarness();
    for (const change of [
      { position: { lngLat: [0, 85.0511287798066 + 1e-8] } },
      { position: { lngLat: [Infinity, 0] } },
      { position: { lngLat: [0, 0], altitude: -12001 } },
      { position: { lngLat: [0, 0], altitude: 100000001 } },
      { position: { lngLat: [0, 0], altitudeReference: 'ellipsoid' } },
      { opacity: -0.1 }, { opacity: 1.1 }, { radius: 0 }, { interactive: 'yes' },
    ]) expect(() => stageMapSceneAdmission({ objects: [{ ...sceneMarker(), ...change }] }, { request: h.request(), sources: h.sources })).to.throw();
    for (const change of [{ metersPerUnit: 0 }, { metersPerUnit: Infinity }, { orientation: [0, 0, 0, 0] }]) {
      expect(() => stageMapSceneAdmission({ objects: [{ ...sceneModel(), ...change }] }, { request: h.request(), sources: h.sources })).to.throw();
    }
    for (const altitude of [-12000, 100000000]) {
      const candidate = stageMapSceneAdmission({ objects: [{ ...sceneMarker(), position: { lngLat: [0, 85.0511287798066], altitude } }] }, { request: h.request(), sources: h.sources });
      candidate.dispose();
    }
    expect(h.allocations).to.equal(0); h.sources.dispose();
  });

  it('rejects ambiguous or inconsistent path and arc descriptors', () => {
    const h = sceneSourceHarness();
    const invalid = [
      { ...scenePath(), positions: [{ lngLat: [0, 0] }] },
      { ...scenePath(), positions: [{ lngLat: [0, 0] }, { lngLat: [180, 0] }] },
      { ...scenePath(), positions: [{ lngLat: [0, 0] }, { lngLat: [0, 0] }] },
      { ...scenePath(), positions: [{ lngLat: [0, 0] }, { lngLat: [10, 0], altitudeReference: 'terrain' }] },
      { ...scenePath(), interpolation: 'spline' }, { ...scenePath(), width: -1 },
      { ...sceneArc(), height: -1 }, { ...sceneArc(), end: { lngLat: [0, 0] } },
      { ...sceneArc(), end: { lngLat: [10, 0], altitudeReference: 'terrain' } },
    ];
    for (const object of invalid) expect(() => stageMapSceneAdmission({ objects: [object] }, { request: h.request(), sources: h.sources })).to.throw();
    h.sources.dispose();
  });

  it('enforces object, model and authored path cardinalities before snapshots', () => {
    const h = sceneSourceHarness();
    expect(() => stageMapSceneAdmission({ objects: Array.from({ length: 2001 }, (_, i) => sceneMarker(String(i))) }, { request: h.request(), sources: h.sources })).to.throw();
    const source = { format: 'glb' as const, bytes: new Uint8Array([1]) };
    expect(() => stageMapSceneAdmission({ objects: Array.from({ length: 33 }, (_, i) => sceneModel(String(i), source)) }, { request: h.request(), sources: h.sources })).to.throw();
    expect(() => stageMapSceneAdmission({ objects: [{ ...scenePath(), positions: Array.from({ length: 4097 }, (_, i) => ({ lngLat: [i / 100, 0] })) }] }, { request: h.request(), sources: h.sources })).to.throw();
    expect(h.allocations).to.equal(0); h.sources.dispose();
  });

  it('admits exact object, model and authored path count ceilings', () => {
    const h = sceneSourceHarness();
    const markers = stageMapSceneAdmission({ objects: Array.from({ length: 2000 }, (_, i) => sceneMarker(String(i))) }, { request: h.request(), sources: h.sources });
    expect(markers.objects.length).to.equal(2000); markers.dispose();
    const source = { format: 'glb' as const, bytes: new Uint8Array([1]) };
    const models = stageMapSceneAdmission({ objects: Array.from({ length: 32 }, (_, i) => sceneModel(String(i), source)) }, { request: h.request(), sources: h.sources });
    expect(models.objects.length).to.equal(32); expect(models.sourceStage.receipts.length).to.equal(1); models.dispose();
    const path = stageMapSceneAdmission({ objects: [{ ...scenePath(), positions: Array.from({ length: 4096 }, (_, i) => ({ lngLat: [i / 100, 0] })) }] }, { request: h.request(), sources: h.sources });
    expect(path.objects.length).to.equal(1); path.dispose(); h.sources.dispose(); expect(h.liveBytes).to.equal(0);
  });

  it('binds each model to its own admitted source receipt while sharing repeated records', () => {
    const h = sceneSourceHarness();
    const a = { format: 'glb' as const, bytes: new Uint8Array([1]) };
    const b = { format: 'glb' as const, bytes: new Uint8Array([2]) };
    const candidate = stageMapSceneAdmission({ objects: [sceneModel('a', a), sceneModel('b', b), sceneModel('again', a)] }, { request: h.request(), sources: h.sources });
    const models = candidate.objects.filter(object => object.kind === 'model');
    expect(models.length).to.equal(3);
    expect(models[0]!.source).to.equal(models[2]!.source);
    expect(models[0]!.source).not.to.equal(models[1]!.source);
    expect(candidate.sourceStage.receipts.includes(models[0]!.source)).to.equal(true);
    expect(candidate.sourceStage.receipts.includes(models[1]!.source)).to.equal(true);
    const bytesA = h.sources.snapshot(models[0]!.source), bytesB = h.sources.snapshot(models[1]!.source);
    if (bytesA.kind !== 'bytes' || bytesB.kind !== 'bytes') throw new Error('Expected byte snapshots');
    expect([...bytesA.bytes]).to.deep.equal([1]); expect([...bytesB.bytes]).to.deep.equal([2]);
    candidate.dispose(); h.sources.dispose();
  });

  it('uses source receipts without publishing staged associations', () => {
    const h = sceneSourceHarness(); const model = sceneModel();
    const staged = stageMapSceneAdmission({ objects: [model] }, { request: h.request(), sources: h.sources });
    const firstId = staged.sourceStage.receipts[0]!.sourceId;
    staged.dispose(); staged.dispose();
    const next = stageMapSceneAdmission({ objects: [model] }, { request: h.next(), sources: h.sources });
    expect(next.sourceStage.receipts[0]!.sourceId).not.to.equal(firstId);
    expect(h.allocations).to.equal(2); expect(h.releases).to.equal(1);
    next.dispose(); h.sources.dispose(); expect(h.releases).to.equal(2);
  });
});
