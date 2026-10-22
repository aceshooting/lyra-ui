import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import { elementAttributes as attributes, qualificationFixture as fixture } from '../../test/image-qualification-harness.js';
import { captureImageIntent, imageCandidates, imageCandidatesInPackage, qualifyImageCommand } from './eigenpal-images.js';
import type { DocxImageAction } from './types.js';

type Harness = ReturnType<typeof fixture>;
const unsupported = { ok: false, code: 'unsupported' } as const;
const limited = { ok: false, code: 'resource-limit' } as const;
const actions: readonly DocxImageAction[] = [
  { type: 'resize-image', widthPoints: 180, heightPoints: 90 },
  { type: 'image-description', title: 'Title', description: 'Description' },
  { type: 'delete-image' },
];

function find(h: Harness, name: string): OoxmlElement {
  const node = h.nodes.find(value => value.localName === name);
  assert(node, name);
  return node;
}
function setAttribute(h: Harness, element: string, name: string, value: string): void {
  const records = attributes(find(h, element)), existing = records.find(record => record.localName === name && record.namespaceUri === '');
  if (existing) existing.value = value; else records.push({ namespaceUri: '', localName: name, value });
}
function assertRefused(h: Harness, expected: typeof unsupported | typeof limited, label: string): void {
  for (const action of actions) assert.deepEqual(h.qualify(action), expected, `${label}: ${action.type}`);
}
function assertQualifies(h: Harness, label: string): void {
  for (const action of actions) assert.equal(h.qualify(action).ok, true, `${label}: ${action.type}`);
}
function mediaName(h: Harness): string {
  const name = [...h.pkg.partBytes.keys()].find(value => value.startsWith('/word/media/'));
  assert(name);
  return name;
}

// Each rule changes exactly one attribute of the Word-authored picture, which qualifies unchanged.
const valueRules: readonly (readonly [element: string, attribute: string, accepted: readonly string[], rejected: readonly string[]])[] = [
  ['effectExtent', 'l', ['0', '123456789'], ['', '-1', '1.5', '1234567890', 'wide']],
  ['effectExtent', 'b', ['7'], ['-7']],
  ['blip', 'cstate', ['print', 'screen', 'email', 'hqprint', 'none'], ['', 'PRINT', 'draft']],
  ['cNvPicPr', 'preferRelativeResize', ['0', '1', 'false', 'true'], ['', '2', 'TRUE', 'yes']],
  ['blipFill', 'dpi', ['0'], ['', '96', '-1']],
  ['blipFill', 'rotWithShape', ['0', '1', 'false', 'true'], ['', '2', 'True']],
  ['spPr', 'bwMode', ['auto'], ['', 'gray', 'Auto']],
  ['ln', 'w', ['0', '9525', '99999999'], ['', '-1', '1.5', '100000000', 'thin']],
  ['ln', 'cap', ['rnd', 'flat'], ['', 'round cap', 'x'.repeat(17)]],
  ['ln', 'cmpd', ['sng'], ['', 'two lines']],
  ['ln', 'algn', ['ctr'], ['', 'in/out']],
  ['miter', 'lim', ['800000'], ['', '80 000']],
  ['headEnd', 'type', ['triangle'], ['', 'has space']],
  ['headEnd', 'w', ['med'], ['', 'extra-large']],
  ['tailEnd', 'len', ['lg'], ['', 'long!']],
  ['off', 'x', ['0'], ['', '1', '-1']],
  ['off', 'y', ['0'], ['1']],
  ['prstGeom', 'prst', ['rect'], ['', 'ellipse', 'Rect']],
];
test('picture attribute values outside the plain grammar refuse every image operation', () => {
  assertQualifies(fixture('image-word'), 'unchanged');
  for (const [element, name, accepted, rejected] of valueRules) {
    for (const value of accepted) {
      const h = fixture('image-word'); setAttribute(h, element, name, value);
      assertQualifies(h, `${element}.${name}=${JSON.stringify(value)}`);
    }
    for (const value of rejected) {
      const h = fixture('image-word'), before = JSON.stringify(h.part.root); setAttribute(h, element, name, value);
      assertRefused(h, unsupported, `${element}.${name}=${JSON.stringify(value)}`);
      assert.notEqual(JSON.stringify(h.part.root), before);
    }
  }
});

test('extension lists admit only a:ext records that carry a single uri attribute', () => {
  const entryOf = (h: Harness) => (find(h, 'extLst').children as OoxmlNode[])[0] as OoxmlElement;
  assertQualifies(fixture('image-word'), 'unchanged');
  const mutations: readonly (readonly [string, (h: Harness) => void])[] = [
    ['entry from another vocabulary', h => { (entryOf(h) as { namespaceUri: string }).namespaceUri = 'urn:lookalike'; }],
    ['entry with another name', h => { (entryOf(h) as { localName: string }).localName = 'extension'; }],
    ['text between entries', h => { (find(h, 'extLst').children as OoxmlNode[]).push({ kind: 'textValue', id: 'list-text', value: ' ' } as OoxmlNode); }],
    ['entry without attributes', h => { attributes(entryOf(h)).length = 0; }],
    ['entry with a second attribute', h => { attributes(entryOf(h)).push({ namespaceUri: '', localName: 'note', value: 'x' }); }],
  ];
  for (const [label, mutate] of mutations) {
    const h = fixture('image-word'); mutate(h);
    assertRefused(h, unsupported, label);
  }
});

test('table-like wrappers around a picture paragraph must be table, row and cell at every level', () => {
  const wrap = (h: Harness, names: readonly string[]) => {
    const body = find(h, 'body'), paragraph = h.nodes.find(node => node.id === h.f.paragraph)!;
    const wrapped = names.reduceRight<OoxmlElement>((inner, name, level) => ({ ...paragraph, id: `wrapper-${level}`, localName: name, attributes: [], children: [inner] } as OoxmlElement), paragraph);
    const siblings = body.children as OoxmlNode[]; siblings.splice(siblings.indexOf(paragraph), 1, wrapped);
  };
  const chains: readonly (readonly [readonly string[], boolean])[] = [
    [['tbl', 'tr', 'tc'], true],
    [['tbl', 'tr', 'sdt'], false], [['tbl', 'sdt', 'tc'], false], [['sdt', 'tr', 'tc'], false], [['tc', 'tr', 'tbl'], false],
    [['tbl', 'tr', 'tc', 'tbl', 'tr', 'sdt'], false],
  ];
  for (const [chain, qualifies] of chains) {
    const h = fixture(); wrap(h, chain);
    if (qualifies) assertQualifies(h, chain.join('/')); else assertRefused(h, unsupported, chain.join('/'));
  }
});

test('image relationship targets must resolve to a part inside the package', () => {
  const targets: readonly (readonly [string, boolean])[] = [
    ['media/pixel.png', true], ['/word/media/pixel.png', true], ['./media/../media/pixel.png', true],
    ['../../pixel.png', false], ['media\\pixel.png', false], ['media/pixel%2Epng', false], ['https:pixel.png', false],
    ['//media/pixel.png', false], ['', false], ['media/pixel.png#fragment', false], ['media/pixel.png?query', false],
  ];
  for (const [target, qualifies] of targets) {
    const h = fixture();
    const relation = h.pkg.relationships.get(h.part.name)!.find(value => value.type.endsWith('/image')) as unknown as { rawTarget: string };
    relation.rawTarget = target;
    if (qualifies) assertQualifies(h, JSON.stringify(target)); else assertRefused(h, unsupported, JSON.stringify(target));
  }
});

test('a picture without a relationship id, relationship set or media bytes refuses and is skipped by candidate reads', () => {
  const blip = fixture(); attributes(find(blip, 'blip')).length = 0;
  assertRefused(blip, unsupported, 'blip without r:embed');
  const candidates = imageCandidatesInPackage(blip.pkg, blip.part); assert(candidates.ok); assert.equal(candidates.value.length, 1);
  const anonymous = fixture(); attributes(find(anonymous, 'blip')).length = 0;
  const image = anonymous.pkg.relationships.get(anonymous.part.name)!.find(value => value.type.endsWith('/image')) as unknown as { id?: string };
  image.id = undefined;
  assertRefused(anonymous, unsupported, 'blip without r:embed beside a relationship without an id');
  const records = fixture(); (records.pkg.relationships as Map<string, unknown>).delete(records.part.name);
  assertRefused(records, unsupported, 'no relationships for the document part');
  assert.deepEqual(imageCandidatesInPackage(records.pkg, records.part), { ok: true, value: [] });
  const media = fixture(); (media.pkg.partBytes as Map<string, Uint8Array>).delete(mediaName(media));
  assertRefused(media, unsupported, 'missing media bytes');
  assert.deepEqual(imageCandidatesInPackage(media.pkg, media.part), { ok: true, value: [] });
});

test('relationship sets beyond the node budget are a resource limit even when the picture id is unique', () => {
  const budget = { nodes: 500 };
  const control = fixture(); assert.equal(control.qualify({ type: 'delete-image' }, budget).ok, true);
  const h = fixture(), records = h.pkg.relationships.get(h.part.name) as unknown as { id: string }[];
  const template = records[0]!;
  for (let index = 0; index < budget.nodes; index++) records.push({ ...template, id: `rIdSpare${index}` });
  assert.deepEqual(h.qualify({ type: 'delete-image' }, budget), limited);
  assert.deepEqual(imageCandidatesInPackage(h.pkg, h.part, budget), limited);
});

test('oversized media is a resource limit while unreadable media stays unsupported', () => {
  const huge = fixture(); (huge.pkg.partBytes as Map<string, Uint8Array>).set(mediaName(huge), new Uint8Array(4 * 1024 * 1024 + 1));
  assert.deepEqual(huge.qualify(), limited);
  assert.deepEqual(imageCandidatesInPackage(huge.pkg, huge.part), limited);
  const blank = fixture(); (blank.pkg.partBytes as Map<string, Uint8Array>).set(mediaName(blank), new Uint8Array(1024));
  assert.deepEqual(blank.qualify(), unsupported);
});

test('picture metadata that is not XML text refuses as unsupported rather than as a limit', () => {
  for (const [name, value] of [['descr', '\u0001'], ['title', '\ud800']] as const) {
    const h = fixture(); setAttribute(h, 'docPr', name, value);
    assertRefused(h, unsupported, name);
  }
  const text = fixture(); setAttribute(text, 'docPr', 'descr', 'Line one\nLine two \u{1f600}');
  assertQualifies(text, 'ordinary text');
});

test('a root wider than the node budget is reported as a limit before its bodies are counted', () => {
  const h = fixture(), body = find(h, 'body');
  (h.part.root.children as OoxmlNode[]).push({ ...body, id: 'second-body', children: [] } as OoxmlElement);
  assert.deepEqual(h.qualify(), unsupported);
  assert.deepEqual(h.qualify({ type: 'delete-image' }, { nodes: 1 }), limited);
});

test('qualification refuses an editor that loses its surface after the intent was confirmed', () => {
  const h = fixture(), surface = h.editor.surface; let reads = 0;
  Object.defineProperty(h.editor, 'surface', { configurable: true, get() { return reads++ === 0 ? surface : null; } });
  assert.deepEqual(h.qualify(), unsupported);
  assert.equal(reads, 2);
});

test('explicit candidate reads and qualification report session faults as unsupported without throwing', () => {
  assert.deepEqual(imageCandidates({ surface: null } as unknown as DocxEditorInstance), unsupported);
  const h = fixture(); h.f.onPackage = () => { throw new Error('session failed'); };
  assert.deepEqual(imageCandidates(h.editor), unsupported);
  assert.deepEqual(h.qualify(), unsupported);
  const broken = fixture(); (broken.pkg as { contentTypes?: unknown }).contentTypes = undefined;
  assert.deepEqual(imageCandidatesInPackage(broken.pkg, broken.part), unsupported);
});

test('an intent captured for a different paragraph than the picture owns refuses', () => {
  const h = fixture(), owner = h.f.paragraph;
  h.f.paragraph = 'another-paragraph';
  const other = captureImageIntent(h.editor, h.copy)!;
  assert.deepEqual(qualifyImageCommand(h.editor, other, { type: 'delete-image' }), unsupported);
  h.f.paragraph = owner;
  assert.equal(qualifyImageCommand(h.editor, captureImageIntent(h.editor, h.copy)!, { type: 'delete-image' }).ok, true);
});
