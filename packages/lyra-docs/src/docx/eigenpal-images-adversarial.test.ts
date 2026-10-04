import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const { readOoxmlPackage } = await import('@docx-editor.dev/core/store');
import { imageFixture } from '../../test/corpus.js';
import { captureImageIntent, copyImage, qualifyImageCommand } from './eigenpal-images.js';
import type { DocxImageAction } from './types.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const actions: readonly DocxImageAction[] = [
  { type: 'resize-image', widthPoints: 160, heightPoints: 80 },
  { type: 'image-description', title: 'Changed', description: 'Changed description' },
  { type: 'delete-image' }
];

/** Keep the copied public candidate valid while changing only the canonical package. */
function fixture(kind = 'image-simple') {
  const parsed = readOoxmlPackage(imageFixture(kind));
  assert(parsed.ok);
  const pkg = structuredClone(parsed.package), part = pkg.parts.get(pkg.mainDocumentPart)!;
  const nodes: OoxmlElement[] = [];
  function collect(node: OoxmlNode): void {
    if (node.kind === 'textValue') return;
    nodes.push(node);
    node.children.forEach(collect);
  }
  collect(part.root);
  const find = (name: string) => {
    const node = nodes.find(value => value.localName === name);
    assert(node, name);
    return node;
  };
  const drawing = find('drawing');
  const run = nodes.find(node => node.children.some(child => child === drawing))!;
  const paragraph = nodes.find(node => node.children.some(child => child === run))!;
  const state = { scope: 'body', revision: 0 };
  const surface = {
    state: () => ({ selection: { anchor: { paragraphId: paragraph.id, offset: 0 }, head: { paragraphId: paragraph.id, offset: 0 } }, cellSelection: null }),
    drawingSelectionIntent: () => ({ kind: 'pointer', drawingNodeId: drawing.id }),
    storyScope: () => ({ kind: state.scope }),
    session: { part: () => part, currentPackage: () => pkg, packageRevision: () => state.revision }
  };
  const editor = { surface, mountGeneration: 0 } as unknown as DocxEditorInstance;
  const selected = {
    id: drawing.id, widthEmu: 1524000, heightEmu: 762000, kind: 'inline', wrap: 'inline', hidden: false,
    resourceStatus: 'ready', position: null, hyperlink: null, rotationDegrees: 0,
    crop: { left: 0, top: 0, right: 0, bottom: 0 }, locks: { select: false, move: false, resize: false, changeAspect: false },
    title: 'Title 1', description: 'Description 1'
  } as NonNullable<ReturnType<DocxEditorInstance['getSelectedImage']>>;
  const intent = captureImageIntent(editor, copyImage(selected));
  assert(intent);
  const qualify = (action: DocxImageAction) => qualifyImageCommand(editor, intent, action);
  assert(qualify(actions[2]!).ok, 'the unchanged fixture must qualify before the adversarial mutation');
  let identity = 0;
  const node = (name: string, namespaceUri = W, descendants: OoxmlNode[] = []): OoxmlElement => ({
    ...drawing, id: `adversarial-${++identity}`, kind: 'generic', namespaceUri, localName: name, attributes: [], children: descendants
  } as OoxmlElement);
  const parent = (target: OoxmlNode) => {
    const owner = nodes.find(value => value.children.some(child => child === target));
    assert(owner);
    return owner;
  };
  const media = [...pkg.partBytes.keys()].find(name => /\/media\/pixel\.(png|jpeg|gif)$/.test(name))!;
  return { pkg, part, nodes, find, drawing, run, paragraph, state, node, parent, media, qualify };
}
type Fixture = ReturnType<typeof fixture>;
function attributes(node: OoxmlElement) {
  return node.attributes as unknown as { namespaceUri: string; localName: string; value: string }[];
}
function children(node: OoxmlElement) { return node.children as OoxmlNode[]; }
function addAttribute(node: OoxmlElement, name: string, value: string, namespaceUri = ''): void {
  attributes(node).push({ namespaceUri, localName: name, value });
}
function setAttribute(node: OoxmlElement, name: string, value: string): void {
  const attribute = attributes(node).find(attribute => attribute.localName === name);
  assert(attribute, name);
  attribute.value = value;
}
function unchanged(h: Fixture, before: typeof h.pkg): void {
  assert.equal(isDeepStrictEqual(h.pkg, before), true, 'qualification must leave canonical nodes, relationships and all part bytes unchanged');
  assert.equal(h.state.revision, 0);
}
function refuse(h: Fixture, code = 'unsupported'): void {
  const before = structuredClone(h.pkg);
  const results = actions.map(action => {
    const result = h.qualify(action);
    unchanged(h, before);
    return { type: action.type, ok: result.ok, code: result.ok ? null : result.code };
  });
  assert.deepEqual(results, actions.map(action => ({ type: action.type, ok: false, code })));
}
function allow(h: Fixture): void {
  const before = structuredClone(h.pkg);
  for (const action of actions) {
    assert.equal(h.qualify(action).ok, true, action.type);
    unchanged(h, before);
  }
}
function locks(h: Fixture, placement: 'picture' | 'frame'): OoxmlElement {
  const lock = h.node(placement === 'picture' ? 'picLocks' : 'graphicFrameLocks', A);
  if (placement === 'picture') children(h.find('cNvPicPr')).push(lock);
  else children(h.find('inline')).push(h.node('cNvGraphicFramePr', WP, [lock]));
  return lock;
}

const lockNames = ['noSelect', 'noMove', 'noResize', 'noChangeAspect', 'noGrp', 'noRot', 'noEditPoints',
  'noAdjustHandles', 'noChangeArrowheads', 'noChangeShapeType', 'noCrop', 'noDrilldown'];
for (const placement of ['picture', 'frame'] as const) {
  for (const name of lockNames) {
    for (const value of ['true', '1', '', 'TRUE', '2', ' false ', 'bogus']) {
      test(`${placement} ${name}=${JSON.stringify(value)} refuses every image operation without mutation`, () => {
        const h = fixture(); addAttribute(locks(h, placement), name, value); refuse(h);
      });
    }
    for (const value of ['false', '0']) {
      test(`${placement} ${name}=${value} is explicitly neutral and does not mutate qualification`, () => {
        const h = fixture(); addAttribute(locks(h, placement), name, value); allow(h);
      });
    }
    test(`${placement} duplicate ${name} is ambiguous even when both values are neutral`, () => {
      const h = fixture(), lock = locks(h, placement);
      addAttribute(lock, name, '0'); addAttribute(lock, name, 'false'); refuse(h);
    });
  }
  test(`${placement} locks refuse unknown names and namespace lookalikes`, () => {
    for (const [name, namespaceUri] of [['futureLock', ''], ['noResize', A]]) {
      const h = fixture(); addAttribute(locks(h, placement), name!, 'false', namespaceUri!); refuse(h);
    }
  });
  test(`${placement} repeated lock containers cannot imply an unlocked image`, () => {
    const h = fixture(), lock = locks(h, placement), owner = placement === 'picture' ? h.find('cNvPicPr') : children(h.find('inline')).at(-1)! as OoxmlElement;
    children(owner).push(h.node(lock.localName, A)); refuse(h);
  });
}
test('simultaneous neutral picture and frame locks qualify, but either enabled placement refuses', () => {
  const h = fixture(), picture = locks(h, 'picture'), frame = locks(h, 'frame');
  for (const name of lockNames) { addAttribute(picture, name, '0'); addAttribute(frame, name, 'false'); }
  allow(h); setAttribute(frame, 'noSelect', '1'); refuse(h);
  setAttribute(frame, 'noSelect', 'false'); setAttribute(picture, 'noMove', 'true'); refuse(h);
});

for (const name of ['document', 'body', 'p', 'r', 'drawing', 'inline', 'extent', 'docPr', 'graphic', 'graphicData',
  'pic', 'nvPicPr', 'cNvPr', 'cNvPicPr', 'blipFill', 'blip', 'stretch', 'fillRect', 'spPr', 'xfrm', 'off', 'ext', 'prstGeom', 'avLst']) {
  test(`namespace lookalike ${name} cannot qualify the canonical image`, () => {
    const h = fixture(), target = name === 'p' ? h.paragraph : name === 'r' ? h.run : h.find(name);
    Object.assign(target, { namespaceUri: 'urn:lookalike' }); refuse(h);
  });
}
test('relationship embed namespace, graphicData URI and duplicate attribute identity refuse', () => {
  for (const mutate of [
    (h: Fixture) => { attributes(h.find('blip'))[0]!.namespaceUri = ''; },
    (h: Fixture) => { addAttribute(h.find('blip'), 'embed', 'rIdImage', 'urn:lookalike'); },
    (h: Fixture) => { setAttribute(h.find('graphicData'), 'uri', 'urn:lookalike'); },
    (h: Fixture) => { attributes(h.find('extent')).push({ ...attributes(h.find('extent'))[0]! }); }
  ]) { const h = fixture(); mutate(h); refuse(h); }
});
test('self cycles, ancestor cycles, shared nodes and distinct objects with duplicate ids refuse without mutation', () => {
  for (const mutate of [
    (h: Fixture) => { children(h.find('body')).push(h.find('body')); },
    (h: Fixture) => { children(h.run).push(h.part.root); },
    (h: Fixture) => { children(h.paragraph).push(h.run); },
    (h: Fixture) => { children(h.find('body')).push({ ...h.paragraph, children: [] } as OoxmlElement); },
    (h: Fixture) => { Object.assign(h.find('docPr'), { id: h.find('extent').id }); }
  ]) { const h = fixture(); mutate(h); refuse(h); }
});
for (const name of ['inline', 'extent', 'docPr', 'graphicData', 'pic', 'blip', 'ext']) {
  test(`duplicate ${name} with distinct identities remains structurally ambiguous`, () => {
    const h = fixture(), original = h.find(name), duplicate = structuredClone(original);
    let index = 0;
    function rename(node: OoxmlNode): void {
      Object.assign(node, { id: `duplicate-${++index}` });
      if (node.kind !== 'textValue') node.children.forEach(rename);
    }
    rename(duplicate); children(h.parent(original)).push(duplicate); refuse(h);
  });
}
for (const extent of ['extent', 'ext']) for (const axis of ['cx', 'cy']) {
  for (const value of ['0', '-1', '1.5', 'NaN', '9007199254740992']) {
    test(`${extent}.${axis}=${value} refuses nonpositive, nonintegral or unsafe dimensions`, () => {
      const h = fixture(); setAttribute(h.find(extent), axis, value); refuse(h);
    });
  }
  test(`${extent}.${axis}=1 accepts positive independent extents without qualification mutation`, () => {
    // The inline extent defines final geometry; positive picture transform extents may differ.
    const h = fixture(); setAttribute(h.find(extent), axis, '1'); allow(h);
  });
}
test('neutral hidden and flip booleans accept only exact false encodings', () => {
  for (const name of ['docPr', 'cNvPr', 'xfrm']) {
    for (const attribute of name === 'xfrm' ? ['flipH', 'flipV'] : ['hidden']) {
      for (const value of ['0', 'false', '1', 'true', '', 'False', 'bogus']) {
        const h = fixture(); addAttribute(h.find(name), attribute, value);
        if (value === '0' || value === 'false') allow(h); else refuse(h);
      }
    }
  }
});
for (const wrapper of ['tbl', 'tc', 'txbxContent', 'sdt', 'sdtContent', 'hyperlink', 'fldSimple', 'ins', 'del', 'moveFrom', 'moveTo', 'customXml', 'smartTag']) {
  test(`selected image under ${wrapper} is an excluded canonical wrapper`, () => {
    const h = fixture();
    if (['hyperlink', 'fldSimple', 'ins', 'del', 'moveFrom', 'moveTo', 'smartTag'].includes(wrapper)) {
      children(h.paragraph).splice(children(h.paragraph).indexOf(h.run), 1, h.node(wrapper, W, [h.run]));
    } else {
      const body = h.find('body'), position = children(body).indexOf(h.paragraph);
      const wrapped = wrapper === 'tbl' || wrapper === 'tc'
        ? h.node('tbl', W, [h.node('tr', W, [h.node('tc', W, [h.paragraph])])])
        : wrapper === 'sdt' || wrapper === 'sdtContent'
          ? h.node('sdt', W, [h.node('sdtContent', W, [h.paragraph])])
          : h.node(wrapper, W, [h.paragraph]);
      children(body).splice(position, 1, wrapped);
    }
    refuse(h);
  });
}
test('floating anchors and alternate-content fallback cannot qualify as a plain inline picture', () => {
  const anchor = fixture(); Object.assign(anchor.find('inline'), { localName: 'anchor' }); refuse(anchor);
  const alternate = fixture();
  children(alternate.run).splice(children(alternate.run).indexOf(alternate.drawing), 1,
    alternate.node('AlternateContent', 'http://schemas.openxmlformats.org/markup-compatibility/2006', [alternate.drawing]));
  refuse(alternate);
});
for (const story of ['header', 'footer', 'footnote', 'endnote', 'comment', 'textbox']) {
  test(`${story} scope invalidates the original body intent without package mutation`, () => {
    const h = fixture(); h.state.scope = story; refuse(h, 'stale-selection');
  });
  test(`an image moved into a ${story} part cannot qualify through the main-body reader`, () => {
    const h = fixture(), body = h.find('body');
    children(body).splice(children(body).indexOf(h.paragraph), 1);
    const name = `/word/${story}.xml`;
    (h.pkg.parts as Map<string, typeof h.part>).set(name, { ...h.part, name, root: h.node(story, W, [h.paragraph]) });
    refuse(h);
  });
}

function join(...segments: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(segments.reduce((sum, segment) => sum + segment.length, 0));
  let at = 0;
  for (const segment of segments) { result.set(segment, at); at += segment.length; }
  return result;
}
function pngChunk(name: string, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(payload.length + 12), view = new DataView(result.buffer);
  view.setUint32(0, payload.length);
  result.set([...name].map(char => char.charCodeAt(0)), 4); result.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0);
  return result;
}
/** Two complete frames reuse the valid PNG's compressed raster, with valid control CRCs. */
function animatedPng(png: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength), chunks: Uint8Array[] = [];
  for (let at = 8; at < png.length; at += view.getUint32(at) + 12) chunks.push(png.slice(at, at + view.getUint32(at) + 12));
  const ihdr = chunks.find(chunk => new DataView(chunk.buffer).getUint32(4) === 0x49484452)!;
  const data = chunks.filter(chunk => new DataView(chunk.buffer).getUint32(4) === 0x49444154);
  assert.equal(data.length, 1);
  const control = new Uint8Array(8); new DataView(control.buffer).setUint32(0, 2);
  const frame = (sequence: number) => {
    const bytes = new Uint8Array(26), frameView = new DataView(bytes.buffer);
    frameView.setUint32(0, sequence); frameView.setUint32(4, view.getUint32(16)); frameView.setUint32(8, view.getUint32(20));
    frameView.setUint16(20, 1); frameView.setUint16(22, 10);
    return pngChunk('fcTL', bytes);
  };
  const second = new Uint8Array(data[0]!.length - 8);
  new DataView(second.buffer).setUint32(0, 2); second.set(data[0]!.subarray(8, -4), 4);
  return join(png.slice(0, 8), ihdr, pngChunk('acTL', control), frame(0), data[0]!, frame(1), pngChunk('fdAT', second), pngChunk('IEND', new Uint8Array()));
}
function replaceMedia(h: Fixture, bytes: Uint8Array): void { (h.pkg.partBytes as Map<string, Uint8Array>).set(h.media, bytes); }
test('current media APNG with complete animation frames refuses all image operations', () => {
  const h = fixture(); replaceMedia(h, animatedPng(h.pkg.partBytes.get(h.media)!)); refuse(h);
});
test('current media GIF with two complete image descriptors refuses all image operations', () => {
  const h = fixture('image-gif'), gif = h.pkg.partBytes.get(h.media)!;
  const paletteEnd = 13 + ((gif[10]! & 128) ? 3 * 2 ** ((gif[10]! & 7) + 1) : 0);
  const descriptor = gif.indexOf(44, paletteEnd);
  assert(descriptor >= paletteEnd); assert.equal(gif.at(-1), 59);
  replaceMedia(h, join(gif.subarray(0, -1), gif.subarray(descriptor, -1), new Uint8Array([59]))); refuse(h);
});
for (const [kind, cuts] of [['image-simple', [1, 4, 13, 32]], ['image-gif', [1, 2, 8, 16]], ['image-jpeg', [1, 2, 8, 16]]] as const) {
  for (const cut of cuts) {
    test(`${kind} current media truncated by ${cut} bytes refuses despite a previously qualified image`, () => {
      const h = fixture(kind), original = h.pkg.partBytes.get(h.media)!;
      assert(original.length > cut); replaceMedia(h, original.slice(0, -cut)); refuse(h);
    });
  }
}
test('JPEG cut after a complete SOF but before scan data is not a valid current raster', () => {
  const h = fixture('image-jpeg'), bytes = h.pkg.partBytes.get(h.media)!;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 2, end = 0;
  while (at + 4 <= bytes.length) {
    assert.equal(bytes[at], 255);
    const marker = bytes[at + 1]!, length = view.getUint16(at + 2);
    if (marker === 0xc0 || marker === 0xc2) { end = at + 2 + length; break; }
    at += 2 + length;
  }
  assert(end > 0 && end < bytes.length); replaceMedia(h, bytes.slice(0, end)); refuse(h);
});
