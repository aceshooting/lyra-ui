import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { CONTENT_TYPES, docxFixture } from '../src/docx/admission-fixtures.js';

const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const image = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));

export const protectedParts = ['custom/payload.bin', 'customXml/item1.xml', 'word/media/pixel.png'] as const;

export function representativeFixture(): Uint8Array {
  const types = CONTENT_TYPES.replace('</Types>', [
    '<Default Extension="bin" ContentType="application/octet-stream"/>',
    '<Default Extension="png" ContentType="image/png"/>',
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>',
    '</Types>'
  ].join(''));
  const relations = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rIdNumbering" Type="${officeRel}numbering" Target="numbering.xml"/>
    <Relationship Id="rIdImage" Type="${officeRel}image" Target="media/pixel.png"/>
    <Relationship Id="rIdCustom" Type="urn:lyra:custom-data" Target="../customXml/item1.xml"/>
    <Relationship Id="rIdBinary" Type="urn:lyra:opaque-data" Target="../custom/payload.bin"/>
  </Relationships>`;
  const numbering = `<w:numbering xmlns:w="${word}">
    <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  </w:numbering>`;
  const documentXml = `<w:document xmlns:w="${word}" xmlns:r="${officeRel.slice(0, -1)}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
    <w:body>
      <w:p><w:r><w:t>Corpus opening</w:t></w:r></w:p>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Numbered item</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:drawing><wp:inline><wp:extent cx="9525" cy="9525"/><wp:docPr id="1" name="Pixel"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Pixel"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9525" cy="9525"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
    </w:body>
  </w:document>`;
  return docxFixture({
    '[Content_Types].xml': types,
    'word/_rels/document.xml.rels': relations,
    'word/document.xml': documentXml,
    'word/numbering.xml': numbering,
    'word/media/pixel.png': image,
    'customXml/item1.xml': '<x:payload xmlns:x="urn:lyra:fixture">Keep this extension</x:payload>',
    'custom/payload.bin': new Uint8Array([0, 1, 2, 3, 255, 254, 253, 0, 42])
  }, 6);
}

export function largeFixture(paragraphCount = 2000): Uint8Array {
  const paragraphs = Array.from({ length: paragraphCount }, (_, index) =>
    `<w:p><w:r><w:t>Paragraph ${String(index + 1).padStart(4, '0')} keeps layout work measurable.</w:t></w:r></w:p>`).join('');
  return docxFixture({ 'word/document.xml': `<w:document xmlns:w="${word}"><w:body>${paragraphs}</w:body></w:document>` }, 6);
}

/** Original OOXML fixture with a real custom style, a link and text split across runs. */
export function basicEditingFixture(): Uint8Array {
  const entries = unzipSync(representativeFixture());
  const styles = `<w:styles xmlns:w="${word}">
    <w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="CustomHeading"><w:name w:val="Custom Heading"/><w:basedOn w:val="Normal"/></w:style>
  </w:styles>`;
  const extra = `<w:p><w:r><w:t>Caf</w:t></w:r><w:r><w:t>é 東</w:t></w:r><w:r><w:t>京 alpha</w:t></w:r></w:p>
    <w:p><w:r><w:t>Alpha alphabeta Café 東京</w:t></w:r></w:p>
    <w:p><w:hyperlink r:id="rIdExistingLink"><w:r><w:t>Existing link</w:t></w:r></w:hyperlink></w:p>`;
  entries['[Content_Types].xml'] = strToU8(strFromU8(entries['[Content_Types].xml']!).replace('</Types>',
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'));
  entries['word/_rels/document.xml.rels'] = strToU8(strFromU8(entries['word/_rels/document.xml.rels']!).replace('</Relationships>',
    `<Relationship Id="rIdStyles" Type="${officeRel}styles" Target="styles.xml"/><Relationship Id="rIdExistingLink" Type="${officeRel}hyperlink" Target="https://example.test/original" TargetMode="External"/></Relationships>`));
  entries['word/document.xml'] = strToU8(strFromU8(entries['word/document.xml']!).replace('</w:body>', `${extra}</w:body>`));
  entries['word/styles.xml'] = strToU8(styles);
  return zipSync(entries, { level: 6 });
}

/** Two explicitly different paragraph and run formats, with opaque parts retained. */
export function mixedFormattingFixture(): Uint8Array {
  const entries = unzipSync(basicEditingFixture());
  entries['word/document.xml'] = strToU8(`<w:document xmlns:w="${word}"><w:body>
    <w:p><w:pPr><w:pStyle w:val="Normal"/><w:jc w:val="left"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t>First mixed paragraph</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="CustomHeading"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="30"/></w:rPr><w:t>Second mixed paragraph</w:t></w:r></w:p>
    </w:body></w:document>`);
  return zipSync(entries, { level: 6 });
}

/** More matches than the public result ceiling, without a large archive. */
export function searchLimitFixture(): Uint8Array {
  const paragraphs = Array.from({ length: 115 }, (_, index) =>
    `<w:p><w:r><w:t>needle ${index + 1}</w:t></w:r></w:p>`).join('');
  return docxFixture({ 'word/document.xml': `<w:document xmlns:w="${word}"><w:body>${paragraphs}</w:body></w:document>` }, 6);
}
