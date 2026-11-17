import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import type { LyraSourceContext, LyraPageRequest, LyraPageResult } from '../../../data-sources.js';
import type {
  DocumentLibrarySource,
  DocumentLibrarySourceQuery,
  LibraryDocument,
  LyraDocumentLibrary,
} from './document-library.class.js';
import type { LyraTable } from '../table/table.class.js';
import './document-library.js';
import '../../../translations/fr.js';

interface CursorRequest extends LyraSourceContext {
  readonly scope: string;
  readonly query: DocumentLibrarySourceQuery;
  readonly cursor: string | null;
  readonly limit: number;
}
interface CursorRecord {
  readonly key: string;
  readonly value: LibraryDocument;
}
interface CursorResult {
  readonly rows: readonly CursorRecord[];
  readonly nextCursor: string | null;
}
interface CursorSource {
  readonly revision: string | number;
  readonly scope: string;
  query(request: CursorRequest): Promise<CursorResult>;
}
interface CursorNavigation {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly atEnd: boolean;
  readonly historyTruncated: boolean;
}
type CursorLibrary = LyraDocumentLibrary & {
  cursorSource: CursorSource | undefined;
  readonly cursorNavigation: CursorNavigation;
  nextCursorPage(): Promise<boolean>;
  previousCursorPage(): Promise<boolean>;
  restartCursorSource(): Promise<boolean>;
};
interface QueryChange {
  readonly searchTerm: string;
  readonly tags: readonly string[];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
function page(ids: readonly string[], nextCursor: string | null): CursorResult {
  return {
    rows: ids.map(id => ({ key: id, value: { id, name: `Document ${id}`, tags: ['row-tag'] } })),
    nextCursor,
  };
}
function recordingSource(
  run: (request: CursorRequest) => CursorResult | Promise<CursorResult>,
  scope = 'documents-a',
) {
  const requests: CursorRequest[] = [];
  const source: CursorSource = {
    revision: 'r1', scope,
    query: async request => { requests.push(request); return run(request); },
  };
  return { source, requests };
}
function exactSource(): DocumentLibrarySource {
  return {
    revision: 'r1',
    query: async ({ page: index, pageSize }) => ({
      total: 3,
      rows: ['exact-a', 'exact-b', 'exact-c'].slice(index * pageSize, (index + 1) * pageSize)
        .map((id, offset) => ({ key: id, order: index * pageSize + offset, value: { id, name: id } })),
      tags: { total: 1, values: [{ key: 'global-tag', label: 'Global tag' }], unavailableSelected: [] },
    }),
    lookup: async keys => keys.flatMap(id => {
      const order = ['exact-a', 'exact-b', 'exact-c'].indexOf(id);
      return order < 0 ? [] : [{ key: id, order, value: { id, name: id } }];
    }),
    locate: async key => {
      const index = ['exact-a', 'exact-b', 'exact-c'].indexOf(key);
      return index < 0 ? null : index;
    },
  };
}
function grid(element: LyraDocumentLibrary): LyraTable<LibraryDocument> {
  const value = element.shadowRoot?.querySelector<LyraTable<LibraryDocument>>('lr-table');
  expect(Boolean(value), 'document grid is present').to.equal(true);
  return value!;
}
async function settle(element: LyraDocumentLibrary): Promise<void> {
  await element.updateComplete;
  for (let index = 0; index < 12; index++) await Promise.resolve();
  await element.shadowRoot?.querySelector<LyraTable>('lr-table')?.updateComplete;
  await element.updateComplete;
}
async function ready(element: CursorLibrary, firstId?: string): Promise<void> {
  await settle(element);
  expect(element.cursorNavigation?.status, 'cursorSource exposes a navigation state').not.to.equal(undefined);
  await waitUntil(() => element.cursorNavigation.status === 'ready' &&
    (firstId === undefined || grid(element).rows[0]?.id === firstId), 'cursor batch commits');
  await settle(element);
}
async function failed(element: CursorLibrary): Promise<void> {
  await waitUntil(() => element.cursorNavigation?.status === 'error', 'cursor failure is observable');
  await settle(element);
  expect(grid(element).error).to.equal(true);
  expect(grid(element).rows.length).to.equal(0);
}
async function mount(source: CursorSource, selected: readonly string[] = []): Promise<CursorLibrary> {
  return fixture<CursorLibrary>(html`<lr-document-library
    .cursorSource=${source}
    .sourcePageSize=${2}
    .selectedDocumentIds=${selected}
  ></lr-document-library>`);
}
function control(element: CursorLibrary, part: string): HTMLButtonElement {
  const value = element.shadowRoot?.querySelector<HTMLButtonElement>(`[part~="${part}"]`);
  expect(Boolean(value), `${part} control is present`).to.equal(true);
  return value!;
}
function retryButton(element: CursorLibrary): HTMLElement {
  const value = grid(element).shadowRoot?.querySelector<HTMLElement>('[part~="retry-button"]');
  expect(Boolean(value), 'failed batch has the existing retry control').to.equal(true);
  return value!;
}
function rowControl(element: CursorLibrary, id: string, selector: string): HTMLElement {
  const row = grid(element).rowElement(id);
  const value = row?.querySelector<HTMLElement>(selector);
  expect(Boolean(value), `document ${id} has ${selector}`).to.equal(true);
  return value!;
}
function textAcrossRoots(root: Node & ParentNode): string {
  let text = root.textContent ?? '';
  for (const child of root.querySelectorAll<HTMLElement>('*')) {
    if (child.shadowRoot) text += textAcrossRoots(child.shadowRoot);
  }
  return text;
}
function search(element: LyraDocumentLibrary, value: string): void {
  element.shadowRoot!.querySelector('lr-input')!.dispatchEvent(
    new CustomEvent('lr-input', { detail: { value } }),
  );
}
function queryChanges(element: CursorLibrary): QueryChange[] {
  const values: QueryChange[] = [];
  element.addEventListener('lr-query-change', (event: Event) => {
    values.push((event as CustomEvent<QueryChange>).detail);
  });
  return values;
}

it('leaves the array route unchanged when cursorSource is unset', async () => {
  const element = await fixture<CursorLibrary>(html`<lr-document-library
    .documents=${[{ id: 'b', name: 'Beta' }, { id: 'a', name: 'Alpha' }]}
  ></lr-document-library>`);
  await settle(element);
  expect(element.cursorSource).to.equal(undefined);
  expect(grid(element).rows.map(row => row.id)).to.deep.equal(['a', 'b']);
  expect(element.sourceTotal).to.equal(null);
  expect(element.shadowRoot!.querySelectorAll('[part~="cursor-navigation"]').length).to.equal(0);
  const changes: number[] = [];
  element.addEventListener('lr-filter-change', event => changes.push(event.detail.matchCount));
  search(element, 'Alpha');
  await settle(element);
  expect(grid(element).rows.map(row => row.id)).to.deep.equal(['a']);
  expect(changes).to.deep.equal([1]);
});

it('preserves exact counted paging, global facets and numeric filter notifications with cursorSource unset', async () => {
  const source = exactSource();
  const pages: number[] = [];
  const query = source.query;
  source.query = request => { pages.push(request.page); return query(request); };
  const element = await fixture<CursorLibrary>(html`<lr-document-library
    .dataSource=${source} .sourcePageSize=${2}
  ></lr-document-library>`);
  await waitUntil(() => element.sourceTotal === 3);
  await settle(element);
  expect(element.cursorSource).to.equal(undefined);
  expect(grid(element).rows.map(row => row.id)).to.deep.equal(['exact-a', 'exact-b']);
  expect(element.shadowRoot!.querySelector('lr-option')?.textContent).to.equal('Global tag');
  expect(element.shadowRoot!.querySelectorAll('[part~="cursor-navigation"]').length).to.equal(0);
  element.sourcePage = 1;
  await waitUntil(() => grid(element).rows[0]?.id === 'exact-c');
  const counts: number[] = [];
  element.addEventListener('lr-filter-change', event => counts.push(event.detail.matchCount));
  search(element, 'updated');
  await waitUntil(() => counts.length === 1);
  expect(counts).to.deep.equal([3]);
  expect(pages).to.deep.equal([0, 1, 0]);
});

it('accepts a minimal cursor provider without consulting total, order, lookup, locate or facet metadata', async () => {
  let unsupportedReads = 0;
  const result = page(['a'], ' opaque / + ? = % token ');
  for (const key of ['total', 'tags', 'groups']) {
    Object.defineProperty(result, key, { get() { unsupportedReads++; throw new Error('Unsupported capability'); } });
  }
  Object.defineProperty(result.rows[0]!, 'order', { get() { unsupportedReads++; throw new Error('No global order'); } });
  const provider = recordingSource(() => result);
  for (const key of ['lookup', 'locate']) {
    Object.defineProperty(provider.source, key, { get() { unsupportedReads++; throw new Error('Unsupported capability'); } });
  }
  const element = await mount(provider.source);
  await ready(element, 'a');
  expect(provider.requests.length).to.equal(1);
  expect(provider.requests[0]?.cursor).to.equal(null);
  expect(provider.requests[0]?.limit).to.equal(2);
  expect(provider.requests[0]?.scope).to.equal('documents-a');
  expect(unsupportedReads).to.equal(0);
  expect(element.sourceTotal).to.equal(null);
  expect(grid(element).shadowRoot!.querySelectorAll('lr-pagination').length).to.equal(0);
  expect(element.shadowRoot!.querySelectorAll('[part~="tag-filter"], [part~="limit"]').length).to.equal(0);
  expect(element.shadowRoot!.innerHTML).not.to.contain('opaque /');
  expect(grid(element).shadowRoot!.textContent).to.contain('row-tag');
  expect(element.cursorNavigation.canGoForward).to.equal(true);
  expect(element.cursorNavigation.canGoBack).to.equal(false);
  expect(Object.isFrozen(element.cursorNavigation)).to.equal(true);
});

it('uses the rendered Next and Previous controls with opaque tokens and refetches Back before branching forward', async () => {
  const token = ' keep /?+%== this token ';
  let secondVisit = false;
  const provider = recordingSource(request => {
    if (request.cursor === null) return page(['a'], token);
    if (request.cursor === token) {
      const next = secondVisit ? 'new-branch' : 'original-branch';
      secondVisit = true;
      return page(['b'], next);
    }
    if (request.cursor === 'original-branch') return page(['c'], null);
    if (request.cursor === 'new-branch') return page(['d'], null);
    throw new Error('Unexpected opaque token');
  });
  const element = await mount(provider.source);
  await ready(element, 'a');
  control(element, 'cursor-next').click();
  await ready(element, 'b');
  control(element, 'cursor-next').click();
  await ready(element, 'c');
  expect(element.cursorNavigation.atEnd).to.equal(true);
  expect(control(element, 'cursor-next').getAttribute('aria-disabled')).to.equal('true');
  control(element, 'cursor-previous').click();
  await ready(element, 'b');
  control(element, 'cursor-next').click();
  await ready(element, 'd');
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([
    null, token, 'original-branch', token, 'new-branch',
  ]);
  expect(element.sourceTotal).to.equal(null);
  expect(grid(element).shadowRoot!.querySelectorAll('lr-pagination').length).to.equal(0);
});

it('retries exactly the failed continuation, honors retry veto and keeps provider errors out of the view', async () => {
  let attempts = 0;
  const provider = recordingSource(request => {
    if (request.cursor === null) return page(['a'], 'next-token');
    if (++attempts === 1) throw new Error('Private transport details must not render');
    return page(['b'], null);
  });
  const element = await mount(provider.source);
  await ready(element, 'a');
  expect(await element.nextCursorPage()).to.equal(false);
  await failed(element);
  const firstAttempt = provider.requests[1]!;
  expect(element.cursorNavigation.atEnd).to.equal(false);
  expect(element.cursorNavigation.canGoForward).to.equal(false);
  expect(textAcrossRoots(grid(element).shadowRoot!)).not.to.contain('Private transport details');
  const veto = (event: Event) => event.preventDefault();
  element.addEventListener('lr-retry-request', veto);
  retryButton(element).click();
  await settle(element);
  expect(provider.requests.length).to.equal(2);
  expect(element.cursorNavigation.status).to.equal('error');
  element.removeEventListener('lr-retry-request', veto);
  retryButton(element).click();
  await ready(element, 'b');
  const retried = provider.requests[2]!;
  expect([retried.cursor, retried.scope, retried.revision, retried.locale, retried.limit]).to.deep.equal([
    firstAttempt.cursor, firstAttempt.scope, firstAttempt.revision, firstAttempt.locale, firstAttempt.limit,
  ]);
  expect(retried.query).to.deep.equal(firstAttempt.query);
  expect(element.cursorNavigation.canGoBack).to.equal(true);
});

it('starts over explicitly from null after an expired continuation instead of silently skipping the failure', async () => {
  let starts = 0;
  const provider = recordingSource(request => {
    if (request.cursor !== null) throw new Error('Expired cursor');
    return page([++starts === 1 ? 'a' : 'fresh'], 'expires');
  });
  const element = await mount(provider.source);
  await ready(element, 'a');
  expect(await element.nextCursorPage()).to.equal(false);
  await failed(element);
  await settle(element);
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'expires']);
  control(element, 'cursor-restart').click();
  await ready(element, 'fresh');
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'expires', null]);
  expect(element.cursorNavigation.canGoBack).to.equal(false);
  expect(element.cursorNavigation.historyTruncated).to.equal(false);
});

it('retries a failed Back with its earlier cursor and does not consume another forward token', async () => {
  let starts = 0;
  const provider = recordingSource(request => {
    if (request.cursor === null) {
      if (++starts === 2) throw new Error('Back unavailable');
      return page(['a'], 'b-token');
    }
    return page(['b'], null);
  });
  const element = await mount(provider.source);
  await ready(element, 'a');
  expect(await element.nextCursorPage()).to.equal(true);
  await ready(element, 'b');
  expect(await element.previousCursorPage()).to.equal(false);
  await failed(element);
  retryButton(element).click();
  await ready(element, 'a');
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'b-token', null, null]);
  expect(element.cursorNavigation.canGoBack).to.equal(false);
  expect(element.cursorNavigation.canGoForward).to.equal(true);
});

it('keeps one physical query and only the latest pending search while a revoked provider ignores abort', async () => {
  const old = deferred<CursorResult>();
  let active = 0;
  let maximum = 0;
  const provider = recordingSource(async request => {
    active++;
    maximum = Math.max(maximum, active);
    try {
      if (request.cursor !== null) return await old.promise;
      return page([request.query.searchTerm || 'a'], 'slow-token');
    } finally { active--; }
  });
  const element = await mount(provider.source);
  try {
    await ready(element, 'a');
    const pending = element.nextCursorPage();
    let canceled: boolean | undefined;
    void pending.then(value => { canceled = value; });
    await waitUntil(() => provider.requests.length === 2);
    expect(await element.nextCursorPage()).to.equal(false);
    control(element, 'cursor-next').click();
    for (let index = 0; index < 20; index++) element.searchTerm = `search-${index}`;
    expect(provider.requests[1]!.signal.aborted).to.equal(true);
    await settle(element);
    expect(canceled).to.equal(false);
    expect(provider.requests.length).to.equal(2);
    expect(active).to.equal(1);
    old.resolve(page(['stale'], null));
    await ready(element, 'search-19');
    expect(provider.requests.map(request => [request.cursor, request.query.searchTerm])).to.deep.equal([
      [null, ''], ['slow-token', ''], [null, 'search-19'],
    ]);
    expect(maximum).to.equal(1);
    expect(await pending).to.equal(false);
  } finally { old.resolve(page([], null)); }
});

for (const changed of ['query', 'scope', 'revision', 'source', 'locale'] as const) {
  it(`revokes the previous cursor immediately when ${changed} changes and restarts with current authority`, async () => {
    const old = deferred<CursorResult>();
    let firstName = 'initial';
    const provider = recordingSource(request => request.cursor === null ? page([firstName], 'pending') : old.promise);
    const replacement = recordingSource(() => page(['current'], null), 'documents-a');
    const element = await mount(provider.source);
    const unexpected: string[] = [];
    element.addEventListener('lr-filter-change', () => unexpected.push('count'));
    element.addEventListener('lr-selection-change', () => unexpected.push('selection'));
    element.addEventListener('lr-open', () => unexpected.push('open'));
    try {
      await ready(element, 'initial');
      const pending = element.nextCursorPage();
      await waitUntil(() => provider.requests.length === 2);
      firstName = 'current';
      if (changed === 'query') element.searchTerm = 'new search';
      if (changed === 'scope') {
        Object.assign(provider.source, { scope: 'documents-b' });
        element.cursorSource = provider.source;
      }
      if (changed === 'revision') {
        Object.assign(provider.source, { revision: 'r2' });
        element.cursorSource = provider.source;
      }
      if (changed === 'source') element.cursorSource = replacement.source;
      if (changed === 'locale') element.locale = 'fr';
      expect(provider.requests[1]!.signal.aborted, `${changed} revokes before the next render`).to.equal(true);
      old.resolve(page(['stale'], null));
      expect(await pending).to.equal(false);
      await ready(element, 'current');
      const latest = changed === 'source' ? replacement.requests.at(-1)! : provider.requests.at(-1)!;
      expect(latest.cursor).to.equal(null);
      expect(latest.scope).to.equal(changed === 'scope' ? 'documents-b' : 'documents-a');
      expect(latest.revision).to.equal(changed === 'revision' ? 'r2' : 'r1');
      if (changed === 'query') expect(latest.query.searchTerm).to.equal('new search');
      if (changed === 'locale') expect(latest.locale).to.equal('fr');
      expect(element.sourceTotal).to.equal(null);
      expect(element.cursorNavigation.canGoBack).to.equal(false);
      expect(grid(element).rows.map(row => row.id)).to.deep.equal(['current']);
      expect(unexpected).to.deep.equal([]);
    } finally { old.resolve(page([], null)); }
  });
}

it('emits an immutable query notification without matchCount and forwards complete query inputs without page-local filtering', async () => {
  let filterCalls = 0;
  const filter = () => { filterCalls++; return false; };
  const provider = recordingSource(request => page(request.query.searchTerm ? ['z', 'a'] : ['initial'], null));
  const element = await fixture<CursorLibrary>(html`<lr-document-library
    .cursorSource=${provider.source} .sourcePageSize=${2} .filter=${filter} .tagFilter=${['outside-page']}
  ></lr-document-library>`);
  await ready(element, 'initial');
  const changes = queryChanges(element);
  let counts = 0;
  element.addEventListener('lr-filter-change', () => counts++);
  search(element, 'unmatched text');
  await ready(element, 'z');
  expect(grid(element).rows.map(row => row.id)).to.deep.equal(['z', 'a']);
  expect(filterCalls).to.equal(0);
  expect(provider.requests.at(-1)!.query.filter === filter).to.equal(true);
  expect(provider.requests.at(-1)!.query.tagFilter).to.deep.equal(['outside-page']);
  expect(element.tagFilter).to.deep.equal(['outside-page']);
  expect(changes).to.deep.equal([{ searchTerm: 'unmatched text', tags: ['outside-page'] }]);
  expect(Object.isFrozen(changes[0])).to.equal(true);
  expect(Object.isFrozen(changes[0]!.tags)).to.equal(true);
  expect(Object.hasOwn(changes[0]!, 'matchCount')).to.equal(false);
  expect(counts).to.equal(0);
  element.searchTerm = 'controlled';
  await ready(element, 'z');
  expect(changes.length).to.equal(1);
});

it('reports a user query edit immediately even when its result fails, without a fabricated match count', async () => {
  const rejected = deferred<CursorResult>();
  const provider = recordingSource(request => request.query.searchTerm ? rejected.promise : page(['a'], null));
  const element = await mount(provider.source);
  try {
    await ready(element, 'a');
    const changes = queryChanges(element);
    let counts = 0;
    element.addEventListener('lr-filter-change', () => counts++);
    search(element, 'later failure');
    expect(changes).to.deep.equal([{ searchTerm: 'later failure', tags: [] }]);
    await waitUntil(() => provider.requests.length === 2);
    rejected.resolve({ rows: [], nextCursor: '' });
    await failed(element);
    expect(changes.length).to.equal(1);
    expect(counts).to.equal(0);
    expect(element.sourceTotal).to.equal(null);
  } finally { rejected.resolve(page([], null)); }
});

it('keeps the newest source assigned by an abort callback instead of overwriting it with the outer replacement', async () => {
  const pendingResult = deferred<CursorResult>();
  const outer = recordingSource(() => page(['outer'], null));
  const nested = recordingSource(() => page(['nested'], null));
  let element: CursorLibrary | undefined;
  const first = recordingSource(request => {
    if (request.cursor === null) return page(['a'], 'pending');
    request.signal.addEventListener('abort', () => { if (element) element.cursorSource = nested.source; }, { once: true });
    return pendingResult.promise;
  });
  element = await mount(first.source);
  try {
    await ready(element, 'a');
    const operation = element.nextCursorPage();
    await waitUntil(() => first.requests.length === 2);
    element.cursorSource = outer.source;
    pendingResult.resolve(page(['stale'], null));
    expect(await operation).to.equal(false);
    await ready(element, 'nested');
    expect(element.cursorSource === nested.source).to.equal(true);
    expect(outer.requests.length).to.equal(0);
    expect(nested.requests.map(request => request.cursor)).to.deep.equal([null]);
    expect(grid(element).rows.map(row => row.id)).to.deep.equal(['nested']);
  } finally { pendingResult.resolve(page([], null)); }
});

it('keeps named paints and numeric sourcePage assignments inert while same-source and explicit refresh restart once', async () => {
  const provider = recordingSource(request => page([request.cursor === null ? 'a' : 'b'], request.cursor === null ? 'next' : null));
  const element = await mount(provider.source);
  await ready(element, 'a');
  expect(await element.nextCursorPage()).to.equal(true);
  await ready(element, 'b');
  element.sourcePage = 9000;
  element.label = 'Documents';
  element.strings = { documentLibraryNameColumn: 'Title' };
  await settle(element);
  expect(provider.requests.length).to.equal(2);
  expect(grid(element).rows[0]?.id).to.equal('b');
  element.cursorSource = provider.source;
  await ready(element, 'a');
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'next', null]);
  element.requestUpdate();
  await ready(element, 'a');
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'next', null, null]);
  expect(element.cursorNavigation.canGoBack).to.equal(false);
});

for (const initial of ['exact', 'cursor'] as const) {
  it(`shares the physical page permit when switching from ${initial} to ${initial === 'exact' ? 'cursor' : 'exact'}`, async () => {
    const release = deferred<void>();
    const requests: { mode: string; signal: AbortSignal }[] = [];
    let active = 0;
    let maximum = 0;
    const dual = {
      revision: 'r1', scope: 'same-collection',
      query: async (request: CursorRequest | LyraPageRequest<DocumentLibrarySourceQuery>): Promise<CursorResult | LyraPageResult<LibraryDocument>> => {
        const mode = 'cursor' in request ? 'cursor' : 'exact';
        requests.push({ mode, signal: request.signal });
        active++;
        maximum = Math.max(maximum, active);
        const first = requests.length === 1;
        try {
          if (first) await release.promise;
          const id = first ? 'obsolete' : 'current';
          return mode === 'cursor' ? page([id], null) : {
            total: 1, rows: [{ key: id, order: 0, value: { id, name: id } }],
            tags: { total: 0, values: [], unavailableSelected: [] },
          };
        } finally { active--; }
      },
      lookup: async () => [], locate: async () => null,
    } as unknown as DocumentLibrarySource & CursorSource;
    const element = await fixture<CursorLibrary>(html`<lr-document-library
      .dataSource=${initial === 'exact' ? dual : undefined}
      .cursorSource=${initial === 'cursor' ? dual : undefined}
    ></lr-document-library>`);
    try {
      await settle(element);
      expect(requests.map(request => request.mode), 'the initial provider route starts').to.deep.equal([initial]);
      if (initial === 'exact') {
        element.dataSource = undefined;
        element.cursorSource = dual;
      } else {
        element.cursorSource = undefined;
        element.dataSource = dual;
      }
      expect(requests[0]!.signal.aborted).to.equal(true);
      await settle(element);
      expect(requests.length, 'abort does not free the physical callback permit').to.equal(1);
      expect(active).to.equal(1);
      release.resolve(undefined);
      await waitUntil(() => grid(element).rows[0]?.id === 'current');
      await settle(element);
      expect(requests.map(request => request.mode)).to.deep.equal([initial, initial === 'exact' ? 'cursor' : 'exact']);
      expect(maximum).to.equal(1);
      expect(element.sourceTotal).to.equal(initial === 'exact' ? null : 1);
    } finally { release.resolve(undefined); }
  });
}

it('keeps explicit off-page selected IDs and limits select-all to the current cursor batch', async () => {
  const provider = recordingSource(request => request.cursor === null ? page(['a'], 'b-token') : page(['b', 'c'], null));
  const element = await mount(provider.source, ['not-loaded']);
  await ready(element, 'a');
  const changes: string[][] = [];
  element.addEventListener('lr-selection-change', event => changes.push([...event.detail.documentIds]));
  rowControl(element, 'a', 'lr-checkbox').click();
  await settle(element);
  expect(element.selectedDocumentIds).to.deep.equal(['not-loaded', 'a']);
  expect(await element.nextCursorPage()).to.equal(true);
  await ready(element, 'b');
  const selectPage = grid(element).shadowRoot!.querySelector<HTMLElement>('thead lr-checkbox');
  expect(Boolean(selectPage)).to.equal(true);
  expect(selectPage!.getAttribute('aria-label')).to.equal('Select documents on this page');
  selectPage!.click();
  await settle(element);
  expect(element.selectedDocumentIds).to.deep.equal(['not-loaded', 'a', 'b', 'c']);
  expect(changes).to.deep.equal([['not-loaded', 'a'], ['not-loaded', 'a', 'b', 'c']]);
  expect(await element.previousCursorPage()).to.equal(true);
  await ready(element, 'a');
  expect(element.selectedDocumentIds).to.deep.equal(['not-loaded', 'a', 'b', 'c']);
  element.selectedDocumentIds = ['controlled-off-page'];
  await settle(element);
  expect(changes.length).to.equal(2);
  expect(element.selectedDocumentIds).to.deep.equal(['controlled-off-page']);
});

it('preserves selection for same-scope replacement but clears another namespace before accepting its restored IDs', async () => {
  const first = recordingSource(() => page(['same-key'], null));
  const sameScope = recordingSource(() => page(['same-key'], null));
  const otherScope = recordingSource(() => page(['same-key'], null), 'documents-b');
  const element = await mount(first.source, ['same-key', 'unloaded']);
  await ready(element, 'same-key');
  let notifications = 0;
  element.addEventListener('lr-selection-change', () => notifications++);
  element.cursorSource = sameScope.source;
  await ready(element, 'same-key');
  expect(element.selectedDocumentIds).to.deep.equal(['same-key', 'unloaded']);
  element.cursorSource = otherScope.source;
  expect(element.selectedDocumentIds, 'namespace changes invalidate old key intent synchronously').to.deep.equal([]);
  await ready(element, 'same-key');
  element.cursorSource = first.source;
  element.selectedDocumentIds = ['restored-after-source'];
  await ready(element, 'same-key');
  expect(element.selectedDocumentIds).to.deep.equal(['restored-after-source']);
  expect(notifications).to.equal(0);
});

it('rejects stale row and select-page actions even when a new scope reuses the same key', async () => {
  const first = recordingSource(() => page(['same-key'], null));
  const delayed = deferred<CursorResult>();
  const second = recordingSource(() => delayed.promise, 'documents-b');
  const element = await mount(first.source);
  try {
    await ready(element, 'same-key');
    const oldName = rowControl(element, 'same-key', '[part~="document-name"]');
    const oldCheckbox = rowControl(element, 'same-key', 'lr-checkbox');
    const oldSelectPage = grid(element).shadowRoot!.querySelector<HTMLElement>('thead lr-checkbox')!;
    const opens: string[] = [];
    const selections: string[][] = [];
    element.addEventListener('lr-open', event => opens.push(event.detail.documentId));
    element.addEventListener('lr-selection-change', event => selections.push([...event.detail.documentIds]));
    const staleActions = (): void => {
      oldName.click();
      oldCheckbox.dispatchEvent(new CustomEvent('lr-change', { detail: { checked: true } }));
      oldSelectPage.dispatchEvent(new CustomEvent('lr-change', { detail: { checked: true } }));
    };
    element.cursorSource = second.source;
    staleActions();
    await settle(element);
    expect(oldName.isConnected).to.equal(false);
    delayed.resolve(page(['same-key'], null));
    await ready(element, 'same-key');
    staleActions();
    await settle(element);
    expect(opens).to.deep.equal([]);
    expect(selections).to.deep.equal([]);
    expect(element.selectedDocumentIds).to.deep.equal([]);
    rowControl(element, 'same-key', '[part~="document-name"]').click();
    expect(opens).to.deep.equal(['same-key']);
  } finally { delayed.resolve(page([], null)); }
});

it('retains keyboard focus on the mounted Next control when it reaches the terminal batch in RTL', async () => {
  const provider = recordingSource(request => request.cursor === null ? page(['a'], 'end') : page(['b'], null));
  const element = await mount(provider.source);
  element.dir = 'rtl';
  await ready(element, 'a');
  const next = control(element, 'cursor-next');
  await focusByKeyboard(next);
  await sendKeys({ press: 'Enter' });
  await ready(element, 'b');
  expect(next.isConnected).to.equal(true);
  expect(deepActiveElementIn(document)?.getAttribute('part')).to.contain('cursor-next');
  expect(next.getAttribute('aria-disabled')).to.equal('true');
  const calls = provider.requests.length;
  await sendKeys({ press: 'Enter' });
  next.click();
  await settle(element);
  expect(provider.requests.length).to.equal(calls);
});

it('does not steal focus moved outside the library while a cursor navigation is pending', async () => {
  const delayed = deferred<CursorResult>();
  const provider = recordingSource(request => request.cursor === null ? page(['a'], 'pending') : delayed.promise);
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-document-library .cursorSource=${provider.source}></lr-document-library>
    <button id="outside-cursor-library" type="button">Another action</button>
  </div>`);
  const element = wrapper.querySelector<CursorLibrary>('lr-document-library')!;
  try {
    await ready(element, 'a');
    await focusByKeyboard(control(element, 'cursor-next'));
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => provider.requests.length === 2);
    await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#outside-cursor-library')!);
    delayed.resolve(page(['b'], null));
    await ready(element, 'b');
    expect(deepActiveElementIn(document)?.id).to.equal('outside-cursor-library');
  } finally { delayed.resolve(page([], null)); }
});

it('retains at most 32 visited cursors and requires Start over to cross the evicted history boundary', async () => {
  const tokens: (string | null)[] = [null, ...Array.from({ length: 40 }, (_, index) => `opaque-${index}`)];
  const responses = new Map<string | null, CursorResult>(tokens.map((token, index) =>
    [token, page([`row-${index}`], tokens[index + 1] ?? null)] as const));
  const provider = recordingSource(request => responses.get(request.cursor)!);
  const element = await mount(provider.source);
  await ready(element, 'row-0');
  for (let index = 1; index <= 40; index++) expect(await element.nextCursorPage(), `forward batch ${index}`).to.equal(true);
  await ready(element, 'row-40');
  expect(element.cursorNavigation.historyTruncated).to.equal(true);
  expect(element.shadowRoot!.querySelector('[part~="cursor-status"]')?.textContent?.trim().length ?? 0).to.be.greaterThan(0);
  for (let index = 39; index >= 9; index--) expect(await element.previousCursorPage(), `retained batch ${index}`).to.equal(true);
  await ready(element, 'row-9');
  const before = provider.requests.length;
  expect(element.cursorNavigation.canGoBack).to.equal(false);
  expect(await element.previousCursorPage()).to.equal(false);
  control(element, 'cursor-previous').click();
  await settle(element);
  expect(provider.requests.length).to.equal(before);
  expect(grid(element).rows.length).to.equal(1);
  expect(element.documents.length).to.equal(0);
  expect(await element.restartCursorSource()).to.equal(true);
  await ready(element, 'row-0');
  expect(provider.requests.at(-1)!.cursor).to.equal(null);
  expect(element.cursorNavigation.historyTruncated).to.equal(false);
  expect(element.cursorNavigation.canGoBack).to.equal(false);
});

for (const cycle of ['self', 'predecessor'] as const) {
  it(`rejects a ${cycle} continuation cycle still present in bounded history`, async () => {
    const provider = recordingSource(request => {
      if (request.cursor === null) return page(['a'], 'token-a');
      if (request.cursor === 'token-a') return page(['b'], cycle === 'self' ? 'token-a' : 'token-b');
      return page(['c'], 'token-a');
    });
    const element = await mount(provider.source);
    await ready(element, 'a');
    if (cycle === 'predecessor') {
      expect(await element.nextCursorPage()).to.equal(true);
      await ready(element, 'b');
    }
    expect(await element.nextCursorPage()).to.equal(false);
    await failed(element);
    expect(provider.requests.length).to.equal(cycle === 'self' ? 2 : 3);
    expect(element.cursorNavigation.atEnd).to.equal(false);
    expect(element.sourceTotal).to.equal(null);
  });
}

it('leaves an empty nonterminal batch navigable without automatically fetching or claiming an empty collection', async () => {
  const provider = recordingSource(request => {
    if (request.cursor === null) return page([], 'nonempty');
    if (request.cursor === 'nonempty') return page(['a'], 'empty-terminal');
    return page([], null);
  });
  const element = await mount(provider.source);
  await ready(element);
  await settle(element);
  expect(provider.requests.length).to.equal(1);
  expect(grid(element).rows.length).to.equal(0);
  expect(element.cursorNavigation.canGoForward).to.equal(true);
  expect(element.cursorNavigation.atEnd).to.equal(false);
  expect(textAcrossRoots(grid(element).shadowRoot!)).not.to.contain('No documents yet');
  expect(textAcrossRoots(grid(element).shadowRoot!)).not.to.contain('No matching documents');
  expect(await element.nextCursorPage()).to.equal(true);
  await ready(element, 'a');
  expect(await element.nextCursorPage()).to.equal(true);
  await ready(element);
  expect(element.cursorNavigation.atEnd).to.equal(true);
  expect(element.cursorNavigation.canGoForward).to.equal(false);
  expect(element.cursorNavigation.canGoBack).to.equal(true);
  expect(element.sourceTotal).to.equal(null);
  expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'nonempty', 'empty-terminal']);
});

it('treats an initially empty terminal response as an empty query without inventing an exact zero total', async () => {
  const provider = recordingSource(() => page([], null));
  const element = await mount(provider.source);
  await ready(element);
  expect(element.cursorNavigation.atEnd).to.equal(true);
  expect(element.cursorNavigation.canGoForward).to.equal(false);
  expect(element.cursorNavigation.canGoBack).to.equal(false);
  expect(element.sourceTotal).to.equal(null);
  expect(grid(element).error).to.equal(false);
  expect(textAcrossRoots(grid(element).shadowRoot!)).to.contain('No documents yet');
});

it('owns accepted row and query snapshots without freezing or rereading the caller result', async () => {
  const raw = { rows: [{ key: 'a', value: { id: 'a', name: 'Original', tags: ['original-tag'] } }], nextCursor: 'next' as string | null };
  const provider = recordingSource(request => request.cursor === null ? raw : page(['b'], null));
  const element = await mount(provider.source);
  element.tagFilter = ['chosen'];
  await ready(element, 'a');
  const request = provider.requests.at(-1)!;
  expect(Object.isFrozen(request)).to.equal(true);
  expect(Object.isFrozen(request.query)).to.equal(true);
  expect(Object.isFrozen(request.query.tagFilter)).to.equal(true);
  expect(Object.isFrozen(raw)).to.equal(false);
  expect(Object.isFrozen(raw.rows[0]!.value)).to.equal(false);
  raw.rows[0]!.value.name = 'Mutated';
  raw.rows[0]!.value.tags.push('later-tag');
  raw.nextCursor = 'wrong-token';
  element.label = 'Named repaint';
  await settle(element);
  expect(grid(element).rows[0]?.name).to.equal('Original');
  expect(grid(element).rows[0]?.tags).to.deep.equal(['original-tag']);
  expect(await element.nextCursorPage()).to.equal(true);
  await ready(element, 'b');
  expect(provider.requests.at(-1)!.cursor).to.equal('next');
});

for (const invalid of ['oversized-page', 'duplicate-key', 'missing-next', 'accessor-name'] as const) {
  it(`fails ${invalid} atomically and accepts a corrected response through the visible retry`, async () => {
    let broken = true;
    let getterReads = 0;
    const provider = recordingSource(() => {
      if (!broken) return page(['valid'], null);
      if (invalid === 'oversized-page') return page(['a', 'b', 'c'], null);
      if (invalid === 'duplicate-key') return page(['same', 'same'], null);
      if (invalid === 'missing-next') return { rows: page(['a'], null).rows } as CursorResult;
      const result = page(['a'], null);
      Object.defineProperty(result.rows[0]!.value, 'name', { get() { getterReads++; return 'Accessor name'; } });
      return result;
    });
    const element = await mount(provider.source);
    await settle(element);
    expect(element.cursorNavigation?.status, 'cursorSource reports admission failure').not.to.equal(undefined);
    await failed(element);
    expect(getterReads).to.equal(0);
    expect(element.sourceTotal).to.equal(null);
    broken = false;
    retryButton(element).click();
    await ready(element, 'valid');
    expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, null]);
    expect(element.cursorNavigation.canGoBack).to.equal(false);
  });
}

it('fails simultaneous exact and cursor inputs closed and restores array mode after both are removed', async () => {
  const cursor = recordingSource(() => page(['cursor'], null));
  const exact = exactSource();
  let exactQueries = 0;
  const query = exact.query;
  exact.query = request => { exactQueries++; return query(request); };
  const element = await fixture<CursorLibrary>(html`<lr-document-library
    .documents=${[{ id: 'array', name: 'Array row' }]}
    .dataSource=${exact} .cursorSource=${cursor.source}
  ></lr-document-library>`);
  await settle(element);
  expect(grid(element).error).to.equal(true);
  expect(grid(element).rows.length).to.equal(0);
  expect(exactQueries).to.equal(0);
  expect(cursor.requests.length).to.equal(0);
  element.dataSource = undefined;
  await ready(element, 'cursor');
  element.cursorSource = undefined;
  await settle(element);
  expect(grid(element).rows.map(row => row.id)).to.deep.equal(['array']);
  expect(element.sourceTotal).to.equal(null);
  expect(element.shadowRoot!.querySelectorAll('[part~="cursor-navigation"]').length).to.equal(0);
});

it('does not call a detached provider and restarts at null after reconnect instead of resuming its stale continuation', async () => {
  const old = deferred<CursorResult>();
  const provider = recordingSource(request => request.cursor === null ? page(['a'], 'pending') : old.promise);
  const element = document.createElement('lr-document-library') as CursorLibrary;
  element.cursorSource = provider.source;
  for (let index = 0; index < 12; index++) await Promise.resolve();
  expect(provider.requests.length).to.equal(0);
  const parent = await fixture<HTMLElement>(html`<div></div>`);
  parent.appendChild(element);
  try {
    await ready(element, 'a');
    const pending = element.nextCursorPage();
    await waitUntil(() => provider.requests.length === 2);
    element.remove();
    expect(provider.requests[1]!.signal.aborted).to.equal(true);
    parent.appendChild(element);
    await settle(element);
    expect(provider.requests.length).to.equal(2);
    old.resolve(page(['stale'], null));
    expect(await pending).to.equal(false);
    await ready(element, 'a');
    expect(provider.requests.map(request => request.cursor)).to.deep.equal([null, 'pending', null]);
    expect(element.cursorNavigation.canGoBack).to.equal(false);
  } finally { old.resolve(page([], null)); }
});
