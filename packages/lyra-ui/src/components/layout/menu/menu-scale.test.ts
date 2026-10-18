import { expect } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('folds a 1000-item typeahead corpus once while reading changed labels live', () => {
  const el = document.createElement('lr-menu') as LyraMenu;
  const items = Array.from({ length: 1000 }, (_, index) => ({ getTextLabel: () => `Entry ${index}` })) as unknown as LyraMenuItem[];
  const probe = el as unknown as { items: LyraMenuItem[]; isNavigable(item: LyraMenuItem): boolean; setActiveItem(item: LyraMenuItem): void; typeAhead(key: string): void; typeBuffer: { clear(): void } };
  probe.items = items; probe.isNavigable = () => true; probe.setActiveItem = () => {};
  probe.typeAhead('z'); probe.typeBuffer.clear();
  const original = String.prototype.toLocaleLowerCase;
  let folds = 0;
  String.prototype.toLocaleLowerCase = function (...args) { folds++; return original.apply(this, args); };
  try { probe.typeAhead('q'); expect(folds).to.equal(1); recordScaleMeasurement('lr-menu','1000 items second typeahead query',{folds}); }
  finally { String.prototype.toLocaleLowerCase = original; probe.typeBuffer.clear(); }
});
it('refreshes folded labels after raw label or locale changes', () => {
  const el = document.createElement('lr-menu') as LyraMenu;
  let label = 'Alpha';
  const item = {getTextLabel:()=>label} as LyraMenuItem;
  const probe = el as unknown as {items: LyraMenuItem[];isNavigable(item:LyraMenuItem):boolean;setActiveItem(item:LyraMenuItem):void;typeAhead(key:string):void;typeBuffer:{clear():void}};
  probe.items=[item];probe.isNavigable=()=>true;
  let matches=0;probe.setActiveItem=()=>{matches++;};
  try {
    probe.typeAhead('a');expect(matches).to.equal(1);probe.typeBuffer.clear();
    label='Beta';probe.typeAhead('b');expect(matches).to.equal(2);probe.typeBuffer.clear();
    label='Istanbul';el.locale='tr';probe.typeAhead('i');expect(matches).to.equal(2);probe.typeBuffer.clear();
    el.locale='en';probe.typeAhead('i');expect(matches).to.equal(3);
  } finally {probe.typeBuffer.clear();}
});
