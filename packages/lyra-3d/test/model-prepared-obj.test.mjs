import assert from 'node:assert/strict';
import test from 'node:test';
import { ColorManagement, SRGBColorSpace } from 'three';
import { admitModel } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { createPreparedObj } from '../dist/model/parsers/prepared-obj.js';
import { assertParity, drain, encode, isolatedInput, services } from './fixtures/model-prepared-text.mjs';
const vertices = 'v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\n';
const cases = {
  fan: vertices + 'f -4 -3 -2 -1\n',
  normals: vertices + 'vn 0 0 -1\nvt 0 0\nvt 1 0\nvt 1 1\nf 1/1/1 2/2/1 3/3/1\n',
  groups: vertices + 'o first\ns off\nf 1 2 3\ng second\ns on\nf 1 3 4\n',
  cachedPrimitiveKinds: vertices + 'o mesh\nf 1 2 3\no points\np 1 2 3\n',
  pointFlatShading: vertices + 's off\np 1 2 3\n',
  lineFlatShading: vertices + 's off\nl 1 2 3 4\n',
  points: vertices + 'p 1 3\n',
  lines: vertices + 'l 1 2 3 4\n',
  linesWithUv: vertices + 'vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nl 1/1 2/2 3/3 4/4\n',
  linesWithMixedUv: vertices + 'vt 0 0\nvt 1 1\nl 1/1 2 3/2\n',
  coloredCloud: 'v 0 0 0 .5 .2 1\nv 1 0 0 1 0 .1\nv 0 1 0 .1 1 .2\n',
  cloud: vertices,
  colored: 'v 0 0 0 .5 .2 1\nv 1 0 0 1 0 .1\nv 0 1 0 .1 1 .2\nf 1 2 3\n',
  smoothWhitespace: vertices + 's\toff\nf 1 2 3\n',
  cloudFirstUncolored: 'v 0 0 0\nv 1 0 0 .5 .2 .1\n',
  obliqueNormal: 'v .01234567 .72345678 -.33456789\nv .94567891 -.05678912 .16789123\nv -.27891234 .38912345 .49123456\nf 1 2 3\n',
  emptyDeclarations: vertices + 'o first\ng second\n',
  empty: '',
};
for (const [name, text] of Object.entries(cases)) test(`sliced OBJ ${name} retains native geometry and material`, async () => {
  for (const quota of [1, 2, 7, 65536]) await assertParity(encode(text), 'obj', createPreparedObj, quota);
});
test('OBJ work has independent cursors and disposal cannot publish partial geometry', () => {
  const { prepared } = isolatedInput(encode(cases.fan), 'obj');
  const left = createPreparedObj(prepared, services()); const right = createPreparedObj(prepared, services());
  assert.equal(left.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
  left.dispose(); left.dispose(); assert.throws(() => drain(left, 1), /active/);
  assert.equal(drain(right, 2).value.nodes.length, 2);
});

test('OBJ partial authored colors retain the loader mismatch for independent validation', async () => {
  const bytes = encode('v 0 0 0 .5 .2 1\nv 1 0 0\nv 0 1 0 .1 1 .2\nf 1 2 3\n');
  const { admission, prepared } = isolatedInput(bytes, 'obj');
  await assert.rejects(parseModel(admission), { name: 'ModelAdmissionError' });
  const output = drain(createPreparedObj(prepared, services()), 1).value;
  assert.equal(output.geometries[0].attributes.position.count, 3);
  assert.equal(output.geometries[0].attributes.color.count, 2);
});

test('OBJ raw color transport retains main-realm color settings', async () => {
  const enabled = ColorManagement.enabled; const working = ColorManagement.workingColorSpace;
  try {
    ColorManagement.enabled = false;
    await assertParity(encode(cases.colored), 'obj', createPreparedObj, 7);
    ColorManagement.enabled = true; ColorManagement.workingColorSpace = SRGBColorSpace;
    await assertParity(encode(cases.colored), 'obj', createPreparedObj, 7);
  } finally { ColorManagement.enabled = enabled; ColorManagement.workingColorSpace = working; }
});

test('OBJ empty line UV segments are refused by admission before decoder creation', () => {
  const prefix = vertices + 'vt 0 0\nvt 1 1\n';
  for (const line of ['l 1/ 2/2\n', 'l 1/1 2/\n']) {
    assert.throws(() => admitModel(encode(prefix + line), 'obj'), { name: 'ModelAdmissionError', code: 'invalid' });
  }
});
