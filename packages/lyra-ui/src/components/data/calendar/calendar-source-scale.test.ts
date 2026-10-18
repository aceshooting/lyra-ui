import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './calendar.js';
import '../table/table.js';
import type { CalendarEvent, LyraCalendar } from './calendar.class.js';
import type { LyraTable, TableColumn } from '../table/table.class.js';
import type { LyraPagination } from '../pagination/pagination.class.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';

interface BackendEvent extends CalendarEvent {
  readonly id: string;
  readonly data: { index: number; category: number };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

function monthAt(index: number): string {
  const month = Math.floor(index / 100);
  return `${2000 + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}-01`;
}

it('queries bounded calendar months and activates first, middle and final million-backend events', async () => {
  const count = 1_000_000;
  let backendReads = 0;
  let queryCalls = 0;
  let maxResponseRows = 0;
  let maxRetainedRows = 0;
  let maxMountedEvents = 0;
  let maxDomNodes = 0;
  const wrapper = await fixture<HTMLElement>(html`<section><p>1,000,000 indexed backend events; 100 events per requested month.</p>
    <lr-calendar lang="en" view-date="2000-01-01" aria-label="Current backend month"></lr-calendar></section>`);
  const el = wrapper.querySelector<LyraCalendar>('lr-calendar')!;
  const query = (month: string): readonly BackendEvent[] => {
    const year = Number(month.slice(0, 4));
    const monthIndex = Number(month.slice(5, 7)) - 1;
    const start = ((year - 2000) * 12 + monthIndex) * 100;
    const rows = start < 0 || start >= count ? [] : Array.from({ length: Math.min(100, count - start) }, (_, offset) => {
      backendReads++;
      const index = start + offset;
      return { id: `event-${index}`, title: `Event ${index}`, date: `${month.slice(0, 7)}-${String(Math.floor(offset / 4) + 1).padStart(2, '0')}`,
        data: { index, category: index % 7 } };
    });
    maxResponseRows = Math.max(maxResponseRows, rows.length);
    return rows;
  };
  let epoch = 0;
  let controller: AbortController | undefined;
  const loadMonth = async (month: string, response?: Promise<readonly BackendEvent[]>): Promise<void> => {
    controller?.abort();
    const current = controller = new AbortController();
    const token = ++epoch;
    queryCalls++;
    el.viewDate = month;
    const rows = await (response ?? Promise.resolve(query(month)));
    if (current.signal.aborted || token !== epoch || el.viewDate !== month) return;
    el.events = rows;
    await el.updateComplete;
    maxRetainedRows = Math.max(maxRetainedRows, el.events.length);
    maxMountedEvents = Math.max(maxMountedEvents, el.shadowRoot!.querySelectorAll('[part="event"]').length);
    maxDomNodes = Math.max(maxDomNodes, renderedNodeCount(el));
  };
  let latestLoad = Promise.resolve();
  el.addEventListener('lr-view-change', event => { latestLoad = loadMonth(event.detail.viewDate); });
  const select = async (index: number) => {
    const row = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="event"]')].find(button => button.textContent?.trim() === `Event ${index}`);
    if (!row) throw new Error(`Missing mounted event ${index}`);
    const selected = oneEvent(el, 'lr-event-select');
    row.click();
    const detail = (await selected as CustomEvent<{ event: BackendEvent }>).detail;
    expect(detail.event.id).equal(`event-${index}`);
    expect(detail.event.data).deep.equal({ index, category: index % 7 });
    expect(detail.event === el.events.find(event => event.id === `event-${index}`)).equal(true);
  };
  await loadMonth(monthAt(0));
  await select(0);

  const obsolete = deferred<readonly BackendEvent[]>();
  const oldLoad = loadMonth('2000-02-01', obsolete.promise);
  const oldSignal = controller!.signal;
  // Long-distance jumps are host-controlled; the real next action emits the load request.
  el.viewDate = '2416-08-01';
  await el.updateComplete;
  const next = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]');
  if (!next) throw new Error('Missing calendar next-month action');
  next.click();
  await latestLoad;
  expect(el.viewDate).equal(monthAt(500_000));
  expect(oldSignal.aborted).equal(true);
  obsolete.resolve(query('2000-02-01'));
  await oldLoad;
  expect(el.events[0]?.id).equal('event-500000');
  await select(500_000);

  el.viewDate = '2833-03-01';
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!.click();
  await latestLoad;
  expect(el.viewDate).equal(monthAt(count - 1));
  await select(count - 1);
  expect(el.shadowRoot!.querySelectorAll('[part="day"]').length).equal(42);
  expect(queryCalls).equal(4);
  expect(backendReads).equal(400);
  expect(maxResponseRows).equal(100);
  expect(maxRetainedRows).equal(100);
  expect(maxMountedEvents).equal(100);
  expect(maxDomNodes).lessThan(400);
  recordScaleMeasurement('lr-calendar', 'month-queries@1000000', {
    logicalEvents: count, queryCalls, backendReads, maxResponseRows, maxRetainedRows, maxMountedEvents,
    dayCells: 42, maxDomNodes, selectedIdentities: 3,
  });
});

it('keeps a dense calendar preview bounded while a server-paged table reaches every event', async () => {
  const count = 1_000_000;
  const pageSize = 100;
  const month = '2026-01-01';
  let backendReads = 0;
  let queryCalls = 0;
  let maxResponseRows = 0;
  let maxRetainedRows = 0;
  let maxMountedRows = 0;
  let maxDomNodes = 0;
  const recordAt = (index: number): BackendEvent => {
    if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('Invalid event index');
    backendReads++;
    return { id: `event-${index}`, date: '2026-01-15', title: `Event ${index}`, data: { index, category: index % 7 } };
  };
  const preview = Array.from({ length: 4 }, (_, index) => recordAt(index));
  const columns: readonly TableColumn<BackendEvent>[] = [
    { key: 'id', label: 'Event identity', cell: row => row.id },
    { key: 'date', label: 'Date', cell: row => String(row.date) },
    { key: 'title', label: 'Title', cell: row => row.title },
  ];
  const wrapper = await fixture<HTMLElement>(html`<section>
    <p data-preview-summary>4 preview events of 1,000,000; browse all events in the table.</p>
    <lr-calendar lang="en" view-date=${month} aria-label="Dense day preview" .events=${preview}></lr-calendar>
    <lr-table lang="en" caption="All 1,000,000 events in January" pagination-mode="server" pagination-format="standard"
      page-size="100" total-items="1000000" .rowKey=${(row: BackendEvent) => row.id} .columns=${columns}></lr-table>
  </section>`);
  const calendar = wrapper.querySelector<LyraCalendar>('lr-calendar')!;
  const table = wrapper.querySelector<LyraTable<BackendEvent>>('lr-table')!;
  const query = (page: number): readonly BackendEvent[] => {
    const start = (page - 1) * pageSize;
    const rows = Array.from({ length: Math.min(pageSize, count - start) }, (_, offset) => recordAt(start + offset));
    maxResponseRows = Math.max(maxResponseRows, rows.length);
    return rows;
  };
  let epoch = 0;
  let controller: AbortController | undefined;
  const loadPage = async (page: number, response?: Promise<readonly BackendEvent[]>): Promise<void> => {
    controller?.abort();
    const current = controller = new AbortController();
    const token = ++epoch;
    queryCalls++;
    const requestedMonth = calendar.viewDate;
    const rows = await (response ?? Promise.resolve(query(page)));
    if (current.signal.aborted || token !== epoch || requestedMonth !== calendar.viewDate) return;
    table.page = page;
    table.rows = rows;
    await table.updateComplete;
    maxRetainedRows = Math.max(maxRetainedRows, table.rows.length);
    maxMountedRows = Math.max(maxMountedRows, table.shadowRoot!.querySelectorAll('[part="row"]').length);
    maxDomNodes = Math.max(maxDomNodes, renderedNodeCount(wrapper));
  };
  let latestLoad = Promise.resolve();
  table.addEventListener('lr-page-change', event => { latestLoad = loadPage(event.detail.page); });
  const select = async (index: number) => {
    const row = [...table.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')].find(candidate => candidate.textContent?.includes(`event-${index}`));
    if (!row) throw new Error(`Missing paged event ${index}`);
    const activated = oneEvent(table, 'lr-row-activate');
    row.click();
    const event = await activated as CustomEvent<{ row: BackendEvent }>;
    expect(event.detail.row.id).equal(`event-${index}`);
    expect(event.detail.row.date).equal('2026-01-15');
    expect(event.detail.row.data).deep.equal({ index, category: index % 7 });
  };
  await loadPage(1);
  await select(0);
  await loadPage(5_001);
  await select(500_000);
  const obsolete = deferred<readonly BackendEvent[]>();
  const oldLoad = loadPage(5_002, obsolete.promise);
  const oldSignal = controller!.signal;
  const pagination = table.shadowRoot!.querySelector<LyraPagination>('lr-pagination');
  if (!pagination) throw new Error('Missing server-pagination control');
  await pagination.updateComplete;
  const lastPage = [...pagination.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="page"]')].find(button => button.textContent?.trim() === '10,000');
  if (!lastPage) throw new Error('Missing last-page action');
  const requested = oneEvent(table, 'lr-page-change');
  lastPage.click();
  expect((await requested as CustomEvent<{ page: number }>).detail.page).equal(10_000);
  await latestLoad;
  expect(oldSignal.aborted).equal(true);
  obsolete.resolve(query(5_002));
  await oldLoad;
  expect(table.page).equal(10_000);
  expect(table.rows[0]?.id).equal('event-999900');
  await select(999_999);
  expect(calendar.events.length).equal(4);
  expect(calendar.shadowRoot!.querySelectorAll('[part="event"]').length).equal(4);
  expect(wrapper.querySelector('[data-preview-summary]')?.textContent).contain('4 preview events of 1,000,000');
  expect(queryCalls).equal(4);
  expect(backendReads).equal(404);
  expect(maxResponseRows).equal(100);
  expect(maxRetainedRows).equal(100);
  expect(maxMountedRows).equal(100);
  expect(maxDomNodes).lessThan(2_000);
  recordScaleMeasurement('lr-calendar', 'dense-month-table@1000000', {
    logicalEvents: count, queryCalls, backendReads, maxResponseRows, maxRetainedTableRows: maxRetainedRows,
    maxMountedTableRows: maxMountedRows, retainedPreviewEvents: calendar.events.length, maxDomNodes, selectedIdentities: 3,
  });
});
