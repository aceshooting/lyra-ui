import { expect, fixture, html } from '@open-wc/testing';
import './app-rail.js';
import type { LyraAppRail } from './app-rail.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses a hotkey parse across 1000 keyboard eligibility checks', async()=>{
  const el=await fixture<LyraAppRail>(html`<lr-app-rail hotkey="ctrl+k"></lr-app-rail>`);
  const probe=el as unknown as {acceptsHotkey(event:KeyboardEvent):boolean};
  const original=String.prototype.split;
  let parses=0;
  String.prototype.split=function(...args: unknown[]): string[]{if(String(this)==='ctrl+k')parses++;return Reflect.apply(original,this,args);};
  try{for(let index=0;index<1000;index++)probe.acceptsHotkey(new KeyboardEvent('keydown',{key:'x'}));expect(parses).to.equal(0);recordScaleMeasurement('lr-app-rail','1000 keyboard eligibility checks',{hotkeyParses:parses});}
  finally{String.prototype.split=original;}
});
it('observes a changed chord immediately without waiting for a render',async()=>{
  const el=await fixture<LyraAppRail>(html`<lr-app-rail hotkey="ctrl+k"></lr-app-rail>`);
  const probe=el as unknown as {resolvedHotkeyShortcuts:string|null};
  expect(probe.resolvedHotkeyShortcuts).to.equal('Control+K');
  el.hotkey='alt+j';
  expect(probe.resolvedHotkeyShortcuts).to.equal('Alt+J');
});
it('does not redetect the platform during 1000 keyboard eligibility checks',async()=>{
  const el=await fixture<LyraAppRail>(html`<lr-app-rail hotkey="ctrl+k"></lr-app-rail>`);
  const probe=el as unknown as {acceptsHotkey(event:KeyboardEvent):boolean};
  const descriptor=Object.getOwnPropertyDescriptor(navigator,'userAgentData');
  let detections=0;
  Object.defineProperty(navigator,'userAgentData',{configurable:true,get:()=>{detections++;return {platform:'Linux'};}});
  try{for(let index=0;index<1000;index++)probe.acceptsHotkey(new KeyboardEvent('keydown',{key:'x'}));expect(detections).to.equal(0);recordScaleMeasurement('lr-app-rail','1000 keyboard platform checks',{platformDetections:detections});}
  finally{if(descriptor)Object.defineProperty(navigator,'userAgentData',descriptor);else Reflect.deleteProperty(navigator,'userAgentData');}
});
