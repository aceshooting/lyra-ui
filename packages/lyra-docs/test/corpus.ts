import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { CONTENT_TYPES, docxFixture } from '../src/docx/admission-fixtures.js';

const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const image = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/yA9iFgAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));

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

export function tableFixture(kind: string): Uint8Array {
  const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const cell = (text: string, properties = '', extra = '') => `<w:tc><w:tcPr>${properties}</w:tcPr>${p(text)}${extra}</w:tc>`;
  const table = (rows: number, columns: number, prefix = 'A') => `<w:tbl><w:tblPr/><w:tblGrid>${'<w:gridCol w:w="1500"/>'.repeat(columns)}</w:tblGrid>${Array.from({ length: rows }, (_, row) => `<w:tr>${Array.from({ length: columns }, (_, column) => cell(`${prefix}${row}${column}`)).join('')}</w:tr>`).join('')}</w:tbl>`;
  let body = table(3, 3);
  if (kind === 'table-merged') body = `<w:tbl><w:tblGrid>${'<w:gridCol w:w="1800"/>'.repeat(3)}</w:tblGrid><w:tr>${cell('Merged', '<w:gridSpan w:val="2"/>')}${cell('Right')}</w:tr><w:tr>${cell('A10')}${cell('A11')}${cell('A12')}</w:tr></w:tbl>`;
  if (kind === 'table-vmerge') body = `<w:tbl><w:tblGrid>${'<w:gridCol w:w="1800"/>'.repeat(2)}</w:tblGrid><w:tr>${cell('Merged', '<w:vMerge w:val="restart"/>')}${cell('Right')}</w:tr><w:tr>${cell('', '<w:vMerge/>')}${cell('A11')}</w:tr></w:tbl>`;
  if (kind === 'table-nested') body = `<w:tbl><w:tblGrid><w:gridCol w:w="5400"/></w:tblGrid><w:tr>${cell('Outer', '', table(2, 2, 'N') + p('Tail'))}</w:tr></w:tbl>`;
  if (kind === 'table-single') body = table(1, 1);
  if (kind === 'table-limit') body = table(20, 2);
  if (kind === 'table-overlimit') body = table(21, 2);
  const entries = unzipSync(representativeFixture());
  if (kind === 'table-protected-form') {
    body = '<w:p><w:bookmarkStart w:id="0" w:name="Target"/><w:r><w:t>Current value</w:t></w:r><w:bookmarkEnd w:id="0"/></w:p><w:p><w:fldSimple w:instr=" REF Target "><w:r><w:t>Stale value</w:t></w:r></w:fldSimple></w:p><w:p><w:r><w:fldChar w:fldCharType="begin"><w:ffData><w:name w:val="Text1"/><w:enabled/><w:textInput><w:type w:val="number"/><w:default w:val="123"/><w:format w:val="0.00"/></w:textInput></w:ffData></w:fldChar></w:r><w:r><w:instrText xml:space="preserve"> FORMTEXT </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>123.00</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p><w:sdt><w:sdtPr><w:id w:val="42"/><w:tag w:val="probe"/><w:text/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Controlled text</w:t></w:r></w:p></w:sdtContent></w:sdt>';
    entries['word/settings.xml'] = strToU8(`<w:settings xmlns:w="${word}"><w:documentProtection w:edit="forms" w:enforcement="1"/></w:settings>`);
    entries['[Content_Types].xml'] = strToU8(strFromU8(entries['[Content_Types].xml']!).replace('</Types>', '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'));
    entries['word/_rels/document.xml.rels'] = strToU8(strFromU8(entries['word/_rels/document.xml.rels']!).replace('</Relationships>', `<Relationship Id="rIdSettings" Type="${officeRel}settings" Target="settings.xml"/></Relationships>`));
  }
  let xml = `<w:document xmlns:w="${word}"><w:body>${p('Before')}${body}${p('After')}</w:body></w:document>`;
  if (kind === 'table-alt') xml = xml.replaceAll('w:', 'x:').replace('xmlns:w=', 'xmlns:x=');
  entries['word/document.xml'] = strToU8(xml);
  return zipSync(entries, { level: 6 });
}

/** Plain visible existing pictures, sharing one raster resource. */
export function imageFixture(kind = 'image-simple'): Uint8Array {
  const entries = unzipSync(representativeFixture());
  if (kind === 'image-near-limit') {
    const payload = new Uint8Array(4 * 1024 * 1024 - 32768);
    let state = 0x2468ace1;
    for (let index = 0; index < payload.length; index++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      payload[index] = state & 255;
    }
    entries['custom/payload.bin'] = payload;
  }
  entries['word/media/pixel.png'] = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAYklEQVR4nO3QIRXAMBTAwCqpzuFJHJ6XVsaBH3A8L2u/35ls6QCtATpAa4AO0BqgA7QG6ACtATpAa4AO0BqgA7T1P/tM1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AHa+AEX/pyJHlsX+U4AAAAASUVORK5CYII='), char => char.charCodeAt(0));
  let xml = strFromU8(entries['word/document.xml']!);
  const original = xml.match(/<w:p><w:r><w:drawing>[\s\S]*?<\/w:drawing><\/w:r><\/w:p>/)![0];
  const picture = (id: number) => original.replaceAll('9525', '1524000').replaceAll('cy="1524000"', 'cy="762000"')
    .replaceAll('id="1"', `id="${id}"`).replace('<wp:docPr ', `<wp:docPr title="Title ${id}" descr="Description ${id}" `);
  let first = picture(1);
  if (kind === 'image-picture-lock') first = first.replace('<pic:cNvPicPr/>', '<pic:cNvPicPr><a:picLocks noResize="1"/></pic:cNvPicPr>');
  if (kind === 'image-frame-lock') first = first.replace('<a:graphic>', '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic>');
  if (kind === 'image-hidden') first = first.replace('<wp:docPr ', '<wp:docPr hidden="1" ');
  if (kind === 'image-crop') first = first.replace('<a:stretch>', '<a:srcRect l="1000"/><a:stretch>');
  if (kind === 'image-empty-source') first = first.replace('<a:stretch>', '<a:srcRect/><a:stretch>');
  if (kind === 'image-rotation') first = first.replace('<a:xfrm>', '<a:xfrm rot="60000">');
  if (kind === 'image-long-metadata') first = first.replace('Description 1', 'x'.repeat(2049));
  if (kind === 'image-table') first = `<w:tbl><w:tr><w:tc>${first}</w:tc></w:tr></w:tbl>`;
  if (kind === 'image-offscreen-inline' || kind === 'image-line-boundary') {
    const lines = kind === 'image-line-boundary' ? 100 : 20;
    const label = kind === 'image-line-boundary' ? '' : '<w:t xml:space="preserve">Picture: </w:t>';
    first = first.replace('<w:p>', `<w:p><w:r>${Array.from({ length: lines }, (_, index) => `<w:t>Earlier line ${index + 1}</w:t><w:br/>`).join('')}${label}</w:r>`);
  }
  const paragraph = (value: string) => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`;
  xml = xml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${paragraph('Before image')}${first}${paragraph('Between images')}${picture(2)}${paragraph('After image')}</w:body>`);
  if (kind === 'image-offscreen') xml = xml.replace('<w:body>', `<w:body>${Array.from({ length: 140 }, (_, index) => paragraph(`Earlier paragraph ${index + 1}`)).join('')}`);
  entries['word/document.xml'] = strToU8(xml);
  if (kind === 'image-jpeg') {
    entries['word/media/pixel.jpeg'] = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAgAEADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCPAUam8AAAAAAAAAAAAAB//9k='), char => char.charCodeAt(0));
    delete entries['word/media/pixel.png'];
    entries['word/_rels/document.xml.rels'] = strToU8(strFromU8(entries['word/_rels/document.xml.rels']!).replace('pixel.png', 'pixel.jpeg'));
    entries['[Content_Types].xml'] = strToU8(strFromU8(entries['[Content_Types].xml']!).replace('Extension="png" ContentType="image/png"', 'Extension="jpeg" ContentType="image/jpeg"'));
  }
  if (kind === 'image-gif') {
    entries['word/media/pixel.gif'] = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='), char => char.charCodeAt(0));
    delete entries['word/media/pixel.png'];
    entries['word/_rels/document.xml.rels'] = strToU8(strFromU8(entries['word/_rels/document.xml.rels']!).replace('pixel.png', 'pixel.gif'));
    entries['[Content_Types].xml'] = strToU8(strFromU8(entries['[Content_Types].xml']!).replace('Extension="png" ContentType="image/png"', 'Extension="gif" ContentType="image/gif"'));
  }
  return zipSync(entries, { level: 6 });
}
