import { expect, fixture, html } from '@open-wc/testing';
import { LyraCommandPalette } from './command-palette.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('coalesces 1,000 command registrations into one ownership update', async () => {
  const el = await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
  const original = el.requestUpdate;
  let assignments=0;
  el.requestUpdate=function(...args) {if(args[0]==='commands')assignments++; original.apply(this,args);};
  try {
    for(let i=0;i<1000;i++)el.registerCommand({commandId:`${i}`,label:`Command ${i}`});
    await Promise.resolve(); await el.updateComplete;
    expect(el.commands.length).to.equal(1000);
    recordScaleMeasurement('lr-command-palette','register@1000',{assignments});
    expect(assignments).to.equal(1);
  } finally {el.requestUpdate=original;}
});
it('does not reparse the shortcut during 100 key checks', async () => {
 const el=await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
 const seam=el as unknown as {matchesShortcut(event:KeyboardEvent):boolean};
 const event=new KeyboardEvent('keydown',{key:'x'});seam.matchesShortcut(event);
 const original=String.prototype.split;let parses=0;
 String.prototype.split=function(this: string, ...args: unknown[]) {if(String(this)===el.hotkey)parses++;return Reflect.apply(original,this,args);};
 try {for(let i=0;i<100;i++)seam.matchesShortcut(event);recordScaleMeasurement('lr-command-palette','hotkey@100',{parses});expect(parses).to.equal(0);}
 finally {String.prototype.split=original;}
});
it('uses a keyed active command lookup on unrelated updates of 1,000 rows', async () => {
 const el=await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${Array.from({length:1000},(_,i)=>({commandId:`${i}`,label:`Command ${i}`}))}></lr-command-palette>`);
 const seam=el as unknown as {filtered: unknown[]};const rows=seam.filtered;
 const original=rows.findIndex;let scans=0;
 rows.findIndex=function(...args:Parameters<typeof original>) {scans++;return Reflect.apply(original,this,args);};
 try {for(let i=0;i<3;i++){el.requestUpdate();await el.updateComplete;}recordScaleMeasurement('lr-command-palette','active-lookup@1000',{scans});expect(scans).to.equal(0);}
 finally {rows.findIndex=original;}
});
it('cancels queued registrations and honors a replacement before the batch flush', async () => {
 const el=await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
 const cancel=el.registerCommand({commandId:'cancel',label:'Cancelled'});cancel();
 el.registerCommand({commandId:'stale',label:'Stale'});
 el.commands=[{commandId:'replacement',label:'Replacement'}];
 el.registerCommand({commandId:'latest',label:'Latest'});
 await Promise.resolve();await el.updateComplete;
 expect(el.commands.map(row=>row.commandId)).to.deep.equal(['replacement','latest']);
});
it('preserves a pending addition when a settled registration is disposed', async () => {
 const el=await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
 const dispose=el.registerCommand({commandId:'a',label:'A'});
 await Promise.resolve();await el.updateComplete;
 el.registerCommand({commandId:'b',label:'B'});dispose();
 await Promise.resolve();await el.updateComplete;
 expect(el.commands.map(row=>row.commandId)).to.deep.equal(['b']);
});
it('disables an undefined first shortcut and immediately accepts a restored chord', async () => {
 const el=await fixture<LyraCommandPalette>(html`<lr-command-palette .hotkey=${undefined}></lr-command-palette>`);
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'x',bubbles:true}));
 await el.updateComplete;
 expect(el.open).to.equal(false);
 el.hotkey='ctrl+k';
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
 await el.updateComplete;
 expect(el.open).to.equal(true);
});
