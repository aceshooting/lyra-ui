import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './flag.js';
import type { LyraFlag } from './flag.js';
import { setFlagUrlResolver } from './flag-url-resolver.js';
import { localeNativeName } from './language-map.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses native locale names beyond the formatter cache capacity', () => {
  const tags=Array.from({length:1000},(_,index)=>`en-${String(index).padStart(3,'0')}`);
  for(const tag of tags) localeNativeName(tag);
  const original=Intl.DisplayNames.prototype.of;
  let names=0;
  // Keep the same method identity during warmup and measured lookups.
  Intl.DisplayNames.prototype.of=function(tag){names++;return original.call(this,tag);};
  try {for(const tag of tags) localeNativeName(tag);names=0;for(const tag of tags)localeNativeName(tag);expect(names).to.equal(0);recordScaleMeasurement('lr-flag','1000 native names second catalog pass',{displayNames:names});}
  finally {Intl.DisplayNames.prototype.of=original;}
});
it('shares concurrent identical resolver work while allowing later retries', async () => {
  let calls=0;
  let release: ((url: string)=>void)|undefined;
  setFlagUrlResolver(async()=>{calls++;return new Promise<string>(resolve=>{release=resolve;});});
  const wrapper=await fixture<HTMLElement>(html`<div>${Array.from({length:1000},()=>html`<lr-flag country="fr"></lr-flag>`)}</div>`);
  try {
    await waitUntil(()=>calls>0);
    expect(calls).to.equal(1);
    release!('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E');
    const first=wrapper.querySelector<LyraFlag>('lr-flag')!;
    await waitUntil(()=>!!first.shadowRoot!.querySelector('img'));
    recordScaleMeasurement('lr-flag','1000 flags shared pending resolver',{resolverCalls:calls});
    const retry = document.createElement('lr-flag'); retry.country = 'fr'; wrapper.append(retry);
    await waitUntil(() => calls === 2);
    release!('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E');
    await waitUntil(() => !!retry.shadowRoot!.querySelector('img'));
  } finally {wrapper.remove();setFlagUrlResolver(null);}
});
