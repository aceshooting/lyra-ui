import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraPdfViewer } from './pdf-viewer.class.js';
import './pdf-viewer.js';

/** Two blank pages with real outline destinations and an exact cross-reference table. */
function outlinedPdf(named: boolean, first = '0', second = '1'): string {
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R /Outlines 3 0 R${named ? ` /Dests << /first [${first} /Fit] /second [${second} /Fit] >>` : ''} >>`,
    '<< /Type /Pages /Kids [4 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Outlines /First 6 0 R /Last 7 0 R /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << >> /Contents 8 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << >> /Contents 8 0 R >>',
    `<< /Title (First page) /Parent 3 0 R /Next 7 0 R /Dest ${named ? '/first' : `[${first} /Fit]`} >>`,
    `<< /Title (Last page) /Parent 3 0 R /Prev 6 0 R /Dest ${named ? '/second' : `[${second} /Fit]`} >>`,
    '<< /Length 0 >>\nstream\nendstream',
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(source.length);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const crossReference = source.length;
  source += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  return source + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${crossReference}\n%%EOF\n`;
}

async function withPdf(sourcePdf: string, check: (viewer: LyraPdfViewer) => Promise<void>): Promise<void> {
  const viewer = await fixture<LyraPdfViewer>(html`<lr-pdf-viewer></lr-pdf-viewer>`);
  const source = URL.createObjectURL(new Blob([sourcePdf], { type: 'application/pdf' }));
  try {
    viewer.workerSrc = new URL('../../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const loaded = oneEvent(viewer, 'lr-load');
    viewer.src = source;
    await loaded;
    expect(viewer.pageViewerSnapshot.pageCount).to.equal(2);
    await check(viewer);
  } finally { viewer.remove(); URL.revokeObjectURL(source); }
}

async function expectUnavailableDocument(viewer: LyraPdfViewer): Promise<void> {
  expect(await viewer.getOutline()).to.deep.equal([]);
  expect(await viewer.renderPageThumbnail(1, document.createElement('canvas'))).to.equal(false);
  const result: unknown = await viewer.getPageText(1).catch((error: unknown) => error);
  expect(result instanceof Error).to.equal(true);
  expect((result as Error).message).to.equal('No PDF document is loaded.');
}

it('returns no outline or thumbnail and rejects text access before a document loads', async () => {
  const viewer = await fixture<LyraPdfViewer>(html`<lr-pdf-viewer></lr-pdf-viewer>`);
  await expectUnavailableDocument(viewer);
});

it('clears document query results with the source and supports loading the same PDF again', async () => {
  await withPdf(outlinedPdf(false), async viewer => {
    const source = viewer.src;
    expect((await viewer.getOutline()).map(item => item.page)).to.deep.equal([1, 2]);
    viewer.src = '';
    await waitUntil(() => viewer.pageViewerSnapshot.status === 'idle');
    await expectUnavailableDocument(viewer);
    const loaded = oneEvent(viewer, 'lr-load');
    viewer.src = source;
    await loaded;
    expect((await viewer.getOutline()).map(item => item.page)).to.deep.equal([1, 2]);
    expect(await viewer.getPageText(1)).to.equal('');
  });
});

for (const named of [false, true]) {
  it(`resolves ${named ? 'named' : 'explicit'} integer PDF outline destinations to the first and last pages`, async () => {
    await withPdf(outlinedPdf(named), async viewer => {
      expect(await viewer.getOutline()).to.deep.equal([
        { title: 'First page', page: 1 },
        { title: 'Last page', page: 2 },
      ]);
    });
  });

  it(`resolves ${named ? 'named' : 'explicit'} indirect PDF outline destinations to the first and last pages`, async () => {
    await withPdf(outlinedPdf(named, '4 0 R', '5 0 R'), async viewer => {
      expect(await viewer.getOutline()).to.deep.equal([
        { title: 'First page', page: 1 },
        { title: 'Last page', page: 2 },
      ]);
    });
  });

  for (const index of ['-1', '2', '999999', '0.5']) {
    it(`keeps the title of ${named ? 'named' : 'explicit'} out-of-range or fractional PDF outline page ${index}`, async () => {
      await withPdf(outlinedPdf(named, index, '5 0 R'), async viewer => {
        expect(await viewer.getOutline()).to.deep.equal([
          { title: 'First page' },
          { title: 'Last page', page: 2 },
        ]);
      });
    });
  }

  it(`keeps an unresolved ${named ? 'named' : 'explicit'} PDF reference while resolving the next bookmark`, async () => {
    await withPdf(outlinedPdf(named, '8 0 R', '5 0 R'), async viewer => {
      expect(await viewer.getOutline()).to.deep.equal([
        { title: 'First page' },
        { title: 'Last page', page: 2 },
      ]);
    });
  });
}
