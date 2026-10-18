import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraEmbeddingExplorer } from './embedding-explorer.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
const points = (n: number) => Array.from({length:n}, (_, i) => ({id:`p${i}`,x:i,y:i%17}));
it('raises the render sample while preserving the default and disclosure', async () => {
 const el=await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${points(3000)}></lr-embedding-explorer>`);
 expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(1000);
 Object.assign(el,{maxRenderedPoints:2000});await el.updateComplete;
 const rows=el.shadowRoot!.querySelectorAll('[part="point"]').length;
 recordScaleMeasurement('lr-embedding-explorer','raised-sample@3000',{rows});
 expect(rows).to.equal(2000);
 expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('2,000');
});
it('does not rederive bounds or clusters for a selection-only update of 1,000 points', async () => {
 const el=await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${points(1000)}></lr-embedding-explorer>`);
 const seam=el as unknown as {validPoints:unknown[];bounds:object;clusters:unknown[]};
 const before=[seam.validPoints,seam.bounds,seam.clusters];
 el.selectedPointId='p900';await el.updateComplete;
 const rebuilt=[seam.validPoints,seam.bounds,seam.clusters].filter((value,i)=>value!==before[i]).length;
 recordScaleMeasurement('lr-embedding-explorer','selection@1000',{rebuilt});
 expect(rebuilt).to.equal(0);
});
it('bounds invalid sample limits and retains an out-of-sample selection', async () => {
 const el=await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${points(1200)} max-rendered-points="1" selected-point-id="p1199"></lr-embedding-explorer>`);
 expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
 expect(el.shadowRoot!.querySelector('[data-id="p1199"]')?.getAttribute('aria-selected')).to.equal('true');
 el.maxRenderedPoints=NaN;await el.updateComplete;
 expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(1000);
 el.maxRenderedPoints=-10;await el.updateComplete;
 expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
});
it('clamps the raised sample to 10,000 before rendering', async () => {
 const el=await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${points(12000)} .maxRenderedPoints=${1}></lr-embedding-explorer>`);
 await waitUntil(() => el.points.length > 0, 'large input sample did not finish');
 await el.updateComplete;
 el.maxRenderedPoints=100000;
 const seam=el as unknown as {willUpdate(changed:Map<string,unknown>):void;renderedPoints:unknown[]};
 seam.willUpdate(new Map([['points',undefined],['maxRenderedPoints',undefined]]));
 expect(seam.renderedPoints.length).to.equal(10000);
 el.maxRenderedPoints=1; await el.updateComplete;
});
it('reserves selection without rebuilding the unchanged sample of 3,000 points', async () => {
 const el=await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${points(3000)}></lr-embedding-explorer>`);
 const original=Set.prototype.add;let sampled=0;
 Set.prototype.add=function(value){if(value && typeof value==='object' && typeof value.id==='string' && value.id.startsWith('p'))sampled++;return original.call(this,value);};
 try {el.selectedPointId='p1501';await el.updateComplete;recordScaleMeasurement('lr-embedding-explorer','selection-sample@3000',{sampled});expect(sampled).to.equal(0);}
 finally {Set.prototype.add=original;}
});
