import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { MessagePart } from '../../../ai/types.js';
import './message-parts.js';

const meta: Meta = {
  title: 'Message Parts',
  component: 'lr-message-parts',
  tags: ['autodocs'],
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
