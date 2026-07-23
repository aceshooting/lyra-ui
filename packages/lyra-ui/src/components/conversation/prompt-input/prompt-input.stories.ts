import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './prompt-input.js';

const meta: Meta = { title: 'Conversation/Prompt Input', component: 'lr-prompt-input' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-prompt-input
    placeholder="Ask the knowledge base"
    .modelCatalog=${['gpt-5', 'local-model']}
    model="gpt-5"
    .mentionItems=${[{ id: 'docs', label: 'documentation' }]}
    .commandItems=${[{ id: 'summarize', label: 'summarize' }]}
    .sources=${[{ id: 'guide', label: 'Product guide', mimeType: 'application/pdf' }]}
  ></lr-prompt-input>`,
};

