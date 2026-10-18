import { expect } from '@open-wc/testing';
import { normalizeLyraSpans } from './span.js';
import { projectLyraSpans } from './span-projection.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

const source = () => Object.freeze(Array.from({length:10_000}, (_,index)=>({id:String(index),name:String(index),kind:'tool',status:'pending',startMs:index})));

it('reuses the admitted projection when active spans remain in the first 500 of 10000 rows', () => {
  const spans = source();
  const initial = projectLyraSpans(spans);
  let replacements = 0;
  for (let index=0;index<100;index++) {
    if (projectLyraSpans(spans,String(index)) !== initial) replacements++;
  }
  expect(replacements).to.equal(0);
  recordScaleMeasurement('lr-trace-tree','10000 spans 100 active reservations',{projectionReplacements:replacements});
});

it('supports a bounded optional projection limit without changing the two-argument default', () => {
  const spans = source();
  const project = normalizeLyraSpans as (source:readonly unknown[],active:string|null,limit?:number)=>ReturnType<typeof normalizeLyraSpans>;
  expect(project(spans,null,1000).spans.length).to.equal(1000);
  expect(project(spans,null,100000).spans.length).to.equal(5000);
  expect(project(spans,null).spans.length).to.equal(500);
  expect(project(spans,null,NaN).spans.length).to.equal(500);
  expect(project(spans,'9999',1000).byId.has('9999')).to.equal(true);
});

it('retains an out-of-window active reservation across repeated reads', () => {
  const values=source();
  const projection=projectLyraSpans(values,'9999');
  expect(projectLyraSpans(values,'9999') === projection).to.equal(true);
});

it('returns independent mutable span and lookup containers to public callers', () => {
  const values=source();
  const first=normalizeLyraSpans(values);
  first.spans.pop();first.byId.clear();
  const next=normalizeLyraSpans(values);
  expect(next.spans.length).to.equal(500);
  expect(next.byId.size).to.equal(500);
  expect(next.spans === first.spans).to.equal(false);
  expect(next.byId === first.byId).to.equal(false);
  const reserved=normalizeLyraSpans(values,'9999');
  reserved.spans.length=0;reserved.byId.delete('9999');
  const repeated=normalizeLyraSpans(values,'9999');
  expect(repeated.spans.length).to.equal(500);
  expect(repeated.byId.has('9999')).to.equal(true);
});
