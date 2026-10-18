import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { EvalResultSource, EvalRunResult } from './eval-result.js';
import type { TableColumn } from '../../data/table/table.class.js';
import type { RubricKey } from '../../forms/rubric-form/rubric-form.class.js';

const rubricKeys: RubricKey[] = [
  { key: 'accuracy', type: 'score', label: 'Accuracy', min: 0, max: 5, step: 1, required: true },
  { key: 'notes', type: 'comment', label: 'Reviewer notes', placeholder: 'Optional' },
];

const runs: EvalRunResult[] = [
  {
    id: 'gpt-baseline',
    label: 'gpt-4o (baseline)',
    model: 'gpt-4o',
    promptVersion: 'v1',
    output: 'The capital of France is Paris.\nIt has a population of about 2.1 million people.',
    scores: { accuracy: 4 },
  },
  {
    id: 'claude-candidate',
    label: 'claude-sonnet (candidate)',
    model: 'claude-sonnet',
    promptVersion: 'v2',
    output: 'Paris is the capital of France.\nIt has a population of roughly 2.1 million residents.',
    scores: { accuracy: 4 },
    review: { accuracy: 5, notes: 'Slightly more natural phrasing.' },
  },
];

const columns: TableColumn<EvalRunResult>[] = [
  { key: 'label', label: 'Run', sortable: true, cell: (r) => r.label },
  { key: 'model', label: 'Model', cell: (r) => r.model },
  { key: 'promptVersion', label: 'Prompt version', cell: (r) => r.promptVersion },
  { key: 'accuracy', label: 'Accuracy', sortable: true, cell: (r) => r.review?.['accuracy'] ?? r.scores?.['accuracy'] },
];

const meta: Meta = {
  title: 'Observability/Eval Result',
  component: 'lr-eval-result',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-eval-result
    label="Run comparison"
    style="max-width: 48rem"
    .runs=${runs}
    .columns=${columns}
    .rubricKeys=${rubricKeys}
  ></lr-eval-result>`,
};

/** `selected-run-id` picks the candidate run for review; the baseline (`runs[0]` by default)
 *  supplies the diff's "old" side, so the split diff and the review form stay in sync. */
export const ComparingAgainstBaseline: Story = {
  render: () => html`<lr-eval-result
    label="Run comparison"
    style="max-width: 48rem"
    .runs=${runs}
    .columns=${columns}
    .rubricKeys=${rubricKeys}
    selected-run-id="claude-candidate"
    review-skippable
  ></lr-eval-result>`,
};

export const Empty: Story = {
  render: () => html`<lr-eval-result aria-label="Run comparison"></lr-eval-result>`,
};

/** 320px container — the comparison grid scrolls its own viewport rather than widening the host. */
export const NarrowContainer: Story = {
  render: () =>
    html`<lr-eval-result
      style="max-width: 320px"
      label="Run comparison"
      .runs=${runs}
      .columns=${columns}
      .rubricKeys=${rubricKeys}
      selected-run-id="claude-candidate"
    ></lr-eval-result>`,
};

/** A logical million-run provider with off-page comparison and global server order. */
export const SourcePages: Story = {
  render: () => {
    const total = 1_000_000;
    const run = (index: number): EvalRunResult => ({ id: `run-${index}`, label: `Run ${index + 1}`, output: `Output from run ${index + 1}` });
    const record = (index: number) => ({ key: `run-${index}`, order: index, value: run(index) });
    const source: EvalResultSource = {
      revision: 1,
      query: async ({ page, pageSize, query }) => ({ total, rows: Array.from({ length: Math.min(pageSize, total - page * pageSize) }, (_, offset) => record(query.sortDir === 'desc' ? total - 1 - page * pageSize - offset : page * pageSize + offset)) }),
      lookup: async keys => keys.flatMap(key => {
        const index = Number(key.slice(4));
        return /^run-\d+$/.test(key) && Number.isSafeInteger(index) && index < total ? [record(index)] : [];
      }),
      locate: async (key, query) => {
        const index = Number(key.slice(4));
        return /^run-\d+$/.test(key) && Number.isSafeInteger(index) && index < total ? query.sortDir === 'desc' ? total - 1 - index : index : null;
      },
    };
    return html`<lr-eval-result label="Run comparison" .dataSource=${source}
      .columns=${[{ key: 'label', label: 'Run', sortable: true, cell: (value: EvalRunResult) => value.label }]}
      selected-run-id="run-999999" baseline-run-id="run-0"
      @lr-run-activate=${(event: CustomEvent<{ runId: string }>) => { (event.currentTarget as HTMLElement & { selectedRunId: string }).selectedRunId = event.detail.runId; }}
    ></lr-eval-result>`;
  },
};
