import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './prompt-queue.js';

const meta: Meta = { title: 'Conversation/Prompt Queue', component: 'lr-prompt-queue' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-prompt-queue
    .items=${[
      { id: 'q1', value: 'Compare the cited approaches.' },
      { id: 'q2', value: 'Turn the result into an implementation checklist.' },
    ]}
  ></lr-prompt-queue>`,
};

