import { readPointer } from './references.js';
import type { LyraGenSurfaceState } from './runtime.js';
import type { JsonValue, LyraGenDiagnostic, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';
import type { GenRenderedSnapshot } from './ssr.js';

/** One exported cell: plain JSON scalars only. */
export type DataExportCell = string | number | boolean | null;
/** The tabular data behind one node of a view. */
export interface DataExportTable {
  readonly nodeId: string;
  /** The node role, e.g. `table` or `series-chart`. */
  readonly role: string;
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly DataExportCell[])[];
}
/** Column headings for generated tables; hosts translate these. */
export interface DataExportHeadings {
  readonly label: string;
  readonly value: string;
  readonly index: string;
  readonly stage: string;
  readonly comparison: string;
  readonly unit: string;
  readonly caption: string;
  readonly delta: string;
  readonly min: string;
  readonly max: string;
  readonly used: string;
  readonly limit: string;
  readonly id: string;
  readonly parent: string;
  readonly source: string;
  readonly target: string;
  readonly text: string;
  readonly weight: string;
  readonly group: string;
}
export interface DataExportOptions {
  readonly headings?: Partial<DataExportHeadings>;
  /** Upper bound on exported tables. Default 256. */
  readonly maxTables?: number;
  /** Upper bound on exported cells over all tables. Default 200000. */
  readonly maxCells?: number;
}
export interface CsvOptions {
  /** Format numbers with this locale's decimal separator (no digit grouping). Default: plain `String(n)`. */
  readonly locale?: string;
  /** Prefix a UTF-8 byte order mark so spreadsheet applications detect the encoding. */
  readonly bom?: boolean;
  /** Field delimiter, one character other than quote, CR or LF. Default `,`. */
  readonly delimiter?: string;
  /** Upper bound on the produced string length. Default 5000000. */
  readonly maxLength?: number;
}

const DEFAULT_HEADINGS: DataExportHeadings = Object.freeze({
  label: 'Label', value: 'Value', index: 'Index', stage: 'Stage', comparison: 'Comparison', unit: 'Unit', caption: 'Caption', delta: 'Change (%)',
  min: 'Minimum', max: 'Maximum', used: 'Used', limit: 'Limit', id: 'Id', parent: 'Parent', source: 'Source', target: 'Target', text: 'Text', weight: 'Weight', group: 'Group',
});
const DEFAULT_MAX_TABLES = 256;
const DEFAULT_MAX_CELLS = 200_000;
const DEFAULT_MAX_CSV = 5_000_000;
const MAX_NODES = 20_000;
const MAX_DEPTH = 64;

const failure = <T>(code: string, message: string, path = ''): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, path, message, severity: 'error' } satisfies LyraGenDiagnostic] });
type Bag = Readonly<Record<string, JsonValue>>;
const isBag = (value: unknown): value is Bag => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): readonly JsonValue[] => Array.isArray(value) ? value as readonly JsonValue[] : [];
const cell = (value: unknown): DataExportCell => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;
const text = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const own = (row: Bag, key: string): unknown => { const descriptor = Object.getOwnPropertyDescriptor(row, key); return descriptor && 'value' in descriptor ? descriptor.value : undefined; };

function resolved(node: LyraGenNode, state?: LyraGenSurfaceState): Bag {
  const values: Record<string, JsonValue> = { ...node.props };
  if (!state) return values;
  for (const source of [node.bindings, node.reads]) for (const [key, pointer] of Object.entries(source ?? {})) {
    const value = readPointer(state.values, pointer);
    if (value.ok) values[key] = value.value;
  }
  return values;
}

function build(node: LyraGenNode, props: Bag, h: DataExportHeadings): Pick<DataExportTable, 'columns' | 'rows'> | undefined {
  switch (node.type) {
    case 'table': case 'data-grid': {
      const grid = node.type === 'data-grid';
      const columns = list(props[grid ? 'columns' : 'columns']).filter(isBag);
      const rows = list(props[grid ? 'data' : 'rows']).filter(isBag);
      return { columns: columns.map(column => text(column['label'])), rows: rows.map(row => columns.map(column => cell(own(row, text(column[grid ? 'field' : 'key']))))) };
    }
    case 'chart': case 'series-chart': {
      const labels = list(props['labels']);
      const datasets = list(props['datasets']).filter(isBag);
      return { columns: [h.label, ...datasets.map(dataset => text(dataset['label']))], rows: labels.map((label, index) => [cell(label), ...datasets.map(dataset => cell(list(dataset['data'])[index]))]) };
    }
    case 'heatmap': {
      const data = props['data'];
      if (!isBag(data)) return undefined;
      const columns = list(data['colLabels']);
      const values = list(data['values']);
      return { columns: ['', ...columns.map(text)], rows: list(data['rowLabels']).map((label, row) => [cell(label), ...columns.map((_, column) => cell(list(values[row])[column]))]) };
    }
    case 'funnel': {
      const stages = list(props['stages']).filter(isBag);
      const comparison = list(props['comparison']).filter(isBag);
      const compared = comparison.length > 0;
      return { columns: compared ? [h.stage, h.value, text(props['comparisonLabel']) || h.comparison] : [h.stage, h.value], rows: stages.map((stage, index) => compared ? [cell(stage['label']), cell(stage['value']), cell(comparison[index]?.['value'])] : [cell(stage['label']), cell(stage['value'])]) };
    }
    case 'stat': return { columns: [h.label, h.value, h.unit, h.caption, h.delta], rows: [[cell(props['label']), cell(props['value']), cell(props['unit']), cell(props['caption']), cell(props['deltaPercent'])]] };
    case 'gauge': return { columns: [h.label, h.value, h.min, h.max], rows: [[cell(props['label']), cell(props['value']), cell(props['min']), cell(props['max'])]] };
    case 'budget-meter': return { columns: [h.label, h.used, h.limit, h.unit], rows: [[cell(props['label']), cell(props['used']), cell(props['limit']), cell(props['unit'])]] };
    case 'number-ticker': return { columns: [h.value], rows: [[cell(props['value'])]] };
    case 'sparkline': return { columns: [h.index, h.value], rows: list(props['values']).map((value, index) => [index, cell(value)]) };
    case 'treemap': {
      const rows: DataExportCell[][] = [];
      const visit = (items: readonly JsonValue[], parent: string | null, depth: number): void => {
        if (depth > 4) return;
        for (const item of items) if (isBag(item)) { rows.push([cell(item['id']), cell(item['label']), cell(item['value']), parent]); visit(list(item['children']), text(item['id']), depth + 1); }
      };
      visit(list(props['nodes']), null, 0);
      return { columns: [h.id, h.label, h.value, h.parent], rows };
    }
    case 'sankey': {
      const names = new Map(list(props['nodes']).filter(isBag).map(item => [text(item['id']), text(item['label'])] as const));
      const name = (id: unknown): string => names.get(text(id)) ?? text(id);
      return { columns: [h.source, h.target, h.value], rows: list(props['links']).filter(isBag).map(link => [name(link['source']), name(link['target']), cell(link['value'])]) };
    }
    case 'word-cloud': return { columns: [h.text, h.weight, h.group], rows: list(props['words']).filter(isBag).map(word => [cell(word['text']), cell(word['weight']), cell(word['group'])]) };
    default: return undefined;
  }
}

/**
 * Extract the data of every data-bearing node of a view as named tables, in document order.
 * Local-state bindings and reads resolve against `state` when given; live data and host
 * formatters are never consulted. Needs no DOM.
 */
export function exportViewData(view: LyraGenView, state?: LyraGenSurfaceState, options: DataExportOptions = {}): LyraGenResult<readonly DataExportTable[]> {
  const headings = { ...DEFAULT_HEADINGS, ...options.headings };
  const maxTables = options.maxTables ?? DEFAULT_MAX_TABLES;
  const maxCells = options.maxCells ?? DEFAULT_MAX_CELLS;
  const tables: DataExportTable[] = [];
  let cells = 0;
  let visited = 0;
  const pending: { readonly node: LyraGenNode; readonly depth: number }[] = [{ node: view.root, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++visited > MAX_NODES || depth > MAX_DEPTH) return failure('export.limit', 'The view exceeds the exportable node or depth bounds.', `/nodes/${node.id}`);
    const props = resolved(node, state);
    const built = build(node, props, headings);
    if (built) {
      cells += built.rows.length * built.columns.length;
      if (tables.length >= maxTables || cells > maxCells) return failure('export.limit', 'The view data exceeds the export table or cell bounds.', `/nodes/${node.id}`);
      tables.push({ nodeId: node.id, role: node.type, title: text(props['label']) || text(props['caption']) || text(props['summary']) || node.id, columns: built.columns, rows: built.rows });
    }
    const children = node.children ?? [];
    for (let index = children.length - 1; index >= 0; index--) pending.push({ node: children[index]!, depth: depth + 1 });
  }
  return { ok: true, value: tables, diagnostics: [] };
}

const FORMULA_START = /^[=+\-@\t\r]/u;
/** Neutralize spreadsheet formula injection: such text cells get a leading single quote. */
export function neutralizeCsvFormula(value: string): string { return FORMULA_START.test(value) ? `'${value}` : value; }

/** RFC 4180 CSV (CRLF records) of one exported table, with formula-injection protection on text cells. */
export function toCsv(table: Pick<DataExportTable, 'columns' | 'rows'>, options: CsvOptions = {}): LyraGenResult<string> {
  const delimiter = options.delimiter ?? ',';
  if (delimiter.length !== 1 || /["\r\n]/u.test(delimiter)) return failure('csv.delimiter', 'The delimiter must be one character other than a quote or line break.');
  const maxLength = options.maxLength ?? DEFAULT_MAX_CSV;
  let numbers: Intl.NumberFormat | undefined;
  if (options.locale !== undefined) {
    try { numbers = new Intl.NumberFormat(options.locale, { useGrouping: false, maximumFractionDigits: 20 }); }
    catch { return failure('csv.locale', 'Invalid locale.'); }
  }
  const field = (value: DataExportCell): string => {
    if (value === null) return '';
    const raw = typeof value === 'number' ? (numbers ? numbers.format(value) : String(value)) : typeof value === 'boolean' ? String(value) : neutralizeCsvFormula(value.replace(/\0/gu, ''));
    return raw.includes(delimiter) || /["\r\n]/u.test(raw) ? `"${raw.replace(/"/gu, '""')}"` : raw;
  };
  const lines: string[] = [];
  let length = options.bom ? 1 : 0;
  for (const record of [table.columns, ...table.rows]) {
    const line = record.map(value => field(value)).join(delimiter);
    length += line.length + 2;
    if (length > maxLength) return failure('csv.limit', 'The CSV exceeds the size limit.');
    lines.push(line);
  }
  return { ok: true, value: `${options.bom ? '﻿' : ''}${lines.join('\r\n')}\r\n`, diagnostics: [] };
}

export interface PrintableHtmlOptions {
  readonly title?: string;
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
  /** Required when a rendered snapshot is passed: renders its Lit template to a string (the host's SSR renderer). */
  readonly render?: (template: GenRenderedSnapshot['template']) => string | Promise<string>;
  readonly maxBytes?: number;
}
const ALLOWED_TAGS = new Set(['section', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'small', 'pre', 'form', 'fieldset', 'label', 'input', 'select', 'option', 'button', 'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td']);
const VOID_TAGS = new Set(['input']);
const DROPPED_CONTENT = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'noscript', 'svg', 'math', 'title', 'textarea', 'head']);
const ALLOWED_ATTRIBUTES = /^(?:data-gen-id|data-gen-type|data-surface-id|data-revision|lang|dir|type|name|value|disabled|readonly|checked|selected|required|role|scope|for|id|colspan|rowspan|aria-[a-z]+)$/u;
const escapeText = (value: string): string => value.replace(/&(?!(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);)/giu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const escapeAttribute = (value: string): string => escapeText(value).replace(/"/gu, '&quot;');
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/yu;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
const PRINT_STYLES = '@page{margin:16mm}*{box-sizing:border-box}body{font:11pt/1.4 system-ui,sans-serif;color:#000;background:#fff;margin:0}[data-gen-type=row]{display:flex;flex-wrap:wrap;gap:1rem}section,table,figure{break-inside:avoid}table{border-collapse:collapse;width:100%;margin:.5rem 0}caption{text-align:start;font-weight:600}th,td{border:1px solid #666;padding:.25rem .5rem;text-align:start}input,select,button,pre{font:inherit;max-width:100%}pre{white-space:pre-wrap}';

/** Reduce markup to a closed, inert subset: allowed tags and attributes only, rebuilt from tokens. */
function reduceMarkup(markup: string): string {
  let out = '';
  let index = 0;
  const open: string[] = [];
  let skipping: string | undefined;
  let skipDepth = 0;
  while (index < markup.length) {
    const lt = markup.indexOf('<', index);
    const chunk = lt === -1 ? markup.slice(index) : markup.slice(index, lt);
    if (chunk && !skipping) out += escapeText(chunk);
    if (lt === -1) break;
    index = lt;
    if (markup.startsWith('<!--', index)) { const end = markup.indexOf('-->', index + 4); index = end === -1 ? markup.length : end + 3; continue; }
    TAG.lastIndex = index;
    const match = TAG.exec(markup);
    if (!match) { if (!skipping) out += '&lt;'; index += 1; continue; }
    index = TAG.lastIndex;
    const closing = match[1] === '/';
    const name = match[2]!.toLowerCase();
    if (skipping) {
      if (name === skipping) { if (closing) { if (--skipDepth === 0) skipping = undefined; } else skipDepth++; }
      continue;
    }
    if (DROPPED_CONTENT.has(name)) { if (!closing) { skipping = name; skipDepth = 1; } continue; }
    if (!ALLOWED_TAGS.has(name)) continue;
    if (closing) {
      const position = open.lastIndexOf(name);
      if (position === -1) continue;
      while (open.length > position) out += `</${open.pop()!}>`;
      continue;
    }
    let attributes = '';
    for (const attribute of (match[3] ?? '').matchAll(ATTRIBUTE)) {
      const key = attribute[1]!.toLowerCase();
      if (!ALLOWED_ATTRIBUTES.test(key)) continue;
      const value = attribute[2] ?? attribute[3] ?? attribute[4];
      attributes += value === undefined ? ` ${key}` : ` ${key}="${escapeAttribute(value)}"`;
    }
    out += `<${name}${attributes}>`;
    if (!VOID_TAGS.has(name)) open.push(name);
  }
  while (open.length) out += `</${open.pop()!}>`;
  return out;
}

/**
 * Build a standalone, print-styled HTML document from a static snapshot's server markup so a
 * host can print it to PDF or rasterize it. The output has no scripts, no event handlers, no
 * links and no external references: markup is rebuilt from an allowlist of inert tags and
 * attributes, the restoration payload is dropped, and a `default-src 'none'` policy is embedded.
 * Pass the markup string rendered by the host's Lit SSR renderer, or a rendered snapshot plus
 * `options.render`.
 */
export async function exportPrintableHtml(input: string | GenRenderedSnapshot, options: PrintableHtmlOptions = {}): Promise<LyraGenResult<string>> {
  let markup: string;
  if (typeof input === 'string') markup = input;
  else {
    if (!options.render) return failure('print.render', 'Rendering a snapshot requires a render function.');
    try { markup = await options.render(input.template); }
    catch { return failure('print.render', 'The snapshot could not be rendered.'); }
  }
  if (typeof markup !== 'string') return failure('print.render', 'The renderer must return a string.');
  let locale: string | undefined;
  if (options.locale !== undefined) {
    try { locale = Intl.getCanonicalLocales(options.locale)[0]; } catch { locale = undefined; }
    if (!locale) return failure('print.locale', 'Invalid locale.');
  }
  const direction = options.direction === 'rtl' ? 'rtl' : options.direction === 'ltr' ? 'ltr' : undefined;
  const body = reduceMarkup(markup);
  const document = `<!doctype html>\n<html${locale ? ` lang="${escapeAttribute(locale)}"` : ''}${direction ? ` dir="${direction}"` : ''}><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeText(options.title ?? '')}</title><style>${PRINT_STYLES}</style></head><body>${body}</body></html>\n`;
  if (new TextEncoder().encode(document).byteLength > (options.maxBytes ?? 10_000_000)) return failure('print.limit', 'The document exceeds the size limit.');
  return { ok: true, value: document, diagnostics: [] };
}
