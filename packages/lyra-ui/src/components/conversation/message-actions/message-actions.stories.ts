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
          'The per-message action toolbar for lr-chat-message\'s actions slot: opt-in built-ins (copy / regenerate / edit / feedback) plus a slot for custom controls. Duplicate built-in names normalize first-wins; provider actions require nonblank IDs and omit later duplicates. Departing managed controls restore untouched authored tab stops through their optional toolbar release hook. ArrowLeft/ArrowRight/Home/End from a slotted feedback comment editor remain native editing keys. Roving navigation still operates on the actual toolbar and thumb actions.',
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
    <lr-message-actions copy-text="Response text" reveal-on-interaction .controls=${['copy', 'regenerate', 'feedback']}>
      <lr-branch-picker index="1" count="3"></lr-branch-picker>
    </lr-message-actions>
  `,
};

export const FeedbackPersistenceById: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The wrapper receives the built-in feedback event once. Prevent it, then settle its current transaction through the wrapper with the exact submission ID.',
      },
    },
  },
  render: () => {
    const settle = (event: Event): void => {
      event.preventDefault();
      const host = event.currentTarget as HTMLElement & {
        finalizePendingSubmit(submissionId: string): boolean;
      };
      const submissionId = (
        event as CustomEvent<{ readonly submissionId: string }>
      ).detail.submissionId;
      window.setTimeout(() => host.finalizePendingSubmit(submissionId), 750);
    };
    return html`
      <lr-message-actions
        .controls=${['feedback']}
        @lr-feedback-submit=${settle}
      ></lr-message-actions>
    `;
  },
};

export const UnavailableSlottedControl: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Unavailable slotted controls are excluded from the toolbar roving order. The available action remains the single usable Tab and arrow-navigation fallback.',
      },
    },
  },
  render: () => html`
    <lr-message-actions>
      <button inert>Unavailable custom action</button>
      <button>Available custom action</button>
    </lr-message-actions>
  `,
};

export const RevealOnInteraction: Story = {
  render: () => html`
    <lr-chat-message message-role="assistant">
      This response has a hover-revealed action bar.
      <lr-message-actions slot="actions" reveal-on-interaction copy-text="hi" .controls=${['copy', 'regenerate']}>
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
