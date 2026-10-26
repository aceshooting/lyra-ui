import type { JsonObject, JsonValue, LyraGenComponent, LyraGenSchema } from '../types.js';
import { formatTableValue, type TableValueFormat } from './formatting.js';
import { array, boolean, choice, count, documentation, label, number, object, scalar, string } from './shared.js';

/** Canonical field names keep table rows closed while converters preserve caller column keys. */
const tableFields = Object.freeze(Array.from({ length: 16 }, (_, i) => `c${i}`));
const tableRow = object(Object.fromEntries(tableFields.map(key => [key, scalar])));
const format: LyraGenSchema = { anyOf: [
  object({ kind: choice('number'), maximumFractionDigits: count(20) }, ['kind']),
  object({ kind: choice('date', 'datetime'), timeZone: choice('UTC') }, ['kind', 'timeZone']),
] };
const column = object({ key: choice(...tableFields), label, sortable: boolean, format }, ['key', 'label']);
const nullableNumber: LyraGenSchema = { anyOf: [number, { type: 'null' }] };

function tableProperties(props: Readonly<Record<string, JsonValue>>, context?: { readonly locale: string }): Readonly<Record<string, unknown>> {
  const columns = props['columns'];
  if (!Array.isArray(columns)) throw new TypeError('Validated table columns are required.');
  return { ...props, columns: columns.map(value => {
    const column = value as JsonObject;
    const key = column['key'] as string;
    const { format, ...properties } = column;
    if (format && !context) throw new TypeError('Formatted columns require a host locale.');
    return { ...properties, cell: (row: unknown): string => {
      if (row === null || typeof row !== 'object') return '';
      const descriptor = Object.getOwnPropertyDescriptor(row, key);
      const cell: unknown = descriptor && 'value' in descriptor ? descriptor.value : null;
      return formatTableValue(cell as JsonValue, format as TableValueFormat | undefined, context?.locale ?? 'und');
    } };
  }) };
}

export const dataComponents: Readonly<Record<string, LyraGenComponent>> = {
  table: { tag: 'lr-table', prepareProperties: tableProperties, properties: { caption: label, columns: { ...array(column, 16), minItems: 1 } as LyraGenSchema, rows: array(tableRow, 200), loading: boolean, error: boolean, pageSize: count(100, 1), maxRows: count(200, 1) }, required: ['caption', 'columns', 'rows'], accessibleName: { required: true, properties: ['caption'] }, minimumBlockSize: '12rem', useWhen: 'Compare typed records in labelled columns; at most 16 columns and 200 rows.', load: () => import('@aceshooting/lyra-ui/components/lr-table.js'), documentation: documentation('lr-table') },
  chart: { tag: 'lr-lite-chart', properties: { label, description: string(1024), type: { ...choice('bar', 'line'), default: 'bar' }, labels: array(string(256), 200), datasets: array(object({ label, data: array(nullableNumber, 200) }, ['label', 'data']), 8), withLegend: boolean, withDataTable: boolean, dataTableToggle: boolean, xLabel: string(256), yLabel: string(256), maxRecords: count(200, 1) }, required: ['label', 'labels', 'datasets'], accessibleName: { required: true, properties: ['label'] }, minimumBlockSize: '12rem', useWhen: 'Show up to 8 numeric series over at most 200 categories. Null denotes a missing observation.', load: () => import('@aceshooting/lyra-ui/components/lr-lite-chart.js'), documentation: documentation('lr-lite-chart') },
};
