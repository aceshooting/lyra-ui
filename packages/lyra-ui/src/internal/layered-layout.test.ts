import { expect } from '@open-wc/testing';
import { layeredLayout } from './layered-layout.js';

const box = (id: string) => ({ id, width: 20, height: 20 });

it('layers a simple chain by longest path from a source (a -> b -> c)', () => {
  const { positions } = layeredLayout({
    nodes: [box('a'), box('b'), box('c')],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
  });
  expect(positions.get('a')!.y).to.be.lessThan(positions.get('b')!.y);
  expect(positions.get('b')!.y).to.be.lessThan(positions.get('c')!.y);
});

it('assigns a node the LONGEST distance from any source, not the shortest, when both paths exist', () => {
  // a -> c directly (span 1), and a -> b -> c (span 2) -- c must land in the layer implied by the
  // longer path (layer 2), not the shorter one (layer 1).
  const { positions } = layeredLayout({
    nodes: [box('a'), box('b'), box('c')],
    edges: [
      { source: 'a', target: 'c' },
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
  });
  expect(positions.get('c')!.y).to.be.greaterThan(positions.get('b')!.y);
});

it('terminates on a cyclic graph without throwing, and never mutates the caller\'s edge array', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'a' }, // back edge -- would cycle without internal reversal
  ];
  const edgesSnapshot = JSON.parse(JSON.stringify(edges));
  const { positions } = layeredLayout({ nodes: [box('a'), box('b'), box('c')], edges });
  expect(positions.size).to.equal(3);
  expect(edges).to.deep.equal(edgesSnapshot);
});

it('an edge spanning more than one layer routes through virtual waypoints, absent from the returned map', () => {
  // a -> d spans layers 0 -> 3 once b, c are laid out in between via a -> b -> c -> d chain.
  const { positions } = layeredLayout({
    nodes: [box('a'), box('b'), box('c'), box('d')],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
      { source: 'a', target: 'd' }, // spans layers 0 -> 3
    ],
  });
  expect(positions.size).to.equal(4); // exactly the 4 real nodes -- no synthetic waypoint entries
  expect([...positions.keys()].every((id) => ['a', 'b', 'c', 'd'].includes(id))).to.be.true;
});

it('fixedPositions entries end at exactly their given coordinates, excluded from computed assignment', () => {
  const { positions } = layeredLayout({
    nodes: [box('a'), box('b')],
    edges: [{ source: 'a', target: 'b' }],
    options: { fixedPositions: new Map([['b', { x: 999, y: 888 }]]) },
  });
  expect(positions.get('b')).to.deep.equal({ x: 999, y: 888 });
});

it('reserves the fixed-node inline extent before computed siblings regardless of input order', () => {
  const forty = (id: string) => ({ id, width: 40, height: 40 });
  for (const nodes of [
    [forty('fixed'), forty('computed')],
    [forty('computed'), forty('fixed')],
  ]) {
    const { positions } = layeredLayout({
      nodes,
      edges: [],
      options: { fixedPositions: new Map([['fixed', { x: 50, y: 20 }]]) },
    });

    const fixedRight = positions.get('fixed')!.x + 20;
    const computedLeft = positions.get('computed')!.x - 20;
    expect(computedLeft - fixedRight).to.be.at.least(24);
  }
});

it('preserves the requested fixed-to-computed gap near the supported numeric ceiling', () => {
  const fixedCoordinate = Number.MAX_SAFE_INTEGER - 1_000;
  const { positions } = layeredLayout({
    nodes: [
      { id: 'fixed', width: 0, height: 0 },
      { id: 'computed', width: 3, height: 0 },
    ],
    edges: [],
    options: { fixedPositions: new Map([['fixed', { x: fixedCoordinate, y: 0 }]]) },
  });
  const vertical = layeredLayout({
    nodes: [
      { id: 'fixed', width: 0, height: 0 },
      { id: 'child', width: 0, height: 3 },
    ],
    edges: [{ source: 'fixed', target: 'child' }],
    options: { fixedPositions: new Map([['fixed', { x: 0, y: fixedCoordinate }]]) },
  }).positions;

  const fixedRight = positions.get('fixed')!.x;
  const computedLeft = positions.get('computed')!.x - 1.5;
  const fixedBottom = vertical.get('fixed')!.y;
  const childTop = vertical.get('child')!.y - 1.5;
  expect(computedLeft - fixedRight).to.be.at.least(24);
  expect(childTop - fixedBottom).to.be.at.least(100);
});

it('rounds a fractional gap upward near the safe-integer ceiling', () => {
  const fixedX = Number.MAX_SAFE_INTEGER - 4;
  const { positions } = layeredLayout({
    nodes: [
      { id: 'fixed', width: 0, height: 0 },
      { id: 'computed', width: 0.5, height: 0 },
    ],
    edges: [],
    options: {
      fixedPositions: new Map([['fixed', { x: fixedX, y: 0 }]]),
      gapX: 0.25,
    },
  });

  const computed = positions.get('computed')!;
  expect(computed.x - 0.25 - fixedX).to.be.at.least(0.25);
  expect(Number.isFinite(computed.x)).to.equal(true);
});

it('rounds a sub-ULP half-width upward and rejects gap correction beyond the ceiling', () => {
  const nodes = [
    { id: 'fixed', width: 0, height: 0 },
    { id: 'computed', width: 0, height: 0 },
  ];
  const fixedPositions = new Map([['fixed', { x: Number.MAX_SAFE_INTEGER, y: 0 }]]);

  expect(() => layeredLayout({
    nodes,
    edges: [],
    options: { fixedPositions, gapX: 0.25 },
  })).to.throw(RangeError, 'inline gap');

  const corrected = layeredLayout({
    nodes: [nodes[0]!, { ...nodes[1]!, width: 1.1146639167236572e-16 }],
    edges: [],
    options: {
      fixedPositions: new Map([['fixed', { x: 1, y: 0 }]]),
      gapX: 0,
    },
  });
  expect(corrected.positions.get('computed')!.x).to.be.greaterThan(1);
});

it('advances later layer lanes past a fixed predecessor block extent', () => {
  const forty = (id: string) => ({ id, width: 40, height: 40 });
  const { positions } = layeredLayout({
    nodes: [forty('fixed'), forty('child')],
    edges: [{ source: 'fixed', target: 'child' }],
    options: { fixedPositions: new Map([['fixed', { x: 20, y: 300 }]]) },
  });

  const fixedBottom = positions.get('fixed')!.y + 20;
  const childTop = positions.get('child')!.y - 20;
  expect(childTop - fixedBottom).to.be.at.least(100);
});

it('is deterministic: byte-identical output across repeated runs on the same input', () => {
  const input = {
    nodes: [box('a'), box('b'), box('c'), box('d')],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'd' },
      { source: 'c', target: 'd' },
    ],
  };
  const first = layeredLayout(input).positions;
  const second = layeredLayout(input).positions;
  expect([...first.entries()]).to.deep.equal([...second.entries()]);
});

it('breaks ties by stable input order (two nodes in the same layer, no distinguishing edges)', () => {
  const { positions } = layeredLayout({
    nodes: [box('z'), box('a')], // 'z' listed first in the input
    edges: [],
  });
  expect(positions.get('z')!.x).to.be.lessThan(positions.get('a')!.x);
});

it('respects custom gapX/gapY', () => {
  const tight = layeredLayout({
    nodes: [box('a'), box('b')],
    edges: [{ source: 'a', target: 'b' }],
    options: { gapX: 5, gapY: 5 },
  });
  const wide = layeredLayout({
    nodes: [box('a'), box('b')],
    edges: [{ source: 'a', target: 'b' }],
    options: { gapX: 5, gapY: 500 },
  });
  expect(wide.positions.get('b')!.y - wide.positions.get('a')!.y).to.be.greaterThan(
    tight.positions.get('b')!.y - tight.positions.get('a')!.y,
  );
});

it('rejects invalid node geometry, gaps, and fixed coordinates before layout', () => {
  const invalidCases: Array<{
    label: string;
    run: () => unknown;
  }> = [
    {
      label: 'nodes[0].width',
      run: () => layeredLayout({ nodes: [{ id: 'a', width: Number.NaN, height: 20 }], edges: [] }),
    },
    {
      label: 'nodes[0].height',
      run: () => layeredLayout({ nodes: [{ id: 'a', width: 20, height: Number.POSITIVE_INFINITY }], edges: [] }),
    },
    {
      label: 'nodes[0].width',
      run: () => layeredLayout({ nodes: [{ id: 'a', width: -1, height: 20 }], edges: [] }),
    },
    {
      label: 'nodes[0].width',
      run: () => layeredLayout({ nodes: [{ id: 'a', width: Number.MAX_VALUE, height: 20 }], edges: [] }),
    },
    {
      label: 'options.gapX',
      run: () => layeredLayout({ nodes: [box('a')], edges: [], options: { gapX: Number.NaN } }),
    },
    {
      label: 'options.gapY',
      run: () => layeredLayout({ nodes: [box('a')], edges: [], options: { gapY: -1 } }),
    },
    {
      label: 'options.fixedPositions["a"].x',
      run: () =>
        layeredLayout({
          nodes: [box('a')],
          edges: [],
          options: { fixedPositions: new Map([['a', { x: Number.NEGATIVE_INFINITY, y: 0 }]]) },
        }),
    },
    {
      label: 'options.fixedPositions["a"].y',
      run: () =>
        layeredLayout({
          nodes: [box('a')],
          edges: [],
          options: { fixedPositions: new Map([['a', { x: 0, y: -1 }]]) },
        }),
    },
  ];

  for (const { label, run } of invalidCases) {
    expect(run).to.throw(RangeError, label);
  }
});

it('rejects invalid numeric input before traversing graph edges', () => {
  const edges: Array<{ source: string; target: string }> = [];
  Object.defineProperty(edges, 'filter', {
    value: () => {
      throw new Error('graph traversal started');
    },
  });

  expect(() =>
    layeredLayout({
      nodes: [{ id: 'invalid', width: Number.NaN, height: 20 }],
      edges,
    }),
  ).to.throw(RangeError, 'nodes[0].width');
  expect(() =>
    layeredLayout({
      nodes: [{ id: 'fixed', width: 0, height: 1 }],
      edges,
      options: {
        fixedPositions: new Map([
          ['fixed', { x: 0, y: Number.MAX_SAFE_INTEGER }],
        ]),
      },
    }),
  ).to.throw(RangeError, 'fixed block extent for "fixed"');
});

it('accepts zero-sized boxes, zero gaps, and origin-fixed coordinates with finite output', () => {
  const { positions } = layeredLayout({
    nodes: [
      { id: 'fixed', width: 0, height: 0 },
      { id: 'computed', width: 0, height: 0 },
    ],
    edges: [],
    options: {
      fixedPositions: new Map([['fixed', { x: 0, y: 0 }]]),
      gapX: 0,
      gapY: 0,
    },
  });

  for (const position of positions.values()) {
    expect(Number.isFinite(position.x)).to.be.true;
    expect(Number.isFinite(position.y)).to.be.true;
  }
});

it('does not add an unused trailing gap at the supported numeric ceiling', () => {
  const computed = layeredLayout({
    nodes: [{ id: 'computed', width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER }],
    edges: [],
  }).positions.get('computed')!;
  const fixed = layeredLayout({
    nodes: [{ id: 'fixed', width: 0, height: 0 }],
    edges: [],
    options: {
      fixedPositions: new Map([
        ['fixed', { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER }],
      ]),
    },
  }).positions.get('fixed')!;

  expect(Number.isFinite(computed.x)).to.be.true;
  expect(Number.isFinite(computed.y)).to.be.true;
  expect(fixed).to.deep.equal({
    x: Number.MAX_SAFE_INTEGER,
    y: Number.MAX_SAFE_INTEGER,
  });
});

it('an empty node list returns an empty map', () => {
  const result = layeredLayout({ nodes: [], edges: [] });
  expect(result.positions.size).to.equal(0);
  expect(result.truncated).to.be.false;
  expect(result.virtualWaypointCount).to.equal(0);
});

it('lays out a 5,000-node chain without recursive-stack exhaustion', () => {
  const nodes = Array.from({ length: 5_000 }, (_, index) => box(String(index)));
  const edges = Array.from({ length: nodes.length - 1 }, (_, index) => ({
    source: String(index),
    target: String(index + 1),
  }));
  const { positions } = layeredLayout({ nodes, edges });
  expect(positions.size).to.equal(nodes.length);
  expect(positions.get('0')!.y).to.be.lessThan(positions.get('4999')!.y);
});

it('bounds virtual routing work for a dense layered DAG while retaining every real node', () => {
  const nodes = Array.from({ length: 150 }, (_, index) => box(String(index)));
  const edges = nodes.flatMap((source, sourceIndex) =>
    nodes.slice(sourceIndex + 1).map((target) => ({ source: source.id, target: target.id })),
  );
  const started = performance.now();
  const result = layeredLayout({ nodes, edges });
  const { positions } = result;
  const elapsed = performance.now() - started;
  expect(positions.size).to.equal(nodes.length);
  expect([...positions.keys()]).to.deep.equal(nodes.map(({ id }) => id));
  expect(result.truncated).to.be.true;
  expect(result.virtualWaypointCount).to.be.at.most(10_000);
  // The uncapped waypoint expansion takes several seconds on ordinary development hardware. This
  // 2-second ceiling retains generous cross-engine/CI headroom while detecting cubic regression.
  expect(elapsed).to.be.lessThan(2_000);
});

it('reports a caller-configured waypoint budget and truncation without dropping real nodes', () => {
  const result = layeredLayout({
    nodes: [box('a'), box('b'), box('c'), box('d')],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
      { source: 'a', target: 'd' },
    ],
    options: { maxVirtualWaypoints: 0 },
  });

  expect(result.positions.size).to.equal(4);
  expect(result.truncated).to.be.true;
  expect(result.virtualWaypointCount).to.equal(0);
});

it('normalizes fractional, negative, and non-finite waypoint budgets', () => {
  const input = {
    nodes: [box('a'), box('b'), box('c'), box('d')],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
      { source: 'a', target: 'd' },
    ],
  };
  const fractional = layeredLayout({ ...input, options: { maxVirtualWaypoints: 1.9 } });
  const negative = layeredLayout({ ...input, options: { maxVirtualWaypoints: -1 } });
  const nonFinite = layeredLayout({ ...input, options: { maxVirtualWaypoints: Number.NaN } });

  expect(fractional.truncated).to.be.true;
  expect(fractional.virtualWaypointCount).to.equal(0);
  expect(negative.truncated).to.be.true;
  expect(negative.virtualWaypointCount).to.equal(0);
  expect(nonFinite.truncated).to.be.false;
  expect(nonFinite.virtualWaypointCount).to.equal(2);
});
