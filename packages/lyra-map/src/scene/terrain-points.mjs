const fail = () => { throw new TypeError('Invalid terrain point request.'); };
let identity = 0;
const typedPrototype = Object.getPrototypeOf(Float32Array.prototype);
const typedGet = name => Object.getOwnPropertyDescriptor(typedPrototype, name).get;
const getBuffer = typedGet('buffer'), getLength = typedGet('length'), getOffset = typedGet('byteOffset');
const getBytes = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const getResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function data(value, key) {
  if (!value || typeof value !== 'object') fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}
function array(value, limit) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  const length = data(value, 'length');
  if (!Number.isSafeInteger(length) || length > limit || Reflect.ownKeys(value).length !== length + 1) fail();
  const result = [];
  for (let index = 0; index < length; index++) result.push(data(value, String(index)));
  return result;
}
function fixedView(value, Type, length, owned = false) {
  if (Object.getPrototypeOf(value) !== Type.prototype || getLength.call(value) !== length) fail();
  const buffer = getBuffer.call(value);
  if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || getResizable?.call(buffer)) fail();
  if (owned && (getOffset.call(value) !== 0 || getBytes.call(buffer) !== length * Type.BYTES_PER_ELEMENT || Reflect.ownKeys(value).length !== length)) fail();
  return buffer;
}

/** Shares exact selected-world terrain samples within one externally owned sampling generation. */
export function createTerrainPointQueue({ reserve, allocateFloat64 = n => new Float64Array(n), allocateFloat32 = n => new Float32Array(n) } = {}) {
  if (typeof reserve !== 'function' || typeof allocateFloat64 !== 'function' || typeof allocateFloat32 !== 'function') fail();
  const prefix = `terrain-points-${++identity}`;
  let disposed = false, stamp, revision = 0, mutation = 0, serial = 0, batch = null;
  const owners = new Map(), points = new Map(), leases = new Set(), backings = new WeakSet();
  const release = lease => { if (leases.delete(lease)) lease.release(); };
  function retire(owner) {
    if (!owner.live) return;
    owner.live = false;
    for (const point of owner.points) {
      point.references--;
      if (point.references === 0) points.delete(point.key);
    }
    const retiredLeases = owner.leases; owner.leases = []; owner.storage = null;
    let failure;
    for (const lease of retiredLeases) { try { release(lease); } catch (error) { failure ??= error; } }
    if (failure) throw new Error('Terrain cleanup unavailable.');
  }
  function allocate(length, Type, factory, current) {
    const lease = reserve([{ kind: 'bytes', key: `${prefix}-${++serial}`, pool: 'cpu-buffer', byteLength: length * Type.BYTES_PER_ELEMENT }]);
    if (!lease || typeof lease.release !== 'function') fail();
    leases.add(lease);
    if (!current()) { release(lease); throw new Error('Terrain admission retired.'); }
    let storage;
    try {
      storage = factory(length);
      const backing = fixedView(storage, Type, length, true);
      if (backings.has(backing)) fail();
      backings.add(backing);
      if (!current()) throw new Error('Terrain admission retired.');
    } catch (error) { release(lease); throw error; }
    return { lease, storage };
  }
  function valid() { if (disposed || !stamp) throw new Error('Terrain queue unavailable.'); }
  const api = {
    setStamp(value) {
      if (!value || typeof value !== 'object') fail();
      if (disposed || value === stamp) return;
      stamp = value; revision++; batch = null;
      for (const point of points.values()) { point.state = 'queued'; point.height = null; }
    },
    request(ownerID, samples) {
      valid();
      const admitted = array(samples, 65536).map(sample => {
        const coordinate = array(data(sample, 'coordinate'), 2), offset = data(sample, 'offsetMeters');
        if (coordinate.length !== 2 || !coordinate.every(Number.isFinite) || coordinate[1] < 0 || coordinate[1] > 1 || !Number.isFinite(offset)) fail();
        const x = coordinate[0] === 0 ? 0 : coordinate[0], y = coordinate[1] === 0 ? 0 : coordinate[1];
        return { x, y, offset, key: `${x},${y}` };
      });
      const unique = new Set(admitted.map(sample => sample.key));
      const previous = owners.get(ownerID);
      const previousCounts = new Map();
      for (const point of previous?.points ?? []) previousCounts.set(point, (previousCounts.get(point) ?? 0) + 1);
      const retained = new Set([...points.values()].filter(point => point.references > (previousCounts.get(point) ?? 0)).map(point => point.key));
      if (new Set([...retained, ...unique]).size > 65536) fail();
      const generation = revision, admission = mutation, previousOwner = previous;
      const current = () => !disposed && revision === generation && mutation === admission && owners.get(ownerID) === previousOwner;
      const allocations = [];
      try {
        if (admitted.length) {
          allocations.push(allocate(admitted.length * 3, Float64Array, allocateFloat64, current));
          allocations.push(allocate(admitted.length, Float32Array, allocateFloat32, current));
        }
        if (!current()) throw new Error('Terrain admission retired.');
      } catch (error) {
        for (const allocation of allocations) { try { release(allocation.lease); } catch { /* Continue retiring admitted storage. */ } }
        throw error;
      }
      const record = { live: true, points: [], leases: allocations.map(item => item.lease), storage: allocations.map(item => item.storage) };
        // Preserve shared cached identities while replacing this owner's references.
        for (const item of admitted) {
          let point = points.get(item.key);
          if (!point) { point = { key: item.key, coordinate: Object.freeze([item.x, item.y]), references: 0, state: 'queued', height: null }; points.set(item.key, point); }
          const index = record.points.length;
          if (record.storage[0]) {
            record.storage[0][index * 3] = item.x; record.storage[0][index * 3 + 1] = item.y; record.storage[0][index * 3 + 2] = item.offset;
          }
          point.references++; record.points.push(point);
        }
        mutation++; owners.set(ownerID, record);
      const handle = Object.freeze({
          resolve() {
            if (disposed || !record.live || record.points.some(point => point.state !== 'resolved')) return { status: 'terrain-pending' };
            const altitudes = record.points.map((point, index) => {
              record.storage[1][index] = point.height;
              return record.storage[1][index] + record.storage[0][index * 3 + 2];
            });
            if (!altitudes.every(Number.isFinite)) return { status: 'terrain-pending' };
            return { status: 'resolved', altitudes };
          },
          release() { if (record.live) mutation++; if (owners.get(ownerID) === record) owners.delete(ownerID); retire(record); }
      });
      // Committed storage cannot enter precommit rollback when predecessor cleanup reports failure.
      if (previous) retire(previous);
      return handle;
    },
    beginBatch() {
      if (disposed || batch) return null;
      const selected = [...points.values()].filter(point => point.state === 'queued').slice(0, 8);
      if (!selected.length) return null;
      const token = Object.freeze({});
      batch = { token, revision, selected };
      return Object.freeze({ token, points: Object.freeze(selected.map(point => point.coordinate)) });
    },
    complete(token, value) {
      if (disposed || !batch || token !== batch.token || batch.revision !== revision) return false;
      const current = batch, rgba = data(value, 'rgba'), count = data(value, 'count');
      if (!Number.isInteger(count) || count < 1 || count > current.selected.length) fail();
      fixedView(rgba, Float32Array, count * 4);
      if (disposed || batch !== current || token !== current.token || current.revision !== revision) return false;
      for (let index = 0; index < count; index++) {
        const coverage = rgba[index * 4 + 3];
        if ((coverage !== 0 && coverage !== 1) || (coverage === 1 && !Number.isFinite(rgba[index * 4]))) fail();
      }
      for (let index = 0; index < count; index++) {
        const point = current.selected[index];
        point.state = rgba[index * 4 + 3] === 1 ? 'resolved' : 'blocked'; point.height = rgba[index * 4];
      }
      batch = null; return true;
    },
    cancelBatch(token) { if (batch?.token === token) batch = null; },
    dispose() {
      if (disposed) return;
      disposed = true; revision++; batch = null;
      const retired = [...owners.values()]; owners.clear();
      let failure;
      for (const record of retired) { try { retire(record); } catch (error) { failure ??= error; } }
      points.clear();
      for (const lease of [...leases]) { try { release(lease); } catch (error) { failure ??= error; } }
      if (failure) throw new Error('Terrain cleanup unavailable.');
    }
  };
  return Object.freeze(api);
}
