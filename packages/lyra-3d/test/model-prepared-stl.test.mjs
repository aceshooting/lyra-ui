import assert from 'node:assert/strict';
import test from 'node:test';
import { ColorManagement, SRGBColorSpace } from 'three';
import { parseModel } from '../dist/model/model-parsers.js';
import { createPreparedStl } from '../dist/model/parsers/prepared-stl.js';
import { assertParity, asciiStlWithBinaryProbe, binaryStl, drain, encode, isolatedInput, services } from './fixtures/model-prepared-text.mjs';
const solid = name => `solid ${name}\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid ${name}\n`;
for (const [name, bytes] of [['ascii', encode(solid('first') + solid('second'))], ['binary', binaryStl()], ['magics', binaryStl({ color: true })], ['unnamed', encode(solid(''))], ['empty-padded', encode(`solid ${'name'.repeat(20)}\nendsolid ${'name'.repeat(20)}\n`)]]) {
  test(`sliced STL ${name} retains native geometry and material`, async () => {
    for (const quota of [1, 2, 7, 65536]) await assertParity(bytes, 'stl', createPreparedStl, quota);
  });
}
test('STL work yields before completion and disposal releases unpublished work', () => {
  const { prepared } = isolatedInput(binaryStl({ facets: 40 }), 'stl');
  const work = createPreparedStl(prepared, services());
  assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
  work.dispose(); work.dispose(); assert.throws(() => drain(work, 1), /active/);
});

test('STL raw color transport retains main-realm color settings', async () => {
  const enabled = ColorManagement.enabled; const working = ColorManagement.workingColorSpace;
  try {
    ColorManagement.enabled = false;
    await assertParity(binaryStl({ color: true }), 'stl', createPreparedStl, 7);
    ColorManagement.enabled = true; ColorManagement.workingColorSpace = SRGBColorSpace;
    await assertParity(binaryStl({ color: true }), 'stl', createPreparedStl, 7);
  } finally { ColorManagement.enabled = enabled; ColorManagement.workingColorSpace = working; }
});

test('STL preserves native short-ASCII probe refusal after successful admission', async () => {
  for (const bytes of [encode('solid empty\nendsolid empty\n'), encode('solid a\nendsolid a\n')]) {
    const { admission, prepared } = isolatedInput(bytes, 'stl');
    assert.equal(admission.vertices, 0);
    await assert.rejects(parseModel(admission), { name: 'ModelAdmissionError', code: 'invalid' });
    for (const quota of [1, 2, 7, 65536]) {
      const work = createPreparedStl(prepared, services());
      assert.throws(() => drain(work, quota), { name: 'ModelAdmissionError', code: 'invalid' });
      assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
    }
  }
});

test('STL preserves the bounded native binary route for an admitted ASCII prefix beyond byte four', async () => {
  const bytes = asciiStlWithBinaryProbe(0);
  assert.equal(isolatedInput(bytes, 'stl').prepared.plan.variant, 'ascii');
  for (const quota of [1, 2, 7, 65536]) await assertParity(bytes, 'stl', createPreparedStl, quota);
});

test('STL rejects native binary output beyond admitted counts before allocating', async () => {
  const bounded = asciiStlWithBinaryProbe(1);
  const { admission } = isolatedInput(bounded, 'stl');
  await assert.rejects(parseModel(admission), { name: 'ModelAdmissionError', code: 'invalid' });
  for (const facets of [1, 0x20202020]) {
    const { prepared } = isolatedInput(asciiStlWithBinaryProbe(facets), 'stl');
    const allocator = services();
    assert.throws(() => drain(createPreparedStl(prepared, allocator), 1), { name: 'ModelAdmissionError', code: 'invalid' });
    assert.equal(allocator.allocations.length, 0);
  }
});

test('STL bare solid headers preserve native multiline group-name capture', async () => {
  const bare = solid('').replace('solid \n', 'solid\n');
  const cases = [
    { text: bare, names: ['facet normal 0 0 1'] },
    { text: bare.replace('solid\n', 'solid\n\n'), names: [''] },
    { text: 'solid\nendsolid\n' + solid('following'), names: ['endsolid', 'following'] },
  ];
  for (const { text, names } of cases) for (const quota of [1, 2, 7, 65536]) {
    const result = await assertParity(encode(text), 'stl', createPreparedStl, quota);
    assert.deepEqual(result.geometries[0].groupNames, names);
  }
});
