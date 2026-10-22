import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const { readOoxmlPackage, readOoxmlPart } = await import('@docx-editor.dev/core/store');
const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
import { qualifyImageInsertionPackage } from '../src/docx/eigenpal-image-insertion-profile.js';
import { imageFixture } from './corpus.js';

export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
export const MAIN = '/word/document.xml', TYPES = '/[Content_Types].xml';
const blank = readOoxmlPackage(blankDocumentBytes()); assert(blank.ok);
const blankPackage = blank.package;
export const dependencies = { readOoxmlPart, defaultStylesPart: blankPackage.parts.get('/word/styles.xml')! };
export const budget = { mediaBytes: 100, pixelWidth: 1, pixelHeight: 1, titleLength: 0, descriptionLength: 0 };
export const attrs = (n: OoxmlElement) => n.attributes as unknown as { namespaceUri: string; localName: string; value: string }[];
export const children = (n: OoxmlElement) => n.children as OoxmlNode[];
export const unsupported = { ok: false, code: 'unsupported' }, limited = { ok: false, code: 'resource-limit' };

/** The elements below a root in document order. */
function elementsOf(root: OoxmlNode): OoxmlElement[] {
  const found: OoxmlElement[] = [];
  const visit = (node: OoxmlNode): void => { if (node.kind !== 'textValue') { found.push(node); node.children.forEach(visit); } };
  visit(root);
  return found;
}
/** A document whose body is the given markup, in the namespaces the insertion profile requires. */
const documentXml = (body: string) => `<w:document xmlns:w="${W}" xmlns:w14="${W14}"><w:body>${body}</w:body></w:document>`;
/** One paragraph with the identity the profile requires, around the given run content. */
export const paragraphXml = (content: string, properties = '') =>
  `<w:p w14:paraId="00000001" w14:textId="00000001">${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content}</w:p>`;

export function fixture(text = 'alpha') {
  const entries = {
    '[Content_Types].xml': `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="${MAIN}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<w:document xmlns:w="${W}" xmlns:w14="${W14}"><w:body><w:p w14:paraId="00000001" w14:textId="00000001"><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`
  };
  const read = readOoxmlPackage(zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])))); assert(read.ok);
  const pkg = structuredClone(read.package), nodes: OoxmlElement[] = [], stack: OoxmlNode[] = [pkg.parts.get(MAIN)!.root];
  while (stack.length) { const n = stack.pop()!; if (n.kind !== 'textValue') { nodes.push(n); stack.push(...n.children); } }
  const paragraph = nodes.find(n => n.localName === 'p')!, target = { paragraphId: paragraph.id, offset: 2 };
  const rawCt = (s: string) => (pkg.partBytes as Map<string, Uint8Array>).set(TYPES, strToU8(s));
  return { pkg, nodes, paragraph, target, rawCt, check: (input = budget) => qualifyImageInsertionPackage(pkg, target, input, dependencies) };
}

export function withStyles() {
  const h = fixture(), pkg = structuredClone(blankPackage);
  (pkg.parts as Map<string, unknown>).set(MAIN, h.pkg.parts.get(MAIN)!);
  return { ...h, pkg, check: () => qualifyImageInsertionPackage(pkg, h.target, budget, dependencies) };
}

/** Pictures that share one raster resource; `transform` may rewrite the generated document markup. */
export function pictureFixture(kind = 'image-simple', transform: (document: string) => string = document => document) {
  const source = unzipSync(imageFixture(kind)), h = fixture();
  let index = 0;
  const document = transform(strFromU8(source['word/document.xml']!)).replace('<w:document ', `<w:document xmlns:w14="${W14}" `)
    .replaceAll('rIdImage', 'rId1').replaceAll('<w:p>', () => {
      const id = (++index).toString(16).toUpperCase().padStart(8, '0'); return `<w:p w14:paraId="${id}" w14:textId="${id}">`;
    });
  const imageName = Object.keys(source).find(name => name.startsWith('word/media/'))!, extension = imageName.split('.').at(-1)!;
  const mime = extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg';
  const entries = {
    '[Content_Types].xml': strToU8(new TextDecoder().decode(h.pkg.partBytes.get(TYPES)!).replace('</Types>', `<Default Extension="${extension}" ContentType="${mime}"/></Types>`)),
    '_rels/.rels': h.pkg.partBytes.get('/_rels/.rels')!,
    'word/document.xml': strToU8(document),
    'word/_rels/document.xml.rels': strToU8(`<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/image" Target="media/${imageName.split('/').at(-1)}"/></Relationships>`),
    [imageName]: source[imageName]!
  };
  const parsed = readOoxmlPackage(zipSync(entries)); assert(parsed.ok); const pkg = structuredClone(parsed.package);
  const nodes: OoxmlElement[] = [], stack: OoxmlNode[] = [pkg.parts.get(MAIN)!.root];
  while (stack.length) { const node = stack.pop()!; if (node.kind !== 'textValue') { nodes.push(node); stack.push(...node.children); } }
  const paragraph = nodes.find(node => node.localName === 'p' && node.children.some(run => run.kind !== 'textValue' && run.children.some(t => t.kind !== 'textValue' && t.localName === 't')))!;
  const target = { paragraphId: paragraph.id, offset: 1 };
  return { pkg, nodes, target, check: (input = budget) => qualifyImageInsertionPackage(pkg, target, input, dependencies) };
}

export function styledCell(table = false) {
  const h = withStyles(), main = h.pkg.parts.get(MAIN)!;
  const content = `<w:p w14:paraId="00000001" w14:textId="00000001"><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:rStyle w:val="DefaultParagraphFont"/></w:rPr><w:t>alpha</w:t></w:r></w:p>`;
  const parsed = readOoxmlPart(`<w:document xmlns:w="${W}" xmlns:w14="${W14}"><w:body>${table ? `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="2400"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${content}</w:tc></w:tr></w:tbl>` : content}</w:body></w:document>`, { name: MAIN, contentType: main.contentType });
  assert(parsed.ok); const part = structuredClone(parsed.part); (h.pkg.parts as Map<string, unknown>).set(MAIN, part);
  const nodes: OoxmlElement[] = [], stack: OoxmlNode[] = [part.root];
  while (stack.length) { const n = stack.pop()!; if (n.kind !== 'textValue') { nodes.push(n); stack.push(...n.children); } }
  h.target.paragraphId = nodes.find(n => n.localName === 'p')!.id; if (table) h.target.offset = 0;
  return { ...h, nodes };
}

export function customStyledCell(properties = '<w:rPr><w:b/></w:rPr>', basedOn = 'Normal') {
  const h = styledCell(), styles = h.pkg.parts.get('/word/styles.xml')!;
  const parsed = readOoxmlPart(`<w:style xmlns:w="${W}" w:type="paragraph" w:styleId="Custom"><w:name w:val="Custom"/><w:basedOn w:val="${basedOn}"/>${properties}</w:style>`, { name: '/style.xml', contentType: 'application/xml' }); assert(parsed.ok);
  children(styles.root).push(structuredClone(parsed.part.root)); attrs(h.nodes.find(n => n.localName === 'pStyle')!)[0]!.value = 'Custom'; return h;
}

/** The blank document's default styles with a custom body; the caret sits inside the first paragraph. */
export function bodyFixture(body: string, offset = 2) {
  const h = withStyles(), main = h.pkg.parts.get(MAIN)!;
  const parsed = readOoxmlPart(documentXml(body), { name: MAIN, contentType: main.contentType }); assert(parsed.ok);
  const part = structuredClone(parsed.part); (h.pkg.parts as Map<string, unknown>).set(MAIN, part);
  const nodes = elementsOf(part.root), target = { paragraphId: nodes.find(n => n.localName === 'p')!.id, offset };
  return { pkg: h.pkg, nodes, target, check: (references = dependencies) => qualifyImageInsertionPackage(h.pkg, target, budget, references) };
}

/** The blank document with an additional style definition appended to its styles part. */
export function styleFixture(styleXml: string) {
  const h = bodyFixture(paragraphXml('<w:r><w:t>alpha</w:t></w:r>')), styles = h.pkg.parts.get('/word/styles.xml')!;
  const parsed = readOoxmlPart(styleXml.replace('<w:style ', `<w:style xmlns:w="${W}" `), { name: '/style.xml', contentType: 'application/xml' }); assert(parsed.ok);
  children(styles.root).push(structuredClone(parsed.part.root));
  return h;
}
