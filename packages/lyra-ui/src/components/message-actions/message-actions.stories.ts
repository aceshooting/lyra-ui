import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './message-actions.js';
import '../branch-picker/branch-picker.js';
import '../chat-message/chat-message.js';

const meta: Meta = {
  title: 'MessageActions',
  component: 'lyra-message-actions',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The per-message action toolbar for lyra-chat-message\'s actions slot: opt-in built-ins (copy / regenerate / edit / feedback) plus a slot for custom controls.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const AllBuiltins: Story = {
  render: () => html`
    <lyra-message-actions copy-text="Here's the full response text." .controls=${['copy', 'regenerate', 'edit', 'feedback']}>
    </lyra-message-actions>
  `,
};

export const WithSlottedBranchPicker: Story = {
  render: () => html`
    <lyra-message-actions copy-text="Response text" reveal-on-hover .controls=${['copy', 'regenerate', 'feedback']}>
      <lyra-branch-picker index="1" count="3"></lyra-branch-picker>
    </lyra-message-actions>
  `,
};

export const RevealOnHover: Story = {
  render: () => html`
    <lyra-chat-message data-role="assistant">
      This response has a hover-revealed action bar.
      <lyra-message-actions slot="actions" reveal-on-hover copy-text="hi" .controls=${['copy', 'regenerate']}>
      </lyra-message-actions>
    </lyra-chat-message>
  `,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lyra-color-border);padding:8px;">
      <lyra-message-actions copy-text="hi" .controls=${['copy', 'regenerate', 'edit', 'feedback']}>
      </lyra-message-actions>
    </div>
  `,
};
