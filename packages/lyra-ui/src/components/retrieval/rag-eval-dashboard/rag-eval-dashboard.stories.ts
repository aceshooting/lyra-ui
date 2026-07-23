import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  RagEvaluationMetric,
  RagEvaluationRun,
} from './rag-eval-dashboard.class.js';
import './rag-eval-dashboard.js';

const meta: Meta = {
  title: 'RAG Evaluation Dashboard',
  component: 'lr-rag-eval-dashboard',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const metrics: RagEvaluationMetric[] = [
  { id: 'mrr', label: 'Mean reciprocal rank', category: 'retrieval', format: 'number' },
  { id: 'groundedness', label: 'Groundedness', category: 'generation', format: 'percent' },
];

const runs: RagEvaluationRun[] = [
  { id: 'baseline', label: 'Baseline', slice: 'general', metrics: { mrr: 0.62, groundedness: 0.8 } },
  { id: 'reranker', label: 'Reranker v2', slice: 'general', metrics: { mrr: 0.74, groundedness: 0.91 } },
  { id: 'legal', label: 'Legal corpus', slice: 'legal', metrics: { mrr: 0.7, groundedness: 0.88 } },
];

const renderDashboard = () => html`
  <lr-rag-eval-dashboard
    metric-id="groundedness"
    .metrics=${metrics}
    .runs=${runs}
  ></lr-rag-eval-dashboard>
`;

export const Default: Story = {
  render: renderDashboard,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;">${renderDashboard()}</div>`,
};
