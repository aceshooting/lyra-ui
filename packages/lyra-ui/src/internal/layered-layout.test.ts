import { expect } from '@open-wc/testing';
import { layeredLayout } from './layered-layout.js';

const box = (id: string) => ({ id, width: 20, height: 20 });

it('layers a simple chain by longest path from a source (a -> b -> c)', () => {
  const positions = layeredLayout({
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
  const positions = layeredLayout({
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
  const positions = layeredLayout({ nodes: [box('a'), box('b'), box('c')], edges });
  expect(positions.size).to.equal(3);
  expect(edges).to.deep.equal(edgesSnapshot);
});

it('an edge spanning more than one layer routes through virtual waypoints, absent from the returned map', () => {
  // a -> d spans layers 0 -> 3 once b, c are laid out in between via a -> b -> c -> d chain.
  const positions = layeredLayout({
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
  const positions = layeredLayout({
    nodes: [box('a'), box('b')],
    edges: [{ source: 'a', target: 'b' }],
    options: { fixedPositions: new Map([['b', { x: 999, y: 888 }]]) },
  });
  expect(positions.get('b')).to.deep.equal({ x: 999, y: 888 });
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
  const first = layeredLayout(input);
  const second = layeredLayout(input);
  expect([...first.entries()]).to.deep.equal([...second.entries()]);
});

it('breaks ties by stable input order (two nodes in the same layer, no distinguishing edges)', () => {
  const positions = layeredLayout({
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
  expect(wide.get('b')!.y - wide.get('a')!.y).to.be.greaterThan(tight.get('b')!.y - tight.get('a')!.y);
});

it('an empty node list returns an empty map', () => {
  expect(layeredLayout({ nodes: [], edges: [] }).size).to.equal(0);
});
