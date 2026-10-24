import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { LyraMindMap, type LyraTopic } from './mind-map.js';
import { createMindMapLayout } from './mind-map-layout.js';

it('bounds source reads for a million logical roots without invoking topic accessors', () => {
  let reads = 0;
  let getters = 0;
  const roots = new Proxy(new Array<LyraTopic>(1_000_000), {
    has: () => true,
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return topic(Number(key)); }
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return { configurable: true, enumerable: true, value: topic(Number(key)) }; }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  function topic(index: number): LyraTopic {
    return index === 20_000 ? { get id() { getters++; return 'accessor'; }, label: 'Unsafe' } : { id: `n${index}`, label: `Node ${index}` };
  }
  const el = new LyraMindMap();
  el.topics = roots;
  expect(reads).to.be.at.most(50_000);
  expect(getters).to.equal(0);
  expect(el.topics.length).to.be.at.most(50_000);
});

it('bounds admitted depth before recursive layout and safely cuts cycles', () => {
  let root: LyraTopic = { id: 'tail', label: 'Tail' };
  // Fully allocated adversarial hierarchy, distinct from a lazy logical root array.
  for (let index = 20_000; index >= 0; index--) root = { id: `n${index}`, label: 'Node', children: [root] };
  const el = new LyraMindMap();
  el.topics = [root];
  let depth = 0;
  let cursor: LyraTopic | undefined = el.topics[0];
  while (cursor) { depth++; cursor = cursor.children?.[0]; }
  expect(depth).to.be.at.most(65);
  expect(() => createMindMapLayout(el.topics)).not.to.throw();
  const cyclic: LyraTopic = { id: 'cycle', label: 'Cycle' };
  cyclic.children = [cyclic];
  el.topics = [cyclic];
  expect(el.topics[0]?.children?.length ?? 0).to.equal(0);
  expect(Object.isFrozen(el.topics[0])).to.equal(true);
});

it('discloses nested admission loss even when collapsed and clears it on replacement', async () => {
  let root: LyraTopic = { id: 'tail', label: 'Tail' };
  for (let index = 100; index >= 0; index--) root = { id: `n${index}`, label: 'Node', children: [root] };
  const el = await fixture<LyraMindMap>(html`<lr-mind-map .topics=${[root]} expand-depth="0"></lr-mind-map>`);
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Some topics were omitted');
  expect(sinkTexts().some(text => text.includes('Some topics were omitted'))).to.equal(false);
  el.strings = { mindMapInputLimit: 'Topic input was limited' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Topic input was limited');
  el.topics = [{ id: 'safe', label: 'Safe' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
  el.topics = [root];
  await el.updateComplete;
  expect(sinkTexts()).to.include('Topic input was limited');
});

it('preserves a wide admitted hierarchy and its owned data without inspecting unrelated fields', () => {
  let getters = 0;
  const children = Array.from({ length: 15_000 }, (_, index) => ({ id: `c${index}`, label: `Child ${index}` }));
  const root = { id: 'root', label: 'Root', children, get unrelated() { getters++; throw new Error('unused'); } };
  const el = new LyraMindMap();
  el.topics = [root];
  expect(el.topics[0]!.children!.length).to.equal(15_000);
  children[0]!.label = 'Mutated';
  expect(el.topics[0]!.children![0]!.label).to.equal('Child 0');
  expect(getters).to.equal(0);
  expect(Object.isFrozen(el.topics[0]!.children)).to.equal(true);
});

it('keeps shared topic occurrences until the existing depth-first identity normalization', () => {
  const shared: LyraTopic = { id: 'shared', label: 'Shared' };
  const el = new LyraMindMap();
  el.topics = [{ id: 'first', label: 'First', children: [shared] }, shared];
  expect(el.topics[0]!.children?.map(topic => topic.id)).to.deep.equal(['shared']);
  const compute = createMindMapLayout(el.topics);
  const layout = compute('Topics', { ringGap: 20, rtl: false, isExpanded: () => true });
  expect(layout.placed.find(topic => topic.id === 'shared')?.parentId).to.equal('first');
});

it('admits no topics from a root that is not a readable array', () => {
  const unreadable = Proxy.revocable([], {});
  unreadable.revoke();
  const el = new LyraMindMap();
  const roots: unknown[] = [undefined, 'topics', { 0: { id: 'a', label: 'A' }, length: 1 }, unreadable.proxy];
  roots.forEach((value, index) => {
    el.topics = value as LyraTopic[];
    expect(el.topics.length, `root ${index}`).to.equal(0);
  });
});

it('skips rows that are not topic objects and keeps a topic with unreadable children as a leaf', () => {
  const unreadable = Proxy.revocable([], {});
  unreadable.revoke();
  const el = new LyraMindMap();
  el.topics = [
    null,
    'text',
    7,
    { id: 'revoked-children', label: 'Revoked', children: unreadable.proxy },
    { id: 'text-children', label: 'Text', children: 'nope' },
    { id: 'parent', label: 'Parent', children: [{ id: 'kid', label: 'Kid' }] },
  ] as unknown as LyraTopic[];
  expect(el.topics.map(topic => topic.id)).to.deep.equal(['revoked-children', 'text-children', 'parent']);
  expect(el.topics.map(topic => topic.children?.length ?? null)).to.deep.equal([null, null, 1]);
});

it('stops at the inspection budget before reading child lists queued behind it and discloses the omission', async () => {
  const roots: unknown[] = [];
  roots[0] = { id: 'first', label: 'First', children: [{ id: 'queued', label: 'Queued' }] };
  roots.length = 50_000;
  const el = await fixture<LyraMindMap>(html`<lr-mind-map .topics=${roots as LyraTopic[]}></lr-mind-map>`);
  expect(el.topics.map(topic => topic.id)).to.deep.equal(['first']);
  expect(el.topics[0]!.children?.length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Some topics were omitted');
});
