import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { RetrievalChunk } from '../../../ai/types.js';
import type { RetrievalComparisonSet } from './retrieval-compare.class.js';
import './retrieval-compare.js';

const meta: Meta = {
  title: 'Retrieval Compare',
  component: 'lr-retrieval-compare',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

function chunk(id: string, sourceName: string, score: number, rank: number): RetrievalChunk {
  return {
    id,
    text: `A representative passage from ${sourceName} with enough text to exercise wrapping.`,
    score,
    rank,
    source: { id: `source-${id}`, name: sourceName },
    scores: { dense: score - 0.08, sparse: score - 0.16, final: score },
  };
}

const sets: RetrievalComparisonSet[] = [
  {
    id: 'baseline',
    label: 'Baseline retrieval',
    chunks: [
      chunk('annual-report', 'Annual report', 0.82, 1),
      chunk('earnings-call', 'Earnings call transcript', 0.75, 2),
    ],
  },
  {
    id: 'reranked',
    label: 'After reranking',
    chunks: [
      chunk('annual-report', 'Annual report', 0.94, 1),
      chunk('risk-register', 'Enterprise risk register', 0.81, 2),
    ],
  },
];

const renderComparison = () => html`
  <lr-retrieval-compare
    selected-chunk-id="annual-report"
    .sets=${sets}
  ></lr-retrieval-compare>
`;

export const Default: Story = {
  render: renderComparison,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;">${renderComparison()}</div>`,
};
