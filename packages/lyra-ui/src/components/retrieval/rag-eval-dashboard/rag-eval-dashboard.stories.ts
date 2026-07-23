import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './rag-eval-dashboard.js';

const meta: Meta = { title: 'Retrieval/RAG Evaluation Dashboard', component: 'lr-rag-eval-dashboard' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-rag-eval-dashboard
    metric-id="groundedness"
    .metrics=${[
      { id: 'mrr', label: 'MRR', category: 'retrieval' },
      { id: 'groundedness', label: 'Groundedness', category: 'generation', format: 'percent' },
    ]}
    .runs=${[
      { id: 'base', label: 'Baseline', slice: 'all', metrics: { mrr: 0.62, groundedness: 0.81 } },
      { id: 'rerank', label: 'Reranker', slice: 'all', metrics: { mrr: 0.76, groundedness: 0.93 } },
    ]}
  ></lr-rag-eval-dashboard>`,
};

