import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './claim-evidence.js';

const meta: Meta = { title: 'Retrieval/Claim Evidence', component: 'lr-claim-evidence' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-claim-evidence
    .claims=${[
      { id: 'c1', text: 'Hybrid search combines dense and sparse retrieval.', status: 'supported', citationIds: ['s1'], confidence: 0.94 },
      { id: 'c2', text: 'It always improves accuracy.', status: 'unsupported', citationIds: [], explanation: 'No universal evidence.' },
    ]}
    .citations=${[{ id: 's1', sourceId: 'guide', label: 'Search guide', quote: 'Hybrid search combines both signals.' }]}
  ></lr-claim-evidence>`,
};

