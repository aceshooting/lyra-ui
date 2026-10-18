import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './flow-canvas.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import type { FlowNode, FlowEdge, FlowStructureSnapshot } from './flow-types.js';
import type { LyraGraphSource, LyraGraphSourceQuery } from '../../../data-sources.js';
type Source=LyraGraphSource<FlowNode,FlowEdge>;
type Canvas=LyraFlowCanvas & { graphSource:Source|undefined;sourcePage:number;sourcePageSize:number;readonly sourceTotal:number|null;revealSourceKey(key:string):Promise<boolean> };
function provider(){
 const indices=new Uint32Array(1_000_000);for(let i=0;i<indices.length;i++)indices[i]=i;
 const queries:{query:LyraGraphSourceQuery;page:number;pageSize:number}[]=[];let reads=0,scenes=0,overviews=0;
 const row=(key:string)=>({key,order:Number(key.slice(5)),value:key.startsWith('node:')?{kind:'node' as const,value:{id:key.slice(5),accessibleLabel:`Node ${key.slice(5)}`}}:{kind:'edge' as const,value:{id:key.slice(5),source:'0',target:'1',label:`Edge ${key.slice(5)}`}}});
 const source:Source={revision:1,records:{revision:1,query:async request=>{queries.push(request);const start=request.page*request.pageSize;const ids=indices.subarray(start,start+request.pageSize);reads+=ids.length;return {rows:Array.from(ids,i=>row(`${request.query.kind==='nodes'?'node':'edge'}:${i}`)),total:indices.length,summary:{nodes:indices.length,edges:indices.length}};},lookup:async keys=>keys.map(row),locate:async key=>Number(key.slice(5))},
 scene:async request=>{scenes++;const keys=[...new Set(['node:0','node:1',...request.includeKeys.filter(key=>key.startsWith('node:'))])];return {nodes:keys.map((key,i)=>({key,value:{id:key.slice(5),data:{label:`Node ${key.slice(5)}`}},position:{x:i*100,y:0}})),edges:[],coverage:'neighborhood',total:{nodes:indices.length,edges:indices.length},worldBounds:{x:-1000,y:-1000,width:2000,height:2000}};},
 overview:async()=>{overviews++;return {bounds:{x:-1000,y:-1000,width:2000,height:2000},bins:[{bounds:{x:-1000,y:-1000,width:2000,height:2000},count:indices.length}]};}};
 return {source,queries,get reads(){return reads;},get scenes(){return scenes;},get overviews(){return overviews;}};
}
const ready=(el:Canvas)=>waitUntil(()=>el.sourceTotal===1_000_000,'source page',{timeout:3000});
it('navigates million node and edge records without full flow layout',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 expect(await el.revealSourceKey('node:999999')).to.equal(true);expect(el.sourcePage).to.equal(9999);
 expect(await el.revealSourceKey('edge:999999')).to.equal(true);expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(100);expect(data.reads).to.be.at.most(600);
 expect(el.nodes.length).to.equal(0);expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.be.at.most(500);
 recordScaleMeasurement('lr-flow-canvas', 'million source node and edge routes', { allocatedIndices: 1_000_000, logicalNodes: 1_000_000, logicalEdges: 1_000_000, queries: data.queries.length, recordReads: data.reads, mountedRecords: el.shadowRoot!.querySelectorAll('[data-source-key]').length });
});
it('preserves offscene source selection and forbids editing while viewport remains usable',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source} .selectedNodeIds=${['999999']} nodes-draggable connectable droppable></lr-flow-canvas>`);await ready(el);
 expect(el.selectedNodeIds).to.deep.equal(['999999']);expect(el.readonly).to.equal(false);
 let edits=0;for(const event of ['lr-node-move','lr-connect','lr-node-add','lr-selection-delete','lr-layout-change'])el.addEventListener(event,()=>edits++);
 const viewport=el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));
 el.setViewport({x:10,y:20,zoom:1});expect(el.viewport.x).to.equal(10);expect(edits).to.equal(0);
});
it('publishes exact source-wide overview once and updates viewport scenes separately from record pages',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 let snapshot:FlowStructureSnapshot|undefined;el.registerCompanion(value=>{snapshot=value;});await waitUntil(()=>Boolean(snapshot?.source?.overview));
 expect(snapshot!.source!.worldBounds.x).to.equal(-1000);expect(snapshot!.source!.overview!.bins[0]!.count).to.equal(1_000_000);const scenes=data.scenes;
 el.sourcePage=1;await waitUntil(()=>data.queries.length===2);await el.updateComplete;expect(data.scenes).to.equal(scenes);
 el.setViewport({x:50,y:0,zoom:1});await waitUntil(()=>data.scenes>scenes);expect(data.overviews).to.equal(1);
});
it('restores latest legacy flow inputs when source is unset',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source} .nodes=${[{id:'old',position:{x:0,y:0}}]}></lr-flow-canvas>`);await ready(el);
 el.nodes=[{id:'legacy',position:{x:0,y:0}}];el.graphSource=undefined;await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[data-node-id="legacy"]')!==null).to.equal(true);expect(el.shadowRoot!.querySelector('[data-source-key]')===null).to.equal(true);
});

it('keeps original offscene node and edge identities in activation and selection events',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 const nodes:string[]=[],edges:string[]=[];
 el.addEventListener('lr-node-activate',(event:Event)=>nodes.push((event as CustomEvent).detail.nodeId));
 el.addEventListener('lr-edge-activate',(event:Event)=>edges.push((event as CustomEvent).detail.edgeId));
 await el.revealSourceKey('node:999999');el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:999999"]')!.click();
 expect(nodes).to.deep.equal(['999999']);expect(el.selectedNodeIds).to.deep.equal(['999999']);
 await el.revealSourceKey('edge:999999');el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="edge:999999"]')!.click();
 expect(edges).to.deep.equal(['999999']);expect(el.selectedEdgeIds).to.deep.equal(['999999']);
});
it('revokes detached record actions on source replacement and unset',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);await el.updateComplete;
 const old=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!;let events=0;el.addEventListener('lr-node-activate',()=>events++);
 el.graphSource=provider().source;old.click();expect(events).to.equal(0);await ready(el);await el.updateComplete;
 const replacement=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!;el.graphSource=undefined;replacement.click();expect(events).to.equal(0);
});
it('rechecks source ownership after activation callbacks before applying selection',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);await el.updateComplete;
 el.addEventListener('lr-node-activate',()=>{el.graphSource=undefined;},{once:true});
 el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:0"]')!.click();expect(el.selectedNodeIds).to.deep.equal([]);
});
it('explicitly refreshes the same source and keyless updates but not named selection updates',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 const before=data.queries.length;el.graphSource=data.source;await waitUntil(()=>data.queries.length>before);await ready(el);
 const refreshed=data.queries.length;el.requestUpdate();await waitUntil(()=>data.queries.length>refreshed);await ready(el);
 const named=data.queries.length;el.selectedNodeIds=['3'];await el.updateComplete;expect(data.queries.length).to.equal(named);
});
it('retains source-wide companion metadata while a newer viewport scene is pending',async()=>{
 const data=provider();let resolve:(value:Awaited<ReturnType<Source['scene']>>)=>void=()=>{};let hold=false;const scene=data.source.scene;
 data.source.scene=request=>hold?new Promise(done=>{resolve=done;}):scene(request);
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 let snapshot:FlowStructureSnapshot|undefined;el.registerCompanion(value=>snapshot=value);await waitUntil(()=>Boolean(snapshot?.source?.overview));
 hold=true;el.setViewport({x:200,y:0,zoom:1});await el.updateComplete;
 el.registerCompanion(value=>snapshot=value);expect(snapshot?.source?.worldBounds.x).to.equal(-1000);
 resolve(await scene({mode:'viewport',centerKey:null,bounds:{x:0,y:0,width:1,height:1},includeKeys:[],nodeLimit:500,edgeLimit:1000,revision:1,signal:new AbortController().signal,locale:'en'}));
});

it('keeps one physical viewport request and only the latest queued source intent',async()=>{
 const old=provider(),latest=provider();let calls=0;let release:()=>void=()=>{};
 const oldScene=old.source.scene;old.source.scene=async request=>{calls++;await new Promise<void>(resolve=>release=resolve);return oldScene(request);};
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${old.source}></lr-flow-canvas>`);await ready(el);await waitUntil(()=>calls===1);
 el.setViewport({x:10,y:0,zoom:1});el.setViewport({x:20,y:0,zoom:1});el.graphSource=latest.source;await el.updateComplete;
 expect(calls).to.equal(1);expect(latest.scenes).to.equal(0);release();await waitUntil(()=>latest.scenes===1);
 let snapshot:FlowStructureSnapshot|undefined;el.registerCompanion(value=>snapshot=value);await waitUntil(()=>Boolean(snapshot?.source));
 expect(snapshot!.nodes.length).to.equal(2);
});
for(const invalid of ['overlap','population','bounds','limit'] as const)it(`rejects ${invalid} source overview without inventing a local overview`,async()=>{
 const data=provider(),world={x:-1000,y:-1000,width:2000,height:2000};
 data.source.overview=async()=>({bounds:invalid==='bounds'?{...world,x:0}:world,bins:invalid==='limit'?Array.from({length:1025},()=>({bounds:world,count:0})):invalid==='overlap'?[{bounds:world,count:500000},{bounds:world,count:500000}]:[{bounds:world,count:invalid==='population'?1:1_000_000}]});
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 let snapshot:FlowStructureSnapshot|undefined;el.registerCompanion(value=>snapshot=value);await waitUntil(()=>Boolean(snapshot?.source));await el.updateComplete;
 expect(snapshot!.source!.overview).to.equal(null);expect(snapshot!.source!.total.nodes).to.equal(1_000_000);
});
it('accepts all 1024 exact overview bins without materializing the million node model',async()=>{
 const data=provider();const world={x:-1000,y:-1000,width:2000,height:2000};
 data.source.overview=async()=>({bounds:world,bins:Array.from({length:1024},(_,i)=>({bounds:{x:-1000+(i%32)*62.5,y:-1000+Math.floor(i/32)*62.5,width:62.5,height:62.5},count:i===0?1000000:0}))});
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 let snapshot:FlowStructureSnapshot|undefined;el.registerCompanion(value=>snapshot=value);await waitUntil(()=>Boolean(snapshot?.source?.overview));
 expect(snapshot!.source!.overview!.bins.length).to.equal(1024);expect(snapshot!.nodes.length).to.equal(2);expect(el.nodes.length).to.equal(0);
});
it('bounds the records page and restores current source controls after a successful same-page reveal',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 el.sourcePageSize=100000;await waitUntil(()=>data.queries.at(-1)?.pageSize===500);await ready(el);await el.revealSourceKey('node:3');
 el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:3"]')!.click();expect(el.selectedNodeIds).to.deep.equal(['3']);
 expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(500);
});
it('provides localized source controls at a narrow RTL allocation',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas dir="rtl" style="width:320px;height:480px" .strings=${{graphSourceRecords:'Records override',graphSourceNodes:'Nodes override'}} .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[part="source-navigator"]')!.getAttribute('aria-label')).to.equal('Records override');
 expect(el.shadowRoot!.textContent).to.include('Nodes override');expect(el.scrollWidth).to.be.at.most(320);
 await expect(el).to.be.accessible();
});
it('reaches the final and first global records by keyboard',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);await el.updateComplete;
 el.shadowRoot!.querySelector('[data-source-key="node:0"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
 await waitUntil(()=>el.shadowRoot!.activeElement?.getAttribute('data-source-key')==='node:999999');expect(el.sourcePage).to.equal(9999);
 el.shadowRoot!.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
 await waitUntil(()=>el.shadowRoot!.activeElement?.getAttribute('data-source-key')==='node:0');expect(el.sourcePage).to.equal(0);
});
for(const action of ['replace','revision','reveal'] as const)it(`stops inspecting a stale record after descriptor ${action} reentry`,async()=>{
 const data=provider();let el:Canvas|undefined;let armed=false,reads=0;const query=data.source.records.query;
 data.source.records.query=async request=>{
  const page=await query(request);if(!armed)return page;armed=false;
  const node=new Proxy({id:'0',accessibleLabel:'Zero'},{getOwnPropertyDescriptor(target,key){
   if(key==='id') {if(action==='replace')el!.graphSource=provider().source;else if(action==='revision')Object.defineProperty(data.source,'revision',{value:2,configurable:true});else void el!.revealSourceKey('node:3');}
   if(key==='accessibleLabel')reads++;return Reflect.getOwnPropertyDescriptor(target,key);
  }});
  return {...page,rows:[{key:'node:0',order:0,value:{kind:'node' as const,value:node}}]};
 };
 el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);armed=true;el.requestUpdate();
 await waitUntil(()=>!armed);await el.updateComplete;expect(reads).to.equal(0);
});
it('keeps one physical records request across ignored abort and source replacement',async()=>{
 const old=provider(),latest=provider();let calls=0,release:()=>void=()=>{};const query=old.source.records.query;
 old.source.records.query=async request=>{calls++;await new Promise<void>(resolve=>release=resolve);return query(request);};
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${old.source}></lr-flow-canvas>`);await waitUntil(()=>calls===1);
 el.sourcePage=2;el.sourcePage=3;el.graphSource=latest.source;await el.updateComplete;expect(latest.queries.length).to.equal(0);expect(calls).to.equal(1);
 release();await ready(el);expect(latest.queries.length).to.equal(1);expect(latest.queries[0]!.page).to.equal(0);
});
it('revokes obsolete retry controls and recovers an explicit failed-source refresh',async()=>{
 const bad=provider();let failing=true;const query=bad.source.records.query;
 bad.source.records.query=async request=>{if(failing)throw new Error('private failure');return query(request);};
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${bad.source}></lr-flow-canvas>`);
 await waitUntil(()=>Boolean(el.shadowRoot!.querySelector('[part="source-navigator"] [part="source-status"] button')));
 const old=el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-navigator"] [part="source-status"] button')!;
 expect(el.shadowRoot!.textContent).not.to.include('private failure');const replacement=provider();el.graphSource=replacement.source;await ready(el);const count=replacement.queries.length;old.click();await el.updateComplete;expect(replacement.queries.length).to.equal(count);
 el.graphSource=bad.source;await waitUntil(()=>Boolean(el.shadowRoot!.querySelector('[part="source-navigator"] [part="source-status"] button')));failing=false;
 el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-navigator"] [part="source-status"] button')!.click();await ready(el);
});
it('keeps one optional overview call in flight and accepts only the latest provider result',async()=>{
 const old=provider(),latest=provider();let started=false,release:()=>void=()=>{};const overview=old.source.overview!;
 old.source.overview=async context=>{started=true;await new Promise<void>(resolve=>release=resolve);return overview(context);};
 const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${old.source}></lr-flow-canvas>`);await ready(el);await waitUntil(()=>started);
 el.graphSource=latest.source;await ready(el);await el.updateComplete;expect(latest.overviews).to.equal(0);release();await waitUntil(()=>latest.overviews===1);
});
it('does not commit a legacy drag when a source takes ownership before pointerup',async()=>{
 const el=await fixture<Canvas>(html`<lr-flow-canvas nodes-draggable .nodes=${[{id:'legacy',position:{x:0,y:0}}]}></lr-flow-canvas>`);await el.updateComplete;
 let moves=0;el.addEventListener('lr-node-move',()=>moves++);const node=el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="legacy"]')!;node.setPointerCapture=()=>{};
 node.dispatchEvent(new PointerEvent('pointerdown',{pointerId:12,clientX:0,clientY:0,bubbles:true}));el.graphSource=provider().source;
 window.dispatchEvent(new PointerEvent('pointermove',{pointerId:12,clientX:100,clientY:0}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:12,clientX:100,clientY:0}));expect(moves).to.equal(0);await ready(el);
});
it('preserves source overview identity across viewport-only companion updates',async()=>{
 const data=provider();const el=await fixture<Canvas>(html`<lr-flow-canvas .graphSource=${data.source}></lr-flow-canvas>`);await ready(el);
 let snapshot:FlowStructureSnapshot|undefined;el.registerCompanion(value=>snapshot=value);await waitUntil(()=>Boolean(snapshot?.source?.overview));const overview=snapshot!.source!.overview;
 el.setViewport({x:30,y:40,zoom:1});await waitUntil(()=>snapshot?.viewport.x===30);expect(snapshot!.source!.overview===overview).to.equal(true);expect(Object.isFrozen(overview)).to.equal(true);
});

function source(): Source {
 const row=(i:number)=>({key:`node:${i}`,order:i,value:{kind:'node' as const,value:{id:String(i)}}});
 return {revision:1,records:{revision:1,query:async r=>({rows:[0,1].slice(r.page*r.pageSize,(r.page+1)*r.pageSize).map(row),total:2,summary:{nodes:2,edges:0}}),lookup:async keys=>keys.map(k=>row(Number(k.slice(5)))),locate:async k=>Number(k.slice(5))},scene:async()=>({nodes:[0,1].map(i=>({key:`node:${i}`,value:{id:String(i)},position:{x:i*100,y:0}})),edges:[],coverage:'complete',total:{nodes:2,edges:0},worldBounds:{x:0,y:0,width:200,height:100}})};
}
it('final activation authority capture cannot emit after revision getter unsets source',async()=>{
 const data=source();let armed=false,reads=0;let el:LyraFlowCanvas;
 Object.defineProperty(data,'revision',{get(){if(armed&&++reads===2){armed=false;el.graphSource=undefined;}return 1;}});
 el=await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .graphSource=${data}></lr-flow-canvas>`);
 await waitUntil(()=>el.sourceTotal===2);await el.updateComplete;
 let activations=0;el.addEventListener('lr-node-activate',()=>activations++);
 const button=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:0"]')!;
 armed=true;button.click();expect(reads).to.equal(2);expect(el.graphSource===undefined).to.equal(true);expect(activations).to.equal(0);
});
it('publishes corrected source page after request beyond final page',async()=>{
 const el=await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .graphSource=${source()}></lr-flow-canvas>`);
 await waitUntil(()=>el.sourceTotal===2);el.sourcePage=100;await waitUntil(()=>el.sourceTotal===2);await el.updateComplete;
 expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(2);
 expect(el.sourcePage).to.equal(0);expect(el.shadowRoot!.querySelector<HTMLInputElement>('[data-source-page]')!.value).to.equal('1');
});
