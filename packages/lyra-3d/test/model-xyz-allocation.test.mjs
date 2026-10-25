import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, SRGBColorSpace } from 'three';
import { admitModel } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';

const bytes = value => new TextEncoder().encode(value);
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

async function observe(source, count) {
  const admission = admitModel(bytes(source), 'xyz');
  const nativeFloat32 = globalThis.Float32Array;
  const floatDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Float32Array');
  const rgbDescriptor = Object.getOwnPropertyDescriptor(Color.prototype, 'setRGB');
  const calls = []; let conversions = 0; let result;
  Object.defineProperty(globalThis, 'Float32Array', { ...floatDescriptor, value: new Proxy(nativeFloat32, {
    construct(target, args) {
      const input = args[0];
      if ((typeof input === 'number' ? input : input?.length) === count * 3) calls.push(typeof input === 'number' ? 'length' : Array.isArray(input) ? 'number-array' : 'other');
      return Reflect.construct(target, args, target);
    },
  }) });
  Object.defineProperty(Color.prototype, 'setRGB', { ...rgbDescriptor, value(r, g, b, space) {
    if (space === SRGBColorSpace) conversions++;
    return rgbDescriptor.value.call(this, r, g, b, space);
  } });
  try { result = await parseModel(admission); }
  finally {
    Object.defineProperty(globalThis, 'Float32Array', floatDescriptor);
    Object.defineProperty(Color.prototype, 'setRGB', rgbDescriptor);
  }
  return { result, calls, conversions };
}

test('XYZ allocates typed positions directly and converts only authored colors', async () => {
  const count = 13;
  for (const colored of [[], [0], [6], [12], Array.from({ length: count }, (_, i) => i)]) {
    const selected = new Set(colored);
    const source = Array.from({ length: count }, (_, i) => `${i} ${i / 10} ${-i}${selected.has(i) ? ' 128 255 0' : ''}`).join('\n');
    const { result, calls, conversions } = await observe(source, count);
    try {
      assert.equal(conversions, colored.length, 'no conversion for unauthored white colors');
      assert.deepEqual(calls, colored.length ? ['length', 'length'] : ['length'], 'no number-array position/color staging');
      assert.equal(result.object.material.vertexColors, colored.length > 0);
      const geometry = result.object.geometry;
      assert.deepEqual(Array.from(geometry.getAttribute('position').array), Array.from(new Float32Array(Array.from({ length: count }, (_, i) => [i, i / 10, i === 0 ? 0 : -i]).flat())));
      if (colored.length) assert.deepEqual(Array.from(geometry.getAttribute('color').array), Array.from(new Float32Array(Array.from({ length: count }, (_, i) => selected.has(i) ? [linear(128 / 255), 1, 0] : [1, 1, 1]).flat())));
      else assert.equal(geometry.hasAttribute('color'), false);
      assert.deepEqual(result.bounds.min.toArray(), [0, 0, -12]);
      assert.deepEqual(result.bounds.max.toArray(), [12, Math.fround(1.2), 0]);
    } finally { result.dispose(); }
  }
});

test('XYZ retains empty, singleton, CRLF, comments, blank rows and final unterminated row output', async () => {
  for (const source of ['', '# no points\r\n\r\n', ' \t1.23456789 -2e-3 0\r\n', '1 2 3 10 11 254', '# start\r\n\r\n 1.23456789 -2e-3 0\r\n# middle\n2 3 4 0 128 255']) {
    const result = await parseModel(admitModel(bytes(source), 'xyz'));
    try {
      const rows = source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => line.split(/\s+/).map(Number));
      const colored = rows.some(row => row.length === 6);
      assert.deepEqual(Array.from(result.object.geometry.getAttribute('position').array), Array.from(new Float32Array(rows.flatMap(row => row.slice(0, 3)))));
      assert.equal(result.object.material.vertexColors, colored);
      assert.equal(result.object.geometry.hasAttribute('color'), colored);
      if (colored) assert.deepEqual(Array.from(result.object.geometry.getAttribute('color').array), Array.from(new Float32Array(rows.flatMap(row => row.length === 6 ? row.slice(3).map(value => linear(value / 255)) : [1, 1, 1]))));
      assert.equal(result.vertices, rows.length);
      assert.equal(result.indices, 0);
      if (!rows.length) assert.equal(result.bounds, null);
    } finally { result.dispose(); }
  }
});
