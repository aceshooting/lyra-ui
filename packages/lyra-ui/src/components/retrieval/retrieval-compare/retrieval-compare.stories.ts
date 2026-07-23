import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './retrieval-compare.js';

const meta: Meta = { title: 'Retrieval/Retrieval Compare', component: 'lr-retrieval-compare' };
export default meta;
type Story = StoryObj;

const chunk = (id: string, score: number, rank: number) => ({
  id, text: `Evidence chunk ${id}`, score, rank, source: { id: `source-${id}`, name: `Source ${id}` },
  scores: { dense: score - 0.1, sparse: score - 0.2, final: score },
});

export const Default: Story = {
  render: () => html`<lr-retrieval-compare
    .sets=${[
      { id: 'base', label: 'Hybrid search', chunks: [chunk('a', 0.82, 1), chunk('b', 0.73, 2)] },
      { id: 'rerank', label: 'After reranking', chunks: [chunk('b', 0.94, 1), chunk('c', 0.81, 2)] },
    ]}
  ></lr-retrieval-compare>`,
};

