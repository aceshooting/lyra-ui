import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import type { LyraGraph, GraphSource } from '../graph/graph.class.js';
import type { LyraGraphSourceQuery } from '../../../data-sources.js';
type Explorer = LyraKnowledgeGraphExplorer & { graphSource: GraphSource | undefined; sourcePage: number; sourcePageSize: number; readonly sourceTotal: number | null; revealSourceKey(key: string): Promise<boolean> };
function provider() {
 const ids = new Uint32Array(1_000_000); for(let i=0;i<ids.length;i++) ids[i]=i;
 const queries: {query: LyraGraphSourceQuery; page: number; pageSize: number}[] = []; const lookups: readonly string[][] = []; let scenes = 0, read = 0;
 const row = (key: string) => key.startsWith('node:') ? {key,order:Number(key.slice(5)),value:{kind:'node' as const,value:{id:key.slice(5),label:`Node ${key.slice(5)}`}}} : {key,order:Number(key.slice(5)),value:{kind:'edge' as const,value:{id:key.slice(5),source:'0',target:'1'}}};
 const source: GraphSource = {revision:1,records:{revision:1,
 query:async request=>{queries.push(request); const total=request.query.search ? 777 : ids.length; const start=request.page*request.pageSize; read+=Math.max(0,Math.min(total-start,request.pageSize)); return {rows:Array.from(ids.subarray(start,Math.min(total,start+request.pageSize)),i=>row(`${request.query.kind==='nodes'?'node':'edge'}:${i}`)),total,summary:{nodes:ids.length,edges:ids.length}};},
 lookup:async keys=>{(lookups as string[][]).push([...keys]);return keys.filter(key=>key!=='node:missing').map(row);},locate:async key=>Number(key.slice(5))},
 scene:async request=>{scenes++; const keys=request.includeKeys.filter(key=>key.startsWith('node:')); return {nodes:keys.map(key=>({key,value:{id:key.slice(5),label:`Node ${key.slice(5)}`,position:{x:0,y:0,z:0}}})),edges:[],total:{nodes:ids.length,edges:ids.length},coverage:'neighborhood',worldBounds:null};}};
 return {source,queries,lookups,get scenes(){return scenes;},get read(){return read;}};
}
function graph(el: Explorer){return el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;}
async function ready(el: Explorer){await waitUntil(()=>el.sourceTotal!==undefined&&el.sourceTotal!==null,'source ready',{timeout:3000});await graph(el).updateComplete;}
it('composes one global navigator and forwards million-node and edge reveal',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source}></lr-knowledge-graph-explorer>`);await ready(el);
 expect(el.sourceTotal).to.equal(1_000_000);expect(data.queries.length).to.equal(1);expect(data.scenes).to.equal(0);
 expect(await el.revealSourceKey('node:999999')).to.equal(true);expect(el.sourcePage).to.equal(9999);
 expect(await el.revealSourceKey('edge:999999')).to.equal(true);expect(el.sourceTotal).to.equal(1_000_000);
 expect(graph(el).shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(100);
 expect(graph(el).shadowRoot!.querySelectorAll('[data-source-search]').length).to.equal(0);
 expect(data.read).to.equal(500);expect(data.queries.length).to.equal(5);
 recordScaleMeasurement('lr-knowledge-graph-explorer', 'n=1000000 source node and edge reveal', {
  sourceTotal: el.sourceTotal!, providerQueries: data.queries.length, providerRowsRead: data.read,
  sceneCalls: data.scenes, mountedRows: graph(el).shadowRoot!.querySelectorAll('[data-source-key]').length,
 });
});
it('emits authoritative global search count only for the user intent',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source}></lr-knowledge-graph-explorer>`);await ready(el);
 const events: unknown[]=[];el.addEventListener('lr-search-change',e=>events.push(e.detail));
 el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(new CustomEvent('lr-input',{detail:{value:'match'},bubbles:true,composed:true}));
 await waitUntil(()=>events.length===1);expect(events[0]).to.deep.equal({query:'match',matchCount:777,matchCountExact:true,activeIndex:-1});expect(el.sourceTotal).to.equal(777);
 expect(el.shadowRoot!.querySelector('[part="search-results"]')===null).to.equal(true);
 el.query='controlled';await el.updateComplete;await ready(el);expect(events.length).to.equal(1);
});
it('preserves offscene controlled selection with bounded lookup and no hidden neighbor query',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source} .selectedNodeId=${'999999'}></lr-knowledge-graph-explorer>`);
 const events: unknown[]=[];el.addEventListener('lr-selection-change',e=>events.push(e.detail));await ready(el);
 await waitUntil(()=>data.lookups.length>0);expect(el.selectedNodeId).to.equal('999999');expect(events).to.deep.equal([]);
 expect(data.lookups.every(keys=>keys.length<=32)).to.equal(true);expect(data.queries.some(request=>request.query.centerKey!==null)).to.equal(false);
});
it('suppresses all-hidden source work and restores the global filter on clear',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source} .nodeTypes=${[{id:'person',label:'Person'}]} .hiddenTypes=${['person']}></lr-knowledge-graph-explorer>`);
 await el.updateComplete;await graph(el).updateComplete;expect(el.sourceTotal).to.equal(0);expect(data.queries.length).to.equal(0);expect(data.scenes).to.equal(0);
 el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-clear-types]')!.click();await ready(el);expect(el.sourceTotal).to.equal(1_000_000);expect(data.queries.length).to.equal(1);
});
it('opens current user details only after scene acceptance and queries neighbors only while open',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source}></lr-knowledge-graph-explorer>`);await ready(el);
 const selected: unknown[]=[];el.addEventListener('lr-selection-change',event=>selected.push(event.detail));
 // Entity selection is handled by the explorer's composed base, as with neighbor/path controls.
 el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new CustomEvent('lr-entity-select',{detail:{entityId:'9'},bubbles:true,composed:true}));
 await waitUntil(()=>data.queries.some(request=>request.query.centerKey==='node:9'),'visible neighbor query',{timeout:3000});
 expect(data.scenes).to.equal(1);expect(selected).to.deep.equal([{selectedNodeId:'9',selectedNodeIds:['9'],selectedEdgeIds:[]}]);
 const popover=el.shadowRoot!.querySelector<HTMLElement & {open:boolean;hide():void}>('[part="detail-popover"]')!;
 expect(popover.open).to.equal(true);popover.hide();await waitUntil(()=>el.selectedNodeId===null);await el.updateComplete;
 expect(el.shadowRoot!.querySelector('lr-neighbor-list')===null).to.equal(true);
});
it('keeps user search authority latest and controlled replacement silent',async()=>{
 const data=provider();let release!:()=>void; const source:GraphSource={...data.source,records:{...data.source.records,query:async request=>{if(request.query.search==='slow')await new Promise<void>(resolve=>{release=resolve;});return data.source.records.query(request);}}};
 const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${source}></lr-knowledge-graph-explorer>`);await ready(el);
 const seen: unknown[]=[];el.addEventListener('lr-search-change',event=>seen.push(event.detail));
 el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(new CustomEvent('lr-input',{detail:{value:'slow'},bubbles:true,composed:true}));await waitUntil(()=>Boolean(release));
 el.query='controlled';await el.updateComplete;release();await waitUntil(()=>data.queries.some(request=>request.query.search==='controlled'));await graph(el).updateComplete;
 expect(seen).to.deep.equal([]);
});
it('revokes ignored-abort work when all types hide and restores the latest visible filter',async()=>{
 const data=provider();let release!:()=>void;let calls=0;
 const source:GraphSource={...data.source,records:{...data.source.records,query:async request=>{calls++;if(calls===1)await new Promise<void>(resolve=>{release=resolve;});return data.source.records.query(request);}}};
 const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${source} .nodeTypes=${[{id:'a'},{id:'b'}]}></lr-knowledge-graph-explorer>`);await waitUntil(()=>Boolean(release));
 el.hiddenTypes=['a','b'];await el.updateComplete;expect(el.sourceTotal).to.equal(0);expect(calls).to.equal(1);
 el.hiddenTypes=['a'];await el.updateComplete;expect(calls).to.equal(1);release();await ready(el);
 expect(calls).to.equal(2);expect(data.queries.at(-1)!.query.nodeTypes).to.deep.equal(['b']);
});
it('revokes old activation at a selection callback before fetching a scene on the replacement source',async()=>{
 const old=provider(),fresh=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${old.source}></lr-knowledge-graph-explorer>`);await ready(el);
 el.addEventListener('lr-selection-change',()=>{el.graphSource=fresh.source;});
 el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new CustomEvent('lr-entity-select',{detail:{entityId:'8'},bubbles:true,composed:true}));
 await waitUntil(()=>el.graphSource===fresh.source);await ready(el);
 expect(old.scenes).to.equal(0);expect(fresh.scenes).to.equal(0);expect(fresh.queries.some(request=>request.query.centerKey!==null)).to.equal(false);
});
it('keeps provider replacement and same-source refresh silent and restores latest legacy inputs',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .nodes=${[{id:'legacy',label:'Legacy'}]} .graphSource=${data.source} .selectedNodeId=${'42'}></lr-knowledge-graph-explorer>`);await ready(el);await waitUntil(()=>data.lookups.length>0);
 const events:unknown[]=[];el.addEventListener('lr-selection-change',e=>events.push(e.detail));
 el.graphSource=data.source;await waitUntil(()=>data.queries.length===2);await ready(el);expect(el.selectedNodeId).to.equal('42');expect(events).to.deep.equal([]);
 el.nodes=[{id:'new',label:'Newest legacy'}];el.selectedNodeId=null;el.graphSource=undefined;await el.updateComplete;await graph(el).updateComplete;
 expect(graph(el).graphSource).to.equal(undefined);expect(graph(el).nodes.map(node=>node.id)).to.deep.equal(['new']);
});
it('does not forward a reveal started on a replaced provider',async()=>{
 const old=provider(),fresh=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${old.source}></lr-knowledge-graph-explorer>`);await ready(el);
 const reveal=el.revealSourceKey('node:999999');el.graphSource=fresh.source;
 expect(await reveal).to.equal(false);await ready(el);expect(el.sourcePage).to.equal(0);
});
it('exposes English and overridden filter status with an accessible populated source navigator',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" style="width:320px" dir="rtl" .graphSource=${data.source} .nodeTypes=${[{id:'person',label:'Person'}]} .hiddenTypes=${['person']}></lr-knowledge-graph-explorer>`);
 await el.updateComplete;expect(el.shadowRoot!.textContent).to.contain('All configured node types are hidden.');
 expect(el.shadowRoot!.querySelector('[data-source-clear-types]')!.textContent).to.equal('Show all node types');
 el.strings={graphExplorerAllTypesHidden:'Hidden types',graphExplorerClearTypes:'Clear types'};await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[data-source-clear-types]')!.textContent).to.equal('Clear types');
 el.hiddenTypes=[];await ready(el);expect(graph(el).shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(100);await expect(el).to.be.accessible();
});
it('reconnects and adopts with only current source authority and silent controlled selection',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source} .selectedNodeId=${'42'}></lr-knowledge-graph-explorer>`);await ready(el);await waitUntil(()=>data.lookups.length>0);
 const events:unknown[]=[];el.addEventListener('lr-selection-change',e=>events.push(e.detail));const parent=el.parentNode!;el.remove();parent.appendChild(el);
 await waitUntil(()=>data.queries.length===2);await ready(el);expect(events).to.deep.equal([]);expect(el.selectedNodeId).to.equal('42');
 const frame=await fixture<HTMLIFrameElement>(html`<iframe title="Alternate document"></iframe>`);frame.contentDocument!.body.appendChild(el);await waitUntil(()=>data.queries.length===3);await ready(el);expect(events).to.deep.equal([]);
});
it('does not invoke an obsolete underlying query after a capability getter replaces the explorer source',async()=>{
 const old=provider(),fresh=provider();let el!:Explorer,armed=false,calls=0;
 const source:GraphSource={...old.source,records:{...old.source.records,get query(){if(armed){armed=false;el.graphSource=fresh.source;}return async (...args:Parameters<GraphSource['records']['query']>)=>{calls++;return old.source.records.query(...args);};}}};
 el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${source}></lr-knowledge-graph-explorer>`);await ready(el);const before=calls;
 const warnings=await captureReentrantUpdateWarning('lr-knowledge-graph-explorer',async()=>{
  armed=true;el.requestUpdate();await waitUntil(()=>fresh.queries.length===1);await ready(el);
 });
 expect(warnings).to.equal(1);expect(calls).to.equal(before);
});

it('keeps the toolbar coherent when an off-page entity activation clears the global scope',async()=>{
 const data=provider();const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source} .query=${'match'}></lr-knowledge-graph-explorer>`);await ready(el);
 el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new CustomEvent('lr-entity-select',{detail:{entityId:'999999'},bubbles:true,composed:true}));
 await waitUntil(()=>Boolean(el.shadowRoot!.querySelector<HTMLElement & {open:boolean}>('[part="detail-popover"]')?.open),'off-page details',{timeout:3000});
 expect(el.query).to.equal('');expect(el.sourcePage).to.equal(9999);expect(el.sourceTotal).to.equal(1_000_000);
});

for (const transition of ['unset', 'replace'] as const) it(`rejects retained source pin, path and detail actions after source ${transition}`, async () => {
 const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${provider().source} .pinnedNodeIds=${['0','1']}></lr-knowledge-graph-explorer>`);await ready(el);
 el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new CustomEvent('lr-entity-select',{detail:{entityId:'9'},bubbles:true,composed:true}));
 await waitUntil(()=>Boolean(el.shadowRoot!.querySelector<HTMLElement & {open:boolean}>('[part="detail-popover"]')?.open));await el.updateComplete;
 const chip=el.shadowRoot!.querySelector('[part="pinned"] lr-chip')!;
 const path=el.shadowRoot!.querySelector<HTMLElement>('[part="pinned"] lr-button')!;
 const detail=el.shadowRoot!.querySelector<HTMLElement>('lr-entity-card lr-button[slot="actions"]')!;
 let pins=0,paths=0;el.addEventListener('lr-pin-change',()=>pins++);el.addEventListener('lr-path-request',()=>paths++);
 el.graphSource=transition==='unset'?undefined:provider().source;
 path.click();chip.dispatchEvent(new CustomEvent('lr-remove',{bubbles:true,composed:true}));detail.click();
 expect(pins).to.equal(0);expect(paths).to.equal(0);expect(el.pinnedNodeIds).to.deep.equal(['0','1']);
});
for (const source of [false,true]) it(`preserves current ${source?'source':'legacy'} pin and path actions`,async()=>{
 const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .nodes=${[{id:'0'},{id:'1'}]} .graphSource=${source?provider().source:undefined} .pinnedNodeIds=${['0','1']}></lr-knowledge-graph-explorer>`);
 if(source)await ready(el);else await el.updateComplete;
 let pins=0,paths=0;el.addEventListener('lr-pin-change',()=>pins++);el.addEventListener('lr-path-request',()=>paths++);
 el.shadowRoot!.querySelector<HTMLElement>('[part="pinned"] lr-button')!.click();expect(paths).to.equal(1);
 el.shadowRoot!.querySelector('[part="pinned"] lr-chip')!.dispatchEvent(new CustomEvent('lr-remove',{bubbles:true,composed:true}));expect(pins).to.equal(1);expect(el.pinnedNodeIds).to.deep.equal(['1']);
});

it('rejects a retained legacy pin control when source mode begins',async()=>{
 const el=await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .nodes=${[{id:'0'}]} .pinnedNodeIds=${['0']}></lr-knowledge-graph-explorer>`);await el.updateComplete;
 const chip=el.shadowRoot!.querySelector('[part="pinned"] lr-chip')!;let pins=0;el.addEventListener('lr-pin-change',()=>pins++);
 el.graphSource=provider().source;chip.dispatchEvent(new CustomEvent('lr-remove',{bubbles:true,composed:true}));expect(pins).to.equal(0);expect(el.pinnedNodeIds).to.deep.equal(['0']);
});

it('resets source navigation when page size changes and renders the normalized record count', async () => {
 const data = provider();
 const el = await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="list" .graphSource=${data.source}></lr-knowledge-graph-explorer>`);
 await ready(el);
 const child = graph(el);
 const rows = () => [...child.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-source-key]')];
 expect(child.sourcePageSize).to.equal(100);
 expect(rows().length).to.equal(100);
 let currentSize = 100;
 for (const [requested, expected] of [[0, 1], [501, 500], [12.75, 12], [NaN, 100]] as const) {
  el.sourcePage = 2;
  await waitUntil(() => rows()[0]?.dataset['sourceKey'] === `node:${2 * currentSize}`);
  expect(el.sourcePage).to.equal(2);
  expect(child.sourcePage).to.equal(2);

  el.sourcePageSize = requested;
  expect(el.sourcePage).to.equal(0);
  expect(child.sourcePage).to.equal(0);
  expect(child.sourcePageSize).to.equal(expected);
  await waitUntil(() => rows().length === expected && rows()[0]?.dataset['sourceKey'] === 'node:0');
  expect(rows().at(-1)?.dataset['sourceKey']).to.equal(`node:${expected - 1}`);
  expect(data.queries.at(-1)!.page).to.equal(0);
  expect(data.queries.at(-1)!.pageSize).to.equal(expected);
  currentSize = expected;
 }
});

it('preserves strictly accepted source curvature through the wrapper child scene', async () => {
  const data = provider();
  const source: GraphSource = { ...data.source, scene: async () => ({
    nodes: [{ key: 'node:0', value: { id: '0', position: { x: -40, y: 0, z: 0 } } }, { key: 'node:1', value: { id: '1', position: { x: 40, y: 0, z: 0 } } }],
    edges: [{ key: 'edge:0', source: 'node:0', target: 'node:1', value: { id: '0', source: '0', target: '1', curvature: -4 } }],
    total: { nodes: 1_000_000, edges: 1_000_000 }, coverage: 'neighborhood', worldBounds: null,
  }) };
  const el = await fixture<Explorer>(html`<lr-knowledge-graph-explorer view="3d" .graphSource=${source} selected-node-id="0"></lr-knowledge-graph-explorer>`);
  const child = graph(el);
  const seam = child as unknown as { sourceScene: { state: { scene?: { edges: readonly { value: { curvature?: number } }[] } } } };
  await waitUntil(() => seam.sourceScene.state.scene !== undefined, 'accepted wrapper source scene');
  expect(child.graphSource === source).to.equal(true);
  expect(seam.sourceScene.state.scene!.edges[0]!.value.curvature).to.equal(-1);
  expect(child.engine).to.equal('builtin');
});
