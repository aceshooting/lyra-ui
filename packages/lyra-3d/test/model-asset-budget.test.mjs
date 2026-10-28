import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareModelAsset } from '../dist/model/model-asset.js';
import { utf8, triangleJson } from './model-fixtures.mjs';

function budget(rejectPurpose) {
  const events = [], live = new Map(); let serial = 0;
  return { events, live,
    reserve(request) {
      events.push({ type: 'reserve', ...request });
      if (request.purpose === rejectPurpose) throw new RangeError('Reservation refused');
      const key = `allocation-${serial++}`; live.set(key, request.byteLength); let released = false;
      return { key, release() { if (!released) { released = true; assert.ok(live.delete(key)); } } };
    },
    admitCounts(counts) { events.push({ type: 'counts', ...counts }); },
    noteNativeImage() { assert.fail('Untextured fixture has no image'); }
  };
}

test('input ownership is copied once after encoded reservation and before yielding', async () => {
  const input = utf8('1 2 3\n4 5 6\n'), original = [...input], ledger = budget();
  const pending = prepareModelAsset({ format: 'xyz', bytes: input }, { execution: 'local', budget: ledger });
  assert.equal(ledger.events[0].purpose, 'encoded');
  assert.equal(ledger.events[0].byteLength, input.byteLength);
  input.fill(0);
  const asset = await pending;
  assert.equal(asset.storage.filter(row => row.purpose === 'encoded').length, 1);
  assert.equal(asset.storage.find(row => row.purpose === 'encoded').byteLength, original.length);
  assert.ok(ledger.events.findIndex(row => row.type === 'counts') < ledger.events.findIndex(row => row.purpose === 'attribute'));
  assert.ok(Object.isFrozen(asset.storage) && asset.storage.every(Object.isFrozen));
  asset.dispose(); asset.dispose(); assert.equal(ledger.live.size, 0);
});

test('refused encoded or decoder storage leaves no retained candidate allocation', async () => {
  for (const purpose of ['encoded', 'attribute']) {
    const ledger = budget(purpose);
    await assert.rejects(prepareModelAsset({ format: 'xyz', bytes: utf8('1 2 3\n') }, { execution: 'local', budget: ledger }));
    assert.equal(ledger.live.size, 0);
  }
});

test('embedded data URI storage is charged during admission before final counts', async () => {
  const ledger = budget(), source = utf8(JSON.stringify(triangleJson()));
  const asset = await prepareModelAsset({ format: 'gltf', bytes: source }, { execution: 'local', budget: ledger });
  const embedded = ledger.events.findIndex(row => row.purpose === 'embedded');
  assert.ok(embedded >= 0 && embedded < ledger.events.findIndex(row => row.type === 'counts'));
  assert.ok(asset.storage.some(row => row.purpose === 'embedded'));
  asset.dispose(); assert.equal(ledger.live.size, 0);
});
