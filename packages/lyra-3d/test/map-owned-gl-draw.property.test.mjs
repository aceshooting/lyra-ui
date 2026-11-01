import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createDrawFixture, prepareTriangle, retireFixture, uploadBuffer } from './map-owned-gl-draw-fixture.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };

function residency(f) {
  return { bytes: f.bytes, peakBytes: f.peakBytes, leases: [...f.leases.keys()],
    payloadReservations: f.callsOf('reservePayload').length, releases: f.callsOf('release').length };
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function withinBytes(start, length, capacity) {
  return nonnegativeInteger(start) && nonnegativeInteger(length) &&
    BigInt(start) + BigInt(length) <= BigInt(capacity);
}

function transferredBytes(args) {
  const source = args[2], start = args[3] ?? 0;
  const length = args[4] === undefined || args[4] === 0 ? source.length - start : args[4];
  return [...new Uint8Array(source.buffer, source.byteOffset + start * source.BYTES_PER_ELEMENT,
    length * source.BYTES_PER_ELEMENT)];
}

function assertForwarding(f, method, valid, operation) {
  const before = f.callsOf(method).length, accounted = residency(f);
  if (valid) assert.doesNotThrow(operation);
  else assert.throws(operation);
  assert.equal(f.callsOf(method).length, before + (valid ? 1 : 0));
  assert.deepEqual(residency(f), accounted);
}

test('subdata accepts exactly the source element slices and destination byte intervals that fit', () => {
  const input = fc.record({
    capacity: fc.integer({ min: 4, max: 128 }),
    sourceLength: fc.integer({ min: 1, max: 16 }),
    prefix: fc.integer({ min: 1, max: 4 }),
    floating: fc.boolean(), salt: fc.integer({ min: 0, max: 31 }),
    destination: fc.integer({ min: -2, max: 132 }),
    sourceOffset: fc.integer({ min: -2, max: 18 }),
    length: fc.integer({ min: -2, max: 18 }),
    arity: fc.integer({ min: 3, max: 5 }),
  });
  fc.assert(fc.property(input, row => {
    const f = createDrawFixture();
    try {
      f.owner.run(f.entry, gl => {
        uploadBuffer(gl, gl.ARRAY_BUFFER, row.capacity);
        const Type = row.floating ? Float32Array : Uint32Array;
        const backing = new Type(row.prefix + row.sourceLength + 3);
        for (let index = 0; index < backing.length; index++) backing[index] = row.salt + index + 1;
        const source = new Type(backing.buffer, row.prefix * Type.BYTES_PER_ELEMENT, row.sourceLength);
        const start = row.arity >= 4 ? row.sourceOffset : 0;
        const length = row.arity < 5 || row.length === 0 ? row.sourceLength - start : row.length;
        const validSource = withinBytes(start, length, row.sourceLength);
        const valid = validSource && withinBytes(row.destination, length * Type.BYTES_PER_ELEMENT, row.capacity);
        const args = [gl.ARRAY_BUFFER, row.destination, source];
        if (row.arity >= 4) args.push(row.sourceOffset);
        if (row.arity === 5) args.push(row.length);
        assertForwarding(f, 'bufferSubData', valid, () => gl.bufferSubData(...args));
        if (valid) {
          const forwarded = f.callsOf('bufferSubData').at(-1).args;
          assert.equal(forwarded[0], gl.ARRAY_BUFFER);
          assert.equal(forwarded[1], row.destination);
          const expected = [...new Uint8Array(source.buffer, source.byteOffset + start * Type.BYTES_PER_ELEMENT,
            length * Type.BYTES_PER_ELEMENT)];
          assert.deepEqual(transferredBytes(forwarded), expected);
        }
      });
    } finally { retireFixture(f); }
  }), runs);
});

test('indexed draws accept exactly aligned index byte intervals within element storage', () => {
  const input = fc.record({
    capacity: fc.integer({ min: 4, max: 128 }),
    width: fc.constantFrom(1, 2, 4),
    count: fc.integer({ min: -2, max: 48 }),
    offset: fc.integer({ min: -2, max: 132 }),
  });
  fc.assert(fc.property(input, row => {
    const f = createDrawFixture();
    try {
      f.owner.run(f.entry, gl => {
        prepareTriangle(gl, f.entry);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, row.capacity, gl.STATIC_DRAW);
        const type = row.width === 4 ? gl.UNSIGNED_INT : row.width === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE;
        const valid = nonnegativeInteger(row.count) && nonnegativeInteger(row.offset) &&
          BigInt(row.offset) % BigInt(row.width) === 0n &&
          BigInt(row.offset) + BigInt(row.count) * BigInt(row.width) <= BigInt(row.capacity);
        assertForwarding(f, 'drawElements', valid, () => gl.drawElements(gl.TRIANGLES, row.count, type, row.offset));
        if (valid) assert.deepEqual(f.callsOf('drawElements').at(-1).args, [gl.TRIANGLES, row.count, type, row.offset]);
      });
    } finally { retireFixture(f); }
  }), runs);
});

test('Float32 attribute declarations accept exactly aligned slots and complete first rows', () => {
  const input = fc.record({
    floats: fc.integer({ min: 16, max: 64 }),
    slot: fc.integer({ min: -2, max: 18 }),
    offset: fc.integer({ min: -4, max: 268 }),
    stride: fc.oneof(fc.constant(0), fc.integer({ min: -4, max: 28 })),
  });
  fc.assert(fc.property(input, row => {
    const f = createDrawFixture();
    try {
      f.owner.run(f.entry, gl => {
        const prepared = prepareTriangle(gl, f.entry);
        gl.bindBuffer(gl.ARRAY_BUFFER, prepared.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(row.floats), gl.STATIC_DRAW);
        const slots = Array.from({ length: 16 }, (_unused, index) => index);
        const offsets = Array.from({ length: row.floats - 2 }, (_unused, index) => index * 4);
        const strides = [0, 12, 16, 20, 24, 28];
        const valid = slots.includes(row.slot) && offsets.includes(row.offset) && strides.includes(row.stride);
        assertForwarding(f, 'vertexAttribPointer', valid,
          () => gl.vertexAttribPointer(row.slot, 3, gl.FLOAT, false, row.stride, row.offset));
        if (valid) assert.deepEqual(f.callsOf('vertexAttribPointer').at(-1).args,
          [row.slot, 3, gl.FLOAT, false, row.stride, row.offset]);
      });
    } finally { retireFixture(f); }
  }), runs);
});

test('unsafe and extreme transfer or draw offsets and counts never reach the native driver', () => {
  const input = fc.record({
    operation: fc.constantFrom('subdata-destination', 'subdata-source', 'subdata-length',
      'elements-count', 'elements-offset', 'attribute-offset', 'attribute-stride'),
    value: fc.oneof(fc.constantFrom(NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_VALUE,
      Number.MAX_SAFE_INTEGER + 1), fc.integer({ min: 0, max: 32 }).map(value => Number.MAX_SAFE_INTEGER - value)),
  });
  fc.assert(fc.property(input, row => {
    const f = createDrawFixture();
    try {
      f.owner.run(f.entry, gl => {
        const prepared = prepareTriangle(gl, f.entry);
        gl.bindBuffer(gl.ARRAY_BUFFER, prepared.vertices);
        const source = new Float32Array([1, 2, 3]);
        let method, operation;
        if (row.operation === 'subdata-destination') {
          method = 'bufferSubData'; operation = () => gl.bufferSubData(gl.ARRAY_BUFFER, row.value, source);
        } else if (row.operation === 'subdata-source') {
          method = 'bufferSubData'; operation = () => gl.bufferSubData(gl.ARRAY_BUFFER, 0, source, row.value, 1);
        } else if (row.operation === 'subdata-length') {
          method = 'bufferSubData'; operation = () => gl.bufferSubData(gl.ARRAY_BUFFER, 0, source, 0, row.value);
        } else if (row.operation === 'elements-count') {
          method = 'drawElements'; operation = () => gl.drawElements(gl.TRIANGLES, row.value, gl.UNSIGNED_INT, 0);
        } else if (row.operation === 'elements-offset') {
          method = 'drawElements'; operation = () => gl.drawElements(gl.TRIANGLES, 1, gl.UNSIGNED_INT, row.value);
        } else if (row.operation === 'attribute-offset') {
          method = 'vertexAttribPointer'; operation = () => gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, row.value);
        } else {
          method = 'vertexAttribPointer'; operation = () => gl.vertexAttribPointer(0, 3, gl.FLOAT, false, row.value, 0);
        }
        assertForwarding(f, method, false, operation);
      });
    } finally { retireFixture(f); }
  }), runs);
});
