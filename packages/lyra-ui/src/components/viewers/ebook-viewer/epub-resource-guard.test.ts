import { zipWithDeclaredSizes, forgedExpansionZip, expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { assertEpubArchiveWithinLimits } from './epub-resource-guard.js';




describe('EPUB resource guard', () => {
  it('accepts an archive within both ceilings', async () => {
    await assertEpubArchiveWithinLimits(zipWithDeclaredSizes([10, 20]), 2, 30);
  });

  it('rejects excessive declared expansion, entry count, and malformed ZIP input', async () => {
    await expectResourceLimit(() => assertEpubArchiveWithinLimits(zipWithDeclaredSizes([60, 50]), 10, 100));
    await expectResourceLimit(() => assertEpubArchiveWithinLimits(zipWithDeclaredSizes([1, 1]), 1, 100));
    await expectResourceLimit(() => assertEpubArchiveWithinLimits(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer));
  });

  it('measures deflate output instead of trusting forged uncompressed-size fields', async () => {
    const source = await forgedExpansionZip('OEBPS/chapter.xhtml');
    await expectResourceLimit(() => assertEpubArchiveWithinLimits(source, 10, 1_000));
  });

  it('rejects excessive expanded document-node complexity and honors cancellation', async () => {
    const zip = new JSZip();
    zip.file('OEBPS/chapter.xhtml', '<html><body><p>one</p><p>two</p></body></html>');
    const source = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    await expectResourceLimit(() => assertEpubArchiveWithinLimits(source, 10, 10_000, { maxXmlNodes: 3 }));

    const controller = new AbortController();
    controller.abort();
    let aborted: unknown;
    try {
      await assertEpubArchiveWithinLimits(source, 10, 10_000, { signal: controller.signal });
    } catch (error) {
      aborted = error;
    }
    expect(aborted).to.be.instanceOf(DOMException);
    expect((aborted as DOMException).name).to.equal('AbortError');
  });

  it('node-counts the package and content documents the container and manifest name, whatever their extensions', async () => {
    const build = async (chapterParagraphs: number) => {
      const zip = new JSZip();
      zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/book.dat"/></rootfiles></container>');
      zip.file('OEBPS/book.dat', '<package><manifest>'
        + '<item id="c1" href="text/ch%31.dat" media-type="application/xhtml+xml"/>'
        + '<item id="i1" href="images/cover.png" media-type="image/png"/></manifest></package>');
      zip.file('OEBPS/text/ch1.dat', '<html><body>' + '<p/>'.repeat(chapterParagraphs) + '</body></html>');
      zip.file('OEBPS/images/cover.png', '<a'.repeat(2_048));
      return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    };
    await assertEpubArchiveWithinLimits(await build(5), 10, 100_000, { maxXmlNodes: 30 });
    await expectResourceLimit(async () => assertEpubArchiveWithinLimits(await build(100), 10, 100_000, { maxXmlNodes: 30 }));
  });
});
