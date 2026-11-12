import { zipWithDeclaredSizes, forgedExpansionZip, expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { assertEpubArchiveWithinLimits } from './epub-resource-guard.js';




describe('EPUB resource guard', () => {
  for (const [packageName, href, contentName] of [
    ['book.dat', '/Text/chapter.dat', 'Text/chapter.dat'],
    ['OPS/book.dat', '../../Text/chapter.dat', 'Text/chapter.dat'],
    ['OPS/book%ZZ.dat', 'Text/ch%ZZ.dat', 'OPS/Text/ch%ZZ.dat'],
    ['OPS/book.dat', 'Text/caf%C3%A9.dat?edition=2#start', 'OPS/Text/café.dat'],
  ]) {
    it(`counts manifest content resolved from ${href}`, async () => {
      const build = async (paragraphs: number) => {
        const zip = new JSZip();
        zip.file('META-INF/container.xml', `<container><rootfiles><rootfile full-path="${packageName}"/></rootfiles></container>`);
        zip.file(packageName!, `<package><manifest><item href="${href}" media-type="application/xhtml+xml"/></manifest></package>`);
        zip.file(contentName!, `<html><body>${'<p/>'.repeat(paragraphs)}</body></html>`);
        return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
      };
      await assertEpubArchiveWithinLimits(await build(5), 20, 100_000, { maxXmlNodes: 20 });
      await expectResourceLimit(async () => assertEpubArchiveWithinLimits(await build(40), 20, 100_000, { maxXmlNodes: 20 }));
    });
  }

  it('leaves malformed package metadata to the parser while still bounding known XML content', async () => {
    for (const [container, packageXml] of [
      ['<container>', '<package/>'],
      ['<container><rootfile/></container>', '<package/>'],
      ['<container><rootfile full-path="book.dat"/></container>', '<package>'],
      ['<container><rootfile full-path="book.dat"/></container>', '<package><item/><item media-type="application/xhtml+xml"/></package>'],
    ]) {
      const zip = new JSZip();
      zip.file('META-INF/container.xml', container!);
      zip.file('book.dat', packageXml!);
      zip.file('chapter.xhtml', '<html><body><p/></body></html>');
      await assertEpubArchiveWithinLimits(await zip.generateAsync({ type: 'arraybuffer' }), 10, 10_000, { maxXmlNodes: 20 });
      zip.file('chapter.xhtml', `<html><body>${'<p/>'.repeat(30)}</body></html>`);
      await expectResourceLimit(async () => assertEpubArchiveWithinLimits(await zip.generateAsync({ type: 'arraybuffer' }),
        10, 10_000, { maxXmlNodes: 20 }));
    }
  });

  for (const entry of ['META-INF/container.xml', 'book.dat']) {
    it(`enforces the metadata byte boundary for ${entry} independently of the archive expansion ceiling`, async () => {
      const limit = 8 * 1024 * 1024;
      const zip = new JSZip();
      if (entry === 'book.dat') zip.file('META-INF/container.xml', '<container><rootfile full-path="book.dat"/></container>');
      const wrapper = '<metadata></metadata>';
      const metadata = `<metadata>${'x'.repeat(limit - wrapper.length)}</metadata>`;
      zip.file(entry, metadata);
      await assertEpubArchiveWithinLimits(await zip.generateAsync({ type: 'arraybuffer' }), 10, limit * 2);
      zip.file(entry, metadata + ' ');
      await expectResourceLimit(async () => assertEpubArchiveWithinLimits(await zip.generateAsync({ type: 'arraybuffer' }), 10, limit * 2));
    });
  }

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

  it('resolves package and manifest references with dot segments before checking document complexity', async () => {
    const zip = new JSZip();
    zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/chapters/../book.opf"/></rootfiles></container>');
    zip.file('OPS/book.opf', '<package><manifest>'
      + '<item id="chapter" href="../Text/chapter.xhtml?edition=1#start" media-type="application/xhtml+xml"/>'
      + '<item id="image" href="../Images/cover.png" media-type="image/png"/></manifest></package>');
    zip.file('Text/chapter.xhtml', '<html><body>' + '<p/>'.repeat(20) + '</body></html>');
    zip.file('Images/cover.png', '<p'.repeat(256));
    const source = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

    await expectResourceLimit(() => assertEpubArchiveWithinLimits(source, 10, 100_000, { maxXmlNodes: 10 }));
  });
});
