import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { PropertyValues } from 'lit';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('updates only the roving rows when navigating 500 declarative items', async () => {
  const tree = await fixture<LyraTree>(html`<lr-tree label="Nodes">
    ${Array.from({length:500},(_,index)=>html`<lr-tree-item label=${String(index)}></lr-tree-item>`)}
  </lr-tree>`);
  await tree.updateComplete; await twoFrames();
  const items = [...tree.querySelectorAll<LyraTreeItem>('lr-tree-item')];
  await focusByKeyboard(items[0]!);
  await tree.updateComplete; await twoFrames();
  const seam = Object.getPrototypeOf(items[0]) as { updated(changed: PropertyValues): void };
  const original = seam.updated;
  let updates = 0;
  seam.updated = function (changed) { updates++; original.call(this, changed); };
  try { await sendKeys({press:'ArrowDown'}); await tree.updateComplete; await twoFrames(); }
  finally { seam.updated = original; }
  expect(updates).to.be.at.most(2);
  expect(items[0]!.tabIndex).to.equal(-1);
  expect(items[1]!.tabIndex).to.equal(0);
  recordScaleMeasurement('lr-tree', '500 declarative items ArrowDown', { itemUpdates: updates });
});

it('includes declarative items beyond the data-model cap in context and navigation', async () => {
  const tree = await fixture<LyraTree>(html`<lr-tree label="Nodes">
    ${Array.from({length:1001},(_,index)=>html`<lr-tree-item label=${String(index)}></lr-tree-item>`)}
  </lr-tree>`);
  await tree.updateComplete; await twoFrames();
  const items = [...tree.querySelectorAll<LyraTreeItem>('lr-tree-item')];
  expect(items[1000]!.getAttribute('aria-posinset')).to.equal('1001');
  await focusByKeyboard(items[0]!);
  await sendKeys({press:'End'}); await tree.updateComplete;
  expect(items[1000]!.tabIndex).to.equal(0);
});

it('preserves label observer bindings when selection changes on 500 items', async () => {
  const tree = await fixture<LyraTree>(html`<lr-tree label="Nodes">
    ${Array.from({length:500},(_,index)=>html`<lr-tree-item label=${String(index)}></lr-tree-item>`)}
  </lr-tree>`);
  await twoFrames();
  const items = [...tree.querySelectorAll<LyraTreeItem>('lr-tree-item')];
  let binds = 0;
  const restores = items.map(item => {
    const controller = (item as unknown as { labelTextObserver: {bind():void} }).labelTextObserver;
    const original = controller.bind;
    controller.bind = function () { binds++; original.call(this); };
    return () => { controller.bind = original; };
  });
  try {
    items[0]!.selected = true;
    await items[0]!.updateComplete;
  } finally { restores.forEach(restore=>restore()); }
  expect(binds).to.equal(0);
  recordScaleMeasurement('lr-tree-item','500 items selection update',{observerBinds:binds});
});

it('raises the object-model maxNodes budget and restores its default on removal', async () => {
  const data=Array.from({length:1100},(_,index)=>({id:String(index),label:String(index)}));
  const tree=await fixture<LyraTree>(html`<lr-tree label="Nodes" max-nodes="1200" .data=${data}></lr-tree>`);
  expect(tree.data.length).to.equal(1100);
  tree.removeAttribute('max-nodes'); await tree.updateComplete;
  expect(tree.data.length).to.equal(1000);
  tree.setAttribute('max-nodes','1200'); await tree.updateComplete;
  tree.data=data; await tree.updateComplete;
  expect(tree.data.length).to.equal(1100);
});

it('starts a 500-branch bulk expansion before awaiting any individual row update', async () => {
  const tree=await fixture<LyraTree>(html`<lr-tree label="Branches" data-lr-motion="reduce">
    ${Array.from({length:500},(_,index)=>html`<lr-tree-item label=${String(index)}><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>`)}
  </lr-tree>`);
  await twoFrames();
  const roots=[...tree.children] as LyraTreeItem[];
  const seam=Object.getPrototypeOf(roots[0]) as {updated(changed:PropertyValues):void};
  const original=seam.updated; let updates=0;let earlierUpdates=-1;
  seam.updated=function(changed){updates++;original.call(this,changed);};
  const last=roots[roots.length-1]!;const expand=last.expand;
  last.expand=function(){earlierUpdates=updates;expand.call(this);};
  try {await tree.expandAll();} finally {seam.updated=original;last.expand=expand;}
  expect(earlierUpdates).to.equal(0);
  expect(roots.every(node=>node.expanded)).to.equal(true);
  recordScaleMeasurement('lr-tree','500 branches expandAll',{updatesBeforeLastExpansion:earlierUpdates});
});

it('normalizes nonfinite maxNodes values and clamps the hard ceiling', async () => {
  const el = await fixture<HTMLElement & {maxNodes:number;updateComplete:Promise<boolean>}>(html`<lr-tree label="Nodes"></lr-tree>`);
  const seam = el as unknown as {effectiveMaxNodes:number};
  el.maxNodes = 100000; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(10000);
  el.maxNodes = NaN; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(1000);
  el.maxNodes = Infinity; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(1000);
  el.maxNodes = 1; await el.updateComplete;
  expect(seam.effectiveMaxNodes).to.equal(1);
});

it('does not traverse collapsed descendants to patch focus among 500 branches', async () => {
  const tree=await fixture<LyraTree>(html`<lr-tree label="Branches">
    ${Array.from({length:500},(_,index)=>html`<lr-tree-item label=${String(index)}><lr-tree-item label="Hidden"></lr-tree-item></lr-tree-item>`)}
  </lr-tree>`);
  await twoFrames();
  const roots=[...tree.children] as LyraTreeItem[];
  await focusByKeyboard(roots[0]!);await twoFrames();
  const seam=tree as unknown as {allNodeElements():LyraTreeItem[];childrenOf(node:LyraTreeItem):LyraTreeItem[]};
  const all=seam.allNodeElements;const children=seam.childrenOf;
  let walks=0;let childReads=0;
  seam.allNodeElements=function(){walks++;return all.call(this);};
  seam.childrenOf=function(node){childReads++;return children.call(this,node);};
  try {await sendKeys({press:'ArrowDown'});await twoFrames();}
  finally {seam.allNodeElements=all;seam.childrenOf=children;}
  expect({walks,childReads}).to.deep.equal({walks:0,childReads:0});
  expect(roots[0]!.tabIndex).to.equal(-1);expect(roots[1]!.tabIndex).to.equal(0);
  recordScaleMeasurement('lr-tree','500 collapsed branches focus patch',{allNodeWalks:walks,childReads});
});
