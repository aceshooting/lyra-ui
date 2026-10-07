import { zipWithDeclaredSizes, forgedExpansionZip, expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { assertXlsxArchiveWithinLimits } from './xlsx-resource-guard.js';




describe('xlsx resource guard', () => {
  it('accepts an XLSX whose declared expanded size and entry count are within both ceilings', async () => {
    await assertXlsxArchiveWithinLimits(zipWithDeclaredSizes([10, 20]), 2, 30);
  });

  it('rejects cumulative declared expansion before SheetJS can inflate the archive', async () => {
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(zipWithDeclaredSizes([60, 50]), 10, 100));
  });

  it('rejects an excessive entry count and malformed ZIP input, but allows legacy XLS bytes', async () => {
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(zipWithDeclaredSizes([1, 1]), 1, 100));
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer));
    await assertXlsxArchiveWithinLimits(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer);
  });

  it('measures deflate output instead of trusting forged uncompressed-size fields', async () => {
    const source = await forgedExpansionZip('xl/worksheets/sheet1.xml');
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(source, 10, 1_000));
  });

  it('measures every part SheetJS can parse, whatever its name', async () => {
    const zip = (name: string, content: string | Uint8Array): Promise<ArrayBuffer> =>
      new JSZip().file(name, content).generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    const rows = '<worksheet><sheetData><row><c/></row><row><c/></row></sheetData></worksheet>';
    await expectResourceLimit(async () =>
      assertXlsxArchiveWithinLimits(await zip('xl/worksheets/sheet1.dat', rows), 10, 10_000, { maxRows: 1 }));
    await expectResourceLimit(async () =>
      assertXlsxArchiveWithinLimits(await zip('xl/worksheets/sheet1.BIN', new Uint8Array(64)), 10, 10_000, { maxCells: 4 }));
    await assertXlsxArchiveWithinLimits(await zip('xl/vbaProject.bin', new Uint8Array(64)), 10, 10_000, { maxCells: 16 });
    for (const name of ['META-INF/manifest.xml', 'objectdata.xml', 'Index/Document.iwa', 'nested\\Index.zip']) {
      await expectResourceLimit(async () => assertXlsxArchiveWithinLimits(await zip(name, '<x/>')));
    }
  });

  it('rejects excessive worksheet row/cell and XML-node complexity and honors cancellation', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row><c/></row><row><c/><c/></row></sheetData></worksheet>',
    );
    const source = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(source, 10, 10_000, { maxRows: 1 }));
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(source, 10, 10_000, { maxCells: 2 }));
    await expectResourceLimit(() => assertXlsxArchiveWithinLimits(source, 10, 10_000, { maxXmlNodes: 4 }));

    const controller = new AbortController();
    controller.abort();
    let aborted: unknown;
    try {
      await assertXlsxArchiveWithinLimits(source, 10, 10_000, { signal: controller.signal });
    } catch (error) {
      aborted = error;
    }
    expect(aborted).to.be.instanceOf(DOMException);
    expect((aborted as DOMException).name).to.equal('AbortError');
  });
});
