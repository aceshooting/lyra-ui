import assert from 'node:assert/strict';
import test from 'node:test';
import { Lyra3dXrError } from '../dist/xr/types.js';

test('XR errors expose a closed reason and fixed nonempty message', () => {
  for (const code of ['unavailable', 'not-allowed', 'busy', 'unsupported-scene', 'context-lost', 'failed', 'aborted']) {
    const error = new Lyra3dXrError(code);
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'Lyra3dXrError'); assert.equal(error.code, code);
    assert.equal(error.message, new Lyra3dXrError(code).message);
    assert.ok(error.message.length > 0); assert.equal(error.cause, undefined);
  }
  assert.throws(() => new Lyra3dXrError('arbitrary platform detail'), TypeError);
});
