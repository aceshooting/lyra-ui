/** Counts needed before allocating the bounded custom portion of a mixed spatial presentation. */
export interface GraphNodeMeshStorageInput {
  readonly nodeCount: number;
  readonly customNodeCount: number;
  readonly triangleCount: number;
  readonly ordinaryPrimitiveCount: number;
  readonly sortKeyBytesBefore: number;
  readonly sortKeyBytesAfter: number;
  readonly scratchBytes: number;
}

/** Byte-addressable storage accounting; excludes ordinary scene storage and nonportable metadata. */
export interface GraphNodeMeshStorage {
  readonly payloadBytes: number;
  readonly cpuBytes: number;
  readonly gpuBytes: number;
  readonly accountedBytes: number;
  readonly primitiveCount: number;
}

const FIELDS = ['nodeCount', 'customNodeCount', 'triangleCount', 'ordinaryPrimitiveCount', 'sortKeyBytesBefore', 'sortKeyBytesAfter', 'scratchBytes'] as const;
const CPU_LIMIT = 32 * 1024 * 1024;
const GPU_LIMIT = 16 * 1024 * 1024;

/**
 * Preflights five-vec4 custom payloads without widening ordinary primitives. GPU bytes are
 * separate from their CPU backing. Shared custom-pick CPU staging is charged only once.
 * The caller separately accounts for the complete old and detached candidate ordinary scenes.
 */
export function graphNodeMeshStorage(input: GraphNodeMeshStorageInput): GraphNodeMeshStorage {
  const invalid = (): never => { throw new RangeError('Invalid graph node mesh storage'); };
  const budget = (): never => {
    const error = Object.assign(new RangeError('Graph node mesh storage budget exceeded'), { reason: 'budget' as const });
    throw error;
  };
  const values: number[] = [];
  try {
    if (!input || typeof input !== 'object' || Reflect.ownKeys(input).length !== FIELDS.length) return invalid();
    for (const field of FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, field);
      if (!descriptor || !('value' in descriptor)) return invalid();
      const value: unknown = descriptor.value;
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid();
      values.push(value);
    }
  } catch { return invalid(); }
  const [nodes, custom, faces, ordinary, keysBefore, keysAfter, scratch] = values as [number, number, number, number, number, number, number];
  const primitiveCount = ordinary + faces;
  if (custom > nodes || (custom === 0) !== (faces === 0) || faces < custom || faces > custom * 64 || keysBefore % 8 !== 0 || keysAfter % 8 !== 0 ||
    keysBefore > ordinary * 8 || keysAfter > primitiveCount * 8) return invalid();
  if (nodes > 200_000 || custom > 16_384 || faces > 65_536 || ordinary > 2_000_000 || primitiveCount > 2_000_000) return budget();
  if (custom === 0) {
    if (scratch !== 0 || keysAfter > keysBefore) return invalid();
    return Object.freeze({ payloadBytes: 0, cpuBytes: 0, gpuBytes: 0, accountedBytes: 0, primitiveCount });
  }
  const payloadBytes = 48 * faces + 16 * custom;
  // Two admitted copies, output CPU backing, unsorted/pick staging, anchors, mappings,
  // node range offsets, suppression mask and two retained row-slot accounting allowances.
  const cpuBytes = payloadBytes * 2 + faces * 180 + Math.max(0, keysAfter - keysBefore) + (nodes + 1) * 4 + nodes * 17 + scratch;
  const gpuBytes = faces * 160;
  const accountedBytes = cpuBytes + gpuBytes;
  if (![payloadBytes, cpuBytes, gpuBytes, accountedBytes].every(Number.isSafeInteger) || payloadBytes > 4_194_304 ||
    cpuBytes > CPU_LIMIT || gpuBytes > GPU_LIMIT || accountedBytes > CPU_LIMIT + GPU_LIMIT) {
    return budget();
  }
  return Object.freeze({ payloadBytes, cpuBytes, gpuBytes, accountedBytes, primitiveCount });
}
