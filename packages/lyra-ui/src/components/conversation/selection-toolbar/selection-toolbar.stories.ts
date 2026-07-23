import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './selection-toolbar.js';

const meta: Meta = {
  title: 'Selection Toolbar',
  component: 'lr-selection-toolbar',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div style="min-height: 12rem; max-width: 40rem;">
      <p>
        The highlighted passage can be sent to an assistant, quoted, cited, or copied. The toolbar
        carries the selected text and its document locator in each action event.
      </p>
      <lr-selection-toolbar
        open
        text="The highlighted passage can be sent to an assistant."
        .anchor=${{ kind: 'text-quote', quote: 'The highlighted passage can be sent to an assistant.' }}
        .rect=${new DOMRect(60, 150, 280, 28)}
      ></lr-selection-toolbar>
    </div>
  `,
};
