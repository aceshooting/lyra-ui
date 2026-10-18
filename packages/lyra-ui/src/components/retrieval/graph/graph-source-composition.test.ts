import { expect } from '@open-wc/testing';
import { GraphSourceCompositionController, setGraphSourceComposition, resolveGraphSourceComposition } from './graph-source-composition.js';
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
