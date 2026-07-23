import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './evaluation-run.js';
import type { EvaluationExampleResult } from './evaluation-run.class.js';

const meta: Meta = {
  title: 'EvaluationRun',
  component: 'lr-evaluation-run',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "An evaluation batch's live progress: overall progress against the batch total, plus one disclosure per example with its input/output, a grounding summary, and a tool-call trace.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const examples: EvaluationExampleResult[] = [
  {
    id: 'ex-1',
    label: 'Refund policy question',
    status: { kind: 'done' },
    input: 'What is the refund policy?',
    output: 'Refunds are available within 30 days of purchase with a valid receipt.',
    grounding: { supportedClaims: 3, unsupportedClaims: 1, coverage: 0.85, confidence: 0.9 },
    citations: [{ id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc', span: { start: 120, end: 210 } }],
    toolTrace: [
      {
        id: 'call-1',
        name: 'search_docs',
        args: { query: 'refund policy' },
        status: 'success',
        result: { hits: 2 },
        startedAt: Date.now() - 4000,
        endedAt: Date.now() - 3200,
      },
    ],
  },
  {
    id: 'ex-2',
    label: 'Sort a list in Python',
    status: { kind: 'running' },
    input: 'sorted([3, 1, 2])',
    inputFormat: 'code',
    inputLanguage: 'python',
    output: '',
  },
  {
    id: 'ex-3',
    status: { kind: 'error', message: 'Timed out' },
    input: 'What is the capital of France?',
    output: '',
  },
  {
    id: 'ex-4',
    status: { kind: 'idle' },
    input: 'Summarize the attached contract.',
    output: '',
  },
];

export const Default: Story = {
  render: () => html`<lr-evaluation-run style="max-width: 40rem;" .examples=${examples}></lr-evaluation-run>`,
};

export const WithExplicitTotal: Story = {
  name: 'With an explicit total (batch still streaming in)',
  render: () =>
    html`<lr-evaluation-run style="max-width: 40rem;" .examples=${examples.slice(0, 2)} total="4"></lr-evaluation-run>`,
};

export const Empty: Story = {
  render: () => html`<lr-evaluation-run style="max-width: 40rem;"></lr-evaluation-run>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-evaluation-run
        label="Evaluation run for the multilingual customer-support production benchmark"
        .strings=${{
          evaluationRunProgressSummary:
            '{completed} of {total} customer-support benchmark examples have completed evaluation',
        }}
        .examples=${examples}
      ></lr-evaluation-run>
    </div>
  `,
};
