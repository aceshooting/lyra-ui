import type { JsonValue, LyraGenComponent, LyraGenNode, LyraGenSchema } from '../types.js';
import { array, boolean, choice, documentation, label, number, object, string, variant } from './shared.js';

/**
 * Extra chart vocabulary for dashboards: share-of-total, radial, radar, horizontal and ranked bars,
 * bubbles, segmented category bars, status trackers and chord flows. Every role renders from plain
 * bounded JSON; colours come from a closed set of theme tokens, and formatters, plugins, raw chart
 * configuration and activation callbacks stay host-owned.
 */
const example = (id: string, type: string, props: Record<string, unknown>): LyraGenNode => ({ id, type, props } as LyraGenNode);
const identity: LyraGenSchema = { type: 'string', minLength: 1, maxLength: 128 };
const quantity: LyraGenSchema = { type: 'number', minimum: 0, maximum: 1e12 };
const nullableNumber: LyraGenSchema = { anyOf: [number, { type: 'null' }] };
const minItems = (schema: LyraGenSchema, minimum: number): LyraGenSchema => ({ ...schema, minItems: minimum } as LyraGenSchema);
const chartText = { label, description: string(1024), withDataTable: boolean, dataTableToggle: boolean } as const;
const categories = (maxItems: number): LyraGenSchema => minItems(array(string(256), maxItems), 1);
const series = (maxPoints: number, extra: Readonly<Record<string, LyraGenSchema>> = {}): LyraGenSchema => object({ label, data: array(nullableNumber, maxPoints), ...extra }, ['label', 'data']);
const loadDoughnut = () => import('@aceshooting/lyra-ui/components/lr-doughnut-chart.js');
const loadPolarArea = () => import('@aceshooting/lyra-ui/components/lr-polar-area-chart.js');
const loadRadar = () => import('@aceshooting/lyra-ui/components/lr-radar-chart.js');
const loadBar = () => import('@aceshooting/lyra-ui/components/lr-bar-chart.js');
const loadBubble = () => import('@aceshooting/lyra-ui/components/lr-bubble-chart.js');
const loadBarList = () => import('@aceshooting/lyra-ui/components/lr-bar-list.js');
const loadRadialBar = () => import('@aceshooting/lyra-ui/components/lr-radial-bar.js');
const loadCategoryBar = () => import('@aceshooting/lyra-ui/components/lr-category-bar.js');
const loadSequenceStrip = () => import('@aceshooting/lyra-ui/components/lr-sequence-strip.js');
const loadChord = () => import('@aceshooting/lyra-ui/components/lr-chord.js');

/** Theme colour tokens a tracker category may use; raw colours and paint servers are not generated. */
const trackerColors: readonly string[] = Object.freeze(['brand', 'success', 'warning', 'danger', 'neutral'].flatMap(tone => [`var(--lr-color-${tone})`, `var(--lr-color-${tone}-quiet)`]));

const radialProperties = (maxSeries: number): Readonly<Record<string, LyraGenSchema>> => ({
  ...chartText,
  labels: categories(50),
  datasets: minItems(array(series(50), maxSeries), 1),
  withoutLegend: boolean,
  legendDisplay: choice('auto', 'label', 'value', 'percentage', 'value-percentage'),
});
const barProperties: Readonly<Record<string, LyraGenSchema>> = {
  ...chartText,
  labels: categories(100),
  datasets: minItems(array(series(100, { stack: string(64) }), 8), 1),
  stacked: boolean,
  xLabel: string(256),
  yLabel: string(256),
  min: number,
  max: number,
  scaleType: choice('linear', 'logarithmic'),
  withoutLegend: boolean,
};
const barListItem = object({ label: string(256), value: number, variant }, ['label', 'value']);
const radialBarSegment = object({ label: string(256), value: number, max: quantity, variant }, ['label', 'value']);

const horizontal = (props: Readonly<Record<string, JsonValue>>): Readonly<Record<string, unknown>> => ({ ...props, indexAxis: 'y' });

const bubblePoint = object({ x: number, y: number, r: { type: 'number', minimum: 0, maximum: 100 }, label: string(256) }, ['x', 'y', 'r']);
const trackerCategory = object({ id: identity, color: choice(...trackerColors), label }, ['id', 'color']);
const trackerItem = object({ id: identity, categoryId: identity, label: string(256), marker: boolean }, ['id', 'categoryId']);
const chordEntity = object({ id: identity, label }, ['id', 'label']);

/** Reviewed chart roles to add to a dashboard catalog (for example `...chartExtraRoles` in its components). */
export const chartExtraRoles: Readonly<Record<string, LyraGenComponent>> = Object.freeze({
  'donut-chart': {
    tag: 'lr-doughnut-chart',
    properties: radialProperties(4),
    required: ['label', 'labels', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show how one total splits into at most 50 named parts as a ring; prefer bar-list when parts are many or close in size.',
    examples: [example('channels', 'donut-chart', { label: 'Revenue by channel', labels: ['Online', 'Retail', 'Partners'], datasets: [{ label: 'Revenue', data: [540, 320, 140] }], legendDisplay: 'percentage' })],
    load: loadDoughnut,
    documentation: documentation('lr-doughnut-chart'),
  },
  'radial-chart': {
    tag: 'lr-polar-area-chart',
    properties: radialProperties(1),
    required: ['label', 'labels', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Compare the magnitude of at most 50 categories radially, each wedge sized by its value from a shared centre (polar area).',
    examples: [example('tickets', 'radial-chart', { label: 'Tickets by weekday', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], datasets: [{ label: 'Tickets', data: [42, 35, 28, 31, 22] }] })],
    load: loadPolarArea,
    documentation: documentation('lr-polar-area-chart'),
  },
  'radial-bar': {
    tag: 'lr-radial-bar',
    properties: { label, segments: minItems(array(radialBarSegment, 10), 1), withLegend: boolean, max: quantity },
    required: ['label', 'segments'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '12rem',
    useWhen: 'Show progress of up to 10 categories as concentric rings, each ring a share of a full circle (max, per segment or shared); not for parts of one total, use donut-chart.',
    examples: [example('goals', 'radial-bar', { label: 'Quarterly goals', max: 100, withLegend: true, segments: [{ label: 'Revenue', value: 82, variant: 'success' }, { label: 'Signups', value: 64 }, { label: 'Churn target', value: 35, variant: 'warning' }] })],
    load: loadRadialBar,
    documentation: documentation('lr-radial-bar'),
  },
  'radar-chart': {
    tag: 'lr-radar-chart',
    properties: { ...chartText, labels: categories(20), datasets: minItems(array(series(20, { fill: boolean }), 8), 1), min: number, max: number, withoutLegend: boolean },
    required: ['label', 'labels', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Compare up to 8 profiles across 3 to 20 shared dimensions on one radial grid, such as scores per capability.',
    examples: [example('readiness', 'radar-chart', { label: 'Service readiness', labels: ['Latency', 'Uptime', 'Security', 'Cost', 'Support'], datasets: [{ label: 'Plan A', data: [4, 5, 3, 2, 4], fill: true }, { label: 'Plan B', data: [3, 4, 5, 4, 3] }], min: 0, max: 5 })],
    load: loadRadar,
    documentation: documentation('lr-radar-chart'),
  },
  'horizontal-bar': {
    tag: 'lr-bar-chart',
    properties: barProperties,
    required: ['label', 'labels', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    hostProperties: ['indexAxis'],
    prepareProperties: horizontal,
    minimumBlockSize: '14rem',
    useWhen: 'Compare up to 8 series across at most 100 categories with long names as horizontal bars, optionally stacked.',
    examples: [example('latency', 'horizontal-bar', { label: 'p95 latency by endpoint', labels: ['/search', '/checkout', '/profile'], datasets: [{ label: 'p95 (ms)', data: [420, 310, 120] }], xLabel: 'Milliseconds' })],
    load: loadBar,
    documentation: documentation('lr-bar-chart'),
  },
  'bar-list': {
    tag: 'lr-bar-list',
    properties: { label, items: minItems(array(barListItem, 50), 1), max: quantity, sort: choice('descending', 'ascending', 'none') },
    required: ['label', 'items'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '8rem',
    useWhen: 'Rank at most 50 named items by one value as a compact list of horizontal bars; sort defaults to largest first and max fixes a shared scale.',
    examples: [example('pages', 'bar-list', { label: 'Top pages by visits', items: [{ label: '/home', value: 1840 }, { label: '/pricing', value: 920, variant: 'brand' }, { label: '/docs', value: 610 }], sort: 'descending' })],
    load: loadBarList,
    documentation: documentation('lr-bar-list'),
  },
  'bubble-chart': {
    tag: 'lr-bubble-chart',
    properties: { ...chartText, datasets: minItems(array(object({ label, points: minItems(array(bubblePoint, 500), 1) }, ['label', 'points']), 8), 1), xLabel: string(256), yLabel: string(256), withoutLegend: boolean },
    required: ['label', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show up to 8 groups of points over two numeric axes where a third value sets each bubble radius (0 to 100 pixels).',
    examples: [example('deals', 'bubble-chart', { label: 'Deals by size and age', xLabel: 'Age (days)', yLabel: 'Value (k)', datasets: [{ label: 'Open deals', points: [{ x: 12, y: 40, r: 8, label: 'Acme' }, { x: 30, y: 85, r: 14, label: 'Globex' }] }] })],
    load: loadBubble,
    documentation: documentation('lr-bubble-chart'),
  },
  'category-bar': {
    tag: 'lr-category-bar',
    properties: { label, values: minItems(array(quantity, 12), 1), variants: array(variant, 12), marker: quantity, withLabels: boolean },
    required: ['label', 'values'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show consecutive ranges of one scale (for example score bands) as a segmented bar, each range as wide as its value, with an optional marker pointing at a value on that scale.',
    examples: [example('bands', 'category-bar', { label: 'Risk score bands', values: [40, 30, 30], variants: ['success', 'warning', 'danger'], marker: 62, withLabels: true })],
    load: loadCategoryBar,
    documentation: documentation('lr-category-bar'),
  },
  tracker: {
    tag: 'lr-sequence-strip',
    properties: { label, categories: minItems(array(trackerCategory, 12), 1), items: minItems(array(trackerItem, 200), 1), withLegend: boolean, markerLabel: string(256) },
    required: ['label', 'categories', 'items'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show the status of up to 200 consecutive periods or checks as a strip of coloured cells, such as daily uptime; each category picks a theme colour token.',
    examples: [example('uptime', 'tracker', { label: 'Daily uptime', categories: [{ id: 'up', color: 'var(--lr-color-success)', label: 'Operational' }, { id: 'down', color: 'var(--lr-color-danger)', label: 'Outage' }], items: [{ id: 'd1', categoryId: 'up', label: 'Nov 20' }, { id: 'd2', categoryId: 'down', label: 'Nov 21' }, { id: 'd3', categoryId: 'up', label: 'Nov 22' }], withLegend: true })],
    load: loadSequenceStrip,
    documentation: documentation('lr-sequence-strip'),
  },
  chord: {
    tag: 'lr-chord',
    properties: { ...chartText, entities: minItems(array(chordEntity, 32), 2), matrix: minItems(array(array(quantity, 32), 32), 2) },
    required: ['label', 'entities', 'matrix'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '16rem',
    useWhen: 'Show two-way flows between 2 to 32 named groups; matrix is square and symmetric, one row per entity in order.',
    examples: [example('transfers', 'chord', { label: 'Transfers between teams', entities: [{ id: 'eng', label: 'Engineering' }, { id: 'ops', label: 'Operations' }, { id: 'sales', label: 'Sales' }], matrix: [[0, 5, 2], [5, 0, 3], [2, 3, 0]] })],
    load: loadChord,
    documentation: documentation('lr-chord'),
  },
} satisfies Record<string, LyraGenComponent>);
