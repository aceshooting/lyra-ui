import type { LyraGenCatalog, LyraGenComponent, LyraGenNode, LyraGenSchema } from '../types.js';
import { array, boolean, choice, count, documentation, frame, label, number, object, scalar, size, string, variant } from './shared.js';
import { answerRoles } from './answers.js';
import { chartExtraRoles } from './charts-extra.js';
import { technicalAnswerRoles } from './answers-technical.js';
import { richAnswerRoles } from './answers-rich.js';

/** Overlay roles for live dashboards. Every role renders from plain bounded JSON; formatters and callbacks stay host-owned. */
const example = (id: string, type: string, props: Record<string, unknown>): LyraGenNode => ({ id, type, props } as LyraGenNode);
const threshold = object({ at: number, variant }, ['at', 'variant']);
const funnelStage = object({ label, value: number }, ['label', 'value']);
const progress = (tag: 'lr-progress-bar' | 'lr-progress-ring', useWhen: string, sample: Record<string, unknown>): LyraGenComponent => ({
  tag,
  properties: { label, value: number, max: number, indeterminate: boolean, withValue: boolean, variant, size },
  required: ['label'],
  accessibleName: { required: true, properties: ['label'] },
  useWhen,
  examples: [example('progress', tag.slice(3), sample)],
  load: tag === 'lr-progress-bar' ? () => import('@aceshooting/lyra-ui/components/lr-progress-bar.js') : () => import('@aceshooting/lyra-ui/components/lr-progress-ring.js'),
  documentation: documentation(tag),
});

const tierOne: Readonly<Record<string, LyraGenComponent>> = {
  gauge: {
    tag: 'lr-gauge',
    properties: { label, value: number, min: number, max: number, valueText: string(64), shape: choice('radial', 'ring', 'linear'), variant, size, withoutValue: boolean, thresholds: array(threshold, 8) },
    required: ['label', 'value'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '8rem',
    useWhen: 'Show one measured value against a known range, optionally coloured by up to 8 thresholds.',
    examples: [example('utilisation', 'gauge', { label: 'CPU utilisation', value: 72, min: 0, max: 100, valueText: '72%', thresholds: [{ at: 0, variant: 'success' }, { at: 80, variant: 'danger' }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-gauge.js'),
    documentation: documentation('lr-gauge'),
  },
  sparkline: {
    tag: 'lr-sparkline',
    properties: { label, values: { ...array(number, 500), minItems: 1 } as LyraGenSchema, mark: choice('line', 'bar'), curve: choice('linear', 'natural', 'step'), appearance: choice('gradient', 'line', 'solid'), trend: choice('positive', 'negative', 'neutral'), min: number, max: number },
    required: ['label', 'values'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show the shape of one short numeric trend (at most 500 points) inline beside a metric.',
    examples: [example('requests', 'sparkline', { label: 'Requests over the last hour', values: [12, 18, 15, 22, 30, 27], trend: 'positive' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-sparkline.js'),
    documentation: documentation('lr-sparkline'),
  },
  'progress-bar': progress('lr-progress-bar', 'Show completion of one bounded task as a horizontal bar.', { label: 'Import progress', value: 40, max: 100, withValue: true }),
  'progress-ring': progress('lr-progress-ring', 'Show completion of one bounded task compactly as a ring.', { label: 'Sync progress', value: 3, max: 4 }),
  'budget-meter': {
    tag: 'lr-budget-meter',
    properties: { label, used: number, limit: number, unit: string(64), frame, size },
    required: ['label', 'used', 'limit'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show consumption of a quota or budget against its limit.',
    examples: [example('quota', 'budget-meter', { label: 'Monthly storage', used: 42, limit: 100, unit: 'GB' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-budget-meter.js'),
    documentation: documentation('lr-budget-meter'),
  },
  'number-ticker': {
    tag: 'lr-number-ticker',
    properties: { value: number, startValue: number, type: choice('decimal', 'currency', 'percent'), currency: { type: 'string', minLength: 3, maxLength: 3 }, currencyDisplay: choice('symbol', 'narrowSymbol', 'code', 'name'), minimumFractionDigits: count(20), maximumFractionDigits: count(20), withoutGrouping: boolean, duration: count(10000) },
    required: ['value'],
    useWhen: 'Show one headline number that counts to its new value; motion stops under reduced motion.',
    examples: [example('revenue', 'number-ticker', { value: 1250000, type: 'currency', currency: 'EUR' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-number-ticker.js'),
    documentation: documentation('lr-number-ticker'),
  },
  funnel: {
    tag: 'lr-funnel',
    properties: { label, stages: { ...array(funnelStage, 12), minItems: 1 } as LyraGenSchema, comparison: array(funnelStage, 12), comparisonLabel: string(256), withoutDropoff: boolean, sharePrecision: count(3) },
    required: ['label', 'stages'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '10rem',
    useWhen: 'Show how a count narrows across up to 12 ordered stages, optionally against a comparison period.',
    examples: [example('signup', 'funnel', { label: 'Sign-up funnel', stages: [{ label: 'Visited', value: 1000 }, { label: 'Started', value: 420 }, { label: 'Completed', value: 180 }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-funnel.js'),
    documentation: documentation('lr-funnel'),
  },
  'poll-status': {
    tag: 'lr-poll-status',
    properties: { active: boolean, paused: boolean, nextInMs: count(86_400_000) },
    useWhen: 'Show whether a panel is refreshing automatically and when its next refresh is due.',
    examples: [example('freshness', 'poll-status', { active: true, nextInMs: 30000 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-poll-status.js'),
    documentation: documentation('lr-poll-status'),
  },
};

const nullableNumber: LyraGenSchema = { anyOf: [number, { type: 'null' }] };
const identity = string(128);
const treemapLeaf = object({ id: identity, label, value: number }, ['id', 'label', 'value']);
const treemapBranch = object({ id: identity, label, value: number, children: array(treemapLeaf, 50) }, ['id', 'label']);
const treemapRoot = object({ id: identity, label, value: number, children: array(treemapBranch, 20) }, ['id', 'label']);
const series = object({ label, data: array(nullableNumber, 200), fill: boolean, axis: choice('y', 'y2'), stack: string(64) }, ['label', 'data']);
const loadChart = () => import('@aceshooting/lyra-ui/components/lr-chart.js');

/** Structure and richer charts. Nesting is explicit: tabs and panels only inside `tabs`, items only inside `timeline`. */
const tierTwo: Readonly<Record<string, LyraGenComponent>> = {
  tabs: {
    tag: 'lr-tab-group',
    properties: { label, placement: choice('top', 'bottom', 'start', 'end'), activation: choice('auto', 'manual') },
    required: ['label'],
    accessibleName: { required: true, properties: ['label'] },
    children: ['tab', 'tab-panel'],
    slots: ['', 'nav'],
    useWhen: 'Split related dashboard sections into named tabs; each tab (slot "nav") names the panel it shows.',
    examples: [{ id: 'sections', type: 'tabs', props: { label: 'Report sections' }, children: [
      { id: 'overview-tab', type: 'tab', slot: 'nav', props: { panel: 'overview' }, text: 'Overview' },
      { id: 'overview-panel', type: 'tab-panel', props: { name: 'overview' }, children: [{ id: 'overview-text', type: 'text', text: 'All systems nominal.' }] },
    ] }],
    load: () => import('@aceshooting/lyra-ui/components/lr-tab-group.js'),
    documentation: documentation('lr-tab-group'),
  },
  tab: {
    tag: 'lr-tab',
    properties: { panel: identity, disabled: boolean },
    required: ['panel'],
    text: true,
    accessibleName: { required: true, text: true },
    useWhen: 'Name one tab inside tabs; place it in slot "nav" and point panel at a tab-panel name.',
    examples: [{ id: 'usage-tab', type: 'tab', props: { panel: 'usage' }, text: 'Usage' }],
    load: () => import('@aceshooting/lyra-ui/components/lr-tab.js'),
    documentation: documentation('lr-tab'),
  },
  'tab-panel': {
    tag: 'lr-tab-panel',
    properties: { name: identity },
    required: ['name'],
    children: true,
    useWhen: 'Hold the content of one tab inside tabs; name matches its tab panel.',
    examples: [{ id: 'usage-panel', type: 'tab-panel', props: { name: 'usage' } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-tab-panel.js'),
    documentation: documentation('lr-tab-panel'),
  },
  details: {
    tag: 'lr-details',
    properties: { summary: label, open: boolean },
    required: ['summary'],
    accessibleName: { required: true, properties: ['summary'] },
    children: true,
    useWhen: 'Keep secondary detail collapsible under a short summary.',
    examples: [{ id: 'method', type: 'details', props: { summary: 'How this is calculated' }, children: [{ id: 'method-text', type: 'text', text: 'Averages over the last 30 days.' }] }],
    load: () => import('@aceshooting/lyra-ui/components/lr-details.js'),
    documentation: documentation('lr-details'),
  },
  timeline: {
    tag: 'lr-timeline',
    properties: { label, orientation: choice('horizontal', 'vertical', 'auto'), ordered: boolean, markerPlacement: choice('start', 'end', 'alternate') },
    required: ['label'],
    accessibleName: { required: true, properties: ['label'] },
    children: ['timeline-item'],
    useWhen: 'Show at most a few dozen dated events in order, such as an incident history.',
    examples: [{ id: 'incident', type: 'timeline', props: { label: 'Incident timeline', ordered: true }, children: [{ id: 'detected', type: 'timeline-item', props: { timestamp: '2026-11-20T08:00:00Z', variant: 'danger' }, text: 'Errors detected' }] }],
    load: () => import('@aceshooting/lyra-ui/components/lr-timeline.js'),
    documentation: documentation('lr-timeline'),
  },
  'timeline-item': {
    tag: 'lr-timeline-item',
    properties: { timestamp: string(64), variant, active: boolean },
    text: true,
    accessibleName: { required: true, text: true },
    useWhen: 'One event inside a timeline; timestamp is an ISO 8601 date or date-time.',
    examples: [{ id: 'resolved', type: 'timeline-item', props: { timestamp: '2026-11-20T09:30:00Z', variant: 'success' }, text: 'Service restored' }],
    load: () => import('@aceshooting/lyra-ui/components/lr-timeline-item.js'),
    documentation: documentation('lr-timeline-item'),
  },
  'series-chart': {
    tag: 'lr-chart',
    properties: { label, description: string(1024), type: { ...choice('line', 'bar', 'pie', 'doughnut', 'radar', 'polarArea'), default: 'bar' }, labels: array(string(256), 200), datasets: { ...array(series, 8), minItems: 1 } as LyraGenSchema, stacked: boolean, area: boolean, indexAxis: choice('x', 'y'), scaleType: choice('linear', 'logarithmic'), xLabel: string(256), yLabel: string(256), y2Label: string(256), min: number, max: number, withDataTable: boolean, dataTableToggle: boolean, withoutLegend: boolean, grid: choice('x', 'y', 'both', 'none') },
    required: ['label', 'labels', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show up to 8 series over at most 200 categories when chart needs more: area, stacked, horizontal, pie, radar or a second axis.',
    examples: [{ id: 'traffic', type: 'series-chart', props: { label: 'Traffic by channel', type: 'bar', stacked: true, labels: ['Mon', 'Tue'], datasets: [{ label: 'Search', data: [40, 52] }, { label: 'Direct', data: [22, 18] }] } }],
    load: loadChart,
    documentation: documentation('lr-chart'),
  },
  treemap: {
    tag: 'lr-treemap',
    properties: { label, description: string(1024), nodes: { ...array(treemapRoot, 50), minItems: 1 } as LyraGenSchema, withDataTable: boolean, dataTableToggle: boolean },
    required: ['label', 'nodes'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show how a total splits into nested parts, at most three levels deep.',
    examples: [{ id: 'spend', type: 'treemap', props: { label: 'Cloud spend by service', nodes: [{ id: 'compute', label: 'Compute', value: 620 }, { id: 'storage', label: 'Storage', value: 240 }] } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-treemap.js'),
    documentation: documentation('lr-treemap'),
  },
  sankey: {
    tag: 'lr-sankey',
    properties: { label, description: string(1024), nodes: { ...array(object({ id: identity, label }, ['id', 'label']), 50), minItems: 2 } as LyraGenSchema, links: { ...array(object({ source: identity, target: identity, value: number, label: string(256) }, ['source', 'target', 'value']), 200), minItems: 1 } as LyraGenSchema, withDataTable: boolean, dataTableToggle: boolean },
    required: ['label', 'nodes', 'links'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show weighted flows between up to 50 named stages, such as traffic sources to outcomes.',
    examples: [{ id: 'flows', type: 'sankey', props: { label: 'Visitor flow', nodes: [{ id: 'search', label: 'Search' }, { id: 'signup', label: 'Sign-up' }], links: [{ source: 'search', target: 'signup', value: 120 }] } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-sankey.js'),
    documentation: documentation('lr-sankey'),
  },
  'word-cloud': {
    tag: 'lr-word-cloud',
    properties: { words: { ...array(object({ text: string(64), weight: number, group: string(64) }, ['text', 'weight']), 200), minItems: 1 } as LyraGenSchema, scale: choice('linear', 'sqrt'), wordRotation: choice('none', 'mixed'), withLegend: boolean },
    required: ['words'],
    minimumBlockSize: '12rem',
    useWhen: 'Show the relative weight of at most 200 terms, such as topics in feedback.',
    examples: [{ id: 'topics', type: 'word-cloud', props: { words: [{ text: 'latency', weight: 12 }, { text: 'pricing', weight: 7 }] } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-word-cloud.js'),
    documentation: documentation('lr-word-cloud'),
  },
};

/** Canonical grid fields keep generated rows closed, like the reviewed table role. */
const gridFields = Object.freeze(Array.from({ length: 16 }, (_, index) => `c${index}`));
const gridRow = object(Object.fromEntries(gridFields.map(key => [key, scalar])));
const gridColumn = object({ field: choice(...gridFields), label, sortable: boolean, align: choice('start', 'center', 'end') }, ['field', 'label']);
const filterOption = object({ value: string(256), label }, ['value', 'label']);
const selectFilter = object({ filterId: identity, label, type: choice('select'), options: { ...array(filterOption, 50), minItems: 1 } as LyraGenSchema, clearable: boolean }, ['filterId', 'label', 'type', 'options']);
const filterValue: LyraGenSchema = { type: 'object', properties: {}, additionalProperties: string(256), maxProperties: 12, propertyNames: { maxLength: 128 } };

/** Data and driving controls: static plain data only; no server mode, callbacks or row hooks. */
const tierThree: Readonly<Record<string, LyraGenComponent>> = {
  heatmap: {
    tag: 'lr-heatmap',
    properties: { label, description: string(1024), valueLabel: string(256), data: object({ kind: choice('matrix'), rowLabels: array(string(256), 50), colLabels: array(string(256), 50), values: array(array(number, 50), 50) }, ['kind', 'rowLabels', 'colLabels', 'values']), scale: choice('linear', 'sqrt'), legendPlacement: choice('top', 'bottom'), withoutLegend: boolean, accessibleCells: boolean },
    required: ['label', 'data'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show a value over two categorical axes (at most 50 by 50), such as load by weekday and hour.',
    examples: [{ id: 'load', type: 'heatmap', props: { label: 'Load by day and shift', data: { kind: 'matrix', rowLabels: ['Mon', 'Tue'], colLabels: ['Day', 'Night'], values: [[12, 4], [15, 6]] } } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-heatmap.js'),
    documentation: documentation('lr-heatmap'),
  },
  'data-grid': {
    tag: 'lr-data-grid',
    properties: { label, columns: { ...array(gridColumn, 16), minItems: 1 } as LyraGenSchema, data: array(gridRow, 500), paginate: boolean, pageSize: count(100, 1), searchTerm: string(256), loading: boolean, error: boolean },
    required: ['label', 'columns', 'data'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '16rem',
    useWhen: 'Show up to 500 rows of up to 16 columns the user may sort, search or page; prefer table for short lists.',
    examples: [{ id: 'hosts', type: 'data-grid', props: { label: 'Hosts', columns: [{ field: 'c0', label: 'Host', sortable: true }, { field: 'c1', label: 'CPU %', sortable: true, align: 'end' }], data: [{ c0: 'web-1', c1: 63 }, { c0: 'web-2', c1: 41 }], paginate: true, pageSize: 20 } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-data-grid.js'),
    documentation: documentation('lr-data-grid'),
  },
  'time-range': {
    tag: 'lr-time-range',
    properties: { min: number, max: number, start: number, end: number, step: number, startLabel: label, endLabel: label },
    required: ['startLabel', 'endLabel'],
    accessibleName: { required: true, properties: ['startLabel'] },
    bindings: { start: { event: 'lr-input', property: 'start' }, end: { event: 'lr-input', property: 'end' } },
    fieldPurpose: 'general',
    useWhen: 'Let the user choose a numeric range (such as hours or days on a shared axis) that other panels read through reads.',
    examples: [{ id: 'window', type: 'time-range', props: { min: 0, max: 24, start: 8, end: 18, step: 1, startLabel: 'From hour', endLabel: 'To hour' } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-time-range.js'),
    documentation: documentation('lr-time-range'),
  },
  'filter-bar': {
    tag: 'lr-filter-bar',
    properties: { label, filters: { ...array(selectFilter, 12), minItems: 1 } as LyraGenSchema, value: filterValue },
    required: ['label', 'filters'],
    accessibleName: { required: true, properties: ['label'] },
    bindings: { value: { event: 'lr-input', property: 'value' } },
    fieldPurpose: 'general',
    useWhen: 'Offer up to 12 labelled select filters whose chosen values other panels read through reads.',
    examples: [{ id: 'filters', type: 'filter-bar', props: { label: 'Dashboard filters', filters: [{ filterId: 'region', label: 'Region', type: 'select', options: [{ value: 'eu', label: 'Europe' }, { value: 'us', label: 'Americas' }] }] } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-filter-bar.js'),
    documentation: documentation('lr-filter-bar'),
  },
};

const roles: Readonly<Record<string, LyraGenComponent>> = { ...tierOne, ...tierTwo, ...tierThree, ...answerRoles, ...chartExtraRoles, ...technicalAnswerRoles, ...richAnswerRoles };

/** Roles added by the dashboard overlay, in a stable order. */
export const dashboardRoleNames: readonly string[] = Object.freeze(Object.keys(roles));

/** Overlay role definitions; throws when the base already defines one of them. */
export function dashboardComponents(base: LyraGenCatalog): Readonly<Record<string, LyraGenComponent>> {
  for (const role of dashboardRoleNames) if (Object.hasOwn(base.components, role)) throw new TypeError(`The base catalog already defines ${role}.`);
  return roles;
}
