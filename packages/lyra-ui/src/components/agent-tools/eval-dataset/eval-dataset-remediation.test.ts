import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-eval-dataset.js';
import type { LyraEvalDataset, EvalExample } from '../../lr-eval-dataset.js';
import type { LyraTable } from '../../data/table/table.class.js';
import '../../../translations/ja.js';

const examples = (): EvalExample[] => [
  { id: 'ex-1', input: 'First', tags: ['alpha', 'beta'] },
  { id: 'ex-2', input: 'Second', tags: ['gamma'] },
];

const rows = (el: LyraEvalDataset) =>
  el.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[part="row"]');

describe('lr-eval-dataset remediation', () => {
  it('asks before a row activation changes the selection and honours a veto', async () => {
    const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`);
    const requests: unknown[] = [];
    const selected: (string | null)[] = [];
    el.addEventListener('lr-example-select-request', (event) => {
      requests.push((event as CustomEvent).detail);
      if ((event as CustomEvent<{ exampleId: string }>).detail.exampleId === 'ex-2') event.preventDefault();
    });
    el.addEventListener('lr-example-select', (event) => selected.push((event as CustomEvent<{ exampleId: string | null }>).detail.exampleId));
    rows(el)[0]!.click();
    await el.updateComplete;
    rows(el)[1]!.click();
    await el.updateComplete;
    expect(requests).to.deep.equal([
      { exampleId: 'ex-1', previousExampleId: null },
      { exampleId: 'ex-2', previousExampleId: 'ex-1' },
    ]);
    expect(selected).to.deep.equal(['ex-1']);
    const remove = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
    expect(remove.disabled).to.equal(false);
  });

  it('emits nothing when the already-selected row is activated again', async () => {
    const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`);
    const events: string[] = [];
    for (const type of ['lr-example-select-request', 'lr-example-select']) el.addEventListener(type, () => events.push(type));
    rows(el)[0]!.click();
    await el.updateComplete;
    rows(el)[0]!.click();
    await el.updateComplete;
    expect(events).to.deep.equal(['lr-example-select-request', 'lr-example-select']);
  });

  it('formats tag lists for the effective locale', async () => {
    const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset lang="ja" .examples=${examples()}></lr-eval-dataset>`);
    const expected = new Intl.ListFormat('ja', { type: 'unit', style: 'short' }).format(['alpha', 'beta']);
    expect(rows(el)[0]!.textContent).to.include(expected);
  });

  it('contains tag chip and chip-group events raised inside its shadow root', async () => {
    const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`);
    const leaked: string[] = [];
    for (const type of ['lr-chip-change', 'lr-remove', 'lr-overflow-toggle']) el.addEventListener(type, () => leaked.push(type));
    const chip = el.shadowRoot!.querySelector('lr-chip')!;
    chip.dispatchEvent(new CustomEvent('lr-chip-change', { bubbles: true, composed: true, detail: {} }));
    chip.dispatchEvent(new CustomEvent('lr-remove', { bubbles: true, composed: true, detail: {} }));
    el.shadowRoot!.querySelector('lr-chip-group')!.dispatchEvent(new CustomEvent('lr-overflow-toggle', { bubbles: true, composed: true, detail: {} }));
    expect(leaked).to.deep.equal([]);
  });

  it('contains the embedded table page proposal inside its shadow root', async () => {
    const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`);
    let leaked = 0;
    el.addEventListener('lr-before-page-change', () => { leaked++; });
    el.shadowRoot!.querySelector('lr-table')!.dispatchEvent(new CustomEvent('lr-before-page-change', {
      bubbles: true, composed: true, cancelable: true, detail: { page: 2, pageSize: 10, offset: 10 },
    }));
    expect(leaked).to.equal(0);
  });
});
