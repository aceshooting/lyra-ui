import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './copy-button.js';

const meta: Meta = {
  title: 'CopyButton',
  component: 'lr-copy-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A standalone icon-only copy-to-clipboard affordance for a plain text `value`, with no positioning opinion of its own -- the consumer places it (e.g. absolutely positioned in the corner of a textarea or read-only output field). Swaps its icon to a checkmark for ~1.5s on activation.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-copy-button value="npm install @aceshooting/lyra-ui"></lr-copy-button>`,
};

export const CustomAccessibleLabel: Story = {
  render: () => html`
    <lr-copy-button
      aria-label="Copy installation command"
      value="npm install @aceshooting/lyra-ui"
      feedback-duration="3000"
    ></lr-copy-button>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-copy-button disabled value="Unavailable"></lr-copy-button>`,
};

export const InACornerOverlay: Story = {
  name: 'In a corner overlay',
  render: () => html`
    <div
      style="position: relative; inline-size: 20rem; padding: 1rem; border: 1px solid var(--lr-color-border); border-radius: 0.5rem;"
    >
      <pre style="margin: 0; white-space: pre-wrap;">npm install @aceshooting/lyra-ui</pre>
      <div style="position: absolute; top: 0.5rem; inset-inline-end: 0.5rem;">
        <lr-copy-button value="npm install @aceshooting/lyra-ui"></lr-copy-button>
      </div>
    </div>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lr-copy-button
      value="hello world"
      @lr-copy=${(e: CustomEvent<{ text: string }>) => {
        const out = document.getElementById('copy-button-log');
        if (out) out.textContent = `lr-copy: ${e.detail.text}`;
      }}
    ></lr-copy-button>
    <p id="copy-button-log" style="font-family: monospace; margin-top: 0.5rem;">(no event yet)</p>
  `,
};
