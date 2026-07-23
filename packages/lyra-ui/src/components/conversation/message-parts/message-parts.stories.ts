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

export const Default: Story = {
  render: () => html`<lr-message-parts .parts=${parts}></lr-message-parts>`,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-message-parts .parts=${parts}></lr-message-parts>
    </div>
  `,
};
