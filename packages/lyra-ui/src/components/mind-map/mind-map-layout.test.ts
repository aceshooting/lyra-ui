import { expect } from '@open-wc/testing';
import { layoutMindMap, type LyraTopic } from './mind-map-layout.js';

const alwaysExpanded = () => true;

it('returns an empty result for an empty topics array', () => {
  const result = layoutMindMap([], 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  expect(result.placed).to.deep.equal([]);
  expect(result.links).to.deep.equal([]);
});

it('places a single root with no synthetic hub, at depth 0', () => {
  const topics: LyraTopic[] = [{ id: 'root', label: 'Root' }];
  const result = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  expect(result.placed.length).to.equal(1);
  expect(result.placed[0]!.id).to.equal('root');
  expect(result.placed[0]!.depth).to.equal(0);
});

it('wraps multiple roots in an implicit hub whose label is the given hubLabel', () => {
  const topics: LyraTopic[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  const result = layoutMindMap(topics, 'My Mind Map', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  const hub = result.placed.find((p) => p.depth === 0)!;
  expect(hub.label).to.equal('My Mind Map');
  expect(result.placed.length).to.equal(3); // hub + a + b
  expect(result.links.length).to.equal(2);
});

it("subdivides a parent arc proportionally to each child subtree's visible leaf count", () => {
  const topics: LyraTopic[] = [
    { id: 'root', label: 'Root', children: [{ id: 'c1', label: 'C1' }, { id: 'c2', label: 'C2' }] },
  ];
  const result = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  const c1 = result.placed.find((p) => p.id === 'c1')!;
  const c2 = result.placed.find((p) => p.id === 'c2')!;
  expect(c1.angle).to.be.closeTo(Math.PI / 2, 0.0001);
  expect(c2.angle).to.be.closeTo((3 * Math.PI) / 2, 0.0001);
});

it("sibling order runs clockwise from 12 o'clock (angle 0) in LTR", () => {
  const topics: LyraTopic[] = [{ id: 'root', label: 'Root', children: [{ id: 'c1', label: 'C1' }] }];
  const result = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  const c1 = result.placed.find((p) => p.id === 'c1')!;
  // A single child fills the whole [0, 2*pi) span -- its midpoint is pi.
  expect(c1.angle).to.be.closeTo(Math.PI, 0.0001);
});

it("a collapsed node stops recursion and counts as one leaf for its ancestor's arc math", () => {
  const topics: LyraTopic[] = [
    {
      id: 'root',
      label: 'Root',
      children: [
        { id: 'collapsed', label: 'Collapsed', children: [{ id: 'hidden', label: 'Hidden' }] },
        { id: 'leaf', label: 'Leaf' },
      ],
    },
  ];
  const result = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: (id) => id !== 'collapsed' });
  expect(result.placed.find((p) => p.id === 'hidden')).to.equal(undefined);
  const collapsed = result.placed.find((p) => p.id === 'collapsed')!;
  expect(collapsed.hasChildren).to.be.true;
  expect(collapsed.expanded).to.be.false;
  const leaf = result.placed.find((p) => p.id === 'leaf')!;
  // Both top-level children count as one leaf each -- the same equal 180-degree split as the
  // two-equal-children case above.
  expect(collapsed.angle).to.be.closeTo(Math.PI / 2, 0.0001);
  expect(leaf.angle).to.be.closeTo((3 * Math.PI) / 2, 0.0001);
});

it('mirrors x horizontally under rtl for the same angle', () => {
  const topics: LyraTopic[] = [{ id: 'root', label: 'Root', children: [{ id: 'c1', label: 'C1' }, { id: 'c2', label: 'C2' }] }];
  const ltr = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  const rtl = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: true, isExpanded: alwaysExpanded });
  const ltrC1 = ltr.placed.find((p) => p.id === 'c1')!;
  const rtlC1 = rtl.placed.find((p) => p.id === 'c1')!;
  expect(ltrC1.x).to.be.greaterThan(ltr.centerX);
  expect(rtlC1.x).to.be.lessThan(rtl.centerX);
});

it('auto-fits width/height to the laid-out extent, and every placed point stays within it', () => {
  const topics: LyraTopic[] = [{ id: 'root', label: 'Root', children: [{ id: 'c1', label: 'C1' }] }];
  const result = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  expect(result.width).to.be.greaterThan(0);
  expect(result.height).to.be.greaterThan(0);
  for (const p of result.placed) {
    expect(p.x).to.be.within(0, result.width);
    expect(p.y).to.be.within(0, result.height);
  }
});
