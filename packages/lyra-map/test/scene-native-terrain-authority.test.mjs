import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNativeTerrainAuthority,
  captureNativeTerrainAuthority,
  withNativeTerrainHookScope
} from '../src/scene/native-terrain-authority.mjs';

const unavailable = { name: 'TypeError', message: 'Native terrain authority unavailable.' };

function status(result, expected) {
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Reflect.ownKeys(result).sort(), expected === 'admitted' ? ['authority', 'status'] : ['status']);
  assert.equal(Object.getOwnPropertyDescriptor(result, 'status').value, expected);
  if (expected !== 'admitted') return undefined;
  const authority = Object.getOwnPropertyDescriptor(result, 'authority').value;
  assert.equal(typeof authority, 'object');
  assert.notEqual(authority, null);
  assert.equal(Object.isFrozen(authority), true);
  assert.deepEqual(Reflect.ownKeys(authority), []);
  return authority;
}

function admitted(gl, hook) {
  const authority = status(captureNativeTerrainAuthority(gl, hook), 'admitted');
  assert.equal(assertNativeTerrainAuthority(authority, gl, hook), undefined);
  return authority;
}

function refused(authority, gl, hook) {
  assert.throws(() => assertNativeTerrainAuthority(authority, gl, hook), unavailable);
}

test('unissued external hooks are unqualified without gaining verifier authority', () => {
  const gl = {}, hook = () => {};
  status(captureNativeTerrainAuthority(gl, hook), 'unqualified');
  for (const fake of [undefined, null, false, 1, 'authority', {}, Object.freeze({})]) refused(fake, gl, hook);
  status(captureNativeTerrainAuthority(gl, hook), 'unqualified');
});

test('scope invokes once, returns the exact value and expires escaped authority synchronously', () => {
  const gl = {}, hook = () => {}, returned = Object.freeze({ value: 1 });
  let calls = 0, escaped;
  const result = withNativeTerrainHookScope(gl, hook, () => {
    calls++;
    escaped = admitted(gl, hook);
    assert.equal(admitted(gl, hook), escaped);
    return returned;
  });
  assert.equal(calls, 1);
  assert.equal(result, returned);
  refused(escaped, gl, hook);
  status(captureNativeTerrainAuthority(gl, hook), 'refused');
});

test('native callback exception is forwarded unchanged and still closes authority', () => {
  const gl = {}, hook = () => {}, thrown = Object.freeze({ nativeFailure: true });
  let calls = 0, escaped;
  assert.throws(() => withNativeTerrainHookScope(gl, hook, () => {
    calls++;
    escaped = admitted(gl, hook);
    throw thrown;
  }), error => error === thrown);
  assert.equal(calls, 1);
  refused(escaped, gl, hook);
  status(captureNativeTerrainAuthority(gl, hook), 'refused');
});

test('exact GL and hook identities fence capture and assertion without revoking a valid scope', () => {
  const gl = {}, otherGl = {}, hook = () => {}, otherHook = () => {};
  withNativeTerrainHookScope(gl, hook, () => {
    const authority = admitted(gl, hook);
    status(captureNativeTerrainAuthority(otherGl, hook), 'refused');
    status(captureNativeTerrainAuthority(gl, otherHook), 'refused');
    refused(authority, otherGl, hook);
    refused(authority, gl, otherHook);
    refused(Object.freeze({}), gl, hook);
    assert.equal(admitted(gl, hook), authority);
  });
});

test('opaque authority and frozen result cannot be forged by caller mutation or copying', () => {
  const gl = {}, hook = () => {};
  withNativeTerrainHookScope(gl, hook, () => {
    const result = captureNativeTerrainAuthority(gl, hook);
    const authority = status(result, 'admitted');
    assert.throws(() => { result.status = 'unqualified'; }, TypeError);
    assert.throws(() => { result.authority = {}; }, TypeError);
    assert.throws(() => { authority.active = true; }, TypeError);
    assert.throws(() => Object.setPrototypeOf(authority, { gl, hook }), TypeError);
    for (const fake of [{ ...authority }, Object.create(authority), { gl, hook, active: true }, result]) {
      refused(fake, gl, hook);
    }
    assert.equal(assertNativeTerrainAuthority(authority, gl, hook), undefined);
  });
});

test('later scope with the same identities issues a new token and never revives the old one', () => {
  const gl = {}, hook = () => {};
  const old = withNativeTerrainHookScope(gl, hook, () => admitted(gl, hook));
  const fresh = withNativeTerrainHookScope(gl, hook, () => {
    const authority = admitted(gl, hook);
    assert.notEqual(authority, old);
    refused(old, gl, hook);
    return authority;
  });
  refused(old, gl, hook);
  refused(fresh, gl, hook);
});

for (const sameHook of [false, true]) {
  test(`same-context callback reentry permanently revokes outer authority (${sameHook ? 'same' : 'different'} hook)`, () => {
    const gl = {}, outerHook = () => {}, innerHook = sameHook ? outerHook : () => {};
    let outer, inner;
    withNativeTerrainHookScope(gl, outerHook, () => {
      outer = admitted(gl, outerHook);
      withNativeTerrainHookScope(gl, innerHook, () => {
        inner = admitted(gl, innerHook);
        assert.notEqual(inner, outer);
        refused(outer, gl, outerHook);
        if (!sameHook) status(captureNativeTerrainAuthority(gl, outerHook), 'refused');
      });
      refused(inner, gl, innerHook);
      refused(outer, gl, outerHook);
      status(captureNativeTerrainAuthority(gl, outerHook), 'refused');
    });
    refused(outer, gl, outerHook);
    refused(inner, gl, innerHook);
  });
}

test('throwing nested callback does not restore optimization authority to the caught outer callback', () => {
  const gl = {}, outerHook = () => {}, innerHook = () => {}, failure = new Error('callback failure');
  let outer, inner;
  withNativeTerrainHookScope(gl, outerHook, () => {
    outer = admitted(gl, outerHook);
    assert.throws(() => withNativeTerrainHookScope(gl, innerHook, () => {
      inner = admitted(gl, innerHook);
      throw failure;
    }), error => error === failure);
    refused(inner, gl, innerHook);
    refused(outer, gl, outerHook);
    status(captureNativeTerrainAuthority(gl, outerHook), 'refused');
  });
  withNativeTerrainHookScope(gl, outerHook, () => {
    const fresh = admitted(gl, outerHook);
    assert.notEqual(fresh, outer);
  });
});

test('independent GL contexts maintain independent scopes even for the same hook', () => {
  const firstGl = {}, secondGl = {}, hook = () => {};
  let first, second;
  withNativeTerrainHookScope(firstGl, hook, () => {
    first = admitted(firstGl, hook);
    withNativeTerrainHookScope(secondGl, hook, () => {
      second = admitted(secondGl, hook);
      assert.notEqual(second, first);
      assert.equal(assertNativeTerrainAuthority(first, firstGl, hook), undefined);
      assert.equal(admitted(firstGl, hook), first);
      refused(first, secondGl, hook);
      refused(second, firstGl, hook);
    });
    refused(second, secondGl, hook);
    assert.equal(admitted(firstGl, hook), first);
  });
  refused(first, firstGl, hook);
});

test('returned thenable is not inspected and cannot extend synchronous scope lifetime', () => {
  const gl = {}, hook = () => {};
  let escaped, reads = 0;
  const thenable = Object.freeze({ get then() { reads++; throw new Error('must not inspect returned value'); } });
  const returned = withNativeTerrainHookScope(gl, hook, () => {
    escaped = admitted(gl, hook);
    return thenable;
  });
  assert.equal(returned, thenable);
  assert.equal(reads, 0);
  refused(escaped, gl, hook);
});

test('Promise continuation runs after scope expiry and cannot use an escaped token', async () => {
  const gl = {}, hook = () => {};
  let escaped;
  const pending = Promise.resolve().then(() => {
    refused(escaped, gl, hook);
    status(captureNativeTerrainAuthority(gl, hook), 'refused');
    return 'done';
  });
  const returned = withNativeTerrainHookScope(gl, hook, () => {
    escaped = admitted(gl, hook);
    return pending;
  });
  assert.equal(returned, pending);
  refused(escaped, gl, hook);
  assert.equal(await returned, 'done');
});

test('authority bookkeeping reads no GL or hook properties and never invokes the height hook', () => {
  let reads = 0, hookCalls = 0;
  const gl = new Proxy({}, { get() { reads++; throw new Error('unexpected GL property read'); } });
  const hook = new Proxy(() => { hookCalls++; throw new Error('unexpected height invocation'); }, {
    get() { reads++; throw new Error('unexpected hook property read'); }
  });
  status(captureNativeTerrainAuthority(gl, hook), 'unqualified');
  const authority = withNativeTerrainHookScope(gl, hook, () => admitted(gl, hook));
  refused(authority, gl, hook);
  status(captureNativeTerrainAuthority(gl, hook), 'refused');
  assert.equal(reads, 0);
  assert.equal(hookCalls, 0);
});

test('a callback without a terrain hook forwards normally without issuing authority', () => {
  const gl = {}, result = Object.freeze({ noTerrain: true });
  let calls = 0;
  status(captureNativeTerrainAuthority(gl, undefined), 'unqualified');
  const returned = withNativeTerrainHookScope(gl, undefined, () => {
    calls++;
    status(captureNativeTerrainAuthority(gl, undefined), 'unqualified');
    refused(Object.freeze({}), gl, undefined);
    return result;
  });
  assert.equal(calls, 1);
  assert.equal(returned, result);
  status(captureNativeTerrainAuthority(gl, undefined), 'unqualified');
});

test('same-context callback without terrain still permanently revokes outer optimization authority', () => {
  const gl = {}, hook = () => {};
  let outer, calls = 0;
  withNativeTerrainHookScope(gl, hook, () => {
    outer = admitted(gl, hook);
    const returned = withNativeTerrainHookScope(gl, undefined, () => {
      calls++;
      status(captureNativeTerrainAuthority(gl, undefined), 'unqualified');
      status(captureNativeTerrainAuthority(gl, hook), 'refused');
      refused(outer, gl, hook);
      return 'no terrain';
    });
    assert.equal(returned, 'no terrain');
    assert.equal(calls, 1);
    refused(outer, gl, hook);
    status(captureNativeTerrainAuthority(gl, hook), 'refused');
  });
  refused(outer, gl, hook);
});
