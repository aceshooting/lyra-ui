import assert from 'node:assert/strict';
import { BufferGeometry, Material, Texture } from 'three';

function patch(target, key, descriptor, action) {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, descriptor);
  try { return action(); } finally { if (previous) Object.defineProperty(target, key, previous); else delete target[key]; }
}
function patchMethod(prototype, key, wrap, action) {
  return patch(prototype, key, { configurable: true, writable: true, value: wrap(prototype[key]) }, action);
}

/**
 * Runs `construct` with every Float32Array allocation the engine source makes failing in turn
 * (allocations inside three's own constructors are left alone: a half-built three object is never
 * returned to the engine and holds nothing to release). Each failure must
 * reach the caller as the original error, and every geometry, material and texture the partial
 * construction acquired must be disposed exactly once. Returns the number of failure points.
 */
export function sweepConstructionFailures(construct, dispose) {
  const Original = Float32Array, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Float32Array');
  const counting = limit => {
    let calls = 0;
    const value = new Proxy(Original, { construct(target, args, newTarget) {
      const caller = new Error().stack.split('\n')[2] ?? '';
      if (!caller.includes('/node_modules/') && ++calls === limit) throw new Error(`allocation ${limit} failed`);
      return Reflect.construct(target, args, newTarget);
    } });
    return { value, calls: () => calls };
  };
  const control = counting(0);
  dispose(patch(globalThis, 'Float32Array', { ...descriptor, value: control.value }, construct));
  const total = control.calls();
  assert.ok(total > 0, 'construction allocates float storage');
  for (let limit = 1; limit <= total; limit++) {
    const acquired = new Set(), released = new Map();
    const capture = original => function (...args) { acquired.add(this); return Reflect.apply(original, this, args); };
    const release = original => function (...args) { released.set(this, (released.get(this) ?? 0) + 1); return Reflect.apply(original, this, args); };
    const failing = counting(limit), textureUpdate = Object.getOwnPropertyDescriptor(Texture.prototype, 'needsUpdate');
    patchMethod(BufferGeometry.prototype, 'setAttribute', capture, () => patchMethod(Material.prototype, 'setValues', capture,
      () => patchMethod(BufferGeometry.prototype, 'dispose', release, () => patchMethod(Material.prototype, 'dispose', release,
        () => patchMethod(Texture.prototype, 'dispose', release, () => patch(Texture.prototype, 'needsUpdate', { ...textureUpdate,
          set(value) { acquired.add(this); textureUpdate.set.call(this, value); } },
        () => patch(globalThis, 'Float32Array', { ...descriptor, value: failing.value },
          () => assert.throws(construct, { message: `allocation ${limit} failed` }))))))));
    for (const resource of acquired) assert.equal(released.get(resource), 1, `failure ${limit} releases every acquired resource (${resource.type})`);
    for (const count of released.values()) assert.equal(count, 1, `failure ${limit} releases each resource once`);
  }
  return total;
}
