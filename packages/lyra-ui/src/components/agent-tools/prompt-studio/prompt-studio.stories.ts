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

