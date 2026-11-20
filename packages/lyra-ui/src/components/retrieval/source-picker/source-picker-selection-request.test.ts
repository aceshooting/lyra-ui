import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-source-picker.js';
import type { LyraSourcePicker, LyraSourceEntry } from '../../lr-source-picker.js';

const sources: LyraSourceEntry[] = [
  { id: 'doc1', label: 'one.pdf' },
  { id: 'doc2', label: 'two.pdf' },
  { id: 'doc3', label: 'three.pdf' },
];
const row = (el: LyraSourcePicker, id: string): HTMLElement =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="item"]')]
    .find((item) => item.textContent!.includes(sources.find((source) => source.id === id)!.label))!;
const selectAll = (el: LyraSourcePicker): HTMLElement & { checked: boolean; updateComplete: Promise<unknown> } =>
  el.shadowRoot!.querySelector('lr-checkbox[part="select-all-control"]')!;

describe('source-picker selection request', () => {
  it('lets a listener veto or resolve a row or select-all toggle before it commits', async () => {
    const el = await fixture<LyraSourcePicker>(html`<lr-source-picker .sources=${sources}></lr-source-picker>`);
    const log: string[] = [];
    const requests: unknown[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    el.addEventListener('lr-selection-change-request', (event) => {
      requests.push({ ...event.detail });
      log.push(`request:${el.selectedSourceIds.join(',')}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.selectedSourceIds = ['doc3'];
    });
    el.addEventListener('lr-selection-change', () => log.push('lr-selection-change'));

    row(el, 'doc1').click();
    await el.updateComplete;
    expect([...el.selectedSourceIds]).to.deep.equal([]);
    expect(row(el, 'doc1').getAttribute('aria-checked')).to.equal('false');
    expect(log).to.deep.equal(['request::true']);
    expect(requests).to.deep.equal([{ selectedSourceIds: ['doc1'], previousSelectedSourceIds: [] }]);

    log.length = 0;
    selectAll(el).click();
    await el.updateComplete;
    await selectAll(el).updateComplete;
    expect([...el.selectedSourceIds]).to.deep.equal([]);
    expect(selectAll(el).checked, 'a refused select-all leaves its checkbox unchecked').to.equal(false);
    expect(log).to.deep.equal(['request::true']);

    log.length = 0;
    mode = 'resolve';
    row(el, 'doc1').click();
    await el.updateComplete;
    expect([...el.selectedSourceIds], 'a listener write wins over the proposal').to.deep.equal(['doc3']);
    expect(log).to.deep.equal(['request::true']);

    log.length = 0;
    mode = 'allow';
    selectAll(el).click();
    await el.updateComplete;
    await selectAll(el).updateComplete;
    expect([...el.selectedSourceIds]).to.have.members(['doc1', 'doc2', 'doc3']);
    expect(selectAll(el).checked).to.equal(true);
    expect(log).to.deep.equal(['request:doc3:true', 'lr-selection-change']);
  });
});
