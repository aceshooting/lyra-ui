import type { JsonValue, LyraGenComponent, LyraGenNode } from '../types.js';
import type { LyraGenSchema } from '../types.js';
import { appearance, array, boolean, choice, count, documentation, label, number, object, size, string, variant } from './shared.js';

/**
 * Answer and analytics roles. Values stay raw (numbers, ISO dates) and the component
 * formats them with the host locale; images, links, callbacks and editing stay host-owned.
 */
const example = (id: string, type: string, props: Record<string, unknown>, extra: Partial<LyraGenNode> = {}): LyraGenNode => ({ id, type, props, ...extra } as LyraGenNode);
const isoDate = string(64);
const digits = count(20);
const currency = { type: 'string', minLength: 3, maxLength: 3 } as const;

const formatting: Readonly<Record<string, LyraGenComponent>> = {
  'format-number': {
    tag: 'lr-format-number',
    properties: { value: number, type: choice('decimal', 'currency', 'percent'), currency, currencyDisplay: choice('symbol', 'narrowSymbol', 'code', 'name'), notation: choice('standard', 'compact', 'scientific', 'engineering'), minimumFractionDigits: digits, maximumFractionDigits: digits, noGrouping: boolean },
    required: ['value'],
    useWhen: 'Show one raw number formatted for the reader locale (decimal, percent of 0-1, currency, compact).',
    examples: [example('arr', 'format-number', { value: 1250000, type: 'currency', currency: 'USD', notation: 'compact' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-format-number.js'),
    documentation: documentation('lr-format-number'),
  },
  'format-date': {
    tag: 'lr-format-date',
    properties: { date: isoDate, dateStyle: choice('full', 'long', 'medium', 'short'), timeStyle: choice('full', 'long', 'medium', 'short'), month: choice('numeric', '2-digit', 'narrow', 'short', 'long'), day: choice('numeric', '2-digit'), hour: choice('numeric', '2-digit'), minute: choice('numeric', '2-digit'), hourFormat: choice('auto', '12', '24') },
    required: ['date'],
    useWhen: 'Show one ISO 8601 date or date-time formatted for the reader locale.',
    examples: [example('due', 'format-date', { date: '2026-12-01T09:00:00Z', dateStyle: 'medium', timeStyle: 'short' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-format-date.js'),
    documentation: documentation('lr-format-date'),
  },
  'relative-time': {
    tag: 'lr-relative-time',
    properties: { date: isoDate, format: choice('long', 'short', 'narrow'), numeric: choice('always', 'auto'), unit: choice('second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'auto'), sync: boolean },
    required: ['date'],
    useWhen: 'Show how long ago or until an ISO 8601 instant, such as a last update time.',
    examples: [example('updated', 'relative-time', { date: '2026-11-24T08:00:00Z', sync: true })],
    load: () => import('@aceshooting/lyra-ui/components/lr-relative-time.js'),
    documentation: documentation('lr-relative-time'),
  },
  'format-bytes': {
    tag: 'lr-format-bytes',
    properties: { value: { type: 'number', minimum: 0, maximum: 1e18 }, unit: choice('byte', 'bit'), display: choice('long', 'short', 'narrow'), decimals: count(10) },
    required: ['value'],
    useWhen: 'Show a raw byte or bit count in readable units.',
    examples: [example('size', 'format-bytes', { value: 52428800 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-format-bytes.js'),
    documentation: documentation('lr-format-bytes'),
  },
};

const status: Readonly<Record<string, LyraGenComponent>> = {
  callout: {
    tag: 'lr-callout',
    properties: { heading: label, variant, appearance, size, inline: boolean },
    text: true,
    accessibleName: { required: true, properties: ['heading'], text: true },
    useWhen: 'Highlight one note, tip or caveat inside an answer; use alert for a status that needs attention.',
    examples: [example('note', 'callout', { heading: 'Estimate', variant: 'neutral' }, { text: 'Figures exclude refunds issued this week.' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-callout.js'),
    documentation: documentation('lr-callout'),
  },
  tag: {
    tag: 'lr-tag',
    properties: { variant: choice('neutral', 'brand', 'success', 'warning', 'danger'), appearance, size, pill: boolean },
    text: true,
    accessibleName: { required: true, text: true },
    useWhen: 'Label an item with a short category or keyword.',
    examples: [example('env', 'tag', { variant: 'brand' }, { text: 'Production' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-tag.js'),
    documentation: documentation('lr-tag'),
  },
  chip: {
    tag: 'lr-chip',
    properties: { variant: choice('neutral', 'brand', 'success', 'warning', 'danger'), size: choice('s', 'm', 'l'), pill: boolean, selected: boolean },
    text: true,
    accessibleName: { required: true, text: true },
    useWhen: 'Show one compact read-only attribute or applied filter.',
    examples: [example('region', 'chip', { selected: true }, { text: 'Region: Europe' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-chip.js'),
    documentation: documentation('lr-chip'),
  },
  rating: {
    tag: 'lr-rating',
    properties: { label, value: { type: 'number', minimum: 0, maximum: 10 }, max: count(10, 1), precision: { type: 'number', minimum: 0.1, maximum: 1 } },
    required: ['label', 'value'],
    accessibleName: { required: true, properties: ['label'] },
    hostProperties: ['readonly'],
    // Generated ratings are displays; editing a rating is a host-approved field, never generated.
    prepareProperties: (props: Readonly<Record<string, JsonValue>>) => ({ ...props, readonly: true }),
    useWhen: 'Show a read-only score out of at most 10.',
    examples: [example('score', 'rating', { label: 'Average review', value: 4.5, max: 5, precision: 0.5 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-rating.js'),
    documentation: documentation('lr-rating'),
  },
  kbd: {
    tag: 'lr-kbd',
    properties: { keys: string(64), platform: choice('auto', 'mac', 'windows', 'linux') },
    required: ['keys'],
    useWhen: 'Show a keyboard shortcut such as "Mod+K".',
    examples: [example('shortcut', 'kbd', { keys: 'Mod+K' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-kbd.js'),
    documentation: documentation('lr-kbd'),
  },
  divider: {
    tag: 'lr-divider',
    properties: { orientation: choice('horizontal', 'vertical') },
    useWhen: 'Separate two groups of content.',
    examples: [example('rule', 'divider', {})],
    load: () => import('@aceshooting/lyra-ui/components/lr-divider.js'),
    documentation: documentation('lr-divider'),
  },
  avatar: {
    tag: 'lr-avatar',
    properties: { label, initials: string(4), shape: choice('circle', 'rounded', 'square'), size, variant },
    required: ['label'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Represent a person or team by initials; images are never generated.',
    examples: [example('owner', 'avatar', { label: 'Avery Kim', initials: 'AK' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-avatar.js'),
    documentation: documentation('lr-avatar'),
  },
  'avatar-group': {
    tag: 'lr-avatar-group',
    properties: { label, max: count(20, 1), shape: choice('circle', 'rounded', 'square'), size },
    required: ['label'],
    accessibleName: { required: true, properties: ['label'] },
    children: ['avatar'],
    useWhen: 'Show the people involved in an item, collapsing beyond max.',
    examples: [example('team', 'avatar-group', { label: 'Reviewers', max: 3 }, { children: [example('rev-1', 'avatar', { label: 'Avery Kim', initials: 'AK' })] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-avatar-group.js'),
    documentation: documentation('lr-avatar-group'),
  },
};

const treeLeaf = object({ id: string(128), label, description: string(256) }, ['id', 'label']);
const treeBranch = object({ id: string(128), label, description: string(256), expanded: boolean, children: array(treeLeaf, 50) }, ['id', 'label']);
const treeRoot = object({ id: string(128), label, description: string(256), expanded: boolean, children: array(treeBranch, 50) }, ['id', 'label']);
const summary = object({ min: number, q1: number, median: number, q3: number, max: number }, ['min', 'q1', 'median', 'q3', 'max']);
const point = object({ x: number, y: number }, ['x', 'y']);
const chartText = { description: string(1024), xLabel: string(256), yLabel: string(256), withDataTable: boolean } as const;

const structure: Readonly<Record<string, LyraGenComponent>> = {
  accordion: {
    tag: 'lr-accordion',
    properties: { mode: choice('single', 'single-collapsible', 'multiple') },
    children: ['accordion-item'],
    useWhen: 'Group several collapsible sections where usually one is open at a time, such as FAQs.',
    examples: [example('faq', 'accordion', { mode: 'single-collapsible' }, { children: [example('faq-1', 'accordion-item', { label: 'What counts as active?' }, { children: [{ id: 'faq-1-text', type: 'text', text: 'Any sign-in within 30 days.' }] })] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-accordion.js'),
    documentation: documentation('lr-accordion'),
  },
  'accordion-item': {
    tag: 'lr-accordion-item',
    properties: { label, expanded: boolean },
    required: ['label'],
    accessibleName: { required: true, properties: ['label'] },
    children: true,
    useWhen: 'One collapsible section inside accordion.',
    examples: [example('item', 'accordion-item', { label: 'Methodology' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-accordion-item.js'),
    documentation: documentation('lr-accordion-item'),
  },
  tree: {
    tag: 'lr-tree',
    properties: { label, data: { ...array(treeRoot, 50), minItems: 1 } as LyraGenSchema },
    required: ['label', 'data'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show a read-only hierarchy at most three levels deep, such as services and their dependencies.',
    examples: [example('services', 'tree', { label: 'Service map', data: [{ id: 'api', label: 'API', expanded: true, children: [{ id: 'auth', label: 'Auth' }] }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-tree.js'),
    documentation: documentation('lr-tree'),
  },
};

const statistics: Readonly<Record<string, LyraGenComponent>> = {
  'box-plot': {
    tag: 'lr-box-plot',
    properties: { label, ...chartText, labels: array(string(256), 50), datasets: { ...array(object({ label, data: array(summary, 50) }, ['label', 'data']), 8), minItems: 1 } as LyraGenSchema },
    required: ['label', 'labels', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Compare distributions (min, quartiles, median, max) across at most 50 categories.',
    examples: [example('latency', 'box-plot', { label: 'Latency by region (ms)', labels: ['EU', 'US'], datasets: [{ label: 'p50-p99', data: [{ min: 20, q1: 35, median: 48, q3: 70, max: 180 }, { min: 25, q1: 40, median: 55, q3: 82, max: 210 }] }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-box-plot.js'),
    documentation: documentation('lr-box-plot'),
  },
  histogram: {
    tag: 'lr-histogram',
    properties: { label, ...chartText, values: { ...array(number, 2000), minItems: 1 } as LyraGenSchema, bins: count(100, 1), seriesLabel: string(256) },
    required: ['label', 'values'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show how at most 2000 raw numeric values are distributed into bins.',
    examples: [example('durations', 'histogram', { label: 'Job durations (s)', values: [12, 15, 15, 18, 22, 40, 41, 43], bins: 4 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-histogram.js'),
    documentation: documentation('lr-histogram'),
  },
  'scatter-chart': {
    tag: 'lr-scatter-chart',
    properties: { label, ...chartText, datasets: { ...array(object({ label, points: array(point, 1000) }, ['label', 'points']), 8), minItems: 1 } as LyraGenSchema },
    required: ['label', 'datasets'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '14rem',
    useWhen: 'Show the relationship between two numeric measures for at most 1000 points per series.',
    examples: [example('cost', 'scatter-chart', { label: 'Cost against latency', xLabel: 'Latency (ms)', yLabel: 'Cost', datasets: [{ label: 'Endpoints', points: [{ x: 40, y: 2.1 }, { x: 90, y: 1.2 }] }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-scatter-chart.js'),
    documentation: documentation('lr-scatter-chart'),
  },
};

/** Answer and analytics roles, in a stable order. */
export const answerRoles: Readonly<Record<string, LyraGenComponent>> = { ...formatting, ...status, ...structure, ...statistics };
