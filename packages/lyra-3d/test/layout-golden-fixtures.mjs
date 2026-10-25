/** Exact typed inputs; no captured outputs are invented by this fixture generator. */
export function layoutGoldenFixtures() {
  const base = (id, count = 24, extra = {}) => ({ id, data: {
    nodeCount: count, source: Uint32Array.from({ length: count * 3 }, (_, i) => i % count),
    target: Uint32Array.from({ length: count * 3 }, (_, i) => (i * 7 + 3) % count),
    options: { seed: 71, maxSteps: 8, stableSteps: 1000, cooling: 0.98, minAlpha: 0, ...extra.options },
    ...extra,
  } });
  const fixtures = [base('seeded'), base('exact-charge', 24, { options: { seed: 9, theta: 0, maxSteps: 8, stableSteps: 1000, cooling: 0.98, minAlpha: 0 } }),
    base('coincident', 24, { positions: new Float32Array(72), pinned: new Uint8Array(24) }),
    base('deep-cluster', 24, { positions: Float32Array.from({ length: 72 }, (_, i) => 2 ** -(i % 24)), pinned: new Uint8Array(24) }),
    base('all-pinned', 24, { positions: Float32Array.from({ length: 72 }, (_, i) => i / 3) }),
    base('mixed-pins', 24, { positions: Float32Array.from({ length: 72 }, (_, i) => (i % 11) - 5), pinned: Uint8Array.from({ length: 24 }, (_, i) => i % 2) }),
    base('empty', 0),
    base('stable', 1, { positions: new Float32Array(3), pinned: new Uint8Array(1), source: new Uint32Array(), target: new Uint32Array(), options: { stableSteps: 2, maxSteps: 8 } }),
  ];
  return fixtures;
}

export const goldenPin = count => ({ indices: count ? new Uint32Array([0]) : new Uint32Array(),
  positions: count ? new Float32Array([7, 8, 9]) : new Float32Array(), pinned: count ? new Uint8Array([1]) : new Uint8Array() });
