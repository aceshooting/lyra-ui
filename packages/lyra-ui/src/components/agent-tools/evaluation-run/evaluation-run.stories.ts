import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './evaluation-run.js';
import type { EvalExampleResult, EvalToolApprovalDetail } from './evaluation-run.class.js';

const meta: Meta = {
  title: 'EvalRun',
  component: 'lr-eval-run',
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

const examples: EvalExampleResult[] = [
  {
    id: 'ex-1',
    label: 'Refund policy question',
    status: { kind: 'done' },
    input: { text: 'What is the refund policy?' },
    output: { text: 'Refunds are available within 30 days of purchase with a valid receipt.' },
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
    input: { text: 'sorted([3, 1, 2])', format: 'code', language: 'python' },
    output: { text: '' },
  },
  {
    id: 'ex-3',
    status: { kind: 'error', message: 'Timed out' },
    input: { text: 'What is the capital of France?' },
    output: { text: '' },
  },
  {
    id: 'ex-4',
    status: {
      kind: 'quality-review',
      label: 'Needs QA',
      variant: 'warning',
      message: 'A reviewer must verify the extracted clauses.',
      terminal: false,
    },
    input: { text: 'Summarize the attached contract.' },
    output: { text: '' },
  },
];

export const Default: Story = {
  render: () => html`<lr-eval-run style="max-width: 40rem;" .examples=${examples}></lr-eval-run>`,
};

export const WithExplicitTotal: Story = {
  name: 'With an explicit total (batch still streaming in)',
  render: () =>
    html`<lr-eval-run style="max-width: 40rem;" .examples=${examples.slice(0, 2)} total="4"></lr-eval-run>`,
};

export const StaleExplicitTotal: Story = {
  name: 'Observed examples exceed a stale explicit total',
  render: () =>
    html`<lr-eval-run style="max-width: 40rem;" .examples=${examples.slice(0, 3)} total="1"></lr-eval-run>`,
};

export const AsyncApprovalVeto: Story = {
  name: 'Async approval veto',
  parameters: {
    docs: {
      description: {
        story:
          'Expand the example and approve the pending tool call. The correlated event is prevented, so the nested dialog remains pending while the host resolves asynchronous validation.',
      },
    },
  },
  render: () => {
    const pendingExamples: EvalExampleResult[] = [
      {
        ...examples[0]!,
        toolTrace: [
          {
            id: 'call-pending',
            name: 'search_docs',
            args: { query: 'refund policy' },
            status: 'pending',
            needsApproval: true,
          },
        ],
      },
    ];
    return html`
      <lr-eval-run
        style="max-width: 40rem;"
        .examples=${pendingExamples}
        @lr-example-tool-approval-decide=${(event: CustomEvent<EvalToolApprovalDetail>) => {
          event.preventDefault();
          const output = (event.currentTarget as HTMLElement).nextElementSibling;
          if (output) output.textContent = `Pending approval for ${event.detail.exampleId}/${event.detail.invocationId}`;
        }}
      ></lr-eval-run>
      <p role="status">No decision pending.</p>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-eval-run style="max-width: 40rem;"></lr-eval-run>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-eval-run
        label="Evaluation run for the multilingual customer-support production benchmark"
        .strings=${{
          evaluationRunProgressSummary:
            '{completed} of {total} customer-support benchmark examples have completed evaluation',
        }}
        .examples=${examples}
      ></lr-eval-run>
    </div>
  `,
};
