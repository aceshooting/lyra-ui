import type { JsonValue, LyraGenComponent, LyraGenNode, LyraGenSchema } from '../types.js';
import { array, boolean, choice, count, documentation, label, number, object, string } from './shared.js';

/**
 * Rich answer roles: Markdown prose, agent metrics, bounded graphs and driving controls. Every role
 * renders from plain bounded JSON. Links, images, raw HTML, callbacks, data providers, editing and
 * built-in action buttons stay host-owned; trusted adapters force the safe presentation.
 */
const example = (id: string, type: string, props: Record<string, unknown>, extra: Partial<LyraGenNode> = {}): LyraGenNode => ({ id, type, props, ...extra } as LyraGenNode);
const identity: LyraGenSchema = { type: 'string', minLength: 1, maxLength: 128 };
const quantity: LyraGenSchema = { type: 'number', minimum: 0, maximum: 1e12 };
const minItems = (schema: LyraGenSchema, minimum: number): LyraGenSchema => ({ ...schema, minItems: minimum } as LyraGenSchema);
const hint = string(512);
const fieldSize = choice('s', 'm', 'l');
const orientation = choice('horizontal', 'vertical');
const labelDisplay = choice('visible', 'hidden');
/** An ISO 8601 calendar date (`YYYY-MM-DD`); the component rejects other shapes as invalid input. */
const isoDay: LyraGenSchema = { type: 'string', maxLength: 10 };
const controlName = { required: true, properties: ['label'] } as const;

/** Raw HTML is shown as text, images render as their alt text and no link becomes an anchor. */
function markdownProperties(props: Readonly<Record<string, JsonValue>>): Readonly<Record<string, unknown>> {
  return { ...props, htmlMode: 'escape', withoutImages: true, linkSchemes: '', linkTarget: null };
}

const prose: Readonly<Record<string, LyraGenComponent>> = {
  markdown: {
    tag: 'lr-markdown',
    properties: { content: string(16384), headingOffset: count(5), withoutGfm: boolean, withoutSyntaxHighlighting: boolean },
    required: ['content'],
    hostProperties: ['htmlMode', 'linkSchemes', 'linkTarget', 'withoutImages'],
    prepareProperties: markdownProperties,
    useWhen: 'Show a longer formatted explanation (headings, lists, tables, code) as Markdown source; raw HTML shows as text, and links and images render as plain text.',
    examples: [example('summary', 'markdown', { content: '## Findings\n\n- Latency fell **12%** after the cache change.\n- Errors stayed flat.\n\n| Region | p95 (ms) |\n| --- | --- |\n| EU | 180 |\n| US | 210 |', headingOffset: 1 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-markdown.js'),
    documentation: documentation('lr-markdown'),
  },
};

const contextSegment = object({ label, value: quantity, tone: choice('brand', 'success', 'warning', 'danger', 'neutral') }, ['label', 'value']);

const metrics: Readonly<Record<string, LyraGenComponent>> = {
  'context-meter': {
    tag: 'lr-context-meter',
    properties: { label, total: quantity, segments: minItems(array(contextSegment, 12), 1), shape: choice('bar', 'ring'), withLegend: boolean, legendDisplay: choice('label', 'label-value', 'label-percent', 'label-value-percent') },
    required: ['label', 'total', 'segments'],
    accessibleName: { required: true, properties: ['label'] },
    useWhen: 'Show how a model context window or token budget (total) is used by up to 12 labelled categories, as absolute quantities.',
    examples: [example('context', 'context-meter', { label: '128K context window', total: 128000, segments: [{ label: 'System prompt', value: 4200, tone: 'neutral' }, { label: 'Conversation', value: 38500, tone: 'brand' }, { label: 'Retrieved sources', value: 21000, tone: 'warning' }], withLegend: true, legendDisplay: 'label-value' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-context-meter.js'),
    documentation: documentation('lr-context-meter'),
  },
  'stream-status': {
    tag: 'lr-stream-status',
    properties: { connectionState: choice('idle', 'connecting', 'streaming', 'interrupted') },
    required: ['connectionState'],
    hostProperties: ['stallThresholdMs'],
    // Generated content cannot record stream activity, so the inactivity timer would report false stalls.
    prepareProperties: (props: Readonly<Record<string, JsonValue>>) => ({ ...props, stallThresholdMs: 0 }),
    useWhen: 'Show the connection state of one data stream (idle, connecting, streaming or interrupted), usually read from live data.',
    examples: [example('feed', 'stream-status', { connectionState: 'streaming' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-stream-status.js'),
    documentation: documentation('lr-stream-status'),
  },
  'generation-metrics': {
    tag: 'lr-generation-metrics',
    properties: { status: choice('idle', 'running', 'complete'), startedAt: { type: 'number', minimum: 0, maximum: 8.64e15 }, tokenCount: { type: 'integer', minimum: 0, maximum: 1e12 }, tokensPerSecond: { type: 'number', minimum: 0, maximum: 1e9 } },
    required: ['status'],
    hostProperties: ['withoutStop'],
    // Stopping a generation is a host decision; the built-in Stop button has no generated handler.
    prepareProperties: (props: Readonly<Record<string, JsonValue>>) => ({ ...props, withoutStop: true }),
    useWhen: 'Show elapsed time, token count and throughput of one model generation; startedAt is epoch milliseconds.',
    examples: [example('run', 'generation-metrics', { status: 'complete', startedAt: 1764000000000, tokenCount: 1840, tokensPerSecond: 42 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-generation-metrics.js'),
    documentation: documentation('lr-generation-metrics'),
  },
};

const graphNode = object({ id: identity, label, description: string(512) }, ['id', 'label']);
const graphEdge = object({ source: identity, target: identity, label: string(256), directed: boolean }, ['source', 'target']);
const topicLeaf = object({ id: identity, label }, ['id', 'label']);
const topicBranch = object({ id: identity, label, children: array(topicLeaf, 12) }, ['id', 'label']);
// One root, at most 12 branches of at most 12 leaves: 157 topics, three levels.
const topicRoot = object({ id: identity, label, children: array(topicBranch, 12) }, ['id', 'label']);

const graphs: Readonly<Record<string, LyraGenComponent>> = {
  graph: {
    tag: 'lr-graph',
    properties: { label, nodes: minItems(array(graphNode, 200), 1), edges: array(graphEdge, 400), layout: choice('force', 'layered'), view: choice('2d', 'list'), nodeLabels: choice('always', 'zoom', 'none'), withEdgeLabels: boolean },
    required: ['label', 'nodes'],
    accessibleName: { required: true, properties: ['label'] },
    hostProperties: ['fitTo'],
    // The drawing follows the dashboard cell instead of a fixed 800 by 600 canvas.
    prepareProperties: (props: Readonly<Record<string, JsonValue>>) => ({ ...props, fitTo: 'container' }),
    minimumBlockSize: '20rem',
    useWhen: 'Show a network of at most 200 named entities and 400 relationships, such as service dependencies; use layered for a directed flow.',
    examples: [example('deps', 'graph', { label: 'Service dependencies', layout: 'layered', nodes: [{ id: 'web', label: 'Web' }, { id: 'api', label: 'API' }, { id: 'db', label: 'Database' }], edges: [{ source: 'web', target: 'api', directed: true }, { source: 'api', target: 'db', directed: true, label: 'reads' }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-graph.js'),
    documentation: documentation('lr-graph'),
  },
  'mind-map': {
    tag: 'lr-mind-map',
    properties: { label, topics: { ...array(topicRoot, 1), minItems: 1 } as LyraGenSchema, expandDepth: count(3) },
    required: ['label', 'topics'],
    accessibleName: { required: true, properties: ['label'] },
    minimumBlockSize: '16rem',
    useWhen: 'Show one topic broken into at most 12 subtopics of at most 12 points each as an expandable radial map.',
    examples: [example('themes', 'mind-map', { label: 'Feedback themes', expandDepth: 2, topics: [{ id: 'feedback', label: 'Feedback', children: [{ id: 'speed', label: 'Speed', children: [{ id: 'search', label: 'Search' }] }, { id: 'price', label: 'Pricing' }] }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-mind-map.js'),
    documentation: documentation('lr-mind-map'),
  },
};

const segment = object({ value: identity, label, disabled: boolean }, ['value', 'label']);

/** In the number input's adapter the generated number becomes the component's native string value. */
function numberInputProperties(props: Readonly<Record<string, JsonValue>>): Readonly<Record<string, unknown>> {
  const { valueAsNumber, ...rest } = props;
  return typeof valueAsNumber === 'number' ? { ...rest, value: String(valueAsNumber) } : rest;
}

/** Driving controls: each writes one plain value to view state for other panels to read. */
const controls: Readonly<Record<string, LyraGenComponent>> = {
  segmented: {
    tag: 'lr-segmented',
    properties: { label, items: minItems(array(segment, 12), 1), value: string(128), labelDisplay, layout: choice('scroll', 'wrap', 'grid'), fullWidth: boolean, disabled: boolean, size: fieldSize },
    required: ['label', 'items'],
    interactive: true,
    accessibleName: controlName,
    bindings: { value: { event: 'lr-change', property: 'value' } },
    fieldPurpose: 'general',
    useWhen: 'Switch between 2 to 12 mutually exclusive views or periods in one compact track; other panels read the chosen value.',
    examples: [example('period', 'segmented', { label: 'Period', items: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }], value: 'week' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-segmented.js'),
    documentation: documentation('lr-segmented'),
  },
  'toggle-group': {
    tag: 'lr-toggle-group',
    properties: { label, selectionMode: choice('single', 'multiple'), value: array(string(128), 24), orientation, disabled: boolean, size: fieldSize },
    required: ['label'],
    children: ['toggle'],
    interactive: true,
    accessibleName: controlName,
    bindings: { value: { event: 'lr-change', property: 'value' } },
    fieldPurpose: 'general',
    useWhen: 'Turn up to 24 toggle buttons on or off behind one tab stop, such as visible chart series; the value lists the pressed toggle values.',
    examples: [example('series', 'toggle-group', { label: 'Visible series', value: ['requests'] }, { children: [example('requests', 'toggle', { value: 'requests' }, { text: 'Requests' }), example('errors', 'toggle', { value: 'errors' }, { text: 'Errors' })] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-toggle-group.js'),
    documentation: documentation('lr-toggle-group'),
  },
  toggle: {
    tag: 'lr-toggle',
    properties: { value: identity, disabled: boolean },
    required: ['value'],
    text: true,
    interactive: true,
    accessibleName: { required: true, text: true },
    useWhen: 'One labelled toggle inside toggle-group; its value joins the group value while pressed.',
    examples: [example('errors', 'toggle', { value: 'errors' }, { text: 'Errors' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-toggle.js'),
    documentation: documentation('lr-toggle'),
  },
  'checkbox-group': {
    tag: 'lr-checkbox-group',
    properties: { label, hint, value: array(string(128), 24), orientation, required: boolean, disabled: boolean, labelDisplay, size: fieldSize },
    required: ['label'],
    children: ['checkbox-option'],
    interactive: true,
    accessibleName: controlName,
    bindings: { value: { event: 'lr-change', property: 'value' } },
    fieldPurpose: 'general',
    useWhen: 'Pick zero or more of up to 24 labelled checkbox options, such as regions to include; the value lists the checked option values.',
    examples: [example('regions', 'checkbox-group', { label: 'Regions', value: ['eu'] }, { children: [example('eu', 'checkbox-option', { value: 'eu' }, { text: 'Europe' }), example('us', 'checkbox-option', { value: 'us' }, { text: 'Americas' })] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-checkbox-group.js'),
    documentation: documentation('lr-checkbox-group'),
  },
  'checkbox-option': {
    tag: 'lr-checkbox',
    properties: { value: identity, disabled: boolean },
    required: ['value'],
    text: true,
    interactive: true,
    accessibleName: { required: true, text: true },
    useWhen: 'One labelled option inside checkbox-group; use checkbox for a standalone yes/no field.',
    examples: [example('apac', 'checkbox-option', { value: 'apac' }, { text: 'Asia Pacific' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-checkbox.js'),
    documentation: documentation('lr-checkbox'),
  },
  'radio-group': {
    tag: 'lr-radio-group',
    properties: { label, hint, value: string(128), orientation, required: boolean, disabled: boolean, labelDisplay, size: fieldSize },
    required: ['label'],
    children: ['radio'],
    interactive: true,
    accessibleName: controlName,
    bindings: { value: { event: 'lr-change', property: 'value' } },
    fieldPurpose: 'general',
    useWhen: 'Pick exactly one of up to 24 labelled options shown at once, such as a comparison baseline.',
    examples: [example('baseline', 'radio-group', { label: 'Compare with', value: 'last-week' }, { children: [example('last-week', 'radio', { value: 'last-week' }, { text: 'Last week' }), example('last-year', 'radio', { value: 'last-year' }, { text: 'Same week last year' })] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-radio-group.js'),
    documentation: documentation('lr-radio-group'),
  },
  radio: {
    tag: 'lr-radio',
    properties: { value: identity, disabled: boolean },
    required: ['value'],
    text: true,
    interactive: true,
    accessibleName: { required: true, text: true },
    useWhen: 'One labelled option inside radio-group.',
    examples: [example('target', 'radio', { value: 'target' }, { text: 'Target' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-radio.js'),
    documentation: documentation('lr-radio'),
  },
  'number-input': {
    tag: 'lr-number-input',
    properties: { label, hint, valueAsNumber: number, min: number, max: number, step: { type: 'number', minimum: 0.000001, maximum: 1e12 }, placeholder: string(256), required: boolean, disabled: boolean, localized: boolean, withoutSteppers: boolean, labelDisplay, size: fieldSize },
    required: ['label'],
    interactive: true,
    accessibleName: controlName,
    bindings: { valueAsNumber: { event: 'lr-input', property: 'valueAsNumber' } },
    fieldPurpose: 'general',
    hostProperties: ['value'],
    prepareProperties: numberInputProperties,
    useWhen: 'Enter one exact number within optional bounds, such as an alert threshold; bind valueAsNumber for other panels to read.',
    examples: [example('threshold', 'number-input', { label: 'Alert threshold (ms)', valueAsNumber: 250, min: 0, max: 5000, step: 10 })],
    load: () => import('@aceshooting/lyra-ui/components/lr-number-input.js'),
    documentation: documentation('lr-number-input'),
  },
  'date-input': {
    tag: 'lr-date-input',
    properties: { label, hint, value: isoDay, min: isoDay, max: isoDay, required: boolean, disabled: boolean, disablePast: boolean, disableFuture: boolean, firstDayOfWeek: choice('auto', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'), labelDisplay, size: fieldSize },
    required: ['label'],
    interactive: true,
    accessibleName: controlName,
    bindings: { value: { event: 'lr-change', property: 'value' } },
    fieldPurpose: 'general',
    useWhen: 'Pick one calendar day (YYYY-MM-DD) within optional min and max days, such as a report date.',
    examples: [example('report-day', 'date-input', { label: 'Report date', value: '2026-11-24', min: '2026-01-01', max: '2026-12-31' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-date-input.js'),
    documentation: documentation('lr-date-input'),
  },
};

/** Rich answer roles, in a stable order. */
export const richAnswerRoles: Readonly<Record<string, LyraGenComponent>> = { ...prose, ...metrics, ...graphs, ...controls };
