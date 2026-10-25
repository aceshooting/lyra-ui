import assert from 'node:assert/strict';
import test from 'node:test';
import { ColorManagement } from 'three';
import { parseModel } from '../dist/model/model-parsers.js';
import { createPreparedPly } from '../dist/model/parsers/prepared-ply.js';
import { plyFixture, isolatedInput, allocationServices, drainBounded, assertReferenceDescriptor } from './fixtures/model-prepared-binary.mjs';

const richProperties = [['double', 'x'], ['float', 'y'], ['short', 'z'], ['char', 'nx'], ['float', 'ny'], ['double', 'nz'], ['float', 'u'], ['float', 'v'], ['uchar', 'red'], ['uchar', 'green'], ['uchar', 'blue'], ['uchar', 'alpha']];
const richVertices = [[0.123456789, 0, 0, 0, 0, 1, 0.25, 0.75, 128, 64, 1, 0], [1, 0, 0, 0, 0, 1, 1, 0, 255, 254, 0, 255], [0, 1, 0, 0, 0, 1, 0, 1, 1, 2, 3, 128], [1, 1, 0, 0, 0, 1, 1, 1, 127, 129, 200, 255]];

for (const variant of ['ascii', 'binary-le', 'binary-be']) {
  test(`prepared PLY ${variant} retains rich typed attributes, quad diagonal and material`, async () => {
    const fixture = plyFixture({ variant, properties: richProperties, vertices: richVertices, faces: [[0, 1, 2], [0, 1, 3, 2]], faceName: 'vertex_index', countType: 'short', indexType: 'uint' });
    const parsed = await parseModel(fixture.admission);
    try {
      for (const quota of [1, 2, 7, 4096]) {
        const { services, requests } = allocationServices(); const work = createPreparedPly(fixture.input, services);
        assert.equal(requests.length, 0, 'factory does not allocate final storage');
        const { value, steps } = drainBounded(work, quota); assertReferenceDescriptor(value, parsed.object);
        if (quota <= 7) assert.ok(steps > 1); assert.deepEqual([...value.geometries[0].index], [0, 1, 2, 0, 1, 2, 1, 3, 2]);
        assert.equal(value.geometries[0].attributes.position.array.constructor, Float64Array);
        assert.deepEqual(value.geometries[0].attributes.color.colorConversion, { space: 'srgb', scale: 255, output: 'u8-normalized' });
        assert.ok(requests.length >= 5); assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
      }
    } finally { parsed.dispose(); }
  });
}

test('prepared PLY preserves every admitted position scalar kind and partial optional attributes', async () => {
  for (const type of ['char', 'uchar', 'short', 'ushort', 'int', 'uint', 'float', 'double', 'int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'float32', 'float64']) {
    const fixture = plyFixture({ variant: 'binary-be', properties: [[type, 'x'], ['double', 'y'], ['double', 'z'], ['float', 'nx'], ['uchar', 'red'], ['float', 's']], vertices: [[1, 2.125, 3.75, 1, 128, 0.5]] });
    const parsed = await parseModel(fixture.admission);
    try { assertReferenceDescriptor(drainBounded(createPreparedPly(fixture.input, allocationServices().services), 1).value, parsed.object); }
    finally { parsed.dispose(); }
  }
});

test('prepared PLY UV aliases prefer s/t and colors use the current materialization color configuration', async () => {
  const fixture = plyFixture({ properties: [['float', 'x'], ['float', 'y'], ['float', 'z'], ['short', 'u'], ['double', 'v'], ['double', 's'], ['float', 't'], ['uchar', 'red'], ['uchar', 'green'], ['uchar', 'blue']], vertices: [[0, 0, 0, 3, 4, 0.25, 0.5, 128, 64, 254]], newline: '\r\n' });
  const original = ColorManagement.enabled;
  try {
    for (const enabled of [true, false]) {
      ColorManagement.enabled = enabled; const parsed = await parseModel(fixture.admission);
      try { assertReferenceDescriptor(drainBounded(createPreparedPly(fixture.input, allocationServices().services), 2).value, parsed.object); }
      finally { parsed.dispose(); }
    }
  } finally { ColorManagement.enabled = original; }
});

test('prepared PLY preserves empty position attributes and cancellation at intermediate states', async () => {
  const empty = plyFixture({ vertices: [] }); const parsed = await parseModel(empty.admission);
  try { assertReferenceDescriptor(drainBounded(createPreparedPly(empty.input, allocationServices().services), 1).value, parsed.object); }
  finally { parsed.dispose(); }
  const fixture = plyFixture({ properties: richProperties, vertices: richVertices, faces: [[0, 1, 3, 2]] });
  for (const cutoff of [0, 1, 3, 10, 30, 60]) {
    const work = createPreparedPly(fixture.input, allocationServices().services);
    for (let i = 0; i < cutoff; i++) assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
    work.dispose(); work.dispose(); assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  }
  assert.throws(() => createPreparedPly({ ...fixture.input, plan: { format: 'xyz', rows: 1 } }, allocationServices().services), /admission/i);
});

test('prepared PLY selects Uint32 at the native maximum-index boundary', async () => {
  for (const maximum of [65534, 65535]) {
    const fixture = plyFixture({ variant: 'binary-le', vertices: Array.from({ length: maximum + 1 }, () => [0, 0, 0]), faces: [[0, 1, maximum]] });
    const parsed = await parseModel(fixture.admission);
    try { assertReferenceDescriptor(drainBounded(createPreparedPly(fixture.input, allocationServices().services), 65536).value, parsed.object); }
    finally { parsed.dispose(); }
  }
});


test('prepared PLY completes final float and index tokens without trailing whitespace across bounded chunks', async () => {
  const point = plyFixture({ properties: [['double', 'x'], ['double', 'y'], ['double', 'z']], vertices: [[1.25, -2.5, 3.125]] });
  const mesh = plyFixture({ faces: [[0, 1, 2]] });
  const split = plyFixture({ vertices: [[0, 1, 0.002]] });
  const prefix = split.input.input.bytes.subarray(0, split.input.plan.dataOffset);
  const body = new TextEncoder().encode(`0 ${' '.repeat(4093)}\u00a01 2e-3`);
  const chunked = new Uint8Array(prefix.length + body.length); chunked.set(prefix); chunked.set(body, prefix.length);
  const cases = [
    { name: 'final-float', bytes: point.input.input.bytes.slice(0, -1), plan: point.input.plan },
    { name: 'final-index', bytes: mesh.input.input.bytes.slice(0, -1), plan: mesh.input.plan },
    { name: 'split-multibyte-space-and-final-exponent', bytes: chunked, plan: split.input.plan },
  ];
  assert.equal(body[4095], 0xc2); assert.equal(body[4096], 0xa0);
  for (const scenario of cases) {
    assert.equal(/\s/.test(String.fromCharCode(scenario.bytes.at(-1))), false, scenario.name);
    const fixture = isolatedInput(scenario.bytes, 'ply', scenario.plan);
    const parsed = await parseModel(fixture.admission);
    try {
      for (const quota of [1, 2, 7, 4095, 4096]) {
        const work = createPreparedPly(fixture.input, allocationServices().services);
        const { value } = drainBounded(work, quota);
        assertReferenceDescriptor(value, parsed.object);
        assert.throws(() => work.step({ bytes: quota, scalars: quota, records: quota }), /no longer active/);
        work.dispose(); work.dispose();
        assert.throws(() => work.step({ bytes: quota, scalars: quota, records: quota }), /no longer active/);
      }
    } finally { parsed.dispose(); }
  }
});
