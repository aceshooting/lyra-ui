import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { EvalRunResult } from './eval-result.js';
import type { DataGridColumn } from '../data-grid/data-grid.class.js';
import type { RubricKey } from '../rubric-form/rubric-form.class.js';

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

const columns: DataGridColumn<EvalRunResult>[] = [
  { key: 'label', label: 'Run', sortable: true, value: (r) => r.label },
  { key: 'model', label: 'Model', value: (r) => r.model },
  { key: 'promptVersion', label: 'Prompt version', value: (r) => r.promptVersion },
  { key: 'accuracy', label: 'Accuracy', sortable: true, value: (r) => r.review?.accuracy ?? r.scores?.accuracy },
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
    aria-label="Run comparison"
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
    aria-label="Run comparison"
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
      aria-label="Run comparison"
      .runs=${runs}
      .columns=${columns}
      .rubricKeys=${rubricKeys}
      selected-run-id="claude-candidate"
    ></lr-eval-result>`,
};
