import { expect, fixture, html } from '@open-wc/testing';
import { LyraMindMap } from './mind-map.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('reuses normalized topics when recomputing geometry for 1,000 topics', async () => {
 const topics=Array.from({length:1000},(_,i)=>({id:`t${i}`,label:`Topic ${i}`}));
 const el=await fixture<LyraMindMap>(html`<lr-mind-map .topics=${topics}></lr-mind-map>`);
 const original=Object.freeze;let copies=0;
 Object.freeze=function<T>(value:T):Readonly<T>{if(value && typeof value==='object' && 'id' in value && 'label' in value)copies++;return original(value);};
 try {(el as unknown as {relayout():void}).relayout();recordScaleMeasurement('lr-mind-map','relayout@1000',{copies});expect(copies).to.equal(0);}
 finally {Object.freeze=original;}
});
it('recomputes expansion-dependent leaf counts while reusing normalized topics', async () => {
 const el=await fixture<LyraMindMap>(html`<lr-mind-map expand-depth="3" .topics=${[{id:'root',label:'Root',children:[{id:'a',label:'A',children:[{id:'a1',label:'A1'},{id:'a2',label:'A2'}]},{id:'b',label:'B'}]}]}></lr-mind-map>`);
 const seam=el as unknown as {expandedOverrides:Map<string,boolean>};
 expect(el.shadowRoot!.querySelector('[data-id="a1"]')!==null).to.equal(true);
 seam.expandedOverrides=new Map([['a',false]]);await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[data-id="a1"]')===null).to.equal(true);
 seam.expandedOverrides=new Map([['a',true]]);await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[data-id="a1"]')!==null).to.equal(true);
});
it('lays out a collapsed branch only once when ArrowDown expands and focuses it', async () => {
 const el=await fixture<LyraMindMap>(html`<lr-mind-map expand-depth="0" .topics=${[{id:'root',label:'Root',children:Array.from({length:1000},(_,i)=>({id:`c${i}`,label:`Child ${i}`}))}]}></lr-mind-map>`);
 const seam=el as unknown as {focusedId:string|null;relayout():void};seam.focusedId='root';await el.updateComplete;
 const original=seam.relayout;let layouts=0;
 seam.relayout=function(){layouts++;original.call(this);};
 try {el.shadowRoot!.querySelector('[part="svg"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await el.updateComplete;
 recordScaleMeasurement('lr-mind-map','expand@1000',{layouts});expect(layouts).to.equal(1);}
 finally {seam.relayout=original;}
});
