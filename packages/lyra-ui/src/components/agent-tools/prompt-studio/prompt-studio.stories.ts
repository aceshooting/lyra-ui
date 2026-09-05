import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './prompt-studio.js';
import type { LyraPromptStudio, PromptStudioMessageReorderDetail } from './prompt-studio.js';

const meta: Meta = {
  title: 'Agent Tools/Prompt Studio',
  component: 'lr-prompt-studio',
  parameters: {
    docs: {
      description: {
        component:
          'A prompt-development workbench. Empty and blank message or version IDs are omitted and later duplicates are first-wins before editing, focus, selection, and events.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const messages = [
  { id: 'system', role: 'system' as const, content: 'Answer {{audience}} with cited evidence.' },
  { id: 'user', role: 'user' as const, content: 'Explain hybrid retrieval.' },
];

export const Default: Story = {
  render: () => html`<lr-prompt-studio
    .messages=${messages}
    .variables=${[{ name: 'audience', value: 'developers' }]}
    .versions=${[{ id: 'v1', label: 'Production', messages }]}
  ></lr-prompt-studio>`,
};

export const PreviewLimit: Story = {
  render: () => html`
    <p>Preview expansion stops at its resource limits. Messages and variables remain editable and save/run keep the original values.</p>
    <lr-prompt-studio
      .messages=${[{ id: 'limited', role: 'user' as const, content: '{{v0}}' }]}
      .variables=${Array.from({ length: 65 }, (_, index) => ({
        name: `v${index}`,
        value: index < 64 ? `{{v${index + 1}}}` : 'Resolved text',
      }))}
    ></lr-prompt-studio>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long content and selected version)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-prompt-studio
        label="Multilingual customer-support prompt development workspace"
        selected-version-id="production"
        .messages=${[
          ...messages,
          {
            id: 'assistant',
            role: 'assistant' as const,
            content: 'A deliberately long preview value: {{long_variable_name_for_customer_context}}',
          },
        ]}
        .variables=${[{ name: 'long_variable_name_for_customer_context', value: 'Enterprise customer in Luxembourg' }]}
        .versions=${[
          { id: 'production', label: 'Production prompt with multilingual safeguards', messages },
          { id: 'candidate', label: 'Candidate experiment', messages },
        ]}
      ></lr-prompt-studio>
    </div>
  `,
};

/** The cancelable reorder event makes persistence host-controlled: this listener accepts the
 * proposal by assigning its immutable next array back after vetoing the component's immediate
 * update. Production hosts can persist the same proposal first, then assign it when accepted. */
export const Reorderable: Story = {
  name: 'Reorderable messages (host-controlled)',
  render: () => html`
    <lr-prompt-studio
      reorderable
      .messages=${messages}
      .variables=${[{ name: 'audience', value: 'developers' }]}
      @lr-message-reorder=${(event: CustomEvent<PromptStudioMessageReorderDetail>) => {
        event.preventDefault();
        (event.currentTarget as LyraPromptStudio).messages = event.detail.messages;
      }}
    ></lr-prompt-studio>
  `,
};
