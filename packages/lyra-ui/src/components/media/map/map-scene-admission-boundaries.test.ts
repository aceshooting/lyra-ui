import { expect } from '@open-wc/testing';
import { sceneMarker, sceneModel, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';

for (const field of ['src', 'bytes', 'format'] as const) {
  it(`rejects conflicting ${field} metadata for a shared source before allocating either model`, () => {
    const h = sceneSourceHarness();
    const original = field === 'src' ? { format: 'glb', src: 'first.glb' } : { format: 'glb', bytes: new Uint8Array([1, 2]) };
    const replacement = field === 'src' ? 'second.glb' : field === 'bytes' ? new Uint8Array([3, 4]) : 'gltf';
    let reads = 0;
    const source = new Proxy(original, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key === field && ++reads > 1) return { ...descriptor, value: replacement };
        return descriptor;
      },
    });
    try {
      const objects = [{ ...sceneModel('first'), source }, { ...sceneModel('second'), source }];
      expect(() => stageMapSceneAdmission({ objects }, { request: h.request(), sources: h.sources })).to.throw(TypeError, 'Invalid map scene descriptor');
      expect(reads).to.equal(2);
      expect(h.allocations).to.equal(0); expect(h.resolutions).to.equal(0); expect(h.liveBytes).to.equal(0);
      const valid = stageMapSceneAdmission({ objects: [{ ...sceneModel(), source: original }] }, { request: h.request(), sources: h.sources });
      expect(valid.objects.length).to.equal(1); expect(valid.sourceStage.receipts.length).to.equal(1);
      valid.dispose(); expect(h.liveBytes).to.equal(0);
    } finally { h.sources.dispose(); }
  });
}

it('rejects a path whose counted positions change while another source is inspected', () => {
  const h = sceneSourceHarness(), path = scenePath();
  let changed = false;
  const source = new Proxy(sceneModel().source, {
    getOwnPropertyDescriptor(target, key) {
      if (!changed) { changed = true; path.positions.push({ lngLat: [20, 0] }); }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  try {
    expect(() => stageMapSceneAdmission({ objects: [path, { ...sceneModel(), source }] }, { request: h.request(), sources: h.sources })).to.throw(TypeError, 'Invalid map scene descriptor');
    expect(changed).to.equal(true); expect(path.positions.length).to.equal(3);
    expect(h.allocations).to.equal(0); expect(h.resolutions).to.equal(0); expect(h.liveBytes).to.equal(0);
    const valid = stageMapSceneAdmission({ objects: [path] }, { request: h.request(), sources: h.sources });
    const admitted = valid.objects[0]!;
    expect(admitted.kind).to.equal('path');
    if (admitted.kind !== 'path') throw new Error('Expected the stable path to be admitted');
    expect(admitted.positions.length).to.equal(3);
    valid.dispose();
  } finally { h.sources.dispose(); }
});

it('rejects unsafe scene colors before allocating a leading model and accepts a subsequent safe color', () => {
  const h = sceneSourceHarness();
  try {
    for (const color of ['url(https://example.invalid/paint)', 'red; background: blue', 'expression(alert(1))']) {
      expect(() => stageMapSceneAdmission({ objects: [sceneModel(), { ...sceneMarker(), color }] }, { request: h.request(), sources: h.sources })).to.throw(TypeError, 'Invalid map scene descriptor');
      expect(h.allocations).to.equal(0); expect(h.resolutions).to.equal(0); expect(h.liveBytes).to.equal(0);
    }
    const valid = stageMapSceneAdmission({ objects: [sceneModel(), { ...sceneMarker(), color: 'rgb(12, 34, 56)' }] }, { request: h.request(), sources: h.sources });
    expect(valid.objects[1]?.color).to.equal('rgb(12, 34, 56)');
    expect(h.liveBytes).to.equal(3);
    valid.dispose(); expect(h.liveBytes).to.equal(0);
  } finally { h.sources.dispose(); }
});
