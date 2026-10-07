import type { OoxmlElement, OoxmlNode, OoxmlPackage } from '@docx-editor.dev/core/store';
import { parseDocxChart, type DocxChartModel } from './chart-model.js';
import { CHART_NS as C, OFFICE_REL_NS as R, resolveOoxmlPart, WORD_NS as W } from './ooxml.js';

const CHART_RELATIONSHIP = `${R}/chart`;
const LIMITS = { nodes: 200_000, charts: 32, bytes: 2 * 1024 * 1024 };
const decoder = new TextDecoder('utf-8', { fatal: true });
// Chart parts are never edited, so their bytes objects key the parsed model across revisions.
const models = new WeakMap<Uint8Array, DocxChartModel | null>();
function chartModel(bytes: Uint8Array): DocxChartModel | null {
  let model = models.get(bytes);
  if (model === undefined) {
    try { model = bytes.length > LIMITS.bytes ? null : parseDocxChart(decoder.decode(bytes)); } catch { model = null; }
    models.set(bytes, model);
  }
  return model;
}

export interface DocxChartPlacement {
  /** The painted drawing's `data-drawing-node-id`. */
  readonly drawingId: string;
  readonly model: DocxChartModel;
}

const element = (node: OoxmlNode): node is OoxmlElement => node.kind !== 'textValue';

/** Resolve a package-relative target without leaving the package; null for anything unusual. */
/** Body charts with their cached series, read once per package revision; never throws. */
export function chartPlacements(pkg: OoxmlPackage): readonly DocxChartPlacement[] {
  try {
    const main = pkg.parts.get(pkg.mainDocumentPart);
    if (!main) return [];
    const relationships = pkg.relationships.get(main.name) ?? [];
    if (!relationships.some(entry => entry.type === CHART_RELATIONSHIP)) return [];
    const placements: DocxChartPlacement[] = [];
    const stack: { node: OoxmlNode; drawing: string | null }[] = [{ node: main.root, drawing: null }];
    let visited = 0;
    while (stack.length && placements.length < LIMITS.charts) {
      const { node, drawing } = stack.pop()!;
      if (++visited > LIMITS.nodes || !element(node)) continue;
      const owner = node.namespaceUri === W && node.localName === 'drawing' ? node.id : drawing;
      if (owner && node.namespaceUri === C && node.localName === 'chart') {
        const id = node.attributes.find(attribute => attribute.namespaceUri === R && attribute.localName === 'id')?.value;
        const relationship = relationships.find(entry => entry.id === id && entry.type === CHART_RELATIONSHIP && entry.targetMode !== 'External');
        const part = relationship && resolveOoxmlPart(main.name, relationship.rawTarget);
        const bytes = part ? pkg.partBytes.get(part) : undefined;
        const model = bytes ? chartModel(bytes) : null;
        if (model) placements.push(Object.freeze({ drawingId: owner, model }));
        continue;
      }
      for (let index = node.children.length - 1; index >= 0; index--) stack.push({ node: node.children[index]!, drawing: owner });
    }
    return Object.freeze(placements);
  } catch { return []; }
}
