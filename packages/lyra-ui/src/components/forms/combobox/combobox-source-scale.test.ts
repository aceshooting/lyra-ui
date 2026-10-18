import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import './combobox.js';
import type { ComboboxSource, ComboboxSourceRow, LyraComboboxEventMap, LyraCombobox } from './combobox.js';

it('selects first, middle and final identities from a million-record searchable backend with bounded responses', async () => {
  const count = 1_000_000;
  let backendReads = 0;
  let responseReads = 0;
  let offeredRows = 0;
  let maxResponseRows = 0;
  const requests: Array<{ query: string; limit: number }> = [];
  // The host owns an indexed logical backend. Only requested records are materialized;
  // neither a million-object fixture nor the backend itself is passed to the component.
  const recordAt = (index: number): ComboboxSourceRow => {
    if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('Invalid record index');
    backendReads++;
    return { value: `record-${index}`, label: `Record ${index}`, sub: `Region ${index % 10}`, data: { index, category: index % 7 } };
  };
  const source: ComboboxSource = async (query, { signal, limit }) => {
    expect(signal.aborted).equal(false);
    requests.push({ query, limit });
    const match = /^record-(\d+)$/.exec(query);
    const index = match ? Number(match[1]) : -1;
    const rows = query === ''
      ? Array.from({ length: Math.min(count, limit) }, (_, ordinal) => recordAt(ordinal))
      : index >= 0 && index < count ? [recordAt(index)] : [];
    offeredRows += rows.length;
    maxResponseRows = Math.max(maxResponseRows, rows.length);
    const boundedRows = new Proxy(rows, {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) responseReads++;
        return Reflect.get(target, key, receiver);
      },
    });
    return { rows: boundedRows, total: query === '' ? count : rows.length };
  };
  const el = await fixture<LyraCombobox<false>>(html`<lr-combobox label="Record" lang="en" source-delay="0" .source=${source}></lr-combobox>`);
  const retained = el as unknown as { asyncRows: readonly ComboboxSourceRow[]; _selectedRowCache: ReadonlyMap<string, ComboboxSourceRow> };
  let maxMountedRows = 0;
  let maxDomNodes = 0;
  let maxRetainedRows = 0;
  let maxSelectedRowCache = 0;
  const observeRender = () => {
    maxMountedRows = Math.max(maxMountedRows, el.shadowRoot!.querySelectorAll('[part="option"]').length);
    maxDomNodes = Math.max(maxDomNodes, renderedNodeCount(el));
    maxRetainedRows = Math.max(maxRetainedRows, retained.asyncRows.length);
    maxSelectedRowCache = Math.max(maxSelectedRowCache, retained._selectedRowCache.size);
  };
  await el.show();
  await waitUntil(() => el.sourceTotal === count, 'the broad backend query did not settle');
  await el.updateComplete;
  expect(el.sourceTruncated).equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).equal(200);
  expect(el.shadowRoot!.querySelector('[part="option-overflow"]')?.textContent).contain('+999,800 more');
  observeRender();

  for (const index of [0, 500_000, count - 1]) {
    const value = `record-${index}`;
    el.inputValue = value;
    await el.show();
    await waitUntil(() => el.sourceTotal === 1 && el.shadowRoot!.querySelector(`[part="option"][data-value="${value}"]`) !== null,
      `the discriminating query did not return ${value}`);
    await el.updateComplete;
    expect(el.sourceTruncated).equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).equal(1);
    observeRender();
    const row = el.shadowRoot!.querySelector<HTMLElement>(`[part="option"][data-value="${value}"]`);
    if (!row) throw new Error(`Missing returned row ${value}`);
    const changed = oneEvent(el, 'lr-change');
    row.click();
    const event = await changed as LyraComboboxEventMap<false>['lr-change'];
    expect(event.detail.value).equal(value);
    expect(event.detail.data).deep.equal([{ index, category: index % 7 }]);
    expect(el.value).equal(value);
    await waitUntil(() => el.sourceTotal === count, 'the post-selection broad response did not settle');
    await el.updateComplete;
    observeRender();
    // The broad response omits the middle/final selection; its selected label and payload survive.
    expect(el.selectedRows.map(selected => [selected.value, selected.label, selected.sub])).deep.equal([
      [value, `Record ${index}`, `Region ${index % 10}`],
    ]);
    expect(el.input?.value).equal(`Record ${index}`);
    expect(el.selectedRows[0]?.data).deep.equal({ index, category: index % 7 });
  }

  expect(requests.filter(request => request.query !== '').map(request => request.query)).deep.equal([
    'record-0', 'record-500000', 'record-999999',
  ]);
  expect(requests.every(request => request.limit === 2_000)).equal(true);
  expect(requests.length).at.most(8);
  expect(backendReads).equal(offeredRows);
  expect(offeredRows).at.most(10_003);
  expect(responseReads).at.most(offeredRows * 4);
  expect(maxResponseRows).equal(2_000);
  expect(maxMountedRows).equal(200);
  expect(maxDomNodes).lessThan(2_000);
  expect(maxRetainedRows).equal(2_000);
  expect(maxSelectedRowCache).equal(1);
  expect(el.value).equal('record-999999');
  recordScaleMeasurement('lr-combobox', 'remote-search@1000000', {
    logicalRecords: count, sourceCalls: requests.length, backendReads, offeredRows, responseReads,
    maxResponseRows, maxRetainedRows, maxSelectedRowCache, maxMountedRows, maxDomNodes, selectedIdentities: 3,
  });
});

it('keeps the current identity result when a superseded query rejects', async () => {
  let rejectOld: ((error: unknown) => void) | undefined;
  let oldSignal: AbortSignal | undefined;
  const source: ComboboxSource = (query, { signal }) => {
    if (query === '') {
      oldSignal = signal;
      return new Promise((_resolve, reject) => { rejectOld = reject; });
    }
    return Promise.resolve({ rows: [{ value: 'record-999999', label: 'Record 999999' }], total: 1 });
  };
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Record" source-delay="0" .source=${source}></lr-combobox>`);
  let errors = 0;
  el.addEventListener('lr-source-error', () => { errors++; });
  await el.show();
  await waitUntil(() => rejectOld !== undefined, 'the initial query did not start');
  el.inputValue = 'record-999999';
  await waitUntil(() => el.sourceTotal === 1 && el.shadowRoot!.querySelector('[data-value="record-999999"]') !== null,
    'the current identity query did not render');
  expect(oldSignal?.aborted).equal(true);
  if (!rejectOld) throw new Error('Missing superseded query rejection');
  rejectOld(new Error('Superseded query failed'));
  // wait-reason: drain the obsolete promise rejection before asserting its absence from the UI/events.
  await aTimeout(0);
  await el.updateComplete;
  expect(errors).equal(0);
  expect(el.sourceTotal).equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="source-error-row"]').length).equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="option"][data-value="record-999999"]').length).equal(1);
});
