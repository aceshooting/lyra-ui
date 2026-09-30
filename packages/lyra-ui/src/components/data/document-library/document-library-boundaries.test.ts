import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './document-library.js';
import type { LibraryDocument, LyraDocumentLibrary } from './document-library.js';
import type { LyraTable } from '../table/table.js';

const documents: LibraryDocument[] = [
  { id: 'stale', name: 'Stale', owner: 'Owner 10', freshness: 'stale', tags: ['shared'] },
  { id: 'unknown', name: 'Unknown' },
  { id: 'fresh', name: 'Fresh', owner: 'Owner 2', freshness: 'fresh', tags: ['shared'] },
  { id: 'aging', name: 'Aging', owner: 'Owner 1', freshness: 'aging' },
];

function table(element: LyraDocumentLibrary): LyraTable<LibraryDocument> {
  return element.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!;
}

function names(element: LyraDocumentLibrary): string[] {
  return [...table(element).shadowRoot!.querySelectorAll('[part="document-name"]')].map(node => node.textContent!.trim());
}

it('sorts missing owners and freshness after changing sort keys and directions', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${documents} sort-key="owner"></lr-document-library>`);
  await waitUntil(() => names(element).length === 4);
  expect(names(element)).to.deep.equal(['Unknown', 'Aging', 'Fresh', 'Stale']);
  element.sortDir = 'desc';
  await element.updateComplete;
  await table(element).updateComplete;
  expect(names(element)).to.deep.equal(['Stale', 'Fresh', 'Aging', 'Unknown']);
  element.sortKey = 'freshness';
  element.sortDir = 'asc';
  await element.updateComplete;
  await table(element).updateComplete;
  expect(names(element)).to.deep.equal(['Fresh', 'Aging', 'Stale', 'Unknown']);
});

it('deselects only the filtered visible documents with the native select-all control', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${documents} .selectedDocumentIds=${['stale', 'fresh', 'aging']} .tagFilter=${['shared']}></lr-document-library>`);
  await waitUntil(() => names(element).length === 2);
  const control = table(element).shadowRoot!.querySelector<HTMLElement>('thead lr-checkbox')!;
  await waitUntil(() => control.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-checked') === 'true');
  const pending = oneEvent(element, 'lr-selection-change');
  control.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.click();
  expect((await pending).detail.documentIds).to.deep.equal(['aging']);
  expect(element.selectedDocumentIds).to.deep.equal(['aging']);
  await waitUntil(() => control.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-checked') === 'false');
});

it('contains an unsupported composed-table sort proposal without committing or leaking an owned request', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${documents}></lr-document-library>`);
  let requests = 0;
  element.addEventListener('lr-sort-request', () => requests++);
  const proposal = new CustomEvent('lr-sort-request', { detail: { phase: 'request', sortKey: 'unsupported', sortDir: 'desc' }, bubbles: true, composed: true, cancelable: true });
  table(element).dispatchEvent(proposal);
  expect(proposal.defaultPrevented).to.equal(true);
  expect(requests).to.equal(0);
  expect(element.sortKey).to.equal('name');
});

it('updates the failed-load slot when authored content changes its slot assignment after mount', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library error><div>Recovery controls</div></lr-document-library>`);
  const content = element.querySelector('div')!;
  const libraryTable = table(element);
  await waitUntil(() => libraryTable.shadowRoot!.querySelector('[part~="error"]') !== null);
  content.slot = 'error';
  await waitUntil(() => element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="error"]')?.assignedElements().length === 1);
  await libraryTable.updateComplete;
  expect(libraryTable.shadowRoot!.querySelector<HTMLElement>('[part~="error"]')?.getClientRects().length).to.equal(0);
  content.removeAttribute('slot');
  await waitUntil(() => element.shadowRoot!.querySelector('slot[name="error"]') === null);
  await libraryTable.updateComplete;
  expect(libraryTable.shadowRoot!.querySelector<HTMLElement>('[part~="error"]')!.getClientRects().length).to.be.greaterThan(0);
});

it('rejects revoked records and tag arrays and invalid date objects without reserving a later valid document id', async () => {
  const record = Proxy.revocable({ id: 'safe', name: 'Rejected record' }, {});
  const tags = Proxy.revocable(['tag'], {});
  record.revoke();
  tags.revoke();
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${[
    record.proxy,
    { id: 'safe', name: 'Rejected tags', tags: tags.proxy },
    { id: 'safe', name: 'Rejected date', updatedAt: { getTime: () => 1 } },
    { id: 'safe', name: 'Usable record', updatedAt: new Date(0) },
  ]}></lr-document-library>`);
  await waitUntil(() => names(element).length === 1);
  expect(names(element)).to.deep.equal(['Usable record']);
  expect(element.documents.map(document => document.id)).to.deep.equal(['safe']);
  const collection = Proxy.revocable(documents, {});
  collection.revoke();
  element.documents = collection.proxy;
  await element.updateComplete;
  await table(element).updateComplete;
  expect(element.documents.length).to.equal(0);
  expect(names(element)).to.deep.equal([]);
});

it('retains the safe selection prefix when an assigned array iterator fails', async () => {
  const selected = ['fresh', 'stale'];
  selected[Symbol.iterator] = function* () {
    yield 'fresh';
    throw new Error('remaining selection unavailable');
  };
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${documents} .selectedDocumentIds=${selected}></lr-document-library>`);
  expect(element.selectedDocumentIds).to.deep.equal(['fresh']);
  expect(element.shadowRoot!.querySelector('[part="selection-count"]')?.textContent).to.contain('1');
});
