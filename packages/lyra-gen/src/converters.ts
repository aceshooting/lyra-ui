import type { JsonObject, JsonPrimitive, JsonValue, LyraGenResult, LyraGenSchema, LyraGenView } from './types.js';
import { initialCatalog } from './catalog.js';
import { array, boolean, choice, label, number, object, string } from './catalogs/shared.js';
import { snapshotJson, validateSchema } from './schema.js';
import { validateView } from './runtime.js';

export type LyraGenColumnType = 'string' | 'number' | 'boolean';
export interface LyraGenTableColumn {
  readonly key: string;
  readonly label: string;
  readonly type: LyraGenColumnType;
  readonly nullable?: boolean;
}
export interface LyraGenStructuredTable {
  readonly caption: string;
  readonly columns: readonly LyraGenTableColumn[];
  readonly rows: readonly Readonly<Record<string, JsonPrimitive>>[];
}
export interface LyraGenStructuredChart {
  readonly label: string;
  readonly type: 'bar' | 'line';
  readonly labels: readonly string[];
  readonly series: readonly { readonly label: string; readonly values: readonly (number | null)[] }[];
}
export interface LyraGenConversionOptions {
  readonly surfaceId?: string;
  readonly nodeId?: string;
  readonly revision?: number;
}
/** Column metadata is portable data beside the rendered view, never a component property. */
export interface LyraGenTableArtifact {
  readonly kind: 'lyra-gen-table';
  readonly columns: readonly LyraGenTableColumn[];
  readonly view: LyraGenView;
}

const columnSchema = object({ key: { type: 'string', minLength: 1, maxLength: 128 }, label, type: choice('string', 'number', 'boolean'), nullable: boolean }, ['key', 'label', 'type']);
const chartSchema = object({ label, type: choice('bar', 'line'), labels: array(string(256), 200), series: { type: 'array', minItems: 1, maxItems: 8, items: object({ label, values: array({ anyOf: [number, { type: 'null' }] }, 200) }, ['label', 'values']) } }, ['label', 'type', 'labels', 'series']);

function fail<T>(code: string, path: string, message: string): LyraGenResult<T> { return { ok: false, diagnostics: [{ code, path, message, severity: 'error' }] }; }
function pass<T>(value: T): LyraGenResult<T> { return { ok: true, value, diagnostics: [] }; }
function record(value: JsonValue | undefined): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function columns(input: unknown): LyraGenResult<readonly LyraGenTableColumn[]> {
  const parsed = validateSchema(input, { type: 'array', items: columnSchema, minItems: 1, maxItems: 16 });
  if (!parsed.ok) return parsed;
  const result = parsed.value as unknown as readonly LyraGenTableColumn[];
  if (new Set(result.map(column => column.key)).size !== result.length) return fail('convert.columns', '/columns', 'Column keys must be unique.');
  for (const column of result) if (['__proto__', 'constructor', 'prototype'].includes(column.key)) return fail('convert.columns', '/columns', 'Prototype-related column keys are not permitted.');
  return pass(result);
}

function envelope(options: LyraGenConversionOptions, root: LyraGenView['root']): LyraGenResult<LyraGenView> {
  const parsed = validateSchema(options, object({ surfaceId: { type: 'string', minLength: 1, maxLength: 128 }, nodeId: { type: 'string', minLength: 1, maxLength: 128 }, revision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } }));
  if (!parsed.ok) return parsed;
  return validateView({ version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: (parsed.value as JsonObject)['surfaceId'] as string ?? 'converted', revision: (parsed.value as JsonObject)['revision'] as number ?? 0, root: { ...root, id: (parsed.value as JsonObject)['nodeId'] as string ?? root.id } }, initialCatalog);
}

/** Preserve typed values and nulls; unsupported data is refused instead of stringified. */
export function tableToView(input: unknown, options: LyraGenConversionOptions = {}): LyraGenResult<LyraGenTableArtifact> {
  const parsed = snapshotJson(input);
  if (!parsed.ok) return parsed;
  if (!record(parsed.value)) return fail('convert.table', '', 'Expected a structured table.');
  const table = parsed.value;
  const selected = columns(table['columns']);
  if (!selected.ok) return selected;
  const rowProperties = Object.fromEntries(selected.value.map(column => {
    const valueSchema: LyraGenSchema = column.type === 'string' ? string() : column.type === 'number' ? number : boolean;
    return [column.key, column.nullable ? { anyOf: [valueSchema, { type: 'null' }] } as LyraGenSchema : valueSchema];
  }));
  const validated = validateSchema(table, { type: 'object', additionalProperties: false, required: ['caption', 'columns', 'rows'], properties: { caption: label, columns: { type: 'array', items: columnSchema, minItems: 1, maxItems: 16 }, rows: array(object(rowProperties, selected.value.map(column => column.key)), 200) } } as LyraGenSchema);
  if (!validated.ok) return validated;
  const typed = validated.value as unknown as LyraGenStructuredTable;
  const view = envelope(options, { id: 'table', type: 'table', props: {
    caption: typed.caption,
    columns: typed.columns.map((column, index) => ({ key: `c${index}`, label: column.label })),
    rows: typed.rows.map(row => Object.fromEntries(typed.columns.map((column, index) => [`c${index}`, row[column.key]!] ))),
  } });
  if (!view.ok) return view;
  return pass({ kind: 'lyra-gen-table', columns: selected.value, view: view.value });
}

/** Read a converter artifact without guessing types from formatted display strings. */
export function viewToTable(input: unknown): LyraGenResult<LyraGenStructuredTable> {
  const parsed = snapshotJson(input);
  if (!parsed.ok) return parsed;
  if (!record(parsed.value) || parsed.value['kind'] !== 'lyra-gen-table' || !record(parsed.value['view'])) return fail('convert.artifact', '', 'Expected a table conversion artifact.');
  const artifact = parsed.value;
  const selected = columns(artifact['columns']);
  if (!selected.ok) return selected;
  const extracted = extractRoot(artifact['view'], 'table');
  if (!extracted.ok) return extracted;
  const props = extracted.value;
  const component = initialCatalog.components['table']!;
  const checked = validateSchema(props, object(component.properties, component.required));
  if (!checked.ok) return checked;
  const mapped = props['columns'] as readonly JsonObject[];
  if (mapped.length !== selected.value.length || mapped.some((column, index) => column['key'] !== `c${index}` || column['label'] !== selected.value[index]!.label)) return fail('convert.columns', '/view/root/props/columns', 'Rendered columns do not match preserved column metadata.');
  const rows = props['rows'] as readonly JsonObject[];
  const expectedKeys = selected.value.map((_, index) => `c${index}`);
  if (rows.some(row => Object.keys(row).length !== expectedKeys.length || expectedKeys.some(key => !Object.hasOwn(row, key)))) return fail('convert.rows', '/view/root/props/rows', 'Each row must have exactly one cell for every column.');
  const restored = {
    caption: props['caption'],
    columns: selected.value,
    rows: rows.map(row => Object.fromEntries(selected.value.map((column, index) => [column.key, row[`c${index}`]!] ))),
  };
  const verified = tableToView(restored);
  if (!verified.ok) return verified;
  return pass(restored as unknown as LyraGenStructuredTable);
}

function extractRoot(input: JsonValue | undefined, role: string): LyraGenResult<JsonObject> {
  const checked = validateView(input, initialCatalog);
  if (!checked.ok) return checked;
  if (!record(input) || input['version'] !== '1' || !record(input['catalog']) || input['catalog']['id'] !== initialCatalog.id || input['catalog']['version'] !== initialCatalog.version || !record(input['root']) || input['root']['type'] !== role || !record(input['root']['props'])) return fail('convert.view', '/view', 'Expected a view from the reviewed catalog with the requested root role.');
  return pass(input['root']['props']);
}

export function chartToView(input: unknown, options: LyraGenConversionOptions = {}): LyraGenResult<LyraGenView> {
  const parsed = validateSchema(input, chartSchema);
  if (!parsed.ok) return parsed;
  const chart = parsed.value as unknown as LyraGenStructuredChart;
  if (chart.series.some(series => series.values.length !== chart.labels.length)) return fail('convert.chart-length', '/series', 'Every series must contain one value or null for each label.');
  return envelope(options, { id: 'chart', type: 'chart', props: { label: chart.label, type: chart.type, labels: chart.labels, datasets: chart.series.map(series => ({ label: series.label, data: series.values })), withDataTable: true } });
}

export function viewToChart(input: unknown): LyraGenResult<LyraGenStructuredChart> {
  const parsed = snapshotJson(input);
  if (!parsed.ok) return parsed;
  const extracted = extractRoot(parsed.value, 'chart');
  if (!extracted.ok) return extracted;
  const props = extracted.value;
  const component = initialCatalog.components['chart']!;
  const checked = validateSchema(props, object(component.properties, component.required));
  if (!checked.ok) return checked;
  const value = { label: props['label'], type: props['type'] ?? 'bar', labels: props['labels'], series: (props['datasets'] as readonly JsonObject[]).map(series => ({ label: series['label'], values: series['data'] })) };
  const verified = chartToView(value);
  if (!verified.ok) return verified;
  return pass(value as unknown as LyraGenStructuredChart);
}
