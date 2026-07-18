import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './message-actions.js';
import '../branch-picker/branch-picker.js';
import '../chat-message/chat-message.js';

const meta: Meta = {
  title: 'MessageActions',
  component: 'lr-message-actions',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The per-message action toolbar for lr-chat-message\'s actions slot: opt-in built-ins (copy / regenerate / edit / feedback) plus a slot for custom controls.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const AllBuiltins: Story = {
  render: () => html`
    <lr-message-actions copy-text="Here's the full response text." .controls=${['copy', 'regenerate', 'edit', 'feedback']}>
    </lr-message-actions>
  `,
};

export const WithSlottedBranchPicker: Story = {
  render: () => html`
    <lr-message-actions copy-text="Response text" reveal-on-hover .controls=${['copy', 'regenerate', 'feedback']}>
      <lr-branch-picker index="1" count="3"></lr-branch-picker>
    </lr-message-actions>
  `,
};

export const RevealOnHover: Story = {
  render: () => html`
    <lr-chat-message data-role="assistant">
      This response has a hover-revealed action bar.
      <lr-message-actions slot="actions" reveal-on-hover copy-text="hi" .controls=${['copy', 'regenerate']}>
      </lr-message-actions>
    </lr-chat-message>
  `,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-message-actions copy-text="hi" .controls=${['copy', 'regenerate', 'edit', 'feedback']}>
      </lr-message-actions>
    </div>
  `,
};
