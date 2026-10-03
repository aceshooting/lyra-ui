import { strToU8, zipSync } from 'fflate';

const contentTypes = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const relationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

export const performanceFixtureParagraphs = 2_000;
export const performanceFixtureSentinel = 'Performance fixture paragraph 2000';

/** An original, uncompressed OPC package with repeatable mixed-direction content. */
export function performanceDocxFixture() {
  const paragraphs = Array.from({ length: performanceFixtureParagraphs }, (_, index) => {
    const ordinal = index + 1;
    const rtl = ordinal % 10 === 0;
    const text = `Performance fixture paragraph ${ordinal}: editing and layout sample ${String(ordinal).padStart(4, '0')}.`;
    return `<w:p>${rtl ? '<w:pPr><w:bidi/></w:pPr>' : ''}<w:r><w:t>${text}</w:t></w:r>${rtl ? '<w:r><w:t xml:space="preserve"> مرحبا بالعالم</w:t></w:r>' : ''}</w:p>`;
  }).join('');
  const documentXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(relationships),
    'word/document.xml': strToU8(documentXml)
  }, { level: 0 });
}
