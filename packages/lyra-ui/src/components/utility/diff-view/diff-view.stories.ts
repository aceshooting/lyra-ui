import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './diff-view.js';

const meta: Meta = {
  title: 'DiffView',
  component: 'lr-diff-view',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A real two-string line diff (LCS-aligned), rendered as interleaved unified-diff output. A one-line change inside a longer block renders as one red/green pair near the change, not every old line followed by every new line. Unsupported `layout` values normalize to reflected `unified`.',
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
  render: () => html`<lr-diff-view .oldText=${oldText} .newText=${newText} style="max-width: 32rem;"></lr-diff-view>`,
};

export const Copyable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The button remains in its resting state until the Clipboard API settles. A fulfilled write emits the frozen success-only `lr-copy` outcome. Rejections show and announce the localized failure state and emit `lr-error` plus the frozen detailed `lr-copy-error` outcome.',
      },
    },
  },
  render: () => html`
    <lr-diff-view copyable .oldText=${oldText} .newText=${newText} style="max-width: 32rem;"></lr-diff-view>
  `,
};

export const Split: Story = {
  render: () => html`<lr-diff-view layout="split" .oldText=${oldText} .newText=${newText} style="max-width: 40rem;"></lr-diff-view>`,
};

export const SplitNarrow: Story = {
  render: () =>
    html`<div style="max-width: 320px;">
      <lr-diff-view
        layout="split"
        .oldText=${'function add(a, b) {\n  return a + b;\n}'}
        .newText=${'function add(a, b, c) {\n  return a + b + c;\n}'}
      ></lr-diff-view>
    </div>`,
};

export const EmptyDocument: Story = {
  name: 'Empty document against one added line',
  parameters: {
    docs: {
      description: {
        story: 'An empty document has zero logical lines, so this renders exactly one addition with no phantom blank row.',
      },
    },
  },
  render: () => html`<lr-diff-view .oldText=${''} .newText=${'created'} copyable></lr-diff-view>`,
};
