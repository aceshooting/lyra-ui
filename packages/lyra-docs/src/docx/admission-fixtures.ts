import { strToU8, zipSync } from 'fflate';

export const DOCUMENT_XML = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>';
export const CONTENT_TYPES = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const RELATIONSHIPS = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

export function docxFixture(overrides: Record<string, string | Uint8Array | null> = {}, level: 0 | 6 = 0): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELATIONSHIPS),
    'word/document.xml': strToU8(DOCUMENT_XML)
  };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) delete entries[name];
    else entries[name] = typeof value === 'string' ? strToU8(value) : value;
  }
  return zipSync(entries, { level });
}

export function relationship(target: string, type = 'image', mode = 'External'): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}" TargetMode="${mode}"/></Relationships>`;
}
