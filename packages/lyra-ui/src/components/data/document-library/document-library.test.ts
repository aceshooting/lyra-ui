import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './document-library.js';
import type { LyraDocumentLibrary, LibraryDocument } from './document-library.js';

const docs: LibraryDocument[] = [
  {
    id: 'd2',
    name: 'Zeta Runbook.pdf',
    mimeType: 'application/pdf',
    version: 'v2',
    owner: 'Priya',
    tags: ['ops', 'runbook'],
    freshness: 'stale',
    updatedAt: '2024-01-05T00:00:00.000Z',
  },
  {
    id: 'd1',
    name: 'Alpha Overview.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    version: 'v10',
    owner: 'Jordan',
    tags: ['onboarding'],
    freshness: 'fresh',
    updatedAt: '2024-06-01T00:00:00.000Z',
  },
  {
    id: 'd3',
    name: 'Mid Spec.md',
    version: 'v1',
    owner: 'Alex',
    freshness: 'aging',
    updatedAt: '2024-03-15T00:00:00.000Z',
  },
];

function findCheckbox(table: HTMLElement, rowIndex: number): HTMLElement {
  const rows = table.shadowRoot!.querySelectorAll('[data-row-key]');
  return rows[rowIndex]!.querySelector('lr-checkbox')!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
}

it('renders every document as a grid row, sorted by name ascending by default (unsorted input)', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const names = [...table.shadowRoot!.querySelectorAll('[part="document-name"]')].map((btn) =>
    btn.textContent!.trim(),
  );
  // Input order is d2 (Zeta), d1 (Alpha), d3 (Mid) -- deliberately unsorted, so this only
  // passes if the component actually sorts rather than merely preserving input order.
  expect(names).to.deep.equal(['Alpha Overview.docx', 'Mid Spec.md', 'Zeta Runbook.pdf']);
});

it('is accessible with no documents', async () => {
  const el = await fixture(html`<lr-document-library></lr-document-library>`);
  await expect(el).to.be.accessible();
});

it('is accessible with populated, tagged, selected, sorted rows', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs} .selectedIds=${['d1']}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  expect(table.shadowRoot!.querySelectorAll('[data-row-key]')).to.have.length(3);
  expect(el.shadowRoot!.querySelector('[part="selection-bar"]')).to.exist;
  await expect(el).to.be.accessible();
});

it('filters by search text (name/owner/tag substring) and emits lr-filter-change with matchCount', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const input = el.shadowRoot!.querySelector('lr-input')!;
  const listener = oneEvent(el, 'lr-filter-change');
  (input as unknown as { value: string }).value = 'priya';
  input.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'priya' }, bubbles: true, composed: true }));
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ text: 'priya', tags: [], matchCount: 1 });
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  await waitUntil(() => table.shadowRoot!.querySelectorAll('[data-row-key]').length === 1);
});

it('filters by tag facet with AND semantics across multiple selected tags', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs} .tagFilter=${['ops', 'runbook']}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const names = [...table.shadowRoot!.querySelectorAll('[part="document-name"]')].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal(['Zeta Runbook.pdf']);
});

it('does not render the tag filter combobox when no document declares a tag', async () => {
  const untagged: LibraryDocument[] = [{ id: 'x', name: 'Plain.txt' }];
  const el = await fixture(html`<lr-document-library .documents=${untagged}></lr-document-library>`);
  expect(el.shadowRoot!.querySelector('lr-combobox')).to.not.exist;
});

it('toggles sort direction on a repeated header activation and re-sorts rows (unsorted input)', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const nameHeader = table.shadowRoot!.querySelector('[data-col-key="name"]') as HTMLElement;

  const sortListener = oneEvent(el, 'lr-sort');
  nameHeader.click();
  const sortEvent = await sortListener;
  expect((sortEvent as CustomEvent).detail).to.deep.equal({ key: 'name', direction: 'descending' });
  await el.updateComplete;
  let names = [...table.shadowRoot!.querySelectorAll('[part="document-name"]')].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal(['Zeta Runbook.pdf', 'Mid Spec.md', 'Alpha Overview.docx']);

  const secondListener = oneEvent(el, 'lr-sort');
  nameHeader.click();
  const secondEvent = await secondListener;
  expect((secondEvent as CustomEvent).detail).to.deep.equal({ key: 'name', direction: 'ascending' });
  await el.updateComplete;
  names = [...table.shadowRoot!.querySelectorAll('[part="document-name"]')].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal(['Alpha Overview.docx', 'Mid Spec.md', 'Zeta Runbook.pdf']);
});

it('emits one host lr-sort event for one bubbling table lr-sort event', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  let count = 0;
  el.addEventListener('lr-sort', () => count++);

  table.dispatchEvent(
    new CustomEvent('lr-sort', {
      detail: { key: 'name', direction: 'desc' },
      bubbles: true,
      composed: true,
    }),
  );
  await el.updateComplete;

  expect(count).to.equal(1);
});

it('sorts numerically-aware by version (v2 before v10)', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs} sort-key="version"></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const names = [...table.shadowRoot!.querySelectorAll('[part="document-name"]')].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal(['Mid Spec.md', 'Zeta Runbook.pdf', 'Alpha Overview.docx']);
});

it('toggles a row selection via its checkbox and emits lr-selection-change', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const listener = oneEvent(el, 'lr-selection-change');
  findCheckbox(table, 0).click(); // sorted order: row 0 is Alpha (d1)
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ ids: ['d1'] });
  expect(el.selectedIds).to.deep.equal(['d1']);
});

it('select-all header checkbox selects/deselects every currently visible row and reflects indeterminate state', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const headerCheckboxBase = () =>
    (table.shadowRoot!.querySelector('thead lr-checkbox') as HTMLElement).shadowRoot!.querySelector(
      '[part="base"]',
    ) as HTMLElement;

  const listener = oneEvent(el, 'lr-selection-change');
  headerCheckboxBase().click();
  const event = await listener;
  expect((event as CustomEvent).detail.ids).to.have.members(['d1', 'd2', 'd3']);
  // The checkbox `.checked` property is set synchronously as part of this update, but reflecting
  // it into `aria-checked` requires `<lr-checkbox>`'s own nested update cycle to also complete --
  // a second, independent async cycle `el.updateComplete` (the outer element's own) does not wait
  // on. Poll instead of assuming one `await el.updateComplete` drains every nested level.
  await waitUntil(() => headerCheckboxBase().getAttribute('aria-checked') === 'true');

  // Deselect one row -- the header checkbox should now read indeterminate, not checked.
  const secondListener = oneEvent(el, 'lr-selection-change');
  findCheckbox(table, 0).click(); // sorted order: row 0 is Alpha (d1)
  const secondEvent = await secondListener;
  expect((secondEvent as CustomEvent).detail.ids).to.have.members(['d2', 'd3']);
  await waitUntil(() => headerCheckboxBase().getAttribute('aria-checked') === 'mixed');
});

it('"Clear selection" empties selectedIds and emits lr-selection-change with an empty array', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs} .selectedIds=${['d1', 'd2']}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const clearButton = el.shadowRoot!.querySelector('[part="clear-selection"]') as HTMLElement;
  const listener = oneEvent(el, 'lr-selection-change');
  clearButton.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ ids: [] });
  expect(el.selectedIds).to.deep.equal([]);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="selection-bar"]')).to.not.exist;
});

it('prunes a selected id that no longer exists in documents, without firing lr-selection-change', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs} .selectedIds=${['d1', 'ghost-id']}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect(el.selectedIds).to.deep.equal(['d1']);

  let fired = false;
  el.addEventListener('lr-selection-change', () => {
    fired = true;
  });
  el.documents = docs.filter((d) => d.id !== 'd1');
  await el.updateComplete;
  expect(el.selectedIds).to.deep.equal([]);
  expect(fired).to.be.false;
});

it('normalizes stale and duplicate selectedIds assigned after mount', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  el.selectedIds = ['ghost-id', 'd1', 'd1'];
  await el.updateComplete;
  expect(el.selectedIds).to.deep.equal(['d1']);
  expect(el.shadowRoot!.querySelector('[part="selection-count"]')!.textContent!.trim()).to.equal('1 selected');
});

it('formats the selected count with the effective locale', async () => {
  const many = Array.from({ length: 1000 }, (_, index) => ({
    id: `d${index}`,
    name: `Document ${index}`,
  }));
  const el = (await fixture(
    html`<lr-document-library
      locale="de-DE"
      .documents=${many}
      .selectedIds=${many.map((document) => document.id)}
    ></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="selection-count"]')!.textContent!.trim()).to.equal('1.000 selected');
});

it('opens a document via its name button, firing lr-open with the document id', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const nameButton = table.shadowRoot!.querySelectorAll('[part="document-name"]')[0] as HTMLElement; // Alpha (d1)
  const listener = oneEvent(el, 'lr-open');
  nameButton.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ id: 'd1' });
});

it('opens a document by activating its row elsewhere (non-interactive area), via lr-table lr-row-click', async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const row = table.shadowRoot!.querySelectorAll('[data-row-key]')[0] as HTMLElement; // Alpha (d1)
  const listener = oneEvent(el, 'lr-open');
  row.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ id: 'd1' });
});

it('renders the built-in English fallback with no locale/strings registered', async () => {
  const el = await fixture(html`<lr-document-library></lr-document-library>`);
  const input = el.shadowRoot!.querySelector('lr-input')!;
  expect(input.getAttribute('placeholder')).to.equal('Search documents');
});

it('reaches the DOM with a .strings override for the region label and search placeholder', async () => {
  const el = (await fixture(
    html`<lr-document-library
      .strings=${{ documentLibraryLabel: 'Bibliothèque de documents', documentLibrarySearchPlaceholder: 'Rechercher' }}
    ></lr-document-library>`,
  )) as LyraDocumentLibrary;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Bibliothèque de documents',
  );
  expect(el.shadowRoot!.querySelector('lr-input')!.getAttribute('placeholder')).to.equal('Rechercher');
});

it('lets a host aria-label override label on the region and table, including late changes', async () => {
  const el = (await fixture(
    html`<lr-document-library
      label="Library"
      aria-label="Deployment documents"
      .documents=${docs}
    ></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const table = el.shadowRoot!.querySelector('lr-table')!;
  expect(base.getAttribute('aria-label')).to.equal('Deployment documents');
  expect(table.getAttribute('aria-label')).to.equal('Deployment documents');

  el.setAttribute('aria-label', 'Runtime documents');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Runtime documents');
  expect(table.getAttribute('aria-label')).to.equal('Runtime documents');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Library');
  expect(table.getAttribute('aria-label')).to.equal('Library');
});

it('renders under dir="rtl" and keeps document-open interaction working', async () => {
  const el = (await fixture(
    html`<lr-document-library dir="rtl" .documents=${docs}></lr-document-library>`,
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  const nameButton = table.shadowRoot!.querySelectorAll('[part="document-name"]')[0] as HTMLElement;
  const listener = oneEvent(el, 'lr-open');
  nameButton.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ id: 'd1' });
});

it('scrolls a 320px allocation horizontally rather than overflowing, hiding low-priority columns', async () => {
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-document-library style="display:block" .documents=${docs}></lr-document-library>`,
    { parentNode: container },
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);

  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement;
  await waitUntil(() => {
    const tagsHeader = table.shadowRoot!.querySelector('[part="header-cell"][data-col-key="tags"]');
    return tagsHeader !== null && getComputedStyle(tagsHeader).display === 'none';
  });
  const nameHeader = table.shadowRoot!.querySelector('[part="header-cell"][data-col-key="name"]') as HTMLElement;
  expect(getComputedStyle(nameHeader).display).to.not.equal('none');
});
