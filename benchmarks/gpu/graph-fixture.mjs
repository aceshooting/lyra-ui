// Deterministic graph data for the WebGL benchmarks. The browser fixture and the Node tests import
// this module, so the measured scene and the tested scene are the same bytes for a given seed.

/** The seed every recorded graph profile uses; changing it makes older results incomparable. */
export const GRAPH_FIXTURE_SEED = 7;
/** World radius of the node ball, matched to the fixture camera distance. */
export const GRAPH_FIXTURE_RADIUS = 600;

/** A 32-bit mulberry-style generator: uniform values in [0, 1), identical on every engine. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniformly distributed positions inside a ball, as three Float32 columns. */
export function ball(count, radius, next) {
  const x = new Float32Array(count), y = new Float32Array(count), z = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const u = next() * 2 - 1, theta = next() * Math.PI * 2, distance = radius * Math.cbrt(next()), ring = Math.sqrt(1 - u * u);
    x[index] = distance * ring * Math.cos(theta);
    y[index] = distance * ring * Math.sin(theta);
    z[index] = distance * u;
  }
  return { x, y, z };
}

/**
 * A seeded graph: positions in a ball and `edges` index pairs. Sources cycle through every node, so
 * each node has at least one edge once `edges >= nodes`; targets are random and never the source.
 */
export function graphFixture({ nodes, edges, seed = GRAPH_FIXTURE_SEED, radius = GRAPH_FIXTURE_RADIUS }) {
  if (!Number.isSafeInteger(nodes) || nodes < 2) throw new RangeError('nodes must be an integer of at least 2');
  if (!Number.isSafeInteger(edges) || edges < 0) throw new RangeError('edges must be a non-negative integer');
  const next = seededRandom(seed);
  const { x, y, z } = ball(nodes, radius, next);
  const source = new Uint32Array(edges), target = new Uint32Array(edges);
  for (let index = 0; index < edges; index += 1) {
    source[index] = index % nodes;
    target[index] = (source[index] + 1 + Math.floor(next() * (nodes - 1))) % nodes;
  }
  return { nodes, edges, x, y, z, source, target };
}

/** FNV-1a over the column bytes: a compact fingerprint recorded with each result. */
export function graphFixtureDigest({ x, y, z, source, target }) {
  let hash = 0x811c9dc5;
  for (const column of [x, y, z, source, target]) {
    const bytes = new Uint8Array(column.buffer, column.byteOffset, column.byteLength);
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
