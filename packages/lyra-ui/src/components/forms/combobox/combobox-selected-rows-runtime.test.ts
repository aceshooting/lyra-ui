import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { ComboboxSourceRow, LyraCombobox } from './combobox.class.js';

it('isolates a throwing selected-row value without losing later valid selection', async () => {
  const el = await fixture<LyraCombobox>(html`
    <lr-combobox multiple>
      <lr-option value="a">Apple</lr-option><lr-option value="b">Banana</lr-option>
    </lr-combobox>
  `);
  const hostile = { get value(): string { throw new Error('unavailable row'); }, label: 'Unavailable' };
  let changes = 0;
  el.addEventListener('lr-change', () => { changes += 1; });
  el.selectedRows = [hostile, { value: 'b', label: 'Untrusted display' }, { value: 'b', label: 'Duplicate' }];
  await el.updateComplete;
  expect(el.value).to.deep.equal(['b']);
  expect(el.selectedRows.map(row => row.label)).to.deep.equal(['Banana']);
  expect(changes).to.equal(0);
});

it('resolves selected rows assigned after a closed remote control has mounted', async () => {
  const rows: ComboboxSourceRow[] = [{ value: 'city', label: 'City', data: { population: 50 } }];
  const queries: string[] = [];
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-combobox name="place" required source-delay="0"></lr-combobox></form>
  `);
  const el = form.querySelector<LyraCombobox>('lr-combobox')!;
  el.source = async query => { queries.push(query); return rows; };
  await el.updateComplete;
  expect(queries).to.deep.equal([]);
  el.selectedRows = [{ value: 'city', label: 'Caller title' }];
  await waitUntil(() => el.value === 'city', 'closed remote selection did not resolve');
  expect(queries).to.deep.equal(['']);
  expect(el.open).to.equal(false);
  expect(el.selectedRows[0]?.label).to.equal('City');
  expect(new FormData(form).get('place')).to.equal('city');
  expect(el.checkValidity()).to.equal(true);
  el.setCustomValidity('Choose another city');
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(el.selectedRows).to.deep.equal([]);
  expect(el.validity.customError).to.equal(true);
  expect(el.validationMessage).to.equal('Choose another city');
});

it('does not accept a pending selected-row response after the control disconnects', async () => {
  let resolveRows!: (rows: ComboboxSourceRow[]) => void;
  let calls = 0;
  let signal: AbortSignal | undefined;
  const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0"></lr-combobox>`);
  el.source = (_query, request) => {
    calls += 1;
    signal = request.signal;
    return new Promise(resolve => { resolveRows = resolve; });
  };
  await el.updateComplete;
  el.selectedRows = [{ value: 'late', label: 'Late' }];
  await waitUntil(() => calls === 1);
  el.remove();
  expect(signal?.aborted).to.equal(true);
  resolveRows([{ value: 'late', label: 'Late' }]);
  // wait-reason: asserting a late aborted resolution is ignored (negative assertion)
  await aTimeout(30);
  expect(el.value).to.equal('');
  expect(el.selectedRows).to.deep.equal([]);
  expect(el.open).to.equal(false);
});
