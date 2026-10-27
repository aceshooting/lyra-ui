import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenComponent, LyraGenNode, LyraGenSchema } from '../types.js';
import { array, choice, count, documentation, label, number, object, scalar, string } from './shared.js';

/** Primitive roles a base catalog must already define before composite answer blocks can expand into them. */
const expandsInto = Object.freeze(['row', 'stat', 'table'] as const);
const stepStates = ['pending', 'current', 'completed', 'error'] as const;

const kpiItem = object({
  label,
  value: { anyOf: [string(256), number] } as LyraGenSchema,
  caption: string(512),
  deltaPercent: number,
  goodDirection: choice('up', 'down'),
}, ['label', 'value']);
const rowCell: LyraGenSchema = scalar;
const comparisonRow = object({ label, values: array(rowCell, 6) }, ['label', 'values']);
const stepItem = object({ label, description: string(256) }, ['label']);

const record = (value: JsonValue | undefined): JsonObject => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {});
const list = (value: JsonValue | undefined): readonly JsonValue[] => (Array.isArray(value) ? value : []);
const carry = (node: LyraGenNode): { readonly slot?: string } => (node.slot === undefined ? {} : { slot: node.slot });

/** Expand `kpi-row` into a `row` of `stat` nodes with ids `<id>--<index>`. */
export function expandKpiRow(node: LyraGenNode): LyraGenNode {
  const items = list(node.props?.['items']);
  return {
    id: node.id, type: 'row', ...carry(node),
    children: items.map((entry, index): LyraGenNode => {
      const item = record(entry);
      const props: Record<string, JsonValue> = { label: item['label'] ?? '', value: String(item['value'] ?? '') };
      for (const key of ['caption', 'deltaPercent', 'goodDirection'] as const) if (item[key] !== undefined) props[key] = item[key]!;
      return { id: `${node.id}--${index}`, type: 'stat', props };
    }),
  };
}

/**
 * Expand `comparison` into a `table`: column `c0` holds the row label, `c1`... the compared values.
 * A row whose `values` length differs from `columns` yields a table row carrying an undeclared
 * field, so validation rejects exactly that row (`/props/rows/<index>`) with a descriptive key.
 */
export function expandComparison(node: LyraGenNode): LyraGenNode {
  const props = node.props ?? {};
  const columns = list(props['columns']);
  const header = typeof props['rowLabel'] === 'string' ? props['rowLabel'] : 'Item';
  const rows = list(props['rows']).map((entry, index): JsonObject => {
    const row = record(entry);
    const values = list(row['values']);
    if (values.length !== columns.length) throw new RangeError(`Row ${index} has ${values.length} values for ${columns.length} columns.`);
    const out: Record<string, JsonValue> = { c0: row['label'] ?? null };
    values.forEach((value, i) => { out[`c${i + 1}`] = value; });
    return out;
  });
  return {
    id: node.id, type: 'table', ...carry(node),
    props: { caption: props['caption'] ?? '', columns: [{ key: 'c0', label: header }, ...columns.map((column, index) => ({ key: `c${index + 1}`, label: column }))], rows },
  };
}

/** Expand `steps` into a read-only `stepper`; steps before `current` are completed, after it pending. */
export function expandSteps(node: LyraGenNode): LyraGenNode {
  const props = node.props ?? {};
  const current = typeof props['current'] === 'number' ? props['current'] : -1;
  return {
    id: node.id, type: 'stepper', ...carry(node),
    props: {
      accessibleLabel: props['label'] ?? '', readonly: true,
      steps: list(props['items']).map((entry, index) => {
        const item = record(entry);
        const state = index < current ? 'completed' : index === current ? 'current' : 'pending';
        return { stepId: `${node.id}--${index}`, label: item['label'] ?? '', state, ...(typeof item['description'] === 'string' && item['description'] ? { title: item['description'] } : {}) };
      }),
    },
  };
}

const blockExamples = (id: string, type: string, props: JsonObject): LyraGenNode => ({ id, type, props });

/** Read-only progress primitive added only by the answer-blocks overlay. */
const stepper: LyraGenComponent = {
  tag: 'lr-stepper',
  properties: {
    accessibleLabel: label,
    readonly: { type: 'boolean' },
    steps: { ...array(object({ stepId: { type: 'string', minLength: 1, maxLength: 128 }, label, state: choice(...stepStates), title: string(256) }, ['stepId', 'label', 'state']), 12), minItems: 1 } as LyraGenSchema,
  },
  required: ['accessibleLabel', 'steps'],
  accessibleName: { required: true, properties: ['accessibleLabel'] },
  useWhen: 'Show read-only progress through at most 12 named steps.',
  load: () => import('@aceshooting/lyra-ui/components/lr-stepper.js'),
  documentation: documentation('lr-stepper'),
};

const blocks: Readonly<Record<string, LyraGenComponent>> = {
  'kpi-row': {
    tag: 'div',
    properties: { items: { ...array(kpiItem, 6), minItems: 1 } as LyraGenSchema },
    required: ['items'],
    expand: expandKpiRow,
    description: 'Composite block: one row of 1-6 labelled metrics. Always expanded into a row of stat roles.',
    useWhen: 'Summarise 1-6 headline metrics, optionally with a percentage change and whether up or down is good.',
    examples: [blockExamples('kpis', 'kpi-row', { items: [{ label: 'Revenue', value: '1.2M', deltaPercent: 4.5 }, { label: 'Churn', value: '2.1%', deltaPercent: -0.4, goodDirection: 'down', caption: 'Monthly' }] })],
  },
  comparison: {
    tag: 'div',
    properties: { caption: label, rowLabel: label, columns: { ...array(label, 6), minItems: 2 } as LyraGenSchema, rows: { ...array(comparisonRow, 50), minItems: 1 } as LyraGenSchema },
    required: ['caption', 'columns', 'rows'],
    accessibleName: { required: true, properties: ['caption'] },
    expand: expandComparison,
    description: 'Composite block: 2-6 compared options (columns) across up to 50 labelled rows; each row supplies exactly one value per column. Always expanded into a table role.',
    useWhen: 'Compare 2-6 options across named criteria; rowLabel names the first column (default "Item").',
    examples: [blockExamples('plans', 'comparison', { caption: 'Plan comparison', columns: ['Basic', 'Pro'], rows: [{ label: 'Seats', values: [1, 10] }, { label: 'Support', values: ['Email', 'Priority'] }] })],
  },
  steps: {
    tag: 'div',
    properties: { label, items: { ...array(stepItem, 12), minItems: 1 } as LyraGenSchema, current: count(11) },
    required: ['label', 'items'],
    accessibleName: { required: true, properties: ['label'] },
    expand: expandSteps,
    description: 'Composite block: an ordered read-only progress list of 1-12 steps; current is the zero-based active step. Always expanded into a stepper role.',
    useWhen: 'Explain an ordered procedure or show progress through named steps.',
    examples: [blockExamples('rollout', 'steps', { label: 'Rollout progress', items: [{ label: 'Plan' }, { label: 'Build', description: 'In progress' }, { label: 'Ship' }], current: 1 })],
  },
};

/** Overlay role definitions: the three blocks, the `stepper` primitive and a `stat` extended with delta props. */
export function answerBlockComponents(base: LyraGenCatalog): Readonly<Record<string, LyraGenComponent>> {
  for (const role of expandsInto) if (!Object.hasOwn(base.components, role)) throw new TypeError(`Answer blocks require the ${role} role in the base catalog.`);
  for (const role of [...Object.keys(blocks), 'stepper']) if (Object.hasOwn(base.components, role)) throw new TypeError(`The base catalog already defines ${role}.`);
  const stat = base.components['stat']!;
  return { stat: { ...stat, properties: { ...stat.properties, deltaPercent: number, goodDirection: choice('up', 'down') } }, stepper, ...blocks };
}
