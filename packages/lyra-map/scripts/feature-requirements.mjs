/** Copies feature-family metadata without inspecting source or layer payloads. */
export function snapshotFeatureRequirements(requirements) {
  const fail = () => { throw new TypeError('Invalid map feature requirements.'); };
  const object = value => value !== null && typeof value === 'object';
  const plain = value => {
    if (!object(value) || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  };
  // Metadata-only traversal is bounded even when a Proxy fabricates its prototype chain.
  const prototypeDepthLimit = 64;
  const field = (value, name, ownEnumerable = false) => {
    const seen = new Set();
    let depth = 0;
    for (let current = value; current !== null; current = Object.getPrototypeOf(current)) {
      if (seen.has(current) || depth++ >= prototypeDepthLimit) fail();
      seen.add(current);
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (ownEnumerable && !descriptor.enumerable) return undefined;
        if (!Object.hasOwn(descriptor, 'value')) fail();
        return descriptor;
      }
      if (ownEnumerable) break;
    }
    return undefined;
  };
  const define = (target, key, value) => Object.defineProperty(target, key, {
    value, enumerable: true, configurable: true, writable: true
  });
  const metadata = (value, keys) => {
    if (!object(value) || Array.isArray(value)) fail();
    const ownEnumerable = plain(value), result = {};
    for (const key of keys) {
      const entry = field(value, key, ownEnumerable);
      if (!entry) continue;
      if (entry.value !== undefined && typeof entry.value !== 'string') fail();
      define(result, key, entry.value);
    }
    return result;
  };
  const top = requirements == null ? {} : Object(requirements);
  const readTop = key => field(top, key, true);
  const sourceEntry = readTop('sources'), layerEntry = readTop('layers');
  const projectionEntry = readTop('projection'), terrainEntry = readTop('terrain');
  const sources = sourceEntry ? sourceEntry.value : {};
  const layers = layerEntry ? layerEntry.value : [];
  const state = { version: 8, sources, layers };
  // Explicit null/undefined retain existing later preparation/refusal semantics.
  if (sources != null) {
    if (!object(sources) || Array.isArray(sources)) fail();
    state.sources = {};
    for (const key of Reflect.ownKeys(sources)) {
      if (typeof key !== 'string') continue;
      const entry = field(sources, key, true);
      if (entry) define(state.sources, key, metadata(entry.value, ['type']));
    }
  }
  if (layers != null) {
    if (!Array.isArray(layers)) fail();
    const length = field(layers, 'length').value;
    state.layers = new Array(length);
    for (let index = 0; index < length; index++) {
      const entry = field(layers, String(index));
      if (entry) state.layers[index] = metadata(entry.value, ['id', 'ref', 'type']);
    }
  }
  if (projectionEntry) state.projection = projectionEntry.value == null
    ? projectionEntry.value : metadata(projectionEntry.value, ['type']);
  if (terrainEntry) state.terrain = Boolean(terrainEntry.value);
  return state;
}
