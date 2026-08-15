import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { MessagePart } from '../../../ai/types.js';
import './message-parts.js';

const meta: Meta = {
  title: 'Message Parts',
  component: 'lr-message-parts',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Part ids normalize to one unique nonempty first-wins collection shared by rendering, citation ranks, retries, and error announcements.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const parts: MessagePart[] = [
  {
    id: 'reasoning',
    type: 'reasoning',
    text: 'Comparing the retrieved passages with the requested time range.',
    state: 'complete',
  },
  {
    id: 'answer',
    type: 'text',
    text: '**Revenue increased 18% year over year**, led by the enterprise segment.',
    state: 'complete',
  },
  {
    id: 'citation',
    type: 'citation',
    citation: {
      id: 'cite-1',
      sourceId: 'annual-report',
      label: 'Annual report, page 12',
      quote: 'Enterprise revenue increased by 18% compared with the prior year.',
    },
  },
];

const citationDenseParts: MessagePart[] = Array.from(
  { length: 100 },
  (_, index): MessagePart =>
    index % 2 === 0
      ? { id: `text-${index}`, type: 'text', text: `Evidence segment ${index / 2 + 1}.` }
      : {
          id: `citation-${index}`,
          type: 'citation',
          citation: {
            id: `cite-${index}`,
            sourceId: `source-${index}`,
            label: `Source ${Math.ceil(index / 2)}`,
          },
        }
);

export const Default: Story = {
  render: () => html`<lr-message-parts .parts=${parts}></lr-message-parts>`,
};

export const StreamingTextAndReasoning: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Both built-in Markdown paths receive each part’s streaming state, coalescing parse/highlight work until the host replaces the same-id part with `state: "complete"`.',
      },
    },
  },
  render: () => html`
    <lr-message-parts
      .parts=${[
        { id: 'thought', type: 'reasoning', text: 'Comparing sources…', state: 'streaming' },
        { id: 'answer', type: 'text', text: '**Drafting the answer…**', state: 'streaming' },
      ] satisfies MessagePart[]}
    ></lr-message-parts>
  `,
};

/** State-specific custom properties independently retheme streaming, transcript, and error parts. */
export const ThemeableStateColors: Story = {
  render: () => html`
    <div
      style="
        --lr-message-parts-streaming-color: var(--lr-color-success);
        --lr-message-parts-audio-transcript-color: var(--lr-color-warning);
        --lr-message-parts-error-border-color: var(--lr-color-danger);
        --lr-message-parts-error-background: var(--lr-color-warning-quiet);
        --lr-message-parts-error-color: var(--lr-color-danger);
      "
    >
      <lr-message-parts
        .parts=${[
          { id: 'draft', type: 'text', text: 'Drafting an answer…', state: 'streaming' },
          { id: 'audio', type: 'audio', transcript: 'Spoken answer transcript.' },
          { id: 'error', type: 'error', message: 'The response could not complete.', retryable: true },
        ] satisfies MessagePart[]}
      ></lr-message-parts>
    </div>
  `,
};

export const HighCitationDensity: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Fifty interleaved citations keep sequential ranks while the component derives them in one linear pass.',
      },
    },
  },
  render: () => html`<lr-message-parts .parts=${citationDenseParts}></lr-message-parts>`,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-message-parts .parts=${parts}></lr-message-parts>
    </div>
  `,
};
