import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './mind-map.js';
import type { LyraMindMap, LyraTopic } from './mind-map.class.js';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchyAction } from '../../../data-sources.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');
type Source = LyraHierarchySource<LyraTopic, LyraHierarchyQuery>;
type MapElement = LyraMindMap & { treeSource: Source | undefined; revealSourceKey(key: string): Promise<boolean> };
function provider(count = 1_000_000) {
 const ids=new Uint32Array(count);for(let i=0;i<count;i++)ids[i]=i;
 const actions:LyraHierarchyAction[]=[];let reads=0;let selected='';let expanded=true;
 const row=(i:number):LyraHierarchyRow<LyraTopic>=>({key:`n${ids[i]}`,value:{id:`n${i}`,label:`Topic ${i}`},parentKey:i?'n0':null,level:i?2:1,position:i||1,setSize:i?count-1:1,childCount:i?0:count-1,expanded:i?false:expanded,selected:selected===`n${i}`});
 const source:Source={revision:1,project:async request=>{actions.push(request.action);if(request.action.type==='select')selected=request.action.key;if(request.action.type==='toggle')expanded=request.action.expanded;
 return {state:`s${actions.length}`,total:count,rows:{count:expanded?count:1,keyAt:i=>`n${i}`,indexOfKey:(key:string|number)=>Number(String(key).slice(1)),itemAt:i=>{reads++;return row(i);}},...(request.action.type==='reveal'?{focusIndex:Number(request.action.key.slice(1))}:{})};}};
 return {source,actions,get reads(){return reads;}};
}
const ready=(el:MapElement,key='n0')=>waitUntil(()=>Boolean(el.shadowRoot!.querySelector(`[data-source-key="${key}"]`)), 'source row',{timeout:3000});
it('navigates a million topics globally with bounded connected diagram and mounted rows',async()=>{
 const data=provider();const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el);
 expect(await el.revealSourceKey('n999999')).to.equal(true);await ready(el,'n999999');
 expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.be.at.most(301);
 expect(el.shadowRoot!.querySelector('[data-source-key="n999999"]')!.getAttribute('aria-setsize')).to.equal('999999');
 await waitUntil(()=>el.shadowRoot!.querySelectorAll('[part="node"]').length>0);
 expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.be.at.most(400);expect(data.reads).to.be.lessThan(1000);
 recordScaleMeasurement('lr-mind-map', 'n=1000000 source reveal bounded diagram', {
  sourceProjections: data.actions.length, sourceRowsRead: data.reads,
  mountedSourceRows: el.shadowRoot!.querySelectorAll('[data-source-key]').length,
  mountedDiagramNodes: el.shadowRoot!.querySelectorAll('[part="node"]').length,
 });
});
it('uses authoritative child counts and emits only accepted topic actions',async()=>{
 const data=provider(20);const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el);
 const selected:string[]=[],toggled:unknown[]=[];el.addEventListener('lr-topic-select',e=>selected.push(e.detail.topicId));el.addEventListener('lr-topic-toggle',e=>toggled.push(e.detail));
 (el.shadowRoot!.querySelector('[data-source-key="n0"]') as HTMLElement).click();await waitUntil(()=>toggled.length===1);expect(toggled).to.deep.equal([{topicId:'n0',expanded:false}]);expect(selected).to.deep.equal([]);
 expect(await el.revealSourceKey('n0')).to.equal(true);expect(toggled.length).to.equal(1);
 await waitUntil(()=>el.shadowRoot!.querySelectorAll('[part="node"]').length===1);
 el.shadowRoot!.querySelector('[part="node"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 await waitUntil(()=>toggled.length===2);expect(toggled[1]).to.deep.equal({topicId:'n0',expanded:true});expect(selected).to.deep.equal([]);
});
it('rejects stale diagram actions on source unset',async()=>{
 const data=provider(20);const el=await fixture<MapElement>(html`<lr-mind-map .topics=${[{id:'legacy',label:'Legacy'}]} .treeSource=${data.source}></lr-mind-map>`);await ready(el);
 await waitUntil(()=>Boolean(el.shadowRoot!.querySelector('[part="node"]')));const node=el.shadowRoot!.querySelector('[part="node"]')!;let events=0;el.addEventListener('lr-topic-toggle',()=>events++);el.addEventListener('lr-topic-select',()=>events++);
 el.treeSource=undefined;node.dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(events).to.equal(0);await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[data-id="legacy"]')!==null).to.equal(true);expect(el.shadowRoot!.querySelector('[data-source-key]')===null).to.equal(true);
});
it('explicit same-source assignment refreshes while never-set legacy behavior stays available',async()=>{
 const data=provider(20);const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el);el.treeSource=data.source;await waitUntil(()=>data.actions.length===2);await ready(el);
 const legacy=await fixture<MapElement>(html`<lr-mind-map .topics=${[{id:'leaf',label:'Leaf'}]}></lr-mind-map>`);let id='';legacy.addEventListener('lr-topic-select',e=>id=e.detail.topicId);legacy.shadowRoot!.querySelector('[data-id="leaf"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(id).to.equal('leaf');
});

it('uses global keyboard endpoints and preserves deep metadata outside the root cache',async()=>{
 const data=provider(10000),original=data.source.project;
 data.source.project=async request=>{const result=await original(request);const rows=result.rows as {count:number;itemAt:(i:number)=>LyraHierarchyRow<LyraTopic>;keyAt:(i:number)=>string;indexOfKey:(key:string|number)=>number};return {...result,rows:{...rows,itemAt:(i:number)=>({...rows.itemAt(i),parentKey:i?`n${i-1}`:null,level:i+1,position:1,setSize:1,childCount:i<9999?1:0,expanded:i<9999})}};};
 const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el);
 el.shadowRoot!.querySelector('[role="tree"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));await ready(el,'n9999');
 expect(el.shadowRoot!.querySelector('[data-source-key="n9999"]')!.getAttribute('aria-level')).to.equal('10000');
 await waitUntil(()=>Boolean(el.shadowRoot!.querySelector('[part="node"]')));
 const nodeIds=new Set([...el.shadowRoot!.querySelectorAll('[part="node"]')].map(el=>el.getAttribute('data-id')));expect(nodeIds.size).to.be.at.most(301);
 expect(data.reads).to.be.lessThan(1000);
});
it('never reads value children and stops descriptor reads after provider replacement',async()=>{
 const data=provider(10),fresh=provider(10),original=data.source.project;let children=0,labelReads=0,armed=false;let el!:MapElement;
 data.source.project=async request=>{const result=await original(request);const rows=result.rows as {count:number;itemAt:(i:number)=>LyraHierarchyRow<LyraTopic>;keyAt:(i:number)=>string;indexOfKey:(key:string|number)=>number};return {...result,rows:{...rows,itemAt:(i:number)=>({...rows.itemAt(i),value:new Proxy({id:`n${i}`,label:`Topic ${i}`,get children():readonly LyraTopic[]{children++;throw new Error('children');}}, {getOwnPropertyDescriptor(target,key){if(key==='id'&&armed){armed=false;el.treeSource=fresh.source;}if(key==='label')labelReads++;return Reflect.getOwnPropertyDescriptor(target,key);}})})}};};
 el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el);expect(children).to.equal(0);const before=labelReads;
 const warnings=await captureReentrantUpdateWarning('lr-virtual-list',async()=>{
  armed=true;el.treeSource=data.source;await waitUntil(()=>fresh.actions.length===1);await ready(el);
 });
 expect(warnings).to.equal(1);expect(labelReads).to.equal(before);expect(children).to.equal(0);
});
it('emits one original leaf ID only after accepted selection and remains silent on reveal',async()=>{
 const data=provider(10);const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el,'n9');
 const seen:string[]=[];el.addEventListener('lr-topic-select',event=>seen.push(event.detail.topicId));
 (el.shadowRoot!.querySelector('[data-source-key="n9"]') as HTMLElement).click();await waitUntil(()=>seen.length===1);expect(seen).to.deep.equal(['n9']);
 expect(await el.revealSourceKey('n9')).to.equal(true);expect(seen).to.deep.equal(['n9']);
});
it('serializes ignored-abort projection replacement and rejects stale accepted events',async()=>{
 const old=provider(10),fresh=provider(10),project=old.source.project;let release!:()=>void;
 old.source.project=async request=>{if(request.action.type==='select')await new Promise<void>(resolve=>{release=resolve;});return project(request);};
 const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${old.source}></lr-mind-map>`);await ready(el,'n9');let events=0;el.addEventListener('lr-topic-select',()=>events++);
 (el.shadowRoot!.querySelector('[data-source-key="n9"]') as HTMLElement).click();await waitUntil(()=>Boolean(release));el.treeSource=fresh.source;await el.updateComplete;expect(fresh.actions.length).to.equal(0);
 release();await waitUntil(()=>fresh.actions.length===1);await ready(el);expect(events).to.equal(0);
});
it('refreshes keyless, reconnects and adopts without stale topic events',async()=>{
 const data=provider(10);const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source}></lr-mind-map>`);await ready(el);let events=0;el.addEventListener('lr-topic-select',()=>events++);el.addEventListener('lr-topic-toggle',()=>events++);
 el.requestUpdate();await waitUntil(()=>data.actions.length===2);await ready(el);const parent=el.parentNode!;el.remove();parent.appendChild(el);await waitUntil(()=>data.actions.length===3);await ready(el);
 const frame=await fixture<HTMLIFrameElement>(html`<iframe title="Other document"></iframe>`);frame.contentDocument!.body.appendChild(el);await waitUntil(()=>data.actions.length===4);await ready(el);expect(events).to.equal(0);
});

it('rejects over-budget topic payloads without falling back to legacy children',async()=>{
 const data=provider(10),original=data.source.project;
 data.source.project=async request=>{const result=await original(request);const rows=result.rows as {count:number;itemAt:(i:number)=>LyraHierarchyRow<LyraTopic>;keyAt:(i:number)=>string;indexOfKey:(key:string|number)=>number};return {...result,rows:{...rows,itemAt:(i:number)=>({...rows.itemAt(i),value:{id:`n${i}`,label:'x'.repeat(65536)}})}};};
 const el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${data.source} .topics=${[{id:'legacy',label:'Legacy'}]}></lr-mind-map>`);
 await waitUntil(()=>Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);expect(el.shadowRoot!.querySelector('[data-id="legacy"]')===null).to.equal(true);
});
it('keeps source localization and a narrow RTL navigator accessible',async()=>{
 const data=provider(20);const el=await fixture<MapElement>(html`<lr-mind-map style="width:320px" dir="rtl" .treeSource=${data.source}></lr-mind-map>`);await ready(el);
 expect(el.shadowRoot!.textContent).to.contain('20 visible of 20 nodes.');
 el.strings={treeSourceSummary:'{visible} topics of {total}',collapse:'Close branch'};await el.updateComplete;
 await waitUntil(()=>el.shadowRoot!.textContent!.includes('20 topics of 20'));
 expect(el.shadowRoot!.querySelector('[data-source-key="n0"] button')!.getAttribute('aria-label')).to.equal('Close branch');
 await expect(el).to.be.accessible();
});

it('stops old value fields when an id descriptor starts a newer reveal', async () => {
 let el!: MapElement; let armed = false; let later = 0; let calls = 0;
 const source: Source = { revision: 1, project: async request => {
  calls++; const generation = calls;
  return { state: String(calls), total: 10, rows: { count: 10, keyAt: i => `n${i}`, indexOfKey: (key:string|number) => Number(String(key).slice(1)), itemAt: i => ({
   key: `n${i}`, value: new Proxy({id:`n${i}`,label:`Topic ${i}`} as LyraTopic, {getOwnPropertyDescriptor(target,key) {
    if (key === 'id' && armed && generation === 2) { armed=false; void el.revealSourceKey('n9'); }
    if (key === 'label' && generation === 2) later++;
    return Reflect.getOwnPropertyDescriptor(target,key);
   }}), parentKey:null,level:1,position:i+1,setSize:10,childCount:0,expanded:false,selected:false
  }) }, ...(request.action.type === 'reveal' ? {focusIndex:9} : {}) };
 }};
 el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${source}></lr-mind-map>`);
 await waitUntil(()=>!!el.shadowRoot!.querySelector('[data-source-key="n0"]'));
 const warnings=await captureReentrantUpdateWarning('lr-virtual-list',async()=>{
  armed=true; el.treeSource=source;
  await waitUntil(()=>calls===3);
  await waitUntil(()=>!!el.shadowRoot!.querySelector('[data-source-key="n9"]'));
 });
 expect(warnings).to.equal(1);expect(later).to.equal(0);
});

it('stops old projection value reads after an id descriptor changes source revision',async()=>{
 let el!:MapElement,armed=false,later=0,calls=0;const source:Source={revision:1,project:async()=>{const generation=++calls;return {state:String(calls),total:10,rows:{count:10,keyAt:i=>`n${i}`,indexOfKey:(key:string|number)=>Number(String(key).slice(1)),itemAt:i=>({key:`n${i}`,value:new Proxy({id:`n${i}`,label:`Topic ${i}`},{getOwnPropertyDescriptor(target,key){if(key==='id'&&armed&&generation===2){armed=false;Object.assign(source,{revision:2});}if(key==='label'&&generation===2)later++;return Reflect.getOwnPropertyDescriptor(target,key);}}),parentKey:null,level:1,position:i+1,setSize:10,childCount:0,expanded:false,selected:false})}};}};
 el=await fixture<MapElement>(html`<lr-mind-map .treeSource=${source}></lr-mind-map>`);await ready(el);armed=true;el.treeSource=source;await waitUntil(()=>!armed);await el.updateComplete;
 expect(later).to.equal(0);el.requestUpdate();await ready(el);expect(calls).to.be.greaterThan(2);
});
