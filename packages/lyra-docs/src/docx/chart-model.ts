import { SaxesParser } from 'saxes';

const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const LIMITS = { bytes: 2 * 1024 * 1024, nodes: 50_000, depth: 64, series: 16, points: 500, text: 256 };
const BAR = new Set(['barChart', 'bar3DChart']);
const LINE = new Set(['lineChart', 'line3DChart', 'areaChart', 'area3DChart']);

/** Cached values of one DrawingML chart, in the vocabulary `lr-lite-chart` paints. */
export interface DocxChartModel {
  readonly type: 'bar' | 'line';
  readonly stacked: boolean;
  readonly title: string;
  readonly labels: readonly string[];
  readonly series: readonly Readonly<{ label: string; data: readonly (number | null)[] }>[];
}

interface Node { readonly uri: string; readonly name: string; readonly attributes: Record<string, string>; readonly children: Node[]; text: string }

/** Parse with explicit node, depth and size bounds; DTDs and processing instructions refuse. */
function tree(xml: string): Node | null {
  if (xml.length > LIMITS.bytes) return null;
  const parser = new SaxesParser({ xmlns: true });
  const root: Node = { uri: '', name: '#root', attributes: {}, children: [], text: '' };
  const stack: Node[] = [root];
  let nodes = 0, failed = false;
  const fail = () => { failed = true; };
  parser.on('error', fail);
  parser.on('doctype', fail);
  parser.on('processinginstruction', fail);
  parser.on('opentag', tag => {
    if (failed) return;
    if (++nodes > LIMITS.nodes || stack.length > LIMITS.depth) { fail(); return; }
    const attributes: Record<string, string> = {};
    for (const attribute of Object.values(tag.attributes)) if (!attribute.uri) attributes[attribute.local] = attribute.value;
    const node: Node = { uri: tag.uri, name: tag.local, attributes, children: [], text: '' };
    stack.at(-1)!.children.push(node);
    stack.push(node);
  });
  parser.on('text', text => { if (!failed && stack.length > 1) stack.at(-1)!.text += text.slice(0, LIMITS.text); });
  parser.on('closetag', () => { if (!failed) stack.pop(); });
  try { parser.write(xml).close(); } catch { return null; }
  return failed ? null : root.children[0] ?? null;
}

const child = (node: Node | undefined, uri: string, name: string) => node?.children.find(entry => entry.uri === uri && entry.name === name);
const children = (node: Node | undefined, uri: string, name: string) => node?.children.filter(entry => entry.uri === uri && entry.name === name) ?? [];
function descendants(node: Node | undefined, uri: string, name: string, found: Node[] = []): Node[] {
  for (const entry of node?.children ?? []) {
    if (entry.uri === uri && entry.name === name) found.push(entry);
    descendants(entry, uri, name, found);
  }
  return found;
}
const clip = (text: string) => text.trim().slice(0, LIMITS.text);

/** Cached points (`c:strCache`/`c:numCache`) keyed by their declared index. */
function points(reference: Node | undefined): Map<number, string> {
  const values = new Map<number, string>();
  for (const point of descendants(reference, C, 'pt')) {
    const index = Number(point.attributes.idx);
    const value = child(point, C, 'v');
    if (Number.isSafeInteger(index) && index >= 0 && index < LIMITS.points && value) values.set(index, value.text);
  }
  return values;
}

/** Read a supported bar, column, line or area chart from its own cached values; anything else is null. */
export function parseDocxChart(xml: string): DocxChartModel | null {
  const root = tree(xml);
  if (!root || root.uri !== C || root.name !== 'chartSpace') return null;
  const chart = child(root, C, 'chart'), plot = child(chart, C, 'plotArea');
  const group = plot?.children.find(entry => entry.uri === C && (BAR.has(entry.name) || LINE.has(entry.name)));
  if (!group) return null;
  const series = children(group, C, 'ser').slice(0, LIMITS.series);
  if (!series.length) return null;
  let count = 0;
  const parsed = series.map((entry, index) => {
    const label = clip(descendants(child(entry, C, 'tx'), C, 'v')[0]?.text ?? '') || String(index + 1);
    const categories = points(child(entry, C, 'cat'));
    const values = points(child(entry, C, 'val'));
    for (const key of [...categories.keys(), ...values.keys()]) count = Math.max(count, key + 1);
    return { label, categories, values };
  });
  if (!count) return null;
  const labels = Array.from({ length: count }, (_, index) =>
    clip(parsed.find(entry => entry.categories.has(index))?.categories.get(index) ?? String(index + 1)));
  const data = parsed.map(entry => Object.freeze({ label: entry.label, data: Object.freeze(Array.from({ length: count }, (_, index) => {
    const value = entry.values.get(index);
    const number = value === undefined || value.trim() === '' ? NaN : Number(value);
    return Number.isFinite(number) ? number : null;
  })) }));
  if (data.every(entry => entry.data.every(value => value === null))) return null;
  const grouping = child(group, C, 'grouping')?.attributes.val ?? '';
  const titleRuns = descendants(child(chart, C, 'title'), A, 't').map(run => run.text).join('');
  return Object.freeze({
    type: BAR.has(group.name) ? 'bar' : 'line',
    stacked: BAR.has(group.name) && (grouping === 'stacked' || grouping === 'percentStacked'),
    title: clip(titleRuns || (data.length === 1 && child(chart, C, 'autoTitleDeleted')?.attributes.val !== '1' ? data[0]!.label : '')),
    labels: Object.freeze(labels),
    series: Object.freeze(data),
  });
}
