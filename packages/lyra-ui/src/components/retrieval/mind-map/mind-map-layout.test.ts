import { expect } from '@open-wc/testing';
import { layoutMindMap, type LyraTopic } from './mind-map-layout.js';
import { formatBoundedRetrievalValue } from '../retrieval-value-format.js';
import {
  canonicalIdentityList,
  firstByRetrievalIdentity,
  isNonBlankIdentity,
} from '../retrieval-identity.js';

const alwaysExpanded = () => true;

const valueFormatOptions = {
  locale: 'en',
  invalid: '[invalid]',
  truncated: '[truncated]',
};

describe('retrieval identity helpers', () => {
  it('retains the first byte-exact nonblank identity and contains identity readers that throw', () => {
    const values = [
      { id: ' alpha ' },
      { id: ' alpha ' },
      { id: 'alpha' },
      { id: '   ' },
      { id: 'unsafe' },
    ];
    const retained = firstByRetrievalIdentity(values, (value) => {
      if (value.id === 'unsafe') throw new Error('identity denied');
      return value.id;
    });

    expect(retained.map((value) => value.id)).to.deep.equal([' alpha ', 'alpha']);
    expect(isNonBlankIdentity(42)).to.equal(false);
  });

  it('fails non-array runtime collections closed', () => {
    const invalid = { 0: 'kept?', length: 1 } as unknown as readonly string[];

    expect(firstByRetrievalIdentity(invalid, (value) => value)).to.deep.equal([]);
    expect(canonicalIdentityList(invalid)).to.deep.equal([]);
  });

  it('returns one frozen canonical projection for repeated reads of the same list', () => {
    const source = ['one', '', 'one', 'two'];
    const first = canonicalIdentityList(source);

    expect(first).to.deep.equal(['one', 'two']);
    expect(Object.isFrozen(first)).to.equal(true);
    expect(canonicalIdentityList(source) === first).to.equal(true);
  });
});

describe('formatBoundedRetrievalValue', () => {
  it('bounds object entries and string lengths while ignoring inherited fields', () => {
    const inherited = { inherited: 'not rendered' };
    const value = Object.assign(Object.create(inherited) as Record<string, unknown>, {
      first: 'abcdef',
      second: 2,
      third: 3,
    });

    expect(formatBoundedRetrievalValue(value, {
      ...valueFormatOptions,
      maxEntries: 2,
      maxStringLength: 3,
    })).to.equal('{fir[truncated]: abc[truncated], sec[truncated]: 2, [truncated]}');
  });

  it('rejects a runtime array whose length is not a safe non-negative integer', () => {
    const value = new Proxy([], {
      get(target, key, receiver) {
        return key === 'length' ? -1 : Reflect.get(target, key, receiver);
      },
    });

    expect(formatBoundedRetrievalValue(value, valueFormatOptions)).to.equal('[invalid]');
  });

  it('contains hostile collection traps and releases path-local cycle tracking', () => {
    const hostile = new Proxy({}, {
      ownKeys() {
        throw new Error('keys denied');
      },
    });
    const shared = { ok: true };

    expect(formatBoundedRetrievalValue(hostile, valueFormatOptions)).to.equal('[invalid]');
    expect(formatBoundedRetrievalValue([shared, shared], valueFormatOptions)).to.equal(
      '{ok: true} and {ok: true}',
    );
  });

  it('distinguishes nullish, unsupported primitive, and traversal-limit sentinels', () => {
    expect(formatBoundedRetrievalValue(null, valueFormatOptions)).to.equal('');
    expect(formatBoundedRetrievalValue(Symbol('unsupported'), valueFormatOptions)).to.equal('[invalid]');
    expect(formatBoundedRetrievalValue({ nested: { value: 'too deep' } }, {
      ...valueFormatOptions,
      maxDepth: 1,
    })).to.equal('{nested: {value: [truncated]}}');
  });
});

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

it('keeps the synthetic hub distinct when a caller owns the usual hub spelling', () => {
  const topics: LyraTopic[] = [
    { id: '__hub__', label: 'Caller hub' },
    { id: 'other', label: 'Other' },
  ];
  const result = layoutMindMap(topics, 'Synthetic hub', {
    ringGap: 96,
    rtl: false,
    isExpanded: alwaysExpanded,
  });
  const root = result.placed.find((topic) => topic.depth === 0)!;
  expect(root.id).to.not.equal('__hub__');
  expect(result.placed.some((topic) => topic.id === '__hub__')).to.be.true;
  expect(new Set(result.placed.map((topic) => topic.id)).size).to.equal(
    result.placed.length
  );
});

it('drops invalid and later duplicate identities across the complete hierarchy', () => {
  const topics = [
    null,
    { id: '   ', label: 'Blank' },
    {
      id: 'root',
      label: 'Root',
      children: [
        { id: 'shared', label: 'First shared topic' },
        { id: 'shared', label: 'Later duplicate' },
      ],
    },
    { id: 'shared', label: 'Duplicate in another branch' },
  ] as unknown as LyraTopic[];

  const result = layoutMindMap(topics, 'Hub', {
    ringGap: 96,
    rtl: false,
    isExpanded: alwaysExpanded,
  });

  expect(result.placed.map((topic) => topic.label)).to.deep.equal([
    'Root',
    'First shared topic',
  ]);
  expect(result.links).to.deep.equal([{ fromId: 'root', toId: 'shared' }]);
});

it('treats a non-array runtime children collection as an empty branch', () => {
  const topics = [{
    id: 'root',
    label: 'Root',
    children: { 0: { id: 'hidden', label: 'Hidden' }, length: 1 },
  }] as unknown as LyraTopic[];

  const result = layoutMindMap(topics, 'Hub', {
    ringGap: 96,
    rtl: false,
    isExpanded: alwaysExpanded,
  });

  expect(result.placed.map((topic) => topic.id)).to.deep.equal(['root']);
  expect(result.placed[0]!.hasChildren).to.equal(false);
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

it('does not throw a call-stack RangeError laying out a very large flat topic list (regression: bounding box must not spread `placed` into Math.min/Math.max)', () => {
  const topics: LyraTopic[] = [
    {
      id: 'root',
      label: 'Root',
      children: Array.from({ length: 150_000 }, (_, i) => ({ id: `t${i}`, label: `Topic ${i}` })),
    },
  ];
  const result = layoutMindMap(topics, 'Hub', { ringGap: 96, rtl: false, isExpanded: alwaysExpanded });
  expect(result.placed.length).to.equal(150_001); // root + 150,000 children
  expect(result.width).to.be.a('number').greaterThan(0);
  expect(result.height).to.be.a('number').greaterThan(0);
  expect(Number.isFinite(result.width)).to.be.true;
  expect(Number.isFinite(result.height)).to.be.true;
});
