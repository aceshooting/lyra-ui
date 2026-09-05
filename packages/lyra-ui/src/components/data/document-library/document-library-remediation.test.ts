import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './document-library.js';
import type { LibraryDocument, LyraDocumentLibrary } from './document-library.js';
import type { LyraTable } from '../table/table.js';

const documents: LibraryDocument[] = [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }];
function nameButtons(element: LyraDocumentLibrary): HTMLButtonElement[] {
  return [...element.shadowRoot!.querySelector('lr-table')!.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="document-name"]')];
}

it('removes search-term as absence in the composed table without changing null readback', async () => {
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library search-term="Alpha" .documents=${documents}></lr-document-library>`);
  expect(nameButtons(element).map((button) => button.textContent!.trim())).to.deep.equal(['Alpha']);
  element.removeAttribute('search-term');
  await element.updateComplete;
  await waitUntil(() => nameButtons(element).length === 2);
  expect(element.searchTerm as unknown).to.equal(null);
  const opened: string[] = [];
  element.addEventListener('lr-open', (event) => opened.push((event as CustomEvent<{ documentId: string }>).detail.documentId));
  nameButtons(element)[1]!.click();
  expect(opened).to.deep.equal(['beta']);
  element.setAttribute('search-term', 'Beta');
  await element.updateComplete;
  await waitUntil(() => nameButtons(element).length === 1);
  expect(nameButtons(element)[0]!.textContent!.trim()).to.equal('Beta');
  element.setAttribute('search-term', '');
  await element.updateComplete;
  await waitUntil(() => nameButtons(element).length === 2);
  expect(element.searchTerm).to.equal('');
});

it('retains own undefined tags like omission through projection, rows, selection and open events', async () => {
  let accessorReads = 0;
  const accessor = { id: 'accessor', name: 'Accessor', get tags() { accessorReads++; return ['bad']; } };
  const malformed = [null, 'tag', [null], [1], { length: 0 }].map((tags, index) => ({ id: `bad-${index}`, name: 'Bad', tags }));
  const source = [{ id: 'undefined', name: 'Undefined', tags: undefined }, { id: 'omitted', name: 'Omitted' }, { id: 'empty', name: 'Empty', tags: [] }, accessor, ...malformed] as unknown as LibraryDocument[];
  const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${source} .selectedDocumentIds=${['undefined']}></lr-document-library>`);
  expect(accessorReads).to.equal(0);
  expect(element.documents.map((record) => record.id)).to.deep.equal(['undefined', 'omitted', 'empty']);
  expect(Object.hasOwn(element.documents[0]!, 'tags')).to.equal(false);
  expect(source[0]!.tags).to.equal(undefined);
  expect(Object.hasOwn(source[0]!, 'tags')).to.equal(true);
  expect(nameButtons(element).map((button) => button.textContent!.trim())).to.deep.equal(['Empty', 'Omitted', 'Undefined']);
  const table = element.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!;
  expect(table.rows.map((record) => record.id)).to.deep.equal(['empty', 'omitted', 'undefined']);
  expect([...table.selectedRowKeys]).to.deep.equal(['undefined']);
  expect(nameButtons(element)[2]!.closest('tr')?.getAttribute('aria-selected')).to.equal('true');
  const opened: string[] = [];
  element.addEventListener('lr-open', (event) => opened.push((event as CustomEvent<{ documentId: string }>).detail.documentId));
  nameButtons(element)[2]!.click();
  expect(opened).to.deep.equal(['undefined']);
});
