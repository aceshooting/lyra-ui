import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './rag-answer.js';
const meta: Meta = {
  title: 'RagAnswer',
  component: 'lr-rag-answer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A grounded answer surface that canonicalizes citations, sources, and nested assessment claims independently by nonblank id before composition, counts, rendering, lookup, and actions. Both nested citation activation/open signals are contained and translated to one section-qualified `lr-citation-select` event.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-rag-answer answer="The retrieval pipeline found a grounded answer." .citations=${[{ id: 'c1', sourceId: 'd1' }]} .sources=${[{ id: 'd1', name: 'runbook.md', mimeType: 'text/markdown' }]} .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }} @lr-citation-select=${(event: CustomEvent) => console.log('lr-citation-select', event.detail)}></lr-rag-answer>` };
export const Loading: Story = { render: () => html`<lr-rag-answer loading></lr-rag-answer>` };
export const SlotOverrides: Story = {
  render: () => html`
    <lr-rag-answer loading>
      <p slot="answer">A partial streamed answer supplied entirely through the answer slot.</p>
      <div slot="sources">A custom source surface supplied without a redundant sources property.</div>
    </lr-rag-answer>
  `,
};
export const NarrowAllStates: Story = {
  name: 'Narrow long content + states (320px)',
  render: () => html`
    <div style="display:grid; gap:1rem; inline-size:320px; max-inline-size:100%;">
      <lr-rag-answer loading label="Loading narrow grounded response"></lr-rag-answer>
      <lr-rag-answer
        error-text="The retrieval service could not load a deliberately long evidence request. Retry when connectivity returns."
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

export const AnnounceOnMount: Story = {
  name: 'Announce on mount',
  parameters: {
    docs: {
      description: {
        story:
          'An answer surface rendered in response to a question the user just asked should carry `announce`: the `errorText` it already holds when it first mounts is sent to the shared assertive light-DOM sink once, exactly as a later `errorText` change is. Leave it off for an answer that is part of the page being loaded — its visible error is read in document order already. An answer with no error announces nothing, and later `errorText` changes announce either way.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); justify-items: start;">
      <button
        @click=${(event: Event) => {
          const host = (event.currentTarget as HTMLElement).parentElement!;
          const answer = document.createElement('lr-rag-answer');
          answer.setAttribute('announce', '');
          answer.setAttribute(
            'error-text',
            'The retrieval service timed out before the answer could be grounded.'
          );
          host.append(answer);
        }}
      >
        Show a freshly mounted failed answer
      </button>
      <lr-rag-answer
        error-text="This one is part of the page and is deliberately not announced."
      ></lr-rag-answer>
    </div>
  `,
};
