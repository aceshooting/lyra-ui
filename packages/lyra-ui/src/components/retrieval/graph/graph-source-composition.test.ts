import { expect } from '@open-wc/testing';
import { GraphSourceCompositionController, setGraphSourceComposition, resolveGraphSourceComposition, focusGraphSourceComposition } from './graph-source-composition.js';
it('keeps one private profile and caps lookup keys before calling its child lane', async () => {
 const host = {}; let changes = 0, lookups = 0;
 const control = new GraphSourceCompositionController(host, () => changes++, async () => { lookups++; return { records: [], current: () => true }; }, async () => undefined);
 const profile = {search:'',nodeTypes:['a'],empty:false,accepted:()=>undefined};
 setGraphSourceComposition(host,profile);setGraphSourceComposition(host,{...profile,nodeTypes:['a']});
 expect(changes).to.equal(1);expect(Object.isFrozen(control.profile!.nodeTypes)).to.equal(true);
 expect(await resolveGraphSourceComposition(host,Array.from({length:33},(_,i)=>`node:${i}`))).to.equal(undefined);expect(lookups).to.equal(0);
 await resolveGraphSourceComposition(host,['node:1']);expect(lookups).to.equal(1);
 setGraphSourceComposition(host,{...profile,empty:true});await resolveGraphSourceComposition(host,['node:1']);expect(lookups).to.equal(1);
 setGraphSourceComposition(host,undefined);expect(control.profile).to.equal(undefined);
});

const populated = { search: 'term', nodeTypes: ['person'], empty: false, accepted: () => undefined };

it('hands a toolbar profile installed before the graph attaches to the graph and rejects oversized filters', () => {
 const host = {};
 setGraphSourceComposition(host, populated);
 const control = new GraphSourceCompositionController(host, () => undefined, async () => undefined, async () => undefined);
 expect(control.profile?.search).to.equal('term');
 for (const invalid of [
  { ...populated, search: 'x'.repeat(65_537) },
  { ...populated, search: 3 as unknown as string },
  { ...populated, nodeTypes: Array.from({ length: 501 }, (_, index) => `type-${index}`) },
 ]) expect(() => setGraphSourceComposition(host, invalid)).to.throw(RangeError);
 expect(control.profile?.search).to.equal('term');
});

it('focuses only complete node keys of a populated profile through the graph lane', async () => {
 const host = {}, bare = {}, focused: string[] = [];
 const current = () => true;
 const control = new GraphSourceCompositionController(host, () => undefined, async () => undefined, async (key) => { focused.push(key); return current; });
 expect(await focusGraphSourceComposition(host, 'node:a'), 'no profile installed yet').to.equal(undefined);
 setGraphSourceComposition(host, populated);
 expect(control.profile?.empty).to.equal(false);
 expect(await focusGraphSourceComposition(host, 'node:a') === current).to.equal(true);
 for (const key of ['edge:a', 'a', `node:${'k'.repeat(65_536)}`]) expect(await focusGraphSourceComposition(host, key), key.slice(0, 8)).to.equal(undefined);
 setGraphSourceComposition(host, { ...populated, empty: true });
 expect(await focusGraphSourceComposition(host, 'node:a'), 'empty profile').to.equal(undefined);
 expect(focused).to.deep.equal(['node:a']);
 setGraphSourceComposition(bare, populated);
 expect(await focusGraphSourceComposition(bare, 'node:a'), 'profile without a graph lane').to.equal(undefined);
 expect(await focusGraphSourceComposition({}, 'node:a'), 'host without any state').to.equal(undefined);
});
