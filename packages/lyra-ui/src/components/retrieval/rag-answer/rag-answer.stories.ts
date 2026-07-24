import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './rag-answer.js';
const meta: Meta = { title: 'RagAnswer', component: 'lr-rag-answer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-rag-answer answer="The retrieval pipeline found a grounded answer." .citations=${[{ id: 'c1', sourceId: 'd1' }]} .sources=${[{ id: 'd1', name: 'runbook.md', mimeType: 'text/markdown' }]} .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}></lr-rag-answer>` };
export const Loading: Story = { render: () => html`<lr-rag-answer loading></lr-rag-answer>` };
export const NarrowAllStates: Story = {
  name: 'Narrow long content + states (320px)',
  render: () => html`
    <div style="display:grid; gap:1rem; inline-size:320px; max-inline-size:100%;">
      <lr-rag-answer loading label="Loading narrow grounded response"></lr-rag-answer>
      <lr-rag-answer
        error="The retrieval service could not load a deliberately long evidence request. Retry when connectivity returns."
      ></lr-rag-answer>
      <lr-rag-answer
        answer="The grounded answer includes anUnbrokenEvidenceIdentifierThatMustWrapInsideTheNarrowAllocation and a longer explanatory sentence."
        .citations=${[{ id: 'c1', sourceId: 'd1', label: 'Long source citation' }]}
        .sources=${[
          {
            id: 'd1',
            name: 'source-with-a-deliberately-long-unbroken-filename-that-must-not-overflow.md',
            mimeType: 'text/markdown',
          },
        ]}
        .assessment=${{ supportedClaims: 1, unsupportedClaims: 1, coverage: 0.5 }}
      ></lr-rag-answer>
    </div>
  `,
};
