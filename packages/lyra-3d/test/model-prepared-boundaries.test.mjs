import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModel } from '../dist/model/model-parsers.js';
import { createPreparedObj } from '../dist/model/parsers/prepared-obj.js';
import { createPreparedPcd } from '../dist/model/parsers/prepared-pcd.js';
import { createPreparedPly } from '../dist/model/parsers/prepared-ply.js';
import { createPreparedStl } from '../dist/model/parsers/prepared-stl.js';
import { createPreparedXyz } from '../dist/model/parsers/prepared-xyz.js';
import { allocationServices, assertReferenceDescriptor, isolatedInput as isolatedBinary, pcdFixture, plyFixture } from './fixtures/model-prepared-binary.mjs';
import { assertParity, binaryStl, drain, encode, isolatedInput, services } from './fixtures/model-prepared-text.mjs';

/** Drains with one unit scarce and the others plentiful, so each decoder resumes at that unit's boundaries. */
function drainShaped(work, budget) {
  for (let steps = 0; steps < 1000000; steps++) {
    const step = work.step(budget);
    for (const key of Object.keys(budget)) assert.ok(step.used[key] <= budget[key], `${key} cap`);
    if (step.done) return step.value;
    assert.ok(step.used.bytes + step.used.scalars + step.used.records > 0, 'unfinished step makes progress');
  }
  assert.fail('bounded fixture completes');
}
const shapes = [{ bytes: 4096, scalars: 4096, records: 1 }, { bytes: 4096, scalars: 1, records: 4096 }, { bytes: 1, scalars: 4096, records: 4096 }];

test('prepared decoders refuse a plan prepared for another format', () => {
  const { prepared: obj } = isolatedInput(encode('v 0 0 0\n'), 'obj');
  const { prepared: xyz } = isolatedInput(encode('0 0 0\n'), 'xyz');
  const { prepared: stl } = isolatedInput(binaryStl(), 'stl');
  for (const [factory, prepared] of [[createPreparedObj, obj], [createPreparedXyz, xyz], [createPreparedStl, stl]]) {
    assert.throws(() => factory({ ...prepared, plan: { ...prepared.plan, format: 'ply' } }, services()), { name: 'ModelAdmissionError' });
    assert.throws(() => factory({ ...prepared, input: { ...prepared.input, format: 'ply' } }, services()), { name: 'ModelAdmissionError' });
  }
});

test('prepared OBJ skips comments and blank lines, accepts CRLF and keeps degenerate face normals finite', async () => {
  const text = '# exported\r\n\r\nv 0 0 0\r\n   # indented comment\r\nv 1 0 0\r\nv 2 0 0\r\nv 0 1 0\r\n\r\nf 1 2 3\r\nf 1 2 4\r\n';
  for (const quota of [1, 7, 65536]) await assertParity(encode(text), 'obj', createPreparedObj, quota);
  const { prepared } = isolatedInput(encode(text), 'obj');
  const normals = drain(createPreparedObj(prepared, services()), 65536).value.geometries[0].attributes.normal.array;
  assert.ok(Array.from(normals.slice(0, 9)).every(value => value === 0), 'a collinear face gets a zero normal, not NaN');
  assert.deepEqual(Array.from(normals.slice(9)), [0, 0, 1, 0, 0, 1, 0, 0, 1]);
});

test('prepared XYZ skips comments and blank lines and refuses a plan disagreeing with its rows', async () => {
  const text = '# header\n\n0 0 0\n# between\n1 2 3 255 0 0\n\n4 5 6\n';
  for (const quota of [1, 7, 65536]) await assertParity(encode(text), 'xyz', createPreparedXyz, quota);
  const { prepared } = isolatedInput(encode(text), 'xyz');
  const value = drain(createPreparedXyz(prepared, services()), 65536).value;
  assert.deepEqual(Array.from(value.geometries[0].attributes.position.array), [0, 0, 0, 1, 2, 3, 4, 5, 6]);
  for (const vertices of [2, 4]) {
    assert.throws(() => drain(createPreparedXyz({ ...prepared, counts: { ...prepared.counts, vertices } }, services()), 65536), { name: 'ModelAdmissionError' });
  }
});

test('prepared binary STL with a default color refuses facets whose attribute bytes are truncated', () => {
  for (const facets of [1, 3]) {
    const complete = binaryStl({ color: true, facets });
    const { prepared } = isolatedInput(complete, 'stl');
    const truncated = complete.subarray(0, complete.length - 1);
    const input = { ...prepared, input: { ...prepared.input, bytes: truncated } };
    assert.throws(() => drain(createPreparedStl(input, services()), 65536), { name: 'ModelAdmissionError' });
    assert.equal(drain(createPreparedStl(prepared, services()), 65536).value.geometries[0].attributes.position.count, facets * 3);
  }
});

test('prepared PLY and PCD resume at every unit boundary when one budget unit is scarce', async () => {
  const fixtures = [
    [createPreparedPly, plyFixture({ properties: [['float', 'x'], ['float', 'y'], ['float', 'z'], ['uchar', 'red'], ['uchar', 'green'], ['uchar', 'blue']], vertices: [[0, 0, 0, 1, 2, 3], [1, 0, 0, 4, 5, 6], [0, 1, 0, 7, 8, 9], [1, 1, 0, 10, 11, 12]], faces: [[0, 1, 2], [0, 1, 3, 2]] })],
    [createPreparedPly, plyFixture({ variant: 'binary-le', vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] })],
    [createPreparedPcd, pcdFixture({ fields: [['x', 'F'], ['y', 'F'], ['z', 'F'], ['normal_x', 'F'], ['normal_y', 'F'], ['normal_z', 'F']], points: [[0, 0, 0, 0, 0, 1], [1, 2, 3, 0, 1, 0], [4, 5, 6, 1, 0, 0]] })],
    [createPreparedPcd, pcdFixture({ variant: 'binary', points: [[0, 0, 0], [1, 2, 3]] })],
  ];
  for (const [factory, fixture] of fixtures) {
    const parsed = await parseModel(fixture.admission);
    try {
      const expected = drainShaped(factory(fixture.input, allocationServices().services), { bytes: 65536, scalars: 65536, records: 65536 });
      assertReferenceDescriptor(expected, parsed.object);
      for (const budget of shapes) assert.deepEqual(drainShaped(factory(fixture.input, allocationServices().services), budget), expected);
    } finally { parsed.dispose(); }
  }
});

test('prepared ASCII PCD reads a final value that is not newline terminated', async () => {
  const fixture = pcdFixture({ points: [[0, 0, 0], [1, 2, 3.5]] });
  const unterminated = fixture.input.input.bytes.subarray(0, fixture.input.input.bytes.length - 1);
  assert.equal(unterminated.at(-1), '5'.charCodeAt(0));
  const { admission, input } = isolatedBinary(unterminated, 'pcd', fixture.input.plan);
  const parsed = await parseModel(admission);
  try {
    const value = drainShaped(createPreparedPcd(input, allocationServices().services), { bytes: 1, scalars: 1, records: 1 });
    assertReferenceDescriptor(value, parsed.object);
    assert.deepEqual(Array.from(value.geometries[0].attributes.position.array), [0, 0, 0, 1, 2, 3.5]);
  } finally { parsed.dispose(); }
});
