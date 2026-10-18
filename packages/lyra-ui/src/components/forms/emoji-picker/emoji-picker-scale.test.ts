import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { LyraEmojiPicker } from './emoji-picker.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

const groups = [{key:'test',label:'Test',emojis:Array.from({length:1000}, (_, i) => ({emoji:'😀',name:`Smile ${i}`}))}];
it('retains geometry across unrelated updates of 1,000 emojis', async () => {
  const el = await fixture<LyraEmojiPicker>(html`<lr-emoji-picker .groups=${groups}></lr-emoji-picker>`);
  await nextFrame(); await nextFrame(); await el.updateComplete;
  const seam = el as unknown as {geometry(): unknown};
  const first = seam.geometry();
  el.label = 'New label'; await el.updateComplete;
  const rebuilds = Number(first !== seam.geometry());
  recordScaleMeasurement('lr-emoji-picker', 'geometry@1000', {rebuilds});
  expect(rebuilds).to.equal(0);
});

it('shares admission of the same loaded dataset across instances', async () => {
  const a = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
  const b = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
  for (const el of [a,b]) (el as unknown as {loadGroups: () => Promise<typeof groups>}).loadGroups = async () => groups;
  try {
    document.body.append(a,b);
    await nextFrame(); await a.updateComplete; await b.updateComplete;
    expect(a.groups === b.groups).to.equal(true);
    expect(Object.isFrozen(a.groups)).to.equal(true);
  } finally { a.remove(); b.remove(); }
});

it('discloses every emoji admission ceiling and clears it after replacement', async () => {
  const el = await fixture<LyraEmojiPicker>(html`<lr-emoji-picker .groups=${[]} .strings=${{emojiPickerInputLimit:'Emoji limit'}}></lr-emoji-picker>`);
  const oversized = [
    Array.from({length:65}, (_, i) => ({key:`${i}`,label:`${i}`,emojis:[]})),
    [{key:'x',label:'X',emojis:Array.from({length:20001},()=>({emoji:'😀',name:'Smile'}))}],
    [{key:'x',label:'X',emojis:[{emoji:'😀',name:'Smile',shortcodes:Array.from({length:65},(_,i)=>`${i}`)}]}],
  ];
  for(const input of oversized) {
    el.groups = input; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Emoji limit');
  }
  el.groups = []; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});
