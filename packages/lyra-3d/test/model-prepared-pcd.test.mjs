import assert from 'node:assert/strict';
import test from 'node:test';
import { ColorManagement } from 'three';
import { parseModel } from '../dist/model/model-parsers.js';
import { createPreparedPcd } from '../dist/model/parsers/prepared-pcd.js';
import { pcdFixture, allocationServices, drainBounded, assertReferenceDescriptor } from './fixtures/model-prepared-binary.mjs';

const packedFloat = bits => { const view = new DataView(new ArrayBuffer(4)); view.setUint32(0, bits, true); return view.getFloat32(0, true); };
for (const variant of ['ascii', 'binary']) for (const rgbType of ['F', 'U']) {
  test(`prepared PCD ${variant}/${rgbType} preserves packed colors, normal order and ignored viewpoint`, async () => {
    const colors = [0x008040fe, 0x00ff0102];
    const fixture = pcdFixture({ variant, fields: [['normal_z', 'F'], ['rgb', rgbType], ['y', 'F'], ['normal_x', 'F'], ['z', 'F'], ['x', 'F'], ['normal_y', 'F']], points: [[1, variant === 'ascii' && rgbType === 'F' ? packedFloat(colors[0]) : colors[0], 0.125, 0, -0, 1.123456789, 0], [1, variant === 'ascii' && rgbType === 'F' ? packedFloat(colors[1]) : colors[1], 2, 0, 3, 4, 0]], count: false, width: 1, height: 2 });
    const parsed = await parseModel(fixture.admission);
    try {
      for (const quota of [1, 2, 7, 4096]) {
        const { services, requests } = allocationServices(); const work = createPreparedPcd(fixture.input, services);
        assert.equal(requests.length, 0); const { value } = drainBounded(work, quota); assertReferenceDescriptor(value, parsed.object);
        assert.deepEqual(value.geometries[0].attributes.color.colorConversion, { space: 'srgb', scale: 255, output: 'f32' });
        assert.equal(value.materials[0].size, 0.005); assert.equal(value.materials[0].sizeAttenuation, true);
        assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
      }
    } finally { parsed.dispose(); }
  });
}

test('prepared PCD binary preserves raw NaN RGB bits without interpreting them as a coordinate', async () => {
  const fixture = pcdFixture({ variant: 'binary', fields: [['x', 'F'], ['y', 'F'], ['z', 'F'], ['rgb', 'F']], points: [[0, 0, 0, 0xffc08040]] });
  const parsed = await parseModel(fixture.admission);
  try { assertReferenceDescriptor(drainBounded(createPreparedPcd(fixture.input, allocationServices().services), 1).value, parsed.object); }
  finally { parsed.dispose(); }
});

test('prepared PCD materialization preserves the active color configuration and uncolored points', async () => {
  const original = ColorManagement.enabled;
  try {
    for (const enabled of [true, false]) for (const colored of [true, false]) {
      ColorManagement.enabled = enabled;
      const fixture = colored ? pcdFixture({ fields: [['x', 'F'], ['y', 'F'], ['z', 'F'], ['rgb', 'U']], points: [[0, 0, 0, 0x00804020]] }) : pcdFixture();
      const parsed = await parseModel(fixture.admission);
      try { assertReferenceDescriptor(drainBounded(createPreparedPcd(fixture.input, allocationServices().services), 7).value, parsed.object); }
      finally { parsed.dispose(); }
    }
  } finally { ColorManagement.enabled = original; }
});

test('prepared PCD disposal invalidates partial work and empty output retains the existing validation refusal', async () => {
  const fixture = pcdFixture();
  for (const cutoff of [0, 1, 3, 5, 10]) {
    const work = createPreparedPcd(fixture.input, allocationServices().services);
    for (let i = 0; i < cutoff; i++) assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
    work.dispose(); work.dispose(); assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  }
  const empty = pcdFixture({ points: [] });
  await assert.rejects(parseModel(empty.admission), /admission/i);
  assert.deepEqual(drainBounded(createPreparedPcd(empty.input, allocationServices().services), 1).value.geometries[0].attributes, {});
  assert.throws(() => createPreparedPcd({ ...fixture.input, plan: { format: 'xyz', rows: 1 } }, allocationServices().services), /admission/i);
});
