import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNativeTerrainAuthority, captureNativeTerrainAuthority, withNativeTerrainHookScope }
  from '../src/scene/native-terrain-authority.mjs';

test('malformed terrain authority probes are refused without revoking the active native scope', () => {
  const gl = {}, hook = () => {};
  let authority;
  withNativeTerrainHookScope(gl, hook, () => {
    const admitted = captureNativeTerrainAuthority(gl, hook);
    assert.equal(admitted.status, 'admitted');
    authority = admitted.authority;
    for (const invalidGl of [null, undefined, false, 0, 'context', Symbol('context')]) {
      assert.deepEqual(captureNativeTerrainAuthority(invalidGl, hook), { status: 'refused' });
      assert.equal(assertNativeTerrainAuthority(authority, gl, hook), undefined);
    }
    for (const invalidHook of [null, false, 0, 'hook', {}, []]) {
      assert.deepEqual(captureNativeTerrainAuthority(gl, invalidHook), { status: 'refused' });
      assert.equal(assertNativeTerrainAuthority(authority, gl, hook), undefined);
    }
    assert.equal(captureNativeTerrainAuthority(gl, hook).authority, authority);
  });
  assert.throws(() => assertNativeTerrainAuthority(authority, gl, hook), {
    name: 'TypeError', message: 'Native terrain authority unavailable.',
  });
});
