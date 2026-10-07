import { zipWithDeclaredSizes, forgedExpansionZip, expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { assertDocxArchiveWithinLimits, createDocxXmlDepthInspector } from './docx-resource-guard.js';
import { DOCX_ZIP_LIMITS, DocxZipAdmissionError, inspectDocxZip } from '../../../internal/docx-zip-admission.js';
import { assembleZip, zipEntry } from '../archive-viewer/fixtures/zip-builder.js';




describe('DOCX resource guard', () => {
  it('accepts whitespace after closing names and rejects invalid closers or incomplete UTF-8', () => {
    const valid = createDocxXmlDepthInspector(2);
    valid.write(new TextEncoder().encode('<root><child/></root \t\n>'));
    valid.close();
    for (const closer of ['</root suffix>', '</ root>', '</root!>']) {
      const invalid = createDocxXmlDepthInspector(2);
      expect(() => invalid.write(new TextEncoder().encode('<root>' + closer))).to.throw(LyraResourceLimitError);
    }
    const incomplete = createDocxXmlDepthInspector(2);
    incomplete.write(new TextEncoder().encode('<root/>'));
    incomplete.write(new Uint8Array([0xc3]));
    expect(() => incomplete.close()).to.throw(LyraResourceLimitError, 'invalid XML');
  });

  it('maps strict admission failures to resource errors and preserves cancellation', async () => {
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(new ArrayBuffer(0), undefined, undefined, { strictAdmission: true }));
    const source = assembleZip([await zipEntry('word/document.xml', '<document/>')]);
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(source, undefined, undefined, { strictAdmission: true }));
    const controller = new AbortController();
    controller.abort();
    let caught: unknown;
    try {
      await assertDocxArchiveWithinLimits(source, undefined, undefined, { strictAdmission: true, signal: controller.signal });
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(DOMException);
    expect((caught as DOMException).name).to.equal('AbortError');
  });

  it('counts unquoted relationship targets despite a malformed trailing attribute', async () => {
    const source = assembleZip([
      await zipEntry('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target=document.bin =/></Relationships>'),
      await zipEntry('document.bin', '<document><paragraph/><paragraph/><paragraph/></document>'),
    ]);
    await assertDocxArchiveWithinLimits(source, 10, 10_000, { maxXmlNodes: 6 });
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(source, 10, 10_000, { maxXmlNodes: 5 }));
  });

  it('bounds depth of relationship-linked XML stored under a non-XML extension in strict mode', async () => {
    const build = async (depth: number) => assembleZip([
      await zipEntry('[Content_Types].xml', '<Types/>'),
      await zipEntry('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="word/styles.dat"/></Relationships>'),
      await zipEntry('word/document.xml', '<document/>'),
      await zipEntry('word/styles.dat', '<style>'.repeat(depth) + '</style>'.repeat(depth), { deflate: true }),
    ]);
    await assertDocxArchiveWithinLimits(await build(DOCX_ZIP_LIMITS.depth), undefined, undefined, { strictAdmission: true });
    await expectResourceLimit(async () => assertDocxArchiveWithinLimits(await build(DOCX_ZIP_LIMITS.depth + 1), undefined, undefined, { strictAdmission: true }));
  });

  it('shares the relationship byte ceiling across parts and accepts its exact boundary', async () => {
    const ceiling = 8 * 1024 * 1024;
    const xml = '<Relationships><!--' + 'x'.repeat(ceiling - '<Relationships><!----></Relationships>'.length) + '--></Relationships>';
    const boundaryPart = await zipEntry('_rels/.rels', xml, { deflate: true });
    const extraPart = await zipEntry('word/_rels/document.xml.rels', ' ');
    await assertDocxArchiveWithinLimits(assembleZip([boundaryPart]));
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(assembleZip([
      boundaryPart,
      extraPart,
    ])));
  });

  it('counts only real XML nesting across chunks and rejects UTF-16 input', () => {
    const accepted = '<a>'.repeat(128) + '<!-- > </a> --><![CDATA[ > </a> ]]>' + '</a>'.repeat(128);
    const inspector = createDocxXmlDepthInspector(128);
    const encoded = new TextEncoder().encode(accepted);
    for (let offset = 0; offset < encoded.length; offset += 2) inspector.write(encoded.subarray(offset, offset + 2));
    inspector.close();
    for (const disguisedClose of ['<!-- > </a> -->', '<![CDATA[ > </a> ]]>']) {
      const attack = createDocxXmlDepthInspector(128);
      attack.write(new TextEncoder().encode('<a>'.repeat(128) + disguisedClose));
      expect(() => attack.write(new TextEncoder().encode('<a>'))).to.throw(LyraResourceLimitError);
    }
    const utf16 = createDocxXmlDepthInspector(128);
    expect(() => utf16.write(new Uint8Array([0x3c, 0, 0x61, 0, 0x2f, 0, 0x3e, 0]))).to.throw(LyraResourceLimitError);
  });
  it('accepts the shared entry boundary and rejects one more entry', () => {
    expect(inspectDocxZip(new Uint8Array(zipWithDeclaredSizes(Array(DOCX_ZIP_LIMITS.entries).fill(0))), undefined, false)).to.have.length(DOCX_ZIP_LIMITS.entries);
    expect(() => inspectDocxZip(new Uint8Array(zipWithDeclaredSizes(Array(DOCX_ZIP_LIMITS.entries + 1).fill(0))), undefined, false))
      .to.throw(DocxZipAdmissionError, 'resource-limit');
  });

  it('requires matching CRCs and bounds XML depth before conversion', async () => {
    const makeArchive = async (body: string) => assembleZip([
      await zipEntry('[Content_Types].xml', '<Types/>'),
      await zipEntry('_rels/.rels', '<Relationships/>'),
      await zipEntry('word/document.xml', body),
    ]);
    const valid = await makeArchive('<a>'.repeat(DOCX_ZIP_LIMITS.depth) + '</a>'.repeat(DOCX_ZIP_LIMITS.depth));
    await assertDocxArchiveWithinLimits(valid, undefined, undefined, { strictAdmission: true });
    const tooDeep = await makeArchive('<a>'.repeat(DOCX_ZIP_LIMITS.depth + 1) + '</a>'.repeat(DOCX_ZIP_LIMITS.depth + 1));
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(tooDeep, undefined, undefined, { strictAdmission: true }));
    const corrupt = valid.slice(0);
    const bytes = new Uint8Array(corrupt);
    const marker = new TextEncoder().encode('<a>');
    const at = bytes.findIndex((_byte, index) => marker.every((part, offset) => bytes[index + offset] === part));
    expect(at).to.be.greaterThan(0);
    bytes[at + 1] = 0x62;
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(corrupt, undefined, undefined, { strictAdmission: true }));
  });
  it('accepts an archive within both ceilings', async () => {
    await assertDocxArchiveWithinLimits(zipWithDeclaredSizes([10, 20]), 2, 30);
  });

  it('rejects excessive declared expansion, entry count, and malformed ZIP input', async () => {
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(zipWithDeclaredSizes([60, 50]), 10, 100));
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(zipWithDeclaredSizes([1, 1]), 1, 100));
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer));
  });

  it('measures deflate output instead of trusting forged uncompressed-size fields', async () => {
    const source = await forgedExpansionZip('word/document.xml');
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(source, 10, 1_000));
  });

  it('node-counts the parts Mammoth resolves through relationships, whatever their names', async () => {
    const officeRelationship = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
    const body = (paragraphs: number) => '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
      + '<w:p><w:r><w:t>hidden part</w:t></w:r></w:p>'.repeat(paragraphs)
      + '</w:body></w:document>';
    const relationships = (entries: string) => '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + entries + '</Relationships>';
    const styles = (count: number) => '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:style/>'.repeat(count) + '</w:styles>';
    const build = async (mainBody: string, stylesPart = styles(0)) => assembleZip([
      await zipEntry('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      await zipEntry('_rels/.rels', relationships(
        `<Relationship Id="rId1" Type="${officeRelationship}officeDocument" Target="word/document.bin"/>`,
      )),
      await zipEntry('word/_rels/document.bin.rels', relationships(
        `<Relationship Id="rId1" Type="${officeRelationship}styles" Target="styles&#46;dat"/>`,
      )),
      await zipEntry('word/document.bin', mainBody, { deflate: true }),
      await zipEntry('word/styles.dat', stylesPart, { deflate: true }),
      await zipEntry('word/media/image1.png', '<a'.repeat(2_048)),
    ]);

    const mammothModule = (await import('mammoth/mammoth.browser.js')) as unknown as {
      default: { convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
    };
    const converted = await mammothModule.default.convertToHtml({ arrayBuffer: await build(body(1)) });
    expect(converted.value).to.contain('hidden part');

    // 5 rels/content-type nodes + (2 + 3 per paragraph) + (1 + n styles): 14 fit a ceiling of 20.
    await assertDocxArchiveWithinLimits(await build(body(2)), 10, 100_000, { maxXmlNodes: 20 });
    await expectResourceLimit(async () => assertDocxArchiveWithinLimits(
      await build(body(10)),
      10,
      100_000,
      { maxXmlNodes: 20 },
    ));
    await expectResourceLimit(async () => assertDocxArchiveWithinLimits(
      await build(body(1), styles(20)),
      10,
      100_000,
      { maxXmlNodes: 20 },
    ));
  });

  it('rejects excessive expanded XML node complexity before Mammoth and honors cancellation', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:p/><w:p/></w:document>');
    const source = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(source, 10, 10_000, { maxXmlNodes: 2 }));

    const controller = new AbortController();
    controller.abort();
    let aborted: unknown;
    try {
      await assertDocxArchiveWithinLimits(source, 10, 10_000, { signal: controller.signal });
    } catch (error) {
      aborted = error;
    }
    expect(aborted).to.be.instanceOf(DOMException);
    expect((aborted as DOMException).name).to.equal('AbortError');
  });
});
