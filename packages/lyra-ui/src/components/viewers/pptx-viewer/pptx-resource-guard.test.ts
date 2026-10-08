import { zipWithDeclaredSizes, forgedExpansionZip, expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { assertPptxArchiveWithinLimits } from './pptx-resource-guard.js';
import { assembleZip, zipEntry } from '../archive-viewer/fixtures/zip-builder.js';




describe('PPTX resource guard', () => {
  it('accepts an archive within both ceilings', async () => {
    await assertPptxArchiveWithinLimits(zipWithDeclaredSizes([10, 20]), {
      maxEntries: 2,
      maxUncompressedBytes: 30,
    });
  });

  it('rejects excessive declared expansion, entry count, and malformed ZIP input', async () => {
    await expectResourceLimit(() => assertPptxArchiveWithinLimits(zipWithDeclaredSizes([60, 50]), {
      maxEntries: 10,
      maxUncompressedBytes: 100,
    }));
    await expectResourceLimit(() => assertPptxArchiveWithinLimits(zipWithDeclaredSizes([1, 1]), {
      maxEntries: 1,
      maxUncompressedBytes: 100,
    }));
    await expectResourceLimit(() => assertPptxArchiveWithinLimits(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer));
  });

  it('measures deflate output instead of trusting forged expansion metadata', async () => {
    const source = await forgedExpansionZip('ppt/slides/slide1.xml');
    await expectResourceLimit(() => assertPptxArchiveWithinLimits(source, {
      maxEntries: 10,
      maxUncompressedBytes: 1_000,
    }));
  });

  it('enforces an XML node ceiling on the parts the renderer parses, and only on those', async () => {
    const deck = async (slideNodes: number, slideName = 'ppt/slides/slide1.xml') => assembleZip([
      await zipEntry('ppt/presentation.xml', '<p:presentation/>'),
      await zipEntry(slideName, '<p:sld>' + '<a:t/>'.repeat(slideNodes) + '</p:sld>', { deflate: true }),
      await zipEntry('ppt/media/image1.png', '<a'.repeat(2_048)),
    ]);
    await assertPptxArchiveWithinLimits(await deck(10), { maxXmlNodes: 20 });
    await expectResourceLimit(async () => assertPptxArchiveWithinLimits(await deck(30), { maxXmlNodes: 20 }));
    await expectResourceLimit(async () => assertPptxArchiveWithinLimits(
      await deck(30, 'ppt\\slides\\slide1.xml'),
      { maxXmlNodes: 20 },
    ));
    await expectResourceLimit(async () => assertPptxArchiveWithinLimits(await deck(1_000_000)));
  });

  it('node-counts the parts the relationships resolve, whatever their names', async () => {
    const relationship = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
    const rels = (type: string, target: string) => '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + `<Relationship Id="rId1" Type="${relationship}${type}" Target="${target}"/></Relationships>`;
    const deck = async (slideNodes: number) => assembleZip([
      await zipEntry('_rels/.rels', rels('officeDocument', 'ppt/presentation.xml')),
      await zipEntry('ppt/presentation.xml', '<p:presentation/>'),
      await zipEntry('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/slide1.dat')),
      await zipEntry('ppt/slides/slide1.dat', '<p:sld>' + '<a:t/>'.repeat(slideNodes) + '</p:sld>', { deflate: true }),
      await zipEntry('ppt/media/image1.png', '<a'.repeat(2_048)),
    ]);
    await assertPptxArchiveWithinLimits(await deck(5), { maxXmlNodes: 20 });
    await expectResourceLimit(async () => assertPptxArchiveWithinLimits(await deck(30), { maxXmlNodes: 20 }));
  });
});
