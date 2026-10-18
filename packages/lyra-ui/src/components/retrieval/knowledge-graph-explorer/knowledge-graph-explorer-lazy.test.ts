import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.class.js';
import './knowledge-graph-explorer.js';
describe('optional explorer children', function () {
 this.retries(0);
 it('loads the path child only when its data is present', async () => {
  expect(customElements.get('lr-path-strip')===undefined).to.equal(true);
  const el=await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodes=${[{id:'a',label:'A'}]}></lr-knowledge-graph-explorer>`);
  el.pinnedNodeIds=['a'];await el.updateComplete;
  expect(typeof customElements.get('lr-chip')).to.equal('function');
  expect(customElements.get('lr-path-strip')===undefined).to.equal(true);
  el.path=[{kind:'node',node:{id:'a',label:'A'}}];await el.updateComplete;
  expect(typeof customElements.get('lr-path-strip')).to.equal('function');
  expect(el.shadowRoot!.querySelector('lr-path-strip')!==null).to.equal(true);
 });

const path = [{kind:'node' as const,node:{id:'a',label:'A'}}];
type PathLoader = {loadOptionalPath():Promise<void>};
it('awaits initially supplied path registration before mounting dependent DOM', async () => {
 const host=await fixture<HTMLDivElement>(html`<div></div>`);
 const el=document.createElement('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;
 el.path=path;
 const seam=el as unknown as PathLoader;const original=seam.loadOptionalPath;
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let started=false;
 seam.loadOptionalPath=async()=>{started=true;await held;await original.call(el);};
 host.append(el);await waitUntil(()=>started);
 let settled=false;const done=el.updateComplete.then(()=>settled=true);await Promise.resolve();
 expect(settled).to.equal(false);expect(el.shadowRoot!.querySelector('lr-path-strip')===null).to.equal(true);
 release();await done;
 expect(el.shadowRoot!.querySelector('lr-path-strip')!==null).to.equal(true);
});
it('ignores cleared and disconnected pending paths, then reloads on reconnect', async () => {
 const host=await fixture<HTMLDivElement>(html`<div></div>`);
 const el=document.createElement('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;host.append(el);await el.updateComplete;
 const seam=el as unknown as PathLoader;const original=seam.loadOptionalPath;
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let loads=0;
 seam.loadOptionalPath=async()=>{loads++;await held;await original.call(el);};
 el.path=path;await waitUntil(()=>loads===1);
 el.path=[];await el.updateComplete;
 el.path=path;await waitUntil(()=>loads===2);el.remove();
 release();await new Promise(resolve=>setTimeout(resolve,0));
 expect(el.shadowRoot!.querySelector('lr-path-strip')===null).to.equal(true);
 host.append(el);await el.updateComplete;
 expect(loads).to.equal(3);expect(el.shadowRoot!.querySelector('lr-path-strip')!==null).to.equal(true);
});
it('shows a localized failed-import fallback and recovers after clearing the path', async () => {
 const host=await fixture<HTMLDivElement>(html`<div></div>`);
 const el=document.createElement('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;
 const seam=el as unknown as PathLoader;const original=seam.loadOptionalPath;
 seam.loadOptionalPath=async()=>{throw new Error('Internal loader detail');};
 el.strings={statusError:'Path unavailable'};el.path=path;host.append(el);await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[part="path"]')?.textContent).to.equal('Path unavailable');
 expect(el.shadowRoot!.querySelector('lr-path-strip')===null).to.equal(true);
 el.path=[];await el.updateComplete;seam.loadOptionalPath=original;
 el.path=path;await el.updateComplete;
 expect(el.shadowRoot!.querySelector('lr-path-strip')!==null).to.equal(true);
});

});
