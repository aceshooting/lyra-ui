import { expect, fixture, html } from '@open-wc/testing';
import './task-list.js';
import type { LyraTaskList } from './task-list.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-task-list', 'items'));

it('reuses task validation and flattening for a heading update over 10000 tasks', async () => {
  const el = await fixture<LyraTaskList>(html`<lr-task-list reorderable
    .items=${Array.from({length:10_000},(_,index)=>({id:String(index),label:String(index),status:'pending'}))}></lr-task-list>`);
  const seam = el as unknown as { taskModel(): {flat: unknown[]}; renderedTaskItems(items: unknown): unknown };
  const flat = seam.taskModel().flat;
  const render = seam.renderedTaskItems;
  let projected = 0;
  seam.renderedTaskItems = function (items) { projected++; return render.call(this,items); };
  try { el.heading = 'Updated'; await el.updateComplete; }
  finally { seam.renderedTaskItems = render; }
  const flattened = Number(seam.taskModel().flat !== flat);
  expect(flattened).to.equal(0);
  expect(projected).to.equal(0);
  recordScaleMeasurement('lr-task-list','10000 tasks heading update',{flattened,projected});
});

it('admits 10000 closed-schema tasks without spending a generic node budget per field', async () => {
  const items = Array.from({length:10_001},(_,index)=>({id:String(index),label:String(index),status:'pending',detail:'Details', metadata:Array.from({length:20},()=>0)}));
  const el = await fixture<LyraTaskList>(html`<lr-task-list .items=${items}></lr-task-list>`);
  expect(el.items.length).to.equal(10_000);
  expect(el.shadowRoot!.querySelector('[part="limit"]')).not.to.equal(null);
});

it('allows a bounded maxNodes raise while preserving the unset 500-row ceiling', async () => {
  const items = Array.from({length:600},(_,index)=>({id:String(index),label:String(index),status:'pending'}));
  const el = await fixture<LyraTaskList>(html`<lr-task-list max-nodes="1000" .items=${items}></lr-task-list>`);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(600);
  el.removeAttribute('max-nodes'); await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(500);
});

it('normalizes nonfinite maxNodes values and clamps the hard ceiling', async () => {
  const el = await fixture<HTMLElement & {maxNodes:number;updateComplete:Promise<boolean>}>(html`<lr-task-list></lr-task-list>`);
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

it('keeps copied display fields stable until the source collection is reassigned', async () => {
  const source = [{id:'one',label:'Original',status:'pending'}];
  const el=await fixture<LyraTaskList>(html`<lr-task-list .items=${source}></lr-task-list>`);
  source[0]!.label='Changed';
  el.heading='Changed heading';await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="item"]')?.textContent).to.contain('Original');
  el.items=[...source] as LyraTaskList['items'];await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="item"]')?.textContent).to.contain('Changed');
});

it('discloses admission loss even when malformed entries leave only one visible task', async () => {
  const el=await fixture<LyraTaskList>(html`<lr-task-list .items=${[{id:'one',label:'One'},...Array.from({length:10000},()=>({}))]}></lr-task-list>`);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(false);
});

it('retains owned display fields when reconnecting after caller mutation', async () => {
  const source=[{id:'one',label:'Original',status:'pending' as const}];
  const el=await fixture<LyraTaskList>(html`<lr-task-list .items=${source}></lr-task-list>`);
  const parent=el.parentNode!;
  el.remove();source[0]!.label='Changed';parent.appendChild(el);await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="item"]')?.textContent).to.contain('Original');
});

it('does not revalidate the already projected partial child window on heading changes', async () => {
  const el=await fixture<LyraTaskList>(html`<lr-task-list .items=${[{id:'parent',label:'Parent',children:Array.from({length:10000},(_,index)=>({id:String(index),label:String(index)}))}]}></lr-task-list>`);
  const seam=el as unknown as {visibleTaskItems():Array<{children:unknown[]}>};
  const children=seam.visibleTaskItems()[0]!.children;
  const original=children[Symbol.iterator];let traversals=0;
  children[Symbol.iterator]=function(){traversals++;return original.call(this);};
  try {el.heading='Updated';await el.updateComplete;}
  finally {children[Symbol.iterator]=original;}
  expect(traversals).to.equal(0);
  recordScaleMeasurement('lr-task-list','10000 child tasks heading update',{validationTraversals:traversals});
});

it('keeps valid task neighbors when revoked rows or child arrays cannot be inspected', async () => {
  const row=Proxy.revocable({},{});row.revoke();
  const children=Proxy.revocable([],{});children.revoke();
  const el=await fixture<LyraTaskList>(html`<lr-task-list .items=${[row.proxy,{id:'safe',label:'Safe'},{id:'parent',label:'Parent',children:children.proxy},{id:'last',label:'Last'}]}></lr-task-list>`);
  expect([...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')].map(item=>item.dataset['id'])).to.deep.equal(['safe','parent','last']);
});
