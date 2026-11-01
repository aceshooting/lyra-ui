import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelDescriptorValidation } from '../dist/model/model-descriptor-validation.js';
import { decodePreparedModel } from '../dist/model/model-preparation-kernel.js';
import { runModelWork } from '../dist/model/model-work-runner.js';
import { utf8, triangleJson } from './model-fixtures.mjs';

async function fixture() {
  const admitted = await runModelWork(createModelAdmissionWork({ format: 'gltf', bytes: utf8(JSON.stringify(triangleJson())) }));
  const descriptor = await decodePreparedModel(admitted);
  return { admitted, descriptor };
}

async function observingParents(work) {
  const Native = globalThis.Int32Array, events = [];
  globalThis.Int32Array = new Proxy(Native, { construct(target, args) {
    events.push({ type: 'allocate', length: args[0] }); return Reflect.construct(target, args, target);
  } });
  try { await work(events); } finally { globalThis.Int32Array = Native; }
}

test('validation reserves the exact parent table before allocation and retires scratch on success', async () => {
  const { admitted, descriptor } = await fixture();
  await observingParents(async events => {
    const retainedBytes = admitted.input.bytes.byteLength; let liveBytes = retainedBytes, releases = 0;
    const scratch = { reserve(byteLength) {
      events.push({ type: 'reserve', byteLength }); liveBytes += byteLength;
      assert.equal(liveBytes, retainedBytes + descriptor.nodes.length * 4);
      return { release() { releases++; liveBytes -= byteLength; } };
    } };
    await runModelWork(createModelDescriptorValidation(descriptor, admitted, scratch));
    assert.deepEqual(events, [{ type: 'reserve', byteLength: descriptor.nodes.length * 4 },
      { type: 'allocate', length: descriptor.nodes.length }]);
    assert.equal(releases, 1); assert.equal(liveBytes, retainedBytes);
  });
});

test('scratch refusal prevents constructing the parent array', async () => {
  const { admitted, descriptor } = await fixture();
  await observingParents(async events => {
    const refused = new RangeError('Scratch limit');
    await assert.rejects(runModelWork(createModelDescriptorValidation(descriptor, admitted, {
      reserve() { events.push({ type: 'reserve' }); throw refused; }
    })), error => error === refused);
    assert.deepEqual(events, [{ type: 'reserve' }]);
  });
});

test('invalid node graph releases allocated validation scratch on failure', async () => {
  const { admitted, descriptor } = await fixture(); let active = 0, releases = 0;
  descriptor.nodes[0].children.push(0);
  await assert.rejects(runModelWork(createModelDescriptorValidation(descriptor, admitted, {
    reserve(byteLength) { active += byteLength; return { release() { active -= byteLength; releases++; } }; }
  })));
  assert.equal(releases, 1); assert.equal(active, 0);
});

test('abort during sliced validation releases scratch and preserves retained allocation ownership', async () => {
  const { admitted, descriptor } = await fixture();
  let active = admitted.input.bytes.byteLength, releases = 0;
  const retained = active;
  const work = createModelDescriptorValidation(descriptor, admitted, {
    reserve(byteLength) { active += byteLength; return { release() { active -= byteLength; releases++; } }; }
  });
  // Advance a bounded unit at a time until the parent table is live, then cancel cooperative work.
  for (let step = 0; active === retained && step < 10000; step++) {
    const state = work.step({ bytes: 1, scalars: 1, records: 1 });
    assert.equal(state.done, false, 'fixture must reach a live scratch interval');
  }
  assert.equal(active, retained + descriptor.nodes.length * 4);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runModelWork(work, controller.signal), { name: 'AbortError' });
  assert.equal(releases, 1); assert.equal(active, retained);
});
