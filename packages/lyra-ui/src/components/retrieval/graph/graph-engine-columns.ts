import { normalizeGraphCurvature } from './graph-curvature.js';
import { largeDataPage, validateGraphColumns, type LyraGraphColumns, type TypedColumnIssue } from '../../../internal/typed-columns.js';

/** Structural engine data: optional companion declarations never enter the UI type graph. */
interface GraphEngineColumnData {
  readonly nodeCount: number;
  readonly positions?: Float32Array;
  readonly source: Uint32Array;
  readonly target: Uint32Array;
  readonly sizes?: Float32Array;
  readonly categories?: Uint16Array;
  readonly labels?: readonly string[];
  readonly edgeCurvature?: Float32Array;
}
type GraphEngineColumnItem =
  | { readonly kind: 'node'; readonly row: number; readonly id: string; readonly label: string }
  | { readonly kind: 'edge'; readonly row: number; readonly source: string; readonly target: string };
export interface GraphEngineColumns {
  readonly columns: LyraGraphColumns;
  readonly data: GraphEngineColumnData;
  row(id: string): number | undefined;
  item(index: number): GraphEngineColumnItem | undefined;
  page(page: number): { readonly page: number; readonly pageCount: number; readonly rows: readonly GraphEngineColumnItem[] };
}
/** Admits immutable columns once; only a requested fallback page becomes row objects. */
export function admitGraphEngineColumns(input: unknown): { readonly ok: true; readonly value: GraphEngineColumns } | { readonly ok: false; readonly issue: TypedColumnIssue } {
  const result = validateGraphColumns(input); if (!result.ok) return result;
  const columns = result.columns, count = result.count;
  for (const axis of ['x', 'y', 'z'] as const) {
    const values = columns[axis]; if (!values) continue;
    for (let index = 0; index < count; index++) if (Math.abs(values[index]!) > 1e7) return { ok: false, issue: { code: 'out-of-range', column: axis, index } };
  }
  if (columns.size) for (let index = 0; index < count; index++) if (columns.size[index]! > 20_000_000) return { ok: false, issue: { code: 'out-of-range', column: 'size', index } };
  let labelLength = 0;
  for (const label of columns.labels ?? []) { labelLength += label.length; if (labelLength > 4 * 1024 * 1024) return { ok: false, issue: { code: 'too-many', column: 'labels', limit: 4 * 1024 * 1024 } }; }
  const positions = columns.x || columns.y || columns.z ? new Float32Array(count * 3) : undefined;
  if (positions) for (let row = 0; row < count; row++) { positions[row * 3] = columns.x?.[row] ?? 0; positions[row * 3 + 1] = columns.y?.[row] ?? 0; positions[row * 3 + 2] = columns.z?.[row] ?? 0; }
  const indices = new Map<string, number>();
  for (let row = 0; row < count; row++) indices.set(columns.ids[row]!, row);
  const item = (index: number): GraphEngineColumnItem | undefined => {
    if (!Number.isInteger(index) || index < 0 || index >= count + columns.source.length) return undefined;
    if (index < count) return { kind: 'node', row: index, id: columns.ids[index]!, label: columns.labels?.[index] ?? columns.ids[index]! };
    const row = index - count;
    return { kind: 'edge', row, source: columns.ids[columns.source[row]!]!, target: columns.ids[columns.target[row]!]! };
  };
  return { ok: true, value: {
    columns, data: { nodeCount: count, positions, source: columns.source, target: columns.target, sizes: columns.size, categories: columns.category, labels: columns.labels, edgeCurvature: columns.edgeCurvature },
    row: (id) => indices.get(id), item,
    page(requested) { const page = largeDataPage(count + columns.source.length, requested); const rows: GraphEngineColumnItem[] = [];
      for (let index = page.start; index < page.end; index++) rows.push(item(index)!);
      return { page: page.page, pageCount: page.pageCount, rows };
    },
  } };
}

interface GraphEngineColumnSceneData extends GraphEngineColumnData {
  readonly spatialAppearance: { readonly sizeUnits: 'world'; readonly nodeShapes: Uint8Array };
  /** Retained for component-resolved edge paint; the renderer receives resolved appearance colors. */
  readonly edgeCategories?: Uint16Array;
}
export interface GraphEngineColumnScene {
  readonly data: GraphEngineColumnSceneData;
  /** Engine node/edge row to original column row; filtering never changes semantic identity. */
  readonly nodeRows: Uint32Array;
  readonly edgeRows: Uint32Array;
  readonly categoryNames: readonly string[] | undefined;
  readonly itemCount: number;
  nodeIndex(id: string): number | undefined;
  item(index: number): GraphEngineColumnItem | undefined;
  page(page: number): { readonly page: number; readonly pageCount: number; readonly rows: readonly GraphEngineColumnItem[] };
}

/** Dense typed projection; only requested semantic items become objects. */
export function graphEngineColumnScene(admitted: GraphEngineColumns, hiddenTypes: readonly string[]): GraphEngineColumnScene {
  const columns = admitted.columns, count = admitted.data.nodeCount;
  const hidden = new Set(hiddenTypes), remap = new Int32Array(count).fill(-1);
  let nodes = 0;
  for (let row = 0; row < count; row++) {
    const name = columns.category === undefined ? undefined : columns.categories?.[columns.category[row]!];
    if (name === undefined || !hidden.has(name)) remap[row] = nodes++;
  }
  const nodeRows = new Uint32Array(nodes);
  for (let row = 0; row < count; row++) if (remap[row]! >= 0) nodeRows[remap[row]!] = row;
  let edges = 0;
  for (let row = 0; row < columns.source.length; row++) if (remap[columns.source[row]!]! >= 0 && remap[columns.target[row]!]! >= 0) edges++;
  const edgeRows = new Uint32Array(edges), source = new Uint32Array(edges), target = new Uint32Array(edges);
  const edgeCategories = columns.edgeCategory === undefined ? undefined : new Uint16Array(edges);
  const edgeCurvature = columns.edgeCurvature === undefined ? undefined : new Float32Array(edges);
  let next = 0;
  for (let row = 0; row < columns.source.length; row++) {
    const a = remap[columns.source[row]!]!, b = remap[columns.target[row]!]!;
    if (a < 0 || b < 0) continue;
    edgeRows[next] = row; source[next] = a; target[next] = b;
    if (edgeCategories) edgeCategories[next] = columns.edgeCategory![row]!;
    if (edgeCurvature) edgeCurvature[next] = normalizeGraphCurvature(columns.edgeCurvature![row]);
    next++;
  }
  const originalPositions = admitted.data.positions;
  const positions = originalPositions === undefined ? undefined : new Float32Array(nodes * 3);
  const sizes = columns.size === undefined ? undefined : new Float32Array(nodes);
  const categories = columns.category === undefined ? undefined : new Uint16Array(nodes);
  const labels = columns.labels === undefined ? undefined : new Array<string>(nodes);
  for (let row = 0; row < nodes; row++) {
    const original = nodeRows[row]!;
    if (positions) {
      positions[row * 3] = originalPositions![original * 3]!;
      positions[row * 3 + 1] = originalPositions![original * 3 + 1]!;
      positions[row * 3 + 2] = originalPositions![original * 3 + 2]!;
    }
    if (sizes) sizes[row] = columns.size![original]!;
    if (categories) categories[row] = columns.category![original]!;
    if (labels) labels[row] = columns.labels![original]!;
  }
  const itemCount = nodes + edges;
  const item = (index: number): GraphEngineColumnItem | undefined => {
    if (!Number.isInteger(index) || index < 0 || index >= itemCount) return undefined;
    if (index < nodes) {
      const row = nodeRows[index]!;
      return { kind: 'node', row, id: columns.ids[row]!, label: columns.labels?.[row] ?? columns.ids[row]! };
    }
    const row = edgeRows[index - nodes]!;
    return { kind: 'edge', row, source: columns.ids[columns.source[row]!]!, target: columns.ids[columns.target[row]!]! };
  };
  return {
    data: { nodeCount: nodes, positions, source, target, sizes, categories, labels, edgeCategories, edgeCurvature,
      spatialAppearance: { sizeUnits: 'world', nodeShapes: new Uint8Array(nodes) } },
    nodeRows, edgeRows, categoryNames: columns.categories, itemCount,
    nodeIndex(id) { const original = admitted.row(id); if (original === undefined) return undefined; const row = remap[original]!; return row < 0 ? undefined : row; },
    item,
    page(requested) {
      const page = largeDataPage(itemCount, requested); const rows: GraphEngineColumnItem[] = [];
      for (let index = page.start; index < page.end; index++) rows.push(item(index)!);
      return { page: page.page, pageCount: page.pageCount, rows };
    },
  };
}
