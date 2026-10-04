import type { OoxmlElement, OoxmlNode, OoxmlPackage } from '@docx-editor.dev/core/store';
import { parseDocxChart, type DocxChartModel } from './chart-model.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CHART_RELATIONSHIP = `${R}/chart`;
const LIMITS = { nodes: 200_000, charts: 32 };
const decoder = new TextDecoder('utf-8', { fatal: true });

export interface DocxChartPlacement {
  /** The painted drawing's `data-drawing-node-id`. */
  readonly drawingId: string;
  readonly model: DocxChartModel;
}

const element = (node: OoxmlNode): node is OoxmlElement => node.kind !== 'textValue';

/** Resolve a package-relative target without leaving the package; null for anything unusual. */
function resolve(owner: string, target: string): string | null {
  if (!target || /[\\%\x00-\x20\x7f:?#]/.test(target) || target.startsWith('//')) return null;
  const segments = target.startsWith('/') ? [] : owner.split('/').slice(1, -1);
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') { if (!segments.length) return null; segments.pop(); }
    else segments.push(segment);
  }
  return '/' + segments.join('/');
}

/** Body charts with their cached series, read once per package revision; never throws. */
export function chartPlacements(pkg: OoxmlPackage): readonly DocxChartPlacement[] {
  try {
    const main = pkg.parts.get(pkg.mainDocumentPart);
    if (!main) return [];
    const relationships = pkg.relationships.get(main.name) ?? [];
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
        const part = relationship && resolve(main.name, relationship.rawTarget);
        const bytes = part ? pkg.partBytes.get(part) : undefined;
        const model = bytes ? parseDocxChart(decoder.decode(bytes)) : null;
        if (model) placements.push(Object.freeze({ drawingId: owner, model }));
        continue;
      }
      for (let index = node.children.length - 1; index >= 0; index--) stack.push({ node: node.children[index]!, drawing: owner });
    }
    return Object.freeze(placements);
  } catch { return []; }
}
