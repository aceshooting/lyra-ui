const pools = ['cpu-buffer', 'worker-buffer', 'gpu-buffer', 'gpu-texture'];
const byteFields = ['kind', 'key', 'pool', 'byteLength'];
const textureFields = ['kind', 'key', 'pool', 'width', 'height', 'layers', 'faces', 'bytesPerPixel', 'mipLevels'];
const fail = () => { throw new TypeError('Invalid scene allocation.'); };

function own(value, key) {
  if (value === null || typeof value !== 'object') fail();
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (!field || !Object.hasOwn(field, 'value')) fail();
  return field.value;
}

function record(value, fields) {
  if (value === null || typeof value !== 'object') fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail();
  return Object.fromEntries(fields.map(key => [key, own(value, key)]));
}

function integer(value, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail();
  return value;
}
function add(a, b) {
  if (b > Number.MAX_SAFE_INTEGER - a) fail();
  return a + b;
}
function multiply(a, b) {
  if (a !== 0 && b > Math.floor(Number.MAX_SAFE_INTEGER / a)) fail();
  return a * b;
}
function ceiling(options) { return integer(record(options, ['bytes']).bytes); }

function allocation(value) {
  const kind = own(value, 'kind');
  const data = record(value, kind === 'bytes' ? byteFields : kind === 'texture' ? textureFields : fail());
  if (typeof data.key !== 'string' || !data.key.trim() || data.key.length > 1024) fail();
  let bytes;
  if (kind === 'bytes') {
    if (!pools.slice(0, 3).includes(data.pool)) fail();
    bytes = integer(data.byteLength);
  } else {
    if (data.pool !== 'gpu-texture') fail();
    let width = integer(data.width, true), height = integer(data.height, true);
    integer(data.layers, true); integer(data.mipLevels, true);
    if (![1, 6].includes(data.faces) || ![1, 2, 4, 8, 16].includes(data.bytesPerPixel)) fail();
    let availableLevels = 1;
    for (let dimension = Math.max(width, height); dimension > 1; dimension = Math.floor(dimension / 2)) availableLevels++;
    if (data.mipLevels > availableLevels) fail();
    let pixels = 0;
    for (let level = 0; level < data.mipLevels; level++) {
      pixels = add(pixels, multiply(width, height));
      width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));
    }
    bytes = multiply(multiply(multiply(pixels, data.layers), data.faces), data.bytesPerPixel);
  }
  return Object.freeze({ ...data, bytes });
}

function sameShape(a, b) {
  const fields = a.kind === 'bytes' ? byteFields : textureFields;
  return a.kind === b.kind && fields.every(key => a[key] === b[key]);
}

function declarations(resources) {
  if (!Array.isArray(resources)) fail();
  const length = own(resources, 'length');
  if (!Number.isSafeInteger(length) || length < 0 || length > 100000) fail();
  const result = new Map();
  for (let index = 0; index < length; index++) {
    const data = allocation(own(resources, String(index)));
    const prior = result.get(data.key);
    if (prior && !sameShape(prior, data)) fail();
    result.set(data.key, data);
  }
  return result;
}

function summarize(entries, cap) {
  const totals = Object.fromEntries(pools.map(pool => [pool, 0]));
  let knownBytes = 0;
  const allocations = [];
  const ordered = [...entries.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  for (const entry of ordered) {
    knownBytes = add(knownBytes, entry.bytes);
    if (knownBytes > cap) fail();
    totals[entry.pool] = add(totals[entry.pool], entry.bytes);
    allocations.push(Object.freeze({ key: entry.key, pool: entry.pool, bytes: entry.bytes }));
  }
  return Object.freeze({ knownBytes, pools: Object.freeze(totals), allocations: Object.freeze(allocations) });
}

/** Plans the conservative live union of declared payload storage, excluding native image/driver overhead. */
export function planSceneAllocations(resources, options) {
  const cap = ceiling(options);
  return summarize(declarations(resources), cap);
}

/** Reserves declared identities until their actual owner releases them; no future release is assumed. */
export function createSceneResourceLedger(options) {
  const cap = ceiling(options);
  const live = new Map();
  const references = new Map();
  let current = summarize(live, cap);
  return Object.freeze({
    get usage() {
      return Object.freeze({ knownBytes: current.knownBytes, pools: Object.freeze({ ...current.pools }) });
    },
    reserve(resources) {
      const requested = declarations(resources);
      const candidate = new Map(live);
      for (const [key, data] of requested) {
        const previous = candidate.get(key);
        if (previous && !sameShape(previous, data)) fail();
        candidate.set(key, data);
      }
      if (candidate.size > 100000) fail();
      const nextReferences = new Map([...requested.keys()].map(key => [key, add(references.get(key) ?? 0, 1)]));
      // Validate the complete installed/candidate/scratch union before changing any live reference.
      const next = summarize(candidate, cap);
      for (const [key, data] of requested) {
        live.set(key, data);
        references.set(key, nextReferences.get(key));
      }
      current = next;
      let released = false;
      return Object.freeze({ release() {
        if (released) return;
        released = true;
        for (const key of requested.keys()) {
          const count = references.get(key);
          if (count === 1) { references.delete(key); live.delete(key); }
          else references.set(key, count - 1);
        }
        current = summarize(live, cap);
      } });
    }
  });
}
