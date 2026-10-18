import { expect, fixture, html } from '@open-wc/testing';
import './file-tree.js';
import type { LyraFileTree } from './file-tree.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses file projection when selecting among 1000 files', async () => {
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .nodes=${Array.from({length:1000},(_,index)=>({path:String(index)}))}></lr-file-tree>`);
  const seam = el as unknown as {toTreeItem(node:unknown):unknown};
  const original=seam.toTreeItem; let projections=0;
  seam.toTreeItem=function(node){projections++;return original.call(this,node);};
  try { el.selectedPath='42'; await el.updateComplete; } finally {seam.toTreeItem=original;}
  expect(projections).to.equal(0);
  recordScaleMeasurement('lr-file-tree','1000 files selection',{projections});
});

it('raises the projected maxNodes budget and restores its default on removal', async () => {
  const el = await fixture<LyraFileTree>(html`<lr-file-tree max-nodes="1200" .nodes=${Array.from({length:1100},(_,index)=>({path:String(index)}))}></lr-file-tree>`);
  const tree=el.shadowRoot!.querySelector('lr-tree')!;
  await tree.updateComplete;
  expect(tree.data.length).to.equal(1100);
  el.removeAttribute('max-nodes'); await el.updateComplete; await tree.updateComplete;
  expect(tree.data.length).to.equal(1000);
});

it('normalizes nonfinite maxNodes values and clamps the hard ceiling', async () => {
  const el = await fixture<HTMLElement & {maxNodes:number;updateComplete:Promise<boolean>}>(html`<lr-file-tree></lr-file-tree>`);
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
