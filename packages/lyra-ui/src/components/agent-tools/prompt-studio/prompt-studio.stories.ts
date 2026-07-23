import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './prompt-studio.js';

const meta: Meta = { title: 'Agent Tools/Prompt Studio', component: 'lr-prompt-studio' };
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
