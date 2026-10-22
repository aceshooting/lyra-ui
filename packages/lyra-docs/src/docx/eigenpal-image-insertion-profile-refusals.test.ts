import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const { readOoxmlPart } = await import('@docx-editor.dev/core/store');
import {
  MAIN, R, TYPES, W14, attrs, bodyFixture, budget, children, dependencies, fixture, limited, paragraphXml,
  pictureFixture, styleFixture, unsupported, withStyles,
} from '../../test/image-profile-fixtures.js';
import { qualifyImageInsertionPackage } from './eigenpal-image-insertion-profile.js';

const flags = ['0', '1', 'true', 'false', 'on', 'off'], notFlags = ['', 'yes', 'TRUE', '2', ' 1'];
const run = (properties = '') => `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t>alpha</w:t></w:r>`;

// Each rule changes exactly one attribute of one property element; the values around it come from the same grammar.
const rules: readonly (readonly [scope: 'paragraph' | 'run' | 'section', element: (value: string) => string, accepted: readonly string[], rejected: readonly string[]])[] = [
  ...['bidi', 'keepNext', 'keepLines', 'widowControl', 'contextualSpacing'].map(name => ['paragraph', (value: string) => `<w:${name} w:val="${value}"/>`, flags, notFlags] as const),
  ['paragraph', value => `<w:outlineLvl w:val="${value}"/>`, ['0', '9'], ['', '10', '-1', '01', 'one']],
  ['paragraph', value => `<w:spacing w:lineRule="${value}"/>`, ['auto', 'exact', 'atLeast'], ['', 'single', 'AUTO']],
  ['paragraph', value => `<w:spacing w:beforeAutospacing="${value}"/>`, flags, notFlags],
  ['paragraph', value => `<w:spacing w:afterAutospacing="${value}"/>`, flags, notFlags],
  ['paragraph', value => `<w:spacing w:before="${value}"/>`, ['0', '120', '1000000'], ['-1', '1000001', '1.5', '']],
  ['paragraph', value => `<w:ind w:left="${value}"/>`, ['-1000000', '720', '1000000'], ['-1000001', '1000001', '0x10']],
  ['paragraph', value => `<w:jc w:val="${value}"/>`, ['left', 'right', 'center', 'both', 'start', 'end'], ['', 'justify', 'Center']],
  ...['b', 'i', 'bCs', 'iCs', 'rtl'].map(name => ['run', (value: string) => `<w:${name} w:val="${value}"/>`, flags, notFlags] as const),
  ['run', value => `<w:rFonts w:ascii="${value}"/>`, ['Arial', 'x'.repeat(64)], ['x'.repeat(65)]],
  ['run', value => `<w:lang w:val="${value}"/>`, ['en-US', 'x'.repeat(64)], ['', 'en_US', 'x'.repeat(65)]],
  ['run', value => `<w:lang w:eastAsia="${value}"/>`, ['ja-JP'], ['ja_JP']],
  ['run', value => `<w:lang w:bidi="${value}"/>`, ['ar-SA'], ['ar SA']],
  ['run', value => `<w:color w:val="${value}"/>`, ['auto', 'FF00aa', '000000'], ['', '#FF0000', 'FF00', 'red', 'FF00AAA']],
  ['run', value => `<w:u w:val="single" w:color="${value}"/>`, ['auto', '00FF00'], ['', 'green']],
  ['run', value => `<w:u w:val="${value}"/>`, ['none', 'single', 'double'], ['', 'wave', 'Single']],
  ['run', value => `<w:sz w:val="${value}"/>`, ['2', '22', '3276'], ['', '1', '3277', '2.5']],
  ['run', value => `<w:szCs w:val="${value}"/>`, ['2', '3276'], ['1', '3277']],
  ['section', value => `<w:pgSz w:w="12240" w:h="15840" w:orient="${value}"/>`, ['portrait', 'landscape'], ['', 'sideways', 'Landscape']],
  ['section', value => `<w:pgSz w:w="${value}" w:h="15840"/>`, ['1', '12240'], ['', '0', '-1', 'wide']],
  ['section', value => `<w:pgMar w:top="${value}"/>`, ['-1000000', '1440'], ['', 'x', '1000001']],
  ['section', value => `<w:cols w:num="${value}"/>`, ['1', '2', '64'], ['', '0', '65', '1.5']],
  ['section', value => `<w:cols w:equalWidth="${value}"/>`, flags, notFlags],
  ['section', value => `<w:docGrid w:type="${value}"/>`, ['default', 'lines', 'linesAndChars', 'snapToChars'], ['', 'grid', 'Lines']],
  ['section', value => `<w:docGrid w:linePitch="${value}"/>`, ['360', '-5'], ['', 'tall']],
];
test('property attribute values outside the finite grammar are refused while ordinary values qualify', () => {
  const bodyOf = (scope: 'paragraph' | 'run' | 'section', element: string) => scope === 'paragraph' ? paragraphXml(run(), element)
    : scope === 'run' ? paragraphXml(run(element)) : `${paragraphXml(run())}<w:sectPr>${element}</w:sectPr>`;
  for (const [scope, element, accepted, rejected] of rules) {
    for (const value of accepted) assert.equal(bodyFixture(bodyOf(scope, element(value))).check().ok, true, `${element(value)} ${scope}`);
    for (const value of rejected) assert.deepEqual(bodyFixture(bodyOf(scope, element(value))).check(), unsupported, `${element(value)} ${scope}`);
  }
});

test('a style reference without a value is refused even when the package defines the style', () => {
  assert.equal(bodyFixture(paragraphXml(run('<w:rStyle w:val="DefaultParagraphFont"/>'), '<w:pStyle w:val="Heading1"/>')).check().ok, true);
  assert.deepEqual(bodyFixture(paragraphXml(run(), '<w:pStyle/>')).check(), unsupported);
  assert.deepEqual(bodyFixture(paragraphXml(run('<w:rStyle/>'))).check(), unsupported);
});

test('only XML whitespace may sit between the elements of containers that hold no text', () => {
  const whitespace = (value: string) => ({ kind: 'textValue', id: `text-${value.length}`, value }) as unknown as OoxmlNode;
  const locations: readonly (readonly [string, (h: ReturnType<typeof bodyFixture>) => OoxmlElement])[] = [
    ['document', h => h.nodes.find(node => node.localName === 'document')!],
    ['body', h => h.nodes.find(node => node.localName === 'body')!],
    ['paragraph', h => h.nodes.find(node => node.localName === 'p')!],
    ['run', h => h.nodes.find(node => node.localName === 'r')!],
  ];
  for (const [label, locate] of locations) {
    const spaced = bodyFixture(paragraphXml(run())); children(locate(spaced)).push(whitespace(' \t\n'));
    assert.equal(spaced.check().ok, true, `${label}: whitespace`);
    for (const stray of ['text', ' ', 'a b']) {
      const h = bodyFixture(paragraphXml(run())); children(locate(h)).push(whitespace(stray));
      assert.deepEqual(h.check(), unsupported, `${label}: ${JSON.stringify(stray)}`);
    }
  }
});

test('content types that are not UTF-8 are an invalid document before any parsing', () => {
  const h = fixture(); let calls = 0;
  (h.pkg.partBytes as Map<string, Uint8Array>).set(TYPES, Uint8Array.of(0xff, 0xfe, 0xfd));
  const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies, readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } });
  assert.deepEqual(result, { ok: false, code: 'invalid-document' }); assert.equal(calls, 0);
});

test('a failing engine reader leaves the package unqualified instead of throwing', () => {
  const h = fixture();
  const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies, readOoxmlPart: () => { throw new Error('reader failed'); } });
  assert.deepEqual(result, unsupported);
});

test('xml:space on text accepts the two declared values and refuses others', () => {
  for (const [space, accepted] of [['preserve', true], ['default', true], ['', false], ['collapse', false], ['PRESERVE', false]] as const) {
    const h = bodyFixture(paragraphXml(`<w:r><w:t xml:space="${space}">alpha</w:t></w:r>`));
    if (accepted) assert.equal(h.check().ok, true, space); else assert.deepEqual(h.check(), unsupported, space);
  }
});

test('table grid columns need a positive width', () => {
  const table = (grid: string) => `<w:tbl><w:tblGrid>${grid}</w:tblGrid><w:tr><w:tc>${paragraphXml(run())}</w:tc></w:tr></w:tbl>`;
  for (const [grid, accepted] of [['<w:gridCol w:w="2400"/>', true], ['<w:gridCol/>', false], ['<w:gridCol w:w="0"/>', false], ['<w:gridCol w:w="1000001"/>', false]] as const) {
    const h = bodyFixture(table(grid), 0);
    if (accepted) assert.equal(h.check().ok, true, grid); else assert.deepEqual(h.check(), unsupported, grid);
  }
});

test('default style comparison distinguishes text values, element kinds, attribute values and namespace bindings', () => {
  const docDefaultsOf = (styles: { root: OoxmlElement }) => children(styles.root).find(node => node.kind !== 'textValue' && node.localName === 'docDefaults') as OoxmlElement;
  const rPrDefaultOf = (styles: { root: OoxmlElement }) => children(docDefaultsOf(styles)).find(node => node.kind !== 'textValue' && node.localName === 'rPrDefault') as OoxmlElement;
  const text = (id: string, value: string) => ({ kind: 'textValue', id, value }) as unknown as OoxmlNode;
  const binding = (namespaceUri: string, prefix = 'x') => ({ prefix, namespaceUri });
  type Styles = Parameters<typeof docDefaultsOf>[0];
  const cases: readonly (readonly [string, (candidate: Styles, reference: Styles) => void, boolean])[] = [
    ['identical definitions', () => undefined, true],
    ['equal text values', (candidate, reference) => { children(rPrDefaultOf(candidate)).push(text('candidate-text', ' ')); children(rPrDefaultOf(reference)).push(text('reference-text', ' ')); }, true],
    ['different text values', (candidate, reference) => { children(rPrDefaultOf(candidate)).push(text('candidate-text', ' ')); children(rPrDefaultOf(reference)).push(text('reference-text', '\n')); }, false],
    ['text where the reference has an element', (candidate, reference) => {
      children(rPrDefaultOf(candidate)).push(text('candidate-text', ' '));
      children(rPrDefaultOf(reference)).push({ ...children(rPrDefaultOf(reference))[0]!, id: 'reference-extra', children: [] } as OoxmlNode);
    }, false],
    ['an element where the reference has text', (candidate, reference) => {
      children(rPrDefaultOf(reference)).push(text('reference-text', ' '));
      children(rPrDefaultOf(candidate)).push({ ...children(rPrDefaultOf(candidate))[0]!, id: 'candidate-extra', children: [] } as OoxmlNode);
    }, false],
    ['another attribute value', candidate => {
      attrs(children(children(rPrDefaultOf(candidate))[0] as OoxmlElement)[0] as OoxmlElement)[0]!.value = 'Cambria';
    }, false],
    ['equal namespace bindings under different prefixes', (candidate, reference) => {
      Object.assign(rPrDefaultOf(candidate), { namespaceBindings: [binding(W14, 'a')] }); Object.assign(rPrDefaultOf(reference), { namespaceBindings: [binding(W14, 'b')] });
    }, true],
    ['other namespace bindings', (candidate, reference) => {
      Object.assign(rPrDefaultOf(candidate), { namespaceBindings: [binding(W14)] }); Object.assign(rPrDefaultOf(reference), { namespaceBindings: [binding(R)] });
    }, false],
  ];
  for (const [label, change, accepted] of cases) {
    const h = withStyles(), reference = structuredClone(dependencies.defaultStylesPart);
    change(h.pkg.parts.get('/word/styles.xml')!, reference);
    const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies, defaultStylesPart: reference });
    if (accepted) assert.equal(result.ok, true, label); else assert.deepEqual(result, unsupported, label);
  }
});

test('custom styles are paragraph or character styles with the matching property blocks and references', () => {
  const style = (type: string, content: string, attributes = '') => `<w:style w:type="${type}" w:styleId="Custom"${attributes}><w:name w:val="Custom"/>${content}</w:style>`;
  const cases: readonly (readonly [string, string, boolean])[] = [
    ['a character style with run properties', style('character', '<w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:b/></w:rPr>'), true],
    ['a character style with paragraph properties', style('character', '<w:pPr><w:jc w:val="left"/></w:pPr>'), false],
    ['a paragraph style with paragraph properties', style('paragraph', '<w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr>'), true],
    ['paragraph properties out of order', style('paragraph', '<w:pPr><w:jc w:val="left"/><w:keepNext/></w:pPr>'), false],
    ['a table style', style('table', ''), false],
    ['a style without a type', '<w:style w:styleId="Custom"><w:name w:val="Custom"/></w:style>', false],
    ['a paragraph style based on a character style', style('paragraph', '<w:basedOn w:val="DefaultParagraphFont"/>'), false],
    ['a character style based on a paragraph style', style('character', '<w:basedOn w:val="Normal"/>'), false],
    ['a paragraph style followed by a paragraph style', style('paragraph', '<w:next w:val="Normal"/>'), true],
    ['a paragraph style followed by a character style', style('paragraph', '<w:next w:val="DefaultParagraphFont"/>'), false],
    ['a paragraph style followed by a missing style', style('paragraph', '<w:next w:val="Missing"/>'), false],
    ['a character style followed by a character style', style('character', '<w:next w:val="DefaultParagraphFont"/>'), false],
    ['a style flagged as custom with 1', style('paragraph', '', ' w:customStyle="1"'), true],
    ['a style flagged as custom with true', style('character', '', ' w:customStyle="true"'), true],
    ['a style flagged as default with off', style('paragraph', '', ' w:default="off"'), true],
    ['a style flagged as custom with 2', style('paragraph', '', ' w:customStyle="2"'), false],
    ['a style flagged as default with yes', style('paragraph', '', ' w:default="yes"'), false],
  ];
  for (const [label, definition, accepted] of cases) {
    const h = styleFixture(definition);
    if (accepted) assert.equal(h.check().ok, true, label); else assert.deepEqual(h.check(), unsupported, label);
  }
});

test('absolute relationship targets are resolved from the package root', () => {
  const retarget = (target: string) => {
    const h = pictureFixture(), relations = h.pkg.relationships.get(MAIN)! as unknown as { rawTarget: string }[];
    const part = h.pkg.parts.get('/word/_rels/document.xml.rels')!, relationship = part.root.children.find(node => node.kind !== 'textValue')!;
    assert(relationship.kind !== 'textValue');
    attrs(relationship).find(attribute => attribute.localName === 'Target')!.value = target; relations[0]!.rawTarget = target;
    return h;
  };
  assert.equal(retarget('media/pixel.png').check().ok, true);
  assert.equal(retarget('/word/media/pixel.png').check().ok, true);
  for (const target of ['/word/media/../media/pixel.png', '/word//media/pixel.png', '/word/media/missing.png', '/media/pixel.png', 'media/pixel.png#fragment', '/word/media/pixel.png?query', 'media\\pixel.png', 'http:pixel.png']) {
    assert.deepEqual(retarget(target).check(), unsupported, target);
  }
});

test('an empty relationship list for the document is accepted without a relationships part while a populated one is refused', () => {
  const empty = fixture(); (empty.pkg.relationships as Map<string, readonly unknown[]>).set(MAIN, []);
  assert.equal(empty.check().ok, true);
  const populated = pictureFixture(), records = populated.pkg.relationships.get(MAIN)!;
  (populated.pkg.parts as Map<string, unknown>).delete('/word/_rels/document.xml.rels');
  assert.equal(records.length, 1); assert.deepEqual(populated.check(), unsupported);
});

test('a document with more pictures than the navigation bound reports the resource limit', () => {
  const pictures = (count: number) => (document: string) => {
    const picture = document.match(/<w:p><w:r><w:drawing>[\s\S]*?<\/w:drawing><\/w:r><\/w:p>/u)![0];
    const copies = Array.from({ length: count }, (_, index) => picture.replaceAll('id="1"', `id="${index + 1}"`)).join('');
    return document.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body><w:p><w:r><w:t>text</w:t></w:r></w:p>${copies}</w:body>`);
  };
  assert.equal(pictureFixture('image-simple', pictures(128)).check().ok, true);
  assert.deepEqual(pictureFixture('image-simple', pictures(129)).check(), limited);
});
