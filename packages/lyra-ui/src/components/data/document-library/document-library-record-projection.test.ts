import { expect, fixture, html } from '@open-wc/testing';
import './document-library.js';
import type { LibraryDocument, LyraDocumentLibrary } from './document-library.js';

describe('lr-document-library record projection', () => {
  it('keeps a record only when every present field has its documented type', async () => {
    const source = [
      {
        id: 'kept', name: 'Kept', uri: 'https://example.com/kept', mimeType: 'application/pdf', version: 'v1',
        owner: 'Ana', freshness: 'fresh', tags: ['a'], updatedAt: Date.UTC(2026, 0, 2),
      },
      { id: 'bad-uri', name: 'Bad uri', uri: 4 },
      { id: 'bad-mime', name: 'Bad mime', mimeType: 5 },
      { id: 'bad-version', name: 'Bad version', version: 6 },
      { id: 'bad-owner', name: 'Bad owner', owner: {} },
      { id: 'bad-freshness', name: 'Bad freshness', freshness: 'fossil' },
      { id: 'invalid-date', name: 'Date without an instant', updatedAt: new Date(Number.NaN) },
      { id: 'object-date', name: 'Object date', updatedAt: { year: 2026 } },
      { id: 'date', name: 'Date', updatedAt: new Date(Date.UTC(2026, 0, 3)) },
      { id: 'string-date', name: 'String date', updatedAt: '2026-01-04T00:00:00.000Z' },
      { id: 'undefined-date', name: 'Undefined date', updatedAt: undefined },
      { id: 'no-name' },
      { id: '   ', name: 'Blank id' },
      null,
      7,
      ['kept'],
    ] as unknown as LibraryDocument[];
    const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${source}></lr-document-library>`);
    expect(element.documents.map((record) => record.id)).to.deep.equal(['kept', 'invalid-date', 'date', 'string-date', 'undefined-date']);
    const [kept, invalid, dated, textual, undated] = element.documents;
    expect(kept).to.include({ uri: 'https://example.com/kept', mimeType: 'application/pdf', version: 'v1', owner: 'Ana', freshness: 'fresh' });
    expect(kept!.tags).to.deep.equal(['a']);
    expect(kept!.updatedAt instanceof Date && kept!.updatedAt.getTime()).to.equal(Date.UTC(2026, 0, 2));
    // A Date object keeps its slot even when it holds no instant; only a non-Date object is dropped.
    expect(invalid!.updatedAt instanceof Date && Number.isNaN(invalid!.updatedAt.getTime())).to.equal(true);
    expect(dated!.updatedAt instanceof Date && dated!.updatedAt.getTime()).to.equal(Date.UTC(2026, 0, 3));
    expect(textual!.updatedAt).to.equal('2026-01-04T00:00:00.000Z');
    expect(Object.hasOwn(undated!, 'updatedAt')).to.equal(false);
    expect(Object.hasOwn(undated!, 'uri')).to.equal(false);
  });
});
