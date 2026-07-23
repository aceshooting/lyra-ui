import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './message-parts.js';

const meta: Meta = { title: 'Conversation/Message Parts', component: 'lr-message-parts' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-message-parts
    .parts=${[
      { id: 'reasoning', type: 'reasoning', text: 'Checking the retrieved sources.', state: 'complete' },
      { id: 'answer', type: 'text', text: '**Lyra** renders ordered message parts.', state: 'complete' },
      { id: 'citation', type: 'citation', citation: { id: 'c1', sourceId: 'guide', label: 'Guide' }, state: 'complete' },
    ]}
  ></lr-message-parts>`,
};

