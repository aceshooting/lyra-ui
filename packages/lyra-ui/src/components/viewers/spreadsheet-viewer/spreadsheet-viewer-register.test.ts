import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './spreadsheet-viewer-register.js';
import { SPREADSHEET_VIEWER_TAG } from './spreadsheet-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

const xlsx: DocumentFile = {
  name: 'budget.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  src: 'https://example.test/budget.xlsx',
};
const xls: DocumentFile = { ...xlsx, name: 'legacy.xls', mimeType: 'application/vnd.ms-excel' };

describe('spreadsheet-viewer-register laziness', () => {
  it('never fetches the spreadsheet-viewer class module merely by importing the register-only entry', () => {
    expect(fetchedModuleEnding('/spreadsheet-viewer.class.ts')).to.equal(false);
    expect(customElements.get(SPREADSHEET_VIEWER_TAG)).to.equal(undefined);
  });

  it('exposes a stable tag constant matching the real element tag name', () => {
    expect(SPREADSHEET_VIEWER_TAG).to.equal('lr-spreadsheet-viewer');
  });
});

describe('spreadsheet registry', () => {
  it('matches both the modern and legacy Excel MIME types by extension and declares capabilities', () => {
    for (const file of [xlsx, xls]) {
      expect(findDocumentRenderer(file), file.name).to.exist;
      expect(findDocumentRenderer(file)!.capabilities).to.deep.equal({
        anchors: ['cell-range'],
        search: true,
        textSelect: false,
      });
    }
  });

  it('loads (fetching the class module lazily) and renders the tag, registering it', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(xlsx)!);
    expect(fetchedModuleEnding('/spreadsheet-viewer.class.ts')).to.equal(true);
    expect(customElements.get(SPREADSHEET_VIEWER_TAG)).to.not.equal(undefined);

    const anchor = { kind: 'cell-range' as const, sheet: 'Sheet1', range: 'A1:B2' };
    const host = document.createElement('div');
    render(definition.render!({ ...xlsx, anchor }) as never, host);
    const rendered = host.querySelector(SPREADSHEET_VIEWER_TAG) as unknown as { anchor: unknown };
    expect(rendered).to.exist;
    expect(rendered.anchor).to.deep.equal(anchor);
  });
});
