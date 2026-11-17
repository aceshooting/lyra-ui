import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { DocumentLibraryCursorSource, DocumentLibrarySource, LibraryDocument, LyraDocumentLibrary } from './document-library.class.js';
import type { LyraCursorResult } from '../../../data-sources.js';
import type { LyraTable } from '../table/table.class.js';
import './document-library.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
function result(id = 'current', nextCursor: string | null = null): LyraCursorResult<LibraryDocument> {
  return { rows: [{ key: id, value: { id, name: id } }], nextCursor };
}
function source(query: DocumentLibraryCursorSource['query'], scope = 'documents'): DocumentLibraryCursorSource {
  return { revision: 'r1', scope, query };
}
function table(element: LyraDocumentLibrary): LyraTable<LibraryDocument> {
  return element.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!;
}
async function ready(element: LyraDocumentLibrary, id = 'current'): Promise<void> {
  await waitUntil(() => element.cursorNavigation.status === 'ready' && table(element)?.rows[0]?.id === id);
  await element.updateComplete;
  await table(element).updateComplete;
}
async function settle(element: LyraDocumentLibrary): Promise<void> {
  await element.updateComplete;
  for (let count = 0; count < 12; count++) await Promise.resolve();
  await table(element)?.updateComplete;
  await element.updateComplete;
}

it('settles an ordinary array refresh in one update while preserving rendered state', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .documents=${[{ id: 'array-doc', name: 'Array document', tags: ['topic'] }]}
    .selectedDocumentIds=${['array-doc']} .tagFilter=${['topic']}
  ></lr-document-library>`);
  await settle(element);
  const grid = table(element);
  expect(element.cursorSource).to.equal(undefined);
  expect(grid.rows.map(row => row.id)).to.deep.equal(['array-doc']);
  expect(grid.rowElement('array-doc')?.textContent ?? '').to.include('Array document');

  element.requestUpdate();
  expect(element.isUpdatePending).to.equal(true);
  await element.updateComplete;
  expect(element.isUpdatePending).to.equal(false);

  expect(table(element) === grid).to.equal(true);
  expect(grid.rows.map(row => row.id)).to.deep.equal(['array-doc']);
  expect(grid.rowElement('array-doc')?.textContent ?? '').to.include('Array document');
  expect(element.selectedDocumentIds).to.deep.equal(['array-doc']);
  expect(element.tagFilter).to.deep.equal(['topic']);
  expect(element.sourceTotal).to.equal(null);
  expect(element.cursorNavigation.status).to.equal('idle');
  expect(element.shadowRoot!.querySelectorAll('[part="cursor-navigation"]').length).to.equal(0);
});

for (const first of ['exact', 'cursor'] as const) {
  it(`serializes different provider objects across the ${first} route transition`, async () => {
    const release = deferred<void>();
    const calls: string[] = [];
    const signals: AbortSignal[] = [];
    let active = 0;
    let maximum = 0;
    const wait = async (mode: string, signal: AbortSignal): Promise<void> => {
      calls.push(mode); signals.push(signal); active++; maximum = Math.max(maximum, active);
      try { if (mode === first) await release.promise; } finally { active--; }
    };
    const cursor = source(async request => { await wait('cursor', request.signal); return result(); });
    const exact: DocumentLibrarySource = {
      revision: 'r1',
      query: async request => { await wait('exact', request.signal); return {
        total: 1, rows: [{ key: 'current', order: 0, value: { id: 'current', name: 'current' } }],
        tags: { total: 0, values: [], unavailableSelected: [] },
      }; }, lookup: async () => [], locate: async () => null,
    };
    const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
      .cursorSource=${first === 'cursor' ? cursor : undefined}
      .dataSource=${first === 'exact' ? exact : undefined}
    ></lr-document-library>`);
    try {
      await waitUntil(() => calls.length === 1);
      if (first === 'cursor') { element.cursorSource = undefined; element.dataSource = exact; }
      else { element.dataSource = undefined; element.cursorSource = cursor; }
      expect(signals[0]!.aborted).to.equal(true);
      await settle(element);
      expect(calls).to.deep.equal([first]);
      release.resolve(undefined);
      await waitUntil(() => calls.length === 2 && table(element).rows[0]?.id === 'current');
      expect(maximum).to.equal(1);
      expect(calls).to.deep.equal([first, first === 'cursor' ? 'exact' : 'cursor']);
    } finally { release.resolve(undefined); }
  });
}

it('does not resume an obsolete retry when its proposal listener changes the query', async () => {
  const calls: (string | null)[] = [];
  const provider = source(async request => {
    calls.push(request.cursor);
    if (request.query.searchTerm) return result('new-query');
    if (request.cursor) throw new Error('Unavailable continuation');
    return result('first', 'continuation');
  });
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .cursorSource=${provider}></lr-document-library>`);
  await ready(element, 'first');
  expect(await element.nextCursorPage()).to.equal(false);
  await settle(element);
  element.addEventListener('lr-retry-request', () => { element.searchTerm = 'new'; }, { once: true });
  table(element).shadowRoot!.querySelector<HTMLElement>('[part="retry-button"]')!.click();
  await ready(element, 'new-query');
  expect(calls).to.deep.equal([null, 'continuation', null]);
});

it('retains the newer binding installed by a query method getter', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library></lr-document-library>`);
  const replacement = source(async () => result('replacement'));
  let obsoleteCalls = 0;
  const obsolete = { revision: 'r1', scope: 'documents', get query() {
    element.cursorSource = replacement;
    return async () => { obsoleteCalls++; return result('obsolete'); };
  } };
  element.cursorSource = obsolete;
  await ready(element, 'replacement');
  expect(element.cursorSource === replacement).to.equal(true);
  expect(obsoleteCalls).to.equal(0);
});

it('stops projecting a retired document immediately after an effectful descriptor trap', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library></lr-document-library>`);
  const replacement = source(async () => result('replacement'));
  const reads: PropertyKey[] = [];
  const value = new Proxy({ id: 'old', name: 'old', owner: 'old' }, {
    getOwnPropertyDescriptor(target, key) {
      reads.push(key);
      if (key === 'name') element.cursorSource = replacement;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  element.cursorSource = source(async () => ({ rows: [{ key: 'old', value }], nextCursor: null }));
  await ready(element, 'replacement');
  expect(reads).to.deep.equal(['id', 'name']);
});

it('preserves a newer selected-ID assignment made while a changed scope is read', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .cursorSource=${source(async () => result())} .selectedDocumentIds=${['old']}
  ></lr-document-library>`);
  await ready(element);
  element.cursorSource = { revision: 'r1', get scope() {
    element.selectedDocumentIds = ['restored']; return 'other-documents';
  }, query: async () => result() };
  await ready(element);
  expect(element.selectedDocumentIds).to.deep.equal(['restored']);
});

it('remembers the old identity namespace across temporary cursor removal', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .cursorSource=${source(async () => result('same'))} .selectedDocumentIds=${['same']}
  ></lr-document-library>`);
  await ready(element, 'same');
  element.cursorSource = undefined;
  element.cursorSource = source(async () => result('same'), 'other-documents');
  expect(element.selectedDocumentIds).to.deep.equal([]);
  await ready(element, 'same');
});

it('rejects a retired cursor row action after returning to the array route', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .cursorSource=${source(async () => result('same'))} .documents=${[{ id: 'same', name: 'array' }]}
  ></lr-document-library>`);
  await ready(element, 'same');
  const oldTable = table(element);
  const oldRow = oldTable.rowElement('same')!;
  const old = oldRow.querySelector<HTMLButtonElement>('[part="document-name"]')!;
  const oldHeader = oldTable.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="version"]')!;
  element.strings = { documentLibraryNameColumn: 'Document title' };
  await settle(element);
  expect(table(element) === oldTable).to.equal(true);
  expect(old.isConnected).to.equal(true);
  const oldRowSelection = table(element).rowElement('same')!.querySelector<HTMLElement>('lr-checkbox')!;
  const oldPageSelection = table(element).shadowRoot!.querySelector<HTMLElement>('th lr-checkbox')!;
  const opened: string[] = [];
  let sorts = 0;
  element.addEventListener('lr-sort', () => sorts++);
  element.addEventListener('lr-open', event => opened.push(event.detail.documentId));
  element.cursorSource = undefined;
  await settle(element);
  expect(oldTable.isConnected).to.equal(false);
  expect(oldRow.isConnected).to.equal(false);
  expect(old.isConnected).to.equal(false);
  expect(oldRowSelection.isConnected).to.equal(false);
  expect(oldPageSelection.isConnected).to.equal(false);
  old.click();
  oldRow.click();
  oldHeader.click();
  oldTable.dispatchEvent(new CustomEvent('lr-sort', {
    detail: { phase: 'commit', sortKey: 'version', sortDir: 'desc' }, bubbles: true, composed: true,
  }));
  expect(sorts).to.equal(0);
  expect(element.sortKey).to.equal('name');
  for (const control of [oldRowSelection, oldPageSelection]) {
    control.dispatchEvent(new CustomEvent('lr-change', {
      detail: { checked: true }, bubbles: true, composed: true,
    }));
  }
  expect(opened).to.deep.equal([]);
  expect(element.selectedDocumentIds).to.deep.equal([]);
  expect(table(element).rows[0]?.name).to.equal('array');
  table(element).rowElement('same')!.querySelector<HTMLButtonElement>('[part="document-name"]')!.click();
  expect(opened).to.deep.equal(['same']);
  table(element).rowElement('same')!.querySelector<HTMLElement>('lr-checkbox')!.dispatchEvent(new CustomEvent('lr-change', {
    detail: { checked: true }, bubbles: true, composed: true,
  }));
  expect(element.selectedDocumentIds).to.deep.equal(['same']);
});

for (const input of ['search', 'tags', 'selected'] as const) {
  it(`rejects oversized cursor ${input} atomically and recovers after a corrected assignment`, async () => {
    const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .cursorSource=${source(async () => result())}></lr-document-library>`);
    await ready(element);
    if (input === 'search') element.searchTerm = 'x'.repeat(65_537);
    if (input === 'tags') element.tagFilter = Array.from({ length: 501 }, (_, index) => `tag-${index}`);
    if (input === 'selected') element.selectedDocumentIds = ['x'.repeat(65_537)];
    await waitUntil(() => element.cursorNavigation.status === 'error');
    await settle(element);
    expect(table(element).rows.length).to.equal(0);
    expect(table(element).error).to.equal(true);
    if (input === 'search') element.searchTerm = '';
    if (input === 'tags') element.tagFilter = [];
    if (input === 'selected') element.selectedDocumentIds = ['valid-intent'];
    await ready(element);
    if (input === 'selected') expect(element.selectedDocumentIds).to.deep.equal(['valid-intent']);
  });
}

it('uses instance navigation strings without exposing continuation tokens', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .cursorSource=${source(async () => result('current', 'invisible-token'))}
    .strings=${{ documentLibraryCursorNavigation: 'Batches', previous: 'Backwards',
      next: 'Forwards', documentLibraryCursorRestart: 'Beginning' }}
  ></lr-document-library>`);
  await ready(element);
  expect(element.shadowRoot!.querySelector('[part="cursor-navigation"]')?.getAttribute('aria-label')).to.equal('Batches');
  expect(element.shadowRoot!.querySelector('[part="cursor-next"]')?.textContent).to.equal('Forwards');
  expect(element.shadowRoot!.querySelector('[part="cursor-previous"]')?.textContent).to.equal('Backwards');
  expect(element.shadowRoot!.querySelector('[part="cursor-restart"]')?.textContent).to.equal('Beginning');
  expect(element.shadowRoot!.textContent).not.to.contain('invisible-token');
});

it('keeps navigation inert under external loading and error ownership', async () => {
  let calls = 0;
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .cursorSource=${source(async () => { calls++; return result('current', 'next'); })}
  ></lr-document-library>`);
  await ready(element);
  element.loading = true;
  expect(await element.nextCursorPage()).to.equal(false);
  expect(await element.restartCursorSource()).to.equal(false);
  await settle(element);
  expect(calls).to.equal(1);
  element.loading = false;
  await ready(element);
  element.error = true;
  await settle(element);
  expect(await element.restartCursorSource()).to.equal(false);
  expect(element.cursorNavigation.canGoForward).to.equal(false);
  const before = calls;
  table(element).shadowRoot!.querySelector<HTMLElement>('[part="retry-button"]')!.click();
  await ready(element);
  expect(element.error).to.equal(false);
  expect(calls).to.equal(before + 1);
});

for (const action of ['replace', 'next', 'restart'] as const) {
  it(`preserves a focus-listener source replacement during cursor ${action}`, async () => {
    let obsoleteCalls = 0;
    const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library
      .cursorSource=${source(async request => result(request.cursor ? 'obsolete-next' : 'first', 'next'))}
    ></lr-document-library>`);
    await ready(element, 'first');
    const name = table(element).rowElement('first')!.querySelector<HTMLButtonElement>('[part="document-name"]')!;
    await focusByKeyboard(name);
    const replacement = source(async () => result('replacement'));
    element.shadowRoot!.querySelector<HTMLElement>('[part="cursor-navigation"]')!.addEventListener('focus', () => {
      element.cursorSource = replacement;
    }, { once: true });
    if (action === 'replace') element.cursorSource = source(async () => { obsoleteCalls++; return result('obsolete'); });
    else expect(await (action === 'next' ? element.nextCursorPage() : element.restartCursorSource())).to.equal(false);
    await ready(element, 'replacement');
    expect(element.cursorSource === replacement).to.equal(true);
    expect(obsoleteCalls).to.equal(0);
  });
}

for (const action of ['retry', 'sort'] as const) {
  it(`recovers focused cursor ${action} chrome to navigation before loading removes it`, async () => {
    const pending = deferred<LyraCursorResult<LibraryDocument>>();
    let calls = 0;
    const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .cursorSource=${source(async () => {
      calls++;
      if (calls === 1) {
        if (action === 'retry') throw new Error('Unavailable batch');
        return result();
      }
      return pending.promise;
    })}></lr-document-library>`);
    try {
      if (action === 'retry') {
        await waitUntil(() => element.cursorNavigation.status === 'error');
        await settle(element);
      } else await ready(element);
      const target = table(element).shadowRoot!.querySelector<HTMLElement>(
        action === 'retry' ? '[part~="retry-button"]' : 'th[data-col-key="name"]',
      )!;
      await focusByKeyboard(target);
      target.click();
      await waitUntil(() => calls === 2);
      await settle(element);
      const navigation = element.shadowRoot!.querySelector<HTMLElement>('[part="cursor-navigation"]')!;
      expect(target.isConnected).to.equal(false);
      expect(element.shadowRoot!.activeElement === navigation).to.equal(true);
      pending.resolve(result());
      await ready(element);
      expect(element.shadowRoot!.activeElement === navigation).to.equal(true);
    } finally { pending.resolve(result()); }
  });
}

for (const retire of ['replace', 'disconnect'] as const) {
  it(`does not commit a cursor sort after its proposal listener ${retire}s ownership`, async () => {
    const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .cursorSource=${source(async () => result())}></lr-document-library>`);
    await ready(element);
    let commits = 0;
    element.addEventListener('lr-sort', () => commits++);
    element.addEventListener('lr-sort-request', () => {
      if (retire === 'replace') element.cursorSource = source(async () => result('replacement'));
      else element.remove();
    }, { once: true });
    table(element).shadowRoot!.querySelector<HTMLElement>('th[data-col-key="version"]')!.click();
    if (retire === 'replace') await ready(element, 'replacement');
    expect(element.sortKey).to.equal('name');
    expect(commits).to.equal(0);
  });
}

it('commits one complete cursor sort query and preserves a later veto', async () => {
  const queries: string[] = [];
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .cursorSource=${source(async request => {
    queries.push(`${request.query.sortKey}:${request.query.sortDir}`); return result();
  })}></lr-document-library>`);
  await ready(element);
  const commits: string[] = [];
  element.addEventListener('lr-sort', event => commits.push(`${event.detail.sortKey}:${event.detail.sortDir}`));
  table(element).shadowRoot!.querySelector<HTMLElement>('th[data-col-key="version"]')!.click();
  await ready(element);
  expect(queries).to.deep.equal(['name:asc', 'version:asc']);
  expect(commits).to.deep.equal(['version:asc']);
  element.addEventListener('lr-sort-request', event => event.preventDefault(), { once: true });
  table(element).shadowRoot!.querySelector<HTMLElement>('th[data-col-key="owner"]')!.click();
  await settle(element);
  expect(queries).to.deep.equal(['name:asc', 'version:asc']);
  expect(element.sortKey).to.equal('version');
});

it('does not overwrite a newer source and sort during a composed sort commit that aborts a query', async () => {
  const old = deferred<LyraCursorResult<LibraryDocument>>();
  let element: LyraDocumentLibrary | undefined;
  let pendingSignal: AbortSignal | undefined;
  const replacementQueries: string[] = [];
  const replacement = source(async request => { replacementQueries.push(request.query.sortDir); return result('replacement'); });
  const provider = source(async request => {
    if (request.cursor === null) return result('first', 'pending');
    pendingSignal = request.signal;
    request.signal.addEventListener('abort', () => {
      if (element) { element.cursorSource = replacement; element.sortDir = 'asc'; }
    }, { once: true });
    return old.promise;
  });
  element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .cursorSource=${provider}></lr-document-library>`);
  try {
    await ready(element, 'first');
    const pending = element.nextCursorPage();
    await waitUntil(() => pendingSignal !== undefined);
    await settle(element);
    let commits = 0;
    element.addEventListener('lr-sort', () => commits++);
    const grid = table(element);
    expect(grid.loading).to.equal(true);
    expect(grid.shadowRoot!.querySelector('th[data-col-key="name"]') === null).to.equal(true);
    // Loading intentionally replaces the grid; exercise its public composition transaction
    // directly while the physical query is pending instead of clicking absent chrome.
    const proposal = new CustomEvent('lr-sort-request', {
      detail: { phase: 'request', sortKey: 'name', sortDir: 'desc' },
      bubbles: true, composed: true, cancelable: true,
    });
    expect(grid.dispatchEvent(proposal)).to.equal(true);
    grid.dispatchEvent(new CustomEvent('lr-sort', {
      detail: { phase: 'commit', sortKey: 'name', sortDir: 'desc' }, bubbles: true, composed: true,
    }));
    expect(pendingSignal!.aborted).to.equal(true);
    old.resolve(result('obsolete'));
    expect(await pending).to.equal(false);
    await ready(element, 'replacement');
    expect(element.sortDir).to.equal('asc');
    expect(replacementQueries).to.deep.equal(['asc']);
    expect(commits).to.equal(0);
  } finally { old.resolve(result('obsolete')); }
});

it('does not overwrite a newer selected snapshot assigned by input reflection', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library></lr-document-library>`);
  let armed = false;
  const reads: PropertyKey[] = [];
  const input = new Proxy(['old-one', 'old-two'], { getOwnPropertyDescriptor(target, key) {
    if (armed) {
      reads.push(key);
      if (key === '0') element.selectedDocumentIds = ['newer-selection'];
    }
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  element.selectedDocumentIds = input;
  armed = true;
  element.cursorSource = source(async () => result());
  await ready(element);
  expect(element.selectedDocumentIds).to.deep.equal(['newer-selection']);
  expect(reads).to.deep.equal(['length', '0']);
});
