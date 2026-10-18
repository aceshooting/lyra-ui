import { expect, fixture, html } from '@open-wc/testing';
import { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('shares one dimming projection between node and edge bindings', async () => {
 const nodes=Array.from({length:1000},(_,i)=>({id:`n${i}`,label:`Node ${i}`}));
 const el=await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodes=${nodes} query="Node 1"></lr-knowledge-graph-explorer>`);
 const seam=el as unknown as {graphModel:{nodes:unknown[]};computedDimmedNodeIds:unknown;computedDimmedLinkIds:unknown};
 el.query='Node 2';
 const source=seam.graphModel.nodes;const original=Array.prototype.filter;let scans=0;
 Array.prototype.filter=function(...args:Parameters<typeof original>){if(this===source)scans++;return Reflect.apply(original,this,args);};
 try {void seam.computedDimmedNodeIds;void seam.computedDimmedLinkIds;recordScaleMeasurement('lr-knowledge-graph-explorer','dimming@1000',{scans});expect(scans).to.be.at.most(2);}
 finally {Array.prototype.filter=original;}
});
