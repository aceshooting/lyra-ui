import { expect, fixture, html } from '@open-wc/testing';
import './trace-tree.js';
import type { LyraTraceTree } from './trace-tree.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-trace-tree', 'spans'));
const spans = (count:number) => Array.from({length:count},(_,index)=>({id:String(index),name:String(index),kind:'tool' as const,status:'pending' as const,startMs:index}));

it('reuses hierarchy for active selection inside the first 500 of 10000 spans', async () => {
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${spans(10_000)}></lr-trace-tree>`);
  const seam = el as unknown as {buildHierarchy():unknown};
  const original = seam.buildHierarchy;
  let builds = 0;
  seam.buildHierarchy = function () { builds++; return original.call(this); };
  try { el.activeSpanId = '1'; await el.updateComplete; }
  finally { seam.buildHierarchy = original; }
  expect(builds).to.equal(0);
  recordScaleMeasurement('lr-trace-tree','10000 spans active selection',{hierarchyBuilds:builds});
});

it('raises maxNodes and restores the default when the attribute is removed', async () => {
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree max-nodes="1000" .spans=${spans(600)}></lr-trace-tree>`);
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(600);
  el.removeAttribute('max-nodes'); await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(500);
});

it('discloses source admission loss even when most admitted spans are invalid', async () => {
  const source = [{id:'first',name:'First',kind:'tool',status:'pending',startMs:0}, ...Array.from({length:10_000},()=>({}))];
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${source}></lr-trace-tree>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(false);
});

it('normalizes nonfinite maxNodes values and clamps the hard ceiling', async () => {
  const el = await fixture<HTMLElement & {maxNodes:number;updateComplete:Promise<boolean>}>(html`<lr-trace-tree></lr-trace-tree>`);
  const seam = el as unknown as {effectiveMaxNodes:number};
  el.maxNodes = 100000; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(5000);
  el.maxNodes = NaN; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(500);
  el.maxNodes = Infinity; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(500);
  el.maxNodes = 1; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(1);
});
