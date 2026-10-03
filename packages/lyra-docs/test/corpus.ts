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
