import assert from 'node:assert/strict';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const { readOoxmlPackage } = await import('@docx-editor.dev/core/store');
import { captureImageIntent, copyImage, qualifyImageCommand } from '../src/docx/eigenpal-images.js';
import type { DocxImageAction } from '../src/docx/types.js';
import { imageFixture } from './corpus.js';

/** A detached canonical package and a minimal editor surface around its first picture. */
export function qualificationFixture(kind = 'image-simple') {
  const parsed = readOoxmlPackage(imageFixture(kind));
  assert(parsed.ok); const pkg = structuredClone(parsed.package), part = pkg.parts.get(pkg.mainDocumentPart)!;
  // Core may share immutable empty arrays between nodes. Detach each fixture node's arrays so
  // adversarial mutations below affect only the node named by the test.
  function detachArrays(node: OoxmlNode): void {
    if (node.kind === 'textValue') return;
    const element = node as OoxmlElement;
    Object.defineProperty(element, 'attributes', {
      configurable: true, enumerable: true, writable: true,
      value: element.attributes.map(attribute => ({ ...attribute }))
    });
    Object.defineProperty(element, 'children', {
      configurable: true, enumerable: true, writable: true,
      value: [...element.children]
    });
    element.children.forEach(detachArrays);
  }
  detachArrays(part.root);
  const nodes: OoxmlElement[] = [];
  const collect = (node: OoxmlNode) => { if (node.kind !== 'textValue') { nodes.push(node); node.children.forEach(collect); } };
  collect(part.root);
  const drawing = nodes.find(node => node.localName === 'drawing')!;
  const paragraph = nodes.find(node => node.children.some(run => run.kind !== 'textValue' && run.children.some(child => child === drawing)))!;
  const f = { revision: 0, generation: 0, id: drawing.id, paragraph: paragraph.id, offset: 0, head: 0, scope: 'body', cell: null as object | null, onPackage() {} };
  const surface = { state: () => ({ selection: { anchor: { paragraphId: f.paragraph, offset: f.offset }, head: { paragraphId: f.paragraph, offset: f.head } }, cellSelection: f.cell }),
    drawingSelectionIntent: () => ({ kind: 'pointer', drawingNodeId: f.id }), storyScope: () => ({ kind: f.scope }),
    session: { part: () => part, currentPackage: () => { f.onPackage(); return pkg; }, packageRevision: () => f.revision } };
  const editor = { surface, get mountGeneration() { return f.generation; } } as unknown as DocxEditorInstance;
  const selected = { id: drawing.id, widthEmu: 1524000, heightEmu: 762000, kind: 'inline', wrap: 'inline', hidden: false, resourceStatus: 'ready', position: null,
    hyperlink: null, rotationDegrees: 0, crop: { left: 0, top: 0, right: 0, bottom: 0 }, locks: { select: false, move: false, resize: false, changeAspect: false }, title: 'Title 1', description: 'Description 1' } as NonNullable<ReturnType<DocxEditorInstance['getSelectedImage']>>;
  const copy = copyImage(selected)!;
  const intent = captureImageIntent(editor, copy)!;
  const qualify = (action: DocxImageAction = { type: 'delete-image' }, limits?: Parameters<typeof qualifyImageCommand>[3]) => qualifyImageCommand(editor, intent, action, limits);
  return { f, editor, nodes, pkg, part, drawing, selected, copy, intent, qualify };
}

/** The mutable attribute records of a canonical element. */
export function elementAttributes(node: OoxmlElement) { return node.attributes as unknown as { namespaceUri: string; localName: string; value: string }[]; }
