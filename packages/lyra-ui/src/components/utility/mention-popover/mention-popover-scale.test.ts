import { expect, fixture, html } from '@open-wc/testing';
import { LyraMentionPopover } from './mention-popover.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';
const items = (n:number) => Array.from({length:n},(_,i)=>({suggestionId:`${i}`,label:`Person ${i}`,description:'Candidate'}));
it('admits a bounded prefix and discloses omitted candidates', async () => {
  const el = await fixture<LyraMentionPopover>(html`<lr-mention-popover .items=${items(10001)}></lr-mention-popover>`);
  expect(el.items.length).to.equal(10000);
  expect(el.shadowRoot!.querySelector('[part="limit"]') !== null).to.equal(true);
});
it('keeps 1,000 closed candidates unrendered', async () => {
  const el = await fixture<LyraMentionPopover>(html`<lr-mention-popover .items=${items(1000)}></lr-mention-popover>`);
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]').length;
  recordScaleMeasurement('lr-mention-popover','closed@1000',{rows});
  expect(rows).to.equal(0);
});
it('folds candidate fields once across successive queries', async () => {
  const el = await fixture<LyraMentionPopover>(html`<lr-mention-popover .items=${items(1000)}></lr-mention-popover>`);
  el.query='p'; void el.filteredItems;
  const calls = countCalls(String.prototype,'toLocaleLowerCase');
  try {
    for(const query of ['pe','per','pers']) {el.query=query;void el.filteredItems;}
    recordScaleMeasurement('lr-mention-popover','search@1000',{folds:calls.calls});
    expect(calls.calls).to.be.at.most(3);
  } finally {calls.restore();}
});
it('reuses caret mirror nodes for 100 measurements of a 5,000-character anchor', async () => {
 const anchor=await fixture<HTMLTextAreaElement>(html`<textarea style="width:300px;height:100px"></textarea>`);
 anchor.value='x'.repeat(5000);anchor.setSelectionRange(5000,5000);
 const el=await fixture<LyraMentionPopover>(html`<lr-mention-popover .anchor=${anchor}></lr-mention-popover>`);
 const seam=el as unknown as {resolveAnchorElement():unknown};seam.resolveAnchorElement();
 const original=document.createElement;let allocations=0;
 document.createElement=function(...args:Parameters<typeof original>){allocations++;return original.apply(this,args);};
 try {for(let i=0;i<100;i++)seam.resolveAnchorElement();recordScaleMeasurement('lr-mention-popover','caret@5000',{allocations});expect(allocations).to.equal(0);}
 finally {document.createElement=original;}
});
it('selects a candidate using its cached source position', async () => {
 const el=await fixture<LyraMentionPopover>(html`<lr-mention-popover .items=${items(1000)}></lr-mention-popover>`);
 const source=el.items;const original=Array.prototype.indexOf;let scans=0;
 Array.prototype.indexOf=function(...args:Parameters<typeof original>){if(this===source)scans++;return original.apply(this,args);};
 try {(el as unknown as {commit(item:unknown):void}).commit(source[999]);expect(scans).to.equal(0);}
 finally {Array.prototype.indexOf=original;}
});
it('refreshes custom filter closure state on a coalesced explicit update', async () => {
 const anchor=await fixture<HTMLElement>(html`<button>Anchor</button>`);let visible=true;
 const el=await fixture<LyraMentionPopover>(html`<lr-mention-popover open .anchor=${anchor} query="x" .items=${items(2)} .filter=${()=>visible}></lr-mention-popover>`);
 expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(2);
 visible=false;el.label='Changed';el.requestUpdate();await el.updateComplete;
 expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});
it('reuses its owned candidate snapshot without reading descriptors again', async () => {
 const el=await fixture<LyraMentionPopover>(html`<lr-mention-popover .items=${items(1000)}></lr-mention-popover>`);
 const source=el.items; const original=Object.getOwnPropertyDescriptor; let reads=0;
 Object.getOwnPropertyDescriptor=function(target,key){if(target===source)reads++;return original(target,key);};
 try {el.items=source;expect(reads).to.equal(0);expect(el.items===source).to.equal(true);}
 finally {Object.getOwnPropertyDescriptor=original;}
});
it('localizes and clears admission disclosure, skipping accessor fields safely', async () => {
 let reads=0;const rows=items(10001);Object.defineProperty(rows[0], 'description',{get(){reads++;return 'unsafe';},enumerable:true});
 const el=await fixture<LyraMentionPopover>(html`<lr-mention-popover .items=${rows} .strings=${{mentionInputLimit:'Candidate limit'}}></lr-mention-popover>`);
 expect(reads).to.equal(0);expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Candidate limit');
 el.items=[];await el.updateComplete;expect(el.shadowRoot!.querySelector('[part="limit"]')===null).to.equal(true);
});
