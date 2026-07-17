import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './diff-view.js';

const meta: Meta = {
  title: 'DiffView',
  component: 'lyra-diff-view',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A real two-string line diff (LCS-aligned), rendered as interleaved unified-diff output. A one-line change inside a longer block renders as one red/green pair near the change, not every old line followed by every new line.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const oldText = `function greet(name) {
  const trimmed = name.trim();
  return "Hello, " + trimmed;
}`;

const newText = `function greet(name) {
  const trimmed = name.trim();
  return \`Hello, \${trimmed}!\`;
}`;

export const Default: Story = {
  name: 'One-line change inside a longer block',
  render: () => html`<lyra-diff-view .oldText=${oldText} .newText=${newText} style="max-width: 32rem;"></lyra-diff-view>`,
};

export const Copyable: Story = {
  render: () => html`
    <lyra-diff-view copyable .oldText=${oldText} .newText=${newText} style="max-width: 32rem;"></lyra-diff-view>
  `,
};

export const Split: Story = {
  render: () => html`<lyra-diff-view layout="split" .oldText=${oldText} .newText=${newText} style="max-width: 40rem;"></lyra-diff-view>`,
};

export const SplitNarrow: Story = {
  render: () =>
    html`<div style="max-width: 320px;">
      <lyra-diff-view
        layout="split"
        .oldText=${'function add(a, b) {\n  return a + b;\n}'}
        .newText=${'function add(a, b, c) {\n  return a + b + c;\n}'}
      ></lyra-diff-view>
    </div>`,
};
