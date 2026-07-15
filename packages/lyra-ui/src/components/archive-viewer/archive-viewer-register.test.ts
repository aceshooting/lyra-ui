import { expect } from '@open-wc/testing';
import './archive-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

const zip: DocumentFile = { name: 'archive.zip', mimeType: 'application/zip', src: 'https://example.test/archive.zip' };
describe('archive registry', () => {
  it('registers standard, legacy, and extension dispatch', async () => {
    expect(findDocumentRenderer(zip)).to.exist;
    expect(findDocumentRenderer({ ...zip, mimeType: 'application/x-zip-compressed' })).to.exist;
    expect(findDocumentRenderer({ ...zip, mimeType: 'application/octet-stream' })).to.exist;
    expect(findDocumentRenderer({ ...zip, name: 'archive.tar', mimeType: 'application/x-tar' })).to.not.exist;
    const definition = await loadDocumentRenderer(findDocumentRenderer(zip)!);
    expect(definition.render).to.exist;
    const rendered = definition.render!(zip) as { strings?: string };
    expect(rendered).to.exist;
  });
});
