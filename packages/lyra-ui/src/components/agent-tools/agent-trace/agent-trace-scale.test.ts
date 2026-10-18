import { expect, fixture, html } from '@open-wc/testing';
import './agent-trace.js';
import type { LyraAgentTrace } from './agent-trace.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-agent-trace', 'spans'));
const spans = (count:number) => Array.from({length:count},(_,index)=>({id:String(index),name:String(index),kind:'tool' as const,status:'pending' as const,startMs:index}));

it('reuses span arrays for active changes within the first 500 of 10000 spans', async () => {
  const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans(10000)}></lr-agent-trace>`);
  const seam = el as unknown as {projectedSpans():{spans:unknown[]}};
  const initial = seam.projectedSpans().spans;
  el.activeSpanId='1'; await el.updateComplete;
  const replacements = Number(seam.projectedSpans().spans !== initial);
  expect(replacements).to.equal(0);
  recordScaleMeasurement('lr-agent-trace','10000 spans active selection',{projectionReplacements:replacements});
});

it('forwards bounded maxNodes and resets to 500 on removal', async () => {
  const el=await fixture<LyraAgentTrace>(html`<lr-agent-trace max-nodes="1000" .spans=${spans(600)}></lr-agent-trace>`);
  const tree=el.shadowRoot!.querySelector('lr-trace-tree')!; await tree.updateComplete;
  expect(tree.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(600);
  el.removeAttribute('max-nodes'); await el.updateComplete; await tree.updateComplete;
  expect(tree.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(500);
});

it('discloses outer source loss when retained rows do not reach the projection ceiling', async () => {
  const el=await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${[...spans(1),...Array.from({length:10000},()=>({}))]}></lr-agent-trace>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(false);
});

it('normalizes nonfinite maxNodes values and clamps the hard ceiling', async () => {
  const el = await fixture<HTMLElement & {maxNodes:number;updateComplete:Promise<boolean>}>(html`<lr-agent-trace></lr-agent-trace>`);
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
