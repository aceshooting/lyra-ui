import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './csv-viewer-register.js';
import { CSV_VIEWER_TAG } from './csv-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

const csv: DocumentFile = { name: 'rows.csv', mimeType: 'text/csv', src: 'https://example.test/rows.csv' };

describe('csv-viewer-register laziness', () => {
  it('never fetches the csv-viewer class module merely by importing the register-only entry', () => {
    expect(fetchedModuleEnding('/csv-viewer.class.ts')).to.equal(false);
    expect(customElements.get(CSV_VIEWER_TAG)).to.equal(undefined);
  });

  it('exposes a stable tag constant matching the real element tag name', () => {
    expect(CSV_VIEWER_TAG).to.equal('lr-csv-viewer');
  });
});

describe('csv registry', () => {
  it('matches by extension and declares capabilities', () => {
    expect(findDocumentRenderer(csv)).to.exist;
    expect(findDocumentRenderer(csv)!.capabilities).to.deep.equal({
      anchors: ['cell-range'],
      search: true,
      textSelect: false,
    });
  });

  it('loads (fetching the class module lazily) and renders the tag, registering it', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(csv)!);
    expect(fetchedModuleEnding('/csv-viewer.class.ts')).to.equal(true);
    expect(customElements.get(CSV_VIEWER_TAG)).to.not.equal(undefined);

    const anchor = { kind: 'cell-range' as const, range: 'A1:B2' };
    const host = document.createElement('div');
    render(definition.render!({ ...csv, anchor }) as never, host);
    const rendered = host.querySelector(CSV_VIEWER_TAG) as unknown as { anchor: unknown };
    expect(rendered).to.exist;
    expect(rendered.anchor).to.deep.equal(anchor);
  });
});
