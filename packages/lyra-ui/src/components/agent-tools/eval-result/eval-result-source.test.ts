import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './eval-result.js';
import '../../../translations/fr.js';
import '../../../translations/de.js';
import type { EvalResultSource, EvalRunResult, LyraEvalResult } from './eval-result.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraRubricForm } from '../../forms/rubric-form/rubric-form.class.js';

const record = (order: number): LyraSourceRecord<EvalRunResult> => ({ key: `r${order}`, order, value: { id: `r${order}`, label: `Run ${order}`, output: `Output ${order}` } });
function provider(total = 12) {
  const pages: [number, number][] = [];
  const lookups: string[][] = [];
  const source: EvalResultSource = { revision: 1,
    query: async ({ page, pageSize }) => { pages.push([page, pageSize]); return { total, rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, i) => record(page * pageSize + i)) }; },
    lookup: async keys => { lookups.push([...keys]); return keys.filter(key => /^r\d+$/.test(key) && Number(key.slice(1)) < total).map(key => record(Number(key.slice(1)))); },
    locate: async () => null,
  };
  return { source, pages, lookups };
}
async function table(el: LyraEvalResult, first: string) {
  await waitUntil(() => (el.dataSource === undefined || el.sourceTotal !== null) && el.shadowRoot?.querySelector<LyraTable<EvalRunResult>>('lr-table')?.rows[0]?.id === first);
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<LyraTable<EvalRunResult>>('lr-table')!; await grid.updateComplete; return grid;
}
async function review(el: LyraEvalResult, id: string) {
  await waitUntil(() => el.shadowRoot?.querySelector<LyraRubricForm>('lr-rubric-form')?.itemId === id);
  return el.shadowRoot!.querySelector<LyraRubricForm>('lr-rubric-form')!;
}

describe('eval result source', () => {
  it('primes the first global fallback on the same page lane before an initial nonzero page', async () => {
    const { source, pages, lookups } = provider();
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .sourcePage=${2} .sourcePageSize=${3} .dataSource=${source}></lr-eval-result>`);
    await table(el, 'r6'); await review(el, 'r0');
    expect(pages).to.deep.equal([[0, 1], [2, 3]]); expect(lookups).to.deep.equal([['r0']]);
    expect(el.sourcePage).to.equal(2); expect(el.sourceTotal).to.equal(12);
    el.sourcePage = 3; await table(el, 'r9'); await review(el, 'r0');
    expect(pages).to.deep.equal([[0, 1], [2, 3], [3, 3]]); expect(lookups.length).to.equal(1);
  });
  it('resolves explicit selected and baseline IDs outside the page without priming or changing controlled IDs', async () => {
    const { source, pages, lookups } = provider();
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .sourcePage=${2} .sourcePageSize=${3} selected-run-id="r11" baseline-run-id="r1" .dataSource=${source}></lr-eval-result>`);
    await table(el, 'r6'); await review(el, 'r11');
    expect(pages).to.deep.equal([[2, 3]]); expect(lookups).to.deep.equal([['r11', 'r1']]);
    const diff = el.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & { oldText: string; newText: string };
    expect(diff.oldText).to.equal('Output 1'); expect(diff.newText).to.equal('Output 11');
    expect(el.selectedRunId).to.equal('r11'); expect(el.baselineRunId).to.equal('r1');
  });
  it('does not treat an absent explicit ID as page-first and restores the untouched legacy collection', async () => {
    const { source } = provider();
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .runs=${[record(99).value]} selected-run-id="missing" .dataSource=${source}></lr-eval-result>`);
    await table(el, 'r0'); await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-rubric-form')).to.equal(null);
    expect(el.runs[0]!.id).to.equal('r99'); el.dataSource = undefined;
    await table(el, 'r99'); expect(el.sourceTotal).to.equal(null);
  });
  it('does not invoke a query function revoked by its property getter', async () => {
    const old = provider(); const next = provider(); let el: LyraEvalResult; let reads = 0; let obsoleteCalls = 0;
    Object.defineProperty(old.source, 'query', { get() { reads++; if (reads === 2) { el.dataSource = next.source; return async () => { obsoleteCalls++; return { total: 0, rows: [] }; }; } return async () => ({ total: 0, rows: [] }); } });
    el = await fixture<LyraEvalResult>(html`<lr-eval-result selected-run-id="none" baseline-run-id="none"></lr-eval-result>`);
    el.dataSource = old.source; await table(el, 'r0');
    expect(obsoleteCalls).to.equal(0);
  });
});

it('retains provider identity for callbacks and opaque complete maps in a frozen activation shell', async () => {
  const opaque = new Proxy({ score: 3 }, { ownKeys() { throw new Error('opaque dictionary walked'); } });
  const row = Object.freeze({ ...record(0).value, scores: opaque, review: opaque });
  const source: EvalResultSource = { revision: 1, query: async () => ({ total: 1, rows: [{ key: 'r0', order: 0, value: row }] }), lookup: async () => [{ key: 'r0', order: 0, value: row }], locate: async () => null };
  const seen: EvalRunResult[] = [];
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${source} .columns=${[{ key: 'label', label: 'Run', cell: (value: EvalRunResult) => { seen.push(value); return value.label; } }]} .rubricKeys=${[{ key: 'score', type: 'score' }]}></lr-eval-result>`);
  const grid = await table(el, 'r0'); const form = await review(el, 'r0');
  let detail: unknown; el.addEventListener('lr-run-activate', e => { detail = e.detail as { run: EvalRunResult }; });
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: grid.rows[0] } }));
  const result = detail as { runId: string; run: EvalRunResult };
  expect(seen.length).to.be.greaterThan(0); expect(seen.every(value => value === row)).to.equal(true);
  expect(result.runId).to.equal('r0'); expect(Object.isFrozen(result)).to.equal(true); expect(Object.isFrozen(result.run)).to.equal(true);
  expect(result.run.scores === opaque).to.equal(true); expect(result.run.review === opaque).to.equal(true); expect(form.value['score']).to.equal(3);
});
it('rejects stale row and review handlers while captured selected identity owns current submissions', async () => {
  const old = provider(); const next = provider();
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${old.source}></lr-eval-result>`);
  const grid = await table(el, 'r0'); const oldRow = grid.rows[0]!; const form = await review(el, 'r0');
  const events: string[] = [];
  el.addEventListener('lr-review-submit', e => events.push(e.detail!.runId));
  el.addEventListener('lr-run-activate', e => events.push(e.detail!.runId));
  form.dispatchEvent(new CustomEvent('lr-submit', { detail: { itemId: 'spoof', value: {} } }));
  expect(events).to.deep.equal(['r0']);
  el.dataSource = next.source;
  form.dispatchEvent(new CustomEvent('lr-submit', { detail: { itemId: 'spoof', value: {} } }));
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: oldRow } }));
  await table(el, 'r0'); await review(el, 'r0');
  expect(events).to.deep.equal(['r0']);
});
it('keeps sort veto and commit as one original transaction and rejects a replaced-source commit', async () => {
  const data = provider(); const next = provider();
  const sorts: (string | null)[] = []; const query = data.source.query;
  data.source.query = request => { sorts.push(request.query.sortKey); return query(request); };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} .columns=${[{ key: 'label', label: 'Run', sortable: true, cell: (run: EvalRunResult) => run.label }]}></lr-eval-result>`);
  const grid = await table(el, 'r0'); const phases: string[] = [];
  const veto = (e: Event) => { phases.push('request'); e.preventDefault(); };
  el.addEventListener('lr-sort-request', veto);
  grid.shadowRoot!.querySelector<HTMLElement>('[part~="header-cell"][data-key="label"]')?.click();
  if (!phases.length) grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click();
  await el.updateComplete; expect(sorts).to.deep.equal([null]); expect(phases).to.deep.equal(['request']);
  el.removeEventListener('lr-sort-request', veto);
  el.addEventListener('lr-sort', () => phases.push('commit'));
  grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click();
  await waitUntil(() => sorts.length === 2); await table(el, 'r0'); expect(sorts).to.deep.equal([null, 'label']); expect(phases).to.deep.equal(['request', 'commit']);
  el.addEventListener('lr-sort-request', () => { el.dataSource = next.source; }, { once: true });
  grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click();
  await table(el, 'r0'); expect(phases).to.deep.equal(['request', 'commit']);
});
it('does not refresh pages on selection or ordinary paints and coalesces explicit refresh in either order', async () => {
  const data = provider(); const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source}></lr-eval-result>`);
  await table(el, 'r0'); await review(el, 'r0');
  el.selectedRunId = 'r11'; el.label = 'Other'; el.disabled = true; await review(el, 'r11');
  expect(data.pages.length).to.equal(1);
  el.requestUpdate(); el.label = 'Again'; await table(el, 'r0'); await review(el, 'r11');
  expect(data.pages.length).to.equal(2);
  el.label = 'Third'; el.requestUpdate(); await table(el, 'r0'); await review(el, 'r11');
  expect(data.pages.length).to.equal(3);
});
it('keeps late priming and lookup settlements from replacing a newer page and pair', async () => {
  const data = provider(); let settle!: () => void;
  const first = data.source.query; let held = true;
  data.source.query = request => held ? new Promise(resolve => { settle = () => { held = false; void Promise.resolve(first(request)).then(resolve); }; }) : first(request);
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} .sourcePage=${2} .sourcePageSize=${3}></lr-eval-result>`);
  await waitUntil(() => !!settle); expect(el.sourceTotal).to.equal(null); expect(el.sourcePage).to.equal(2);
  el.sourcePage = 3; settle(); await table(el, 'r9'); await review(el, 'r0');
  expect(el.sourcePage).to.equal(3); expect(data.pages[data.pages.length - 1]).to.deep.equal([3, 3]);
});
it('distinguishes failed lookup from missing IDs and retries only the selected pair', async () => {
  const data = provider(); let fail = true; const lookup = data.source.lookup;
  data.source.lookup = (keys, context) => { if (fail) throw new Error('hidden detail'); return lookup(keys, context); };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} selected-run-id="r11" baseline-run-id="r1" .strings=${{ sourceSelectionFailed: 'Pair failed', retry: 'Retry pair' }}></lr-eval-result>`);
  await table(el, 'r0'); await waitUntil(() => !!el.shadowRoot!.querySelector('[part="selection-retry"]'));
  expect(el.shadowRoot!.textContent).to.include('Pair failed'); expect(el.shadowRoot!.textContent).not.to.include('hidden detail');
  fail = false; el.shadowRoot!.querySelector<HTMLButtonElement>('[part="selection-retry"]')!.click();
  await review(el, 'r11'); expect(data.pages.length).to.equal(1);
});
it('fails invalid source input visibly without falling back to legacy runs', async () => {
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .runs=${[record(99).value]} .dataSource=${null}></lr-eval-result>`);
  await waitUntil(() => el.shadowRoot!.querySelector<LyraTable>('lr-table')?.error === true);
  expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelector<LyraTable>('lr-table')!.rows.length).to.equal(0);
  el.dataSource = undefined; await table(el, 'r99');
});
it('rejects malformed fixed fields and oversized configured review without traversing unrelated keys', async () => {
  const data = provider(1); let getterReads = 0;
  const malformed = Object.defineProperty({ ...record(0).value }, 'label', { get() { getterReads++; return 'unsafe'; } });
  data.source.query = async () => ({ total: 1, rows: [{ key: 'r0', order: 0, value: malformed }] });
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source}></lr-eval-result>`);
  await waitUntil(() => el.shadowRoot!.querySelector<LyraTable>('lr-table')?.error === true); expect(getterReads).to.equal(0);
  const huge = { ...record(0).value, review: { notes: 'x'.repeat(65_537) } };
  data.source.query = async () => ({ total: 1, rows: [{ key: 'r0', order: 0, value: huge }] }); data.source.lookup = async () => [{ key: 'r0', order: 0, value: huge }];
  el.rubricKeys = [{ key: 'notes', type: 'comment' }]; el.dataSource = data.source;
  await table(el, 'r0'); await waitUntil(() => !!el.shadowRoot!.querySelector('[part="selection-retry"]'));
  expect(el.shadowRoot!.querySelector('lr-rubric-form')).to.equal(null);
});
it('clears retained page and pair work on disconnect and reconnects at the requested page', async () => {
  const data = provider(); const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} .sourcePage=${1} .sourcePageSize=${3}></lr-eval-result>`);
  await table(el, 'r3'); await review(el, 'r0'); const parent = el.parentNode!; el.remove(); parent.appendChild(el);
  await table(el, 'r3'); await review(el, 'r0'); expect(data.pages).to.deep.equal([[0, 1], [1, 3], [0, 1], [1, 3]]);
});
it('keeps initial failure quiet and announces later page failure exactly once', async () => {
  const { AnnouncementSinkController } = await import('../../../internal/announcer.js');
  const polite = AnnouncementSinkController.prototype.announcePolite;
  const assertive = AnnouncementSinkController.prototype.announceAssertive;
  const messages: string[] = [];
  AnnouncementSinkController.prototype.announcePolite = function (message, ...args) { messages.push(message); return polite.call(this, message, ...args); };
  AnnouncementSinkController.prototype.announceAssertive = function (message, ...args) { messages.push(message); return assertive.call(this, message, ...args); };
  try {
    const data = provider(); const query = data.source.query; let fail = true;
    data.source.query = request => { if (fail) throw new Error('hidden'); return query(request); };
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result selected-run-id="none" baseline-run-id="none" .dataSource=${data.source} .strings=${{ tableLoadFailed: 'Page failed' }}></lr-eval-result>`);
    await waitUntil(() => el.shadowRoot!.querySelector<LyraTable>('lr-table')?.error === true); await el.shadowRoot!.querySelector<LyraTable>('lr-table')!.updateComplete;
    expect(messages.filter(value => value === 'Page failed').length).to.equal(0);
    fail = false; el.dataSource = data.source; await table(el, 'r0');
    fail = true; el.dataSource = data.source; await waitUntil(() => el.shadowRoot!.querySelector<LyraTable>('lr-table')?.error === true); await el.shadowRoot!.querySelector<LyraTable>('lr-table')!.updateComplete;
    expect(messages.filter(value => value === 'Page failed').length).to.equal(1);
  } finally { AnnouncementSinkController.prototype.announcePolite = polite; AnnouncementSinkController.prototype.announceAssertive = assertive; }
});
it('resets the null fallback for sorted order and locale but keeps explicit pair lookup source-keyed', async () => {
  const data = provider(3); let reverse = false;
  data.source.query = async ({ page, pageSize, query }) => { data.pages.push([page, pageSize]); reverse = query.sortKey !== null; return { total: 3, rows: Array.from({ length: Math.min(pageSize, 3 - page * pageSize) }, (_, i) => record(reverse ? 2 - page * pageSize - i : page * pageSize + i)) }; };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} .columns=${[{ key: 'label', label: 'Run', sortable: true, cell: (run: EvalRunResult) => run.label }]}></lr-eval-result>`);
  const grid = await table(el, 'r0'); await review(el, 'r0');
  grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click(); await table(el, 'r2'); await review(el, 'r2');
  expect(data.lookups).to.deep.equal([['r0'], ['r2']]);
  el.selectedRunId = 'r1'; el.baselineRunId = 'r0'; await review(el, 'r1'); const lookupCount = data.lookups.length;
  el.lang = 'fr'; await waitUntil(() => data.pages.length === 3); await table(el, 'r2'); await review(el, 'r1');
  expect(data.lookups.length).to.equal(lookupCount);
});
it('keeps borrowed column callbacks revoked after one callback replaces the provider', async () => {
  const data = provider(2); const next = provider(1); let switched = false; let obsoleteCalls = 0;
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result selected-run-id="none" baseline-run-id="none"></lr-eval-result>`);
  el.columns = [{ key: 'label', label: 'Run', cell: row => { if (!switched) { switched = true; el.dataSource = next.source; } else if (row.id === 'r1') obsoleteCalls++; return row.label; } }];
  el.dataSource = data.source; await waitUntil(() => switched); await table(el, 'r0');
  expect(obsoleteCalls).to.equal(0); expect(el.sourceTotal).to.equal(1);
});
it('does not keep an obsolete pair when a deferred lookup ignores cancellation', async () => {
  const data = provider(); let settle!: () => void; const lookup = data.source.lookup; let hold = true;
  data.source.lookup = (keys, context) => hold ? new Promise(resolve => { settle = () => { hold = false; void Promise.resolve(lookup(keys, context)).then(resolve); }; }) : lookup(keys, context);
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} selected-run-id="r1" baseline-run-id="r2"></lr-eval-result>`);
  await table(el, 'r0'); await waitUntil(() => !!settle); el.selectedRunId = 'r11'; el.baselineRunId = 'r10'; settle();
  await review(el, 'r11'); const retained = el as unknown as { sourcePair: { key: string }[]; sourcePages: { cache: Map<string, unknown> } };
  expect(retained.sourcePair.map(value => value.key)).to.deep.equal(['r10', 'r11']); expect([...retained.sourcePages.cache.keys()].sort()).to.deep.equal(['r10', 'r11']);
});
it('leaves focus outside the component when a pending comparison completes', async () => {
  const data = provider(); let settle!: () => void; const lookup = data.source.lookup;
  data.source.lookup = (keys, context) => new Promise(resolve => { settle = () => { void Promise.resolve(lookup(keys, context)).then(resolve); }; });
  const host = await fixture<HTMLDivElement>(html`<div><button>Outside</button><lr-eval-result .dataSource=${data.source}></lr-eval-result></div>`);
  const el = host.querySelector<LyraEvalResult>('lr-eval-result')!; await table(el, 'r0'); await waitUntil(() => !!settle);
  const { focusByKeyboard } = await import('../../../../test/wtr-focus.js'); const outside = host.querySelector('button')!;
  await focusByKeyboard(outside); settle(); await review(el, 'r0'); expect(document.activeElement === outside).to.equal(true);
});
it('retains complete legacy deep snapshots after source event identity enrollment', async () => {
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .runs=${[{ ...record(0).value, review: { choice: ['a'] } }]}></lr-eval-result>`);
  const grid = await table(el, 'r0'); let detail: { run: EvalRunResult } | null = null;
  el.addEventListener('lr-run-activate', e => { detail = e.detail as { run: EvalRunResult }; });
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: grid.rows[0] } }));
  const result = detail as unknown as { run: EvalRunResult };
  expect(result.run === grid.rows[0]).to.equal(false); expect(Object.isFrozen(result.run.review?.['choice'])).to.equal(true);
  const deep: Record<string, unknown> = {}; let cursor = deep;
  for (let i = 0; i < 300; i++) { const child = {}; cursor['child'] = child; cursor = child; }
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: { ...record(0).value, extra: deep } } }));
  expect(detail).to.equal(null);
});
for (const shape of ['mismatched-key', 'duplicate-key', 'oversized-reply', 'unsafe-total', 'oversized-label', 'revoked-proxy'] as const) {
  it(`rejects ${shape} source replies as a complete response`, async () => {
    const data = provider(1); const rows = [record(0)]; let total = 1;
    if (shape === 'mismatched-key') rows[0] = { ...record(0), key: 'other' };
    if (shape === 'duplicate-key') { rows.push(record(0)); total = 2; }
    if (shape === 'oversized-reply') { rows.push(record(1)); total = 2; }
    if (shape === 'unsafe-total') total = Number.MAX_SAFE_INTEGER + 1;
    if (shape === 'oversized-label') rows[0] = { ...record(0), value: { ...record(0).value, label: 'x'.repeat(65_537) } };
    if (shape === 'revoked-proxy') { const proxy = Proxy.revocable(record(0).value, {}); proxy.revoke(); rows[0] = { ...record(0), value: proxy.proxy }; }
    data.source.query = async () => ({ total, rows });
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} .sourcePageSize=${shape === 'oversized-reply' ? 1 : 100} selected-run-id="none" baseline-run-id="none"></lr-eval-result>`);
    await waitUntil(() => el.shadowRoot!.querySelector<LyraTable>('lr-table')?.error === true);
    expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelector<LyraTable>('lr-table')!.rows.length).to.equal(0);
  });
}
it('adopts into a new document without letting the old request publish or steal focus', async () => {
  const data = provider(1); let settle!: () => void; const query = data.source.query; let first = true;
  data.source.query = request => { if (!first) return query(request); first = false; return new Promise(resolve => { settle = () => { void Promise.resolve(query(request)).then(resolve); }; }); };
  const wrapper = await fixture<HTMLDivElement>(html`<div><iframe title="New document"></iframe><lr-eval-result .dataSource=${data.source}></lr-eval-result></div>`);
  const el = wrapper.querySelector<LyraEvalResult>('lr-eval-result')!; await waitUntil(() => !!settle);
  const frame = wrapper.querySelector('iframe')!; const doc = frame.contentDocument!;
  doc.body.appendChild(doc.adoptNode(el)); settle(); await table(el, 'r0'); await review(el, 'r0');
  expect(el.ownerDocument === doc).to.equal(true); expect(el.sourceTotal).to.equal(1); expect(data.pages.length).to.equal(2);
});
it('honors source replacement reentry from an abort listener while the old physical request settles', async () => {
  const data = provider(); const replacement = provider(1); let settle!: () => void; let el: LyraEvalResult;
  const query = data.source.query;
  data.source.query = request => new Promise(resolve => {
    request.signal.addEventListener('abort', () => { el.dataSource = replacement.source; }, { once: true });
    settle = () => { void Promise.resolve(query(request)).then(resolve); };
  });
  el = await fixture<LyraEvalResult>(html`<lr-eval-result selected-run-id="none" baseline-run-id="none" .dataSource=${data.source}></lr-eval-result>`);
  await waitUntil(() => !!settle); el.sourcePage = 1; settle(); await table(el, 'r0');
  expect(el.dataSource === replacement.source).to.equal(true); expect(el.sourceTotal).to.equal(1); expect(data.pages.length).to.equal(1);
});
it('renders long selection failures at 320px with a keyboard-accessible localized retry', async () => {
  const data = provider(); data.source.lookup = async () => { throw new Error('hidden'); };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result dir="rtl" style="width:320px" .dataSource=${data.source} .strings=${{ sourceSelectionFailed: 'Failure '.repeat(128), retry: 'Retry selected pair' }}></lr-eval-result>`);
  await table(el, 'r0'); await waitUntil(() => !!el.shadowRoot!.querySelector('[part="selection-retry"]'));
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="selection-retry"]')!;
  const { focusByKeyboard } = await import('../../../../test/wtr-focus.js'); await focusByKeyboard(button);
  expect(button.textContent).to.equal('Retry selected pair'); expect(el.shadowRoot!.activeElement === button).to.equal(true);
  expect(button.getBoundingClientRect().height).to.be.at.least(24); expect(el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.scrollWidth).to.be.at.most(321);
});
it('keeps inactive provider dictionaries opaque and does not read legacy runs in source mode', async () => {
  const data = provider(1); const opaque = new Proxy(data.source, { ownKeys() { throw new Error('provider enumerated'); } });
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${opaque}></lr-eval-result>`);
  Object.defineProperty(el, 'runs', { configurable: true, get() { throw new Error('legacy runs read'); } });
  await table(el, 'r0'); await review(el, 'r0'); el.label = 'Other'; await el.updateComplete;
  expect(el.sourceTotal).to.equal(1); delete (el as unknown as { runs?: unknown }).runs;
});
it('revokes legacy controls synchronously when source mode takes precedence', async () => {
  const data = provider(); const el = await fixture<LyraEvalResult>(html`<lr-eval-result .runs=${[record(99).value]}></lr-eval-result>`);
  const grid = await table(el, 'r99'); const form = await review(el, 'r99'); const events: string[] = [];
  el.addEventListener('lr-run-activate', () => events.push('activate')); el.addEventListener('lr-review-submit', () => events.push('submit'));
  el.dataSource = data.source;
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: grid.rows[0] } }));
  form.dispatchEvent(new CustomEvent('lr-submit', { detail: { itemId: 'r99', value: {} } }));
  await table(el, 'r0'); await review(el, 'r0'); expect(events).to.deep.equal([]);
});
it('revokes review activation immediately when the source review is disabled', async () => {
  const data = provider(); const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source}></lr-eval-result>`);
  await table(el, 'r0'); const form = await review(el, 'r0'); let events = 0; el.addEventListener('lr-review-submit', () => events++);
  el.disabled = true; form.dispatchEvent(new CustomEvent('lr-submit', { detail: { itemId: 'r0', value: {} } })); await el.updateComplete;
  expect(events).to.equal(0); expect(el.shadowRoot!.querySelector<LyraRubricForm>('lr-rubric-form')!.disabled).to.equal(true);
});
it('uses unregistered English loading/selection fallbacks and live strings overrides', async () => {
  const data = provider(1); let settle!: () => void; const query = data.source.query;
  data.source.query = request => new Promise(resolve => { settle = () => { void Promise.resolve(query(request)).then(resolve); }; });
  data.source.lookup = async () => { throw new Error('hidden'); };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result lang="en" .dataSource=${data.source}></lr-eval-result>`);
  await waitUntil(() => !!settle); expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Loading…');
  el.strings = { loading: 'Wait here' }; await el.updateComplete; expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Wait here');
  settle(); await table(el, 'r0'); await waitUntil(() => !!el.shadowRoot!.querySelector('[part="selection-retry"]'));
  expect(el.shadowRoot!.querySelector('[part="selection-status"]')!.textContent).to.include('Selected items could not be loaded.');
  expect(el.shadowRoot!.querySelector('[part="selection-retry"]')!.textContent).to.equal('Retry');
  el.strings = { sourceSelectionFailed: 'Selection unavailable', retry: 'Again' }; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="selection-status"]')!.textContent).to.equal('Selection unavailableAgain');
});
it('uses native RTL header navigation and resets the provider page after keyboard sorting', async () => {
  const data = provider(); const sorts: (string | null)[] = []; const query = data.source.query;
  data.source.query = request => { sorts.push(request.query.sortKey); return query(request); };
  const el = await fixture<LyraEvalResult>(html`<lr-eval-result dir="rtl" .dataSource=${data.source} .sourcePage=${1} .sourcePageSize=${3} selected-run-id="none" baseline-run-id="none" .columns=${[
    { key: 'label', label: 'Run', sortable: true, cell: (row: EvalRunResult) => row.label },
    { key: 'output', label: 'Output', sortable: true, cell: (row: EvalRunResult) => row.output },
  ]}></lr-eval-result>`);
  const grid = await table(el, 'r3'); const headers = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('[role="columnheader"][tabindex]')];
  const { focusByKeyboard } = await import('../../../../test/wtr-focus.js'); const { sendKeys } = await import('@web/test-runner-commands');
  await focusByKeyboard(headers[0]!); await sendKeys({ press: 'ArrowLeft' }); expect(grid.shadowRoot!.activeElement === headers[1]).to.equal(true);
  await sendKeys({ press: 'Enter' }); await table(el, 'r0'); expect(sorts).to.deep.equal([null, 'output']); expect(el.sourcePage).to.equal(0);
});
it('renders successful emptiness without comparison or a fabricated selection failure', async () => {
  const data = provider(0); const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source}></lr-eval-result>`);
  await waitUntil(() => el.sourceTotal === 0); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-rubric-form')).to.equal(null); expect(el.shadowRoot!.querySelector('[part="selection-retry"]')).to.equal(null);
  expect(data.lookups.length).to.equal(0); expect(el.shadowRoot!.querySelector<LyraTable>('lr-table')!.error).to.equal(false);
});
it('still refreshes the selected cache when an explicit refresh follows a locale attribute change', async () => {
  const data = provider(); const el = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${data.source} selected-run-id="r11" baseline-run-id="r1"></lr-eval-result>`);
  await table(el, 'r0'); await review(el, 'r11');
  el.lang = 'de'; el.requestUpdate(); await table(el, 'r0'); await review(el, 'r11');
  expect(data.lookups.length).to.equal(2);
});

it('refreshes the explicit pair when navigation observes a new revision on the same provider', async () => {
  let lookups = 0;
  const row = (index: number): LyraSourceRecord<EvalRunResult> => ({ key: `r${index}`, order: index, value: { id: `r${index}`, label: `Run ${index}`, output: `revision ${source.revision}: ${index}` } });
  const source = { revision: 1,
    query: async ({ page, pageSize }: { page: number; pageSize: number }) => ({ total: 6, rows: Array.from({ length: Math.min(pageSize, 6 - page * pageSize) }, (_, offset) => row(page * pageSize + offset)) }),
    lookup: async (keys: readonly string[]) => { lookups++; return keys.map(key => row(Number(key.slice(1)))); }, locate: async () => null,
  };
  const element = await fixture<LyraEvalResult>(html`<lr-eval-result .dataSource=${source} .sourcePageSize=${2} selected-run-id="r5" baseline-run-id="r4"></lr-eval-result>`);
  const diff = () => element.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & { newText: string } | null;
  await waitUntil(() => diff()?.newText === 'revision 1: 5');
  source.revision = 2; element.sourcePage = 1;
  await waitUntil(() => element.sourceTotal === 6 && element.shadowRoot!.querySelector<LyraTable<EvalRunResult>>('lr-table')?.rows[0]?.output === 'revision 2: 2');
  await element.updateComplete;
  expect(diff()?.newText).to.equal('revision 2: 5'); expect(lookups).to.equal(2);
});

it('stops obsolete row descriptor capture after a descriptor navigates to a newer page', async () => {
  let element!: LyraEvalResult; let navigated = false; let obsoleteLabels = 0;
  const old = new Proxy({ id: 'r0', label: 'Old', output: 'Old output' }, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !navigated) { navigated = true; element.sourcePage = 1; }
      else if (key === 'label' && navigated) obsoleteLabels++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const source = { revision: 1,
    query: async ({ page }: { page: number }) => ({ total: 2, rows: [{ key: `r${page}`, order: page, value: page ? { id: 'r1', label: 'New', output: 'New output' } : old }] }),
    lookup: async () => [], locate: async () => null,
  };
  element = await fixture<LyraEvalResult>(html`<lr-eval-result .sourcePageSize=${1} selected-run-id="missing" baseline-run-id="missing"></lr-eval-result>`);
  element.dataSource = source;
  await waitUntil(() => element.sourceTotal === 2 && element.shadowRoot!.querySelector<LyraTable<EvalRunResult>>('lr-table')?.rows[0]?.id === 'r1');
  expect(element.sourcePage).to.equal(1); expect(obsoleteLabels).to.equal(0);
});
it('keeps an explicit pair projection current when its descriptor changes only the displayed page', async () => {
  let element!: LyraEvalResult; let navigated = false; let labels = 0;
  const selected = new Proxy(record(5).value, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !navigated) { navigated = true; element.sourcePage = 1; }
      else if (key === 'label') labels++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const data = provider(6);
  data.source.lookup = async () => [{ key: 'r5', order: 5, value: selected }, record(4)];
  element = await fixture<LyraEvalResult>(html`<lr-eval-result .sourcePageSize=${2} selected-run-id="r5" baseline-run-id="r4"></lr-eval-result>`);
  element.dataSource = data.source;
  await table(element, 'r2'); await review(element, 'r5');
  expect(labels).to.equal(1); expect(element.shadowRoot!.querySelector('[part="selection-retry"]')).to.equal(null);
  expect(element.sourcePage).to.equal(1); expect(element.selectedRunId).to.equal('r5');
});
