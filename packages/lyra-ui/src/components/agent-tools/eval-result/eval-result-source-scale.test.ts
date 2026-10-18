import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './eval-result.js';
import type { EvalResultSource, EvalRunResult, LyraEvalResult } from './eval-result.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraRubricForm } from '../../forms/rubric-form/rubric-form.class.js';

it('reaches and activates middle/final pages of an allocated million while retaining only one page and two comparisons', async () => {
  const input: EvalRunResult[] = Array.from({ length: 1_000_000 }, (_, index) => ({ id: `r${index}`, label: `Run ${index}`, output: '' }));
  let reads = 0; let active = 0; let peak = 0;
  const calls: number[] = []; const lookupCalls: string[][] = [];
  const record = (index: number) => ({ key: `r${index}`, order: index, value: new Proxy(input[index]!, { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } }) });
  const source: EvalResultSource = { revision: 1,
    query: async ({ page, pageSize }) => { calls.push(page); peak = Math.max(peak, ++active); try { return { total: input.length, rows: Array.from({ length: Math.min(pageSize, input.length - page * pageSize) }, (_, offset) => record(page * pageSize + offset)) }; } finally { active--; } },
    lookup: async keys => { lookupCalls.push([...keys]); return keys.map(key => record(Number(key.slice(1)))); }, locate: async () => null,
  };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${source} selected-run-id="r999999" baseline-run-id="r1" .columns=${[{ key: 'label', label: 'Run', cell: (row: EvalRunResult) => row.label }]}></lr-eval-result>`);
  const loaded = async (first: string) => {
    await waitUntil(() => el.shadowRoot?.querySelector<LyraTable<EvalRunResult>>('lr-table')?.rows[0]?.id === first);
    const grid = el.shadowRoot!.querySelector<LyraTable<EvalRunResult>>('lr-table')!; await grid.updateComplete; return grid;
  };
  const grid = await loaded('r0'); await waitUntil(() => el.shadowRoot!.querySelector<LyraRubricForm>('lr-rubric-form')?.itemId === 'r999999');
  const jump = async (page: number, first: string) => {
    const pager = grid.shadowRoot!.querySelector('lr-pagination')!;
    const field = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
    field.value = String(page); field.dispatchEvent(new Event('change')); await loaded(first);
  };
  const selected: string[] = []; el.addEventListener('lr-run-activate', event => selected.push(event.detail!.runId));
  await jump(5001, 'r500000');
  let row = grid.shadowRoot!.querySelector<HTMLElement>('[role="row"][data-row-key]')!;
  await focusByKeyboard(row); await sendKeys({ press: 'Enter' });
  await jump(10000, 'r999900');
  const rows = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('[role="row"][data-row-key]')]; row = rows[rows.length - 1]!;
  await focusByKeyboard(row); await sendKeys({ press: 'Enter' });
  const retained = el as unknown as { sourceRows: unknown[]; sourcePair: unknown[]; sourcePages: { cache: Map<string, unknown> } };
  expect(calls).to.deep.equal([0, 5000, 9999]); expect(lookupCalls).to.deep.equal([['r999999', 'r1']]);
  expect(selected).to.deep.equal(['r500000', 'r999999']); expect(el.sourceTotal).to.equal(1_000_000);
  expect(retained.sourceRows.length).to.equal(100); expect(retained.sourcePair.length).to.equal(2); expect(retained.sourcePages.cache.size).to.equal(2);
  expect(rows.length).to.equal(100); expect(peak).to.equal(1); expect(reads).to.equal(302 * 7);
  recordScaleMeasurement('lr-eval-result', 'n=1000000 allocated runs first middle final pages', { queries: calls.length, lookupCalls: lookupCalls.length, fieldReads: reads, physicalPagePeak: peak, retainedPage: retained.sourceRows.length, retainedPair: retained.sourcePair.length, selectedCache: retained.sourcePages.cache.size, domRows: rows.length });
});

it('normalizes page bounds and corrects an oversized requested page with one bounded query', async () => {
  const calls: [number, number][] = [];
  const source: EvalResultSource = { revision: 1,
    query: async ({ page, pageSize }) => { calls.push([page, pageSize]); return { total: 501, rows: Array.from({ length: Math.max(0, Math.min(pageSize, 501 - page * pageSize)) }, (_, offset) => { const order = page * pageSize + offset; return { key: `r${order}`, order, value: { id: `r${order}`, label: 'Run', output: '' } }; }) }; }, lookup: async () => [], locate: async () => null,
  };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${source} selected-run-id="none" baseline-run-id="none" .sourcePage=${100} .sourcePageSize=${10_000}></lr-eval-result>`);
  await waitUntil(() => el.sourceTotal === 501); expect(calls).to.deep.equal([[100, 500], [1, 500]]); expect(el.sourcePage).to.equal(1);
  const grid = el.shadowRoot!.querySelector<LyraTable>('lr-table')!; await grid.updateComplete; expect(grid.rows.length).to.equal(1);
});
