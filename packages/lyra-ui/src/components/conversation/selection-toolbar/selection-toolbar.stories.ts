import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './selection-toolbar.js';

const meta: Meta = { title: 'Conversation/Selection Toolbar', component: 'lr-selection-toolbar' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<div style="min-block-size:var(--lr-size-8rem);position:relative">
    <lr-selection-toolbar
      open
      text="Selected source text"
      .rect=${new DOMRect(120, 96, 180, 24)}
      .anchor=${{ kind: 'text-quote', quote: 'Selected source text' }}
    ></lr-selection-toolbar>
  </div>`,
};

