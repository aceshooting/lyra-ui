import { expect } from '@open-wc/testing';
import './menubar.js';
import type { LyraMenubar } from './menubar.js';
import type { LyraMenubarItem } from './menubar-item.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('folds a 1000-item typeahead corpus once across distinct queries', () => {
  const el = document.createElement('lr-menubar') as LyraMenubar;
  const items = Array.from({length:1000}, (_, index) => ({textLabel:`Entry ${index}`})) as LyraMenubarItem[];
  const probe = el as unknown as {items: LyraMenubarItem[]; isNavigable(item: LyraMenubarItem):boolean; eventItem(event: Event):unknown; onKeyDown(event:KeyboardEvent):void; typeBuffer:{clear():void}};
  probe.items=items; probe.isNavigable=()=>true; probe.eventItem=()=>({item:items[0],path:[],inMenu:false});
  const key = (text: string) => { const event = new KeyboardEvent('keydown', {key:text}); Object.defineProperty(event, 'target', {value:items[0]}); return event; };
  probe.onKeyDown(key('z'));  probe.typeBuffer.clear();
  const original=String.prototype.toLocaleLowerCase;
  let folds=0;
  String.prototype.toLocaleLowerCase=function(...args){folds++;return original.apply(this,args);};
  try {probe.onKeyDown(key('q'));expect(folds).to.equal(1);recordScaleMeasurement('lr-menubar','1000 items second typeahead query',{folds});}
  finally {String.prototype.toLocaleLowerCase=original;probe.typeBuffer.clear();}
});
it('reads updated labels and locale before the next typeahead key',()=>{
  const el=document.createElement('lr-menubar') as LyraMenubar;
  const item={textLabel:'Alpha'} as LyraMenubarItem;
  const probe=el as unknown as {items:LyraMenubarItem[];isNavigable(item:LyraMenubarItem):boolean;eventItem(event:Event):unknown;onKeyDown(event:KeyboardEvent):void;move(item:LyraMenubarItem):void;typeBuffer:{clear():void}};
  probe.items=[item];probe.isNavigable=()=>true;probe.eventItem=()=>({item,path:[],inMenu:false});
  let matches=0;probe.move=()=>{matches++;};
  const key=(text:string)=>{const event=new KeyboardEvent('keydown',{key:text});Object.defineProperty(event,'target',{value:item});return event;};
  try{probe.onKeyDown(key('a'));expect(matches).to.equal(1);probe.typeBuffer.clear();Object.defineProperty(item,'textLabel',{value:'Beta',configurable:true});probe.onKeyDown(key('b'));expect(matches).to.equal(2);probe.typeBuffer.clear();Object.defineProperty(item,'textLabel',{value:'Istanbul',configurable:true});el.locale='tr';probe.onKeyDown(key('i'));expect(matches).to.equal(2);probe.typeBuffer.clear();el.locale='en';probe.onKeyDown(key('i'));expect(matches).to.equal(3);}
  finally{probe.typeBuffer.clear();}
});
