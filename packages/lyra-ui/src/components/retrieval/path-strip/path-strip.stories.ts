import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../../lr-path-strip.js';
import type { LyraPathElement } from './path-strip.class.js';

const meta: Meta = {
  title: 'Path Strip',
  component: 'lr-path-strip',
};
export default meta;
type Story = StoryObj;

const path: LyraPathElement[] = [
  { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
  { kind: 'edge', relation: 'discovered', directed: true },
  { kind: 'node', node: { id: 'e2', label: 'Polonium' } },
  { kind: 'edge', relation: 'is_a', directed: true },
  { kind: 'node', node: { id: 'e3', label: 'Chemical element' } },
];

export const Default: Story = {
  render: () => html`<lr-path-strip .path=${path}></lr-path-strip>`,
};

export const Empty: Story = {
  render: () => html`<lr-path-strip></lr-path-strip>`,
};

export const RepeatedOccurrences: Story = {
  render: () => html`
    <lr-path-strip
      .path=${[
        { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
        { kind: 'edge', relation: 'collaborated with', directed: true },
        { kind: 'node', node: { id: 'e2', label: 'Pierre Curie' } },
        { kind: 'edge', relation: 'returned to', directed: true },
        { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
      ] satisfies LyraPathElement[]}
    ></lr-path-strip>
  `,
};

export const Narrow: Story = {
  render: () =>
    html`<div style="max-width: 320px;">
      <lr-path-strip .path=${path}></lr-path-strip>
    </div>`,
};

export const RenderLimit: Story = {
  name: 'Render limit (first 200 elements)',
  parameters: {
    docs: {
      description: {
        story: 'Only the first 200 valid elements render, navigate and emit; `[part="limit"]` says the path continues.',
      },
    },
  },
  render: () => html`<lr-path-strip
    .path=${Array.from({ length: 210 }, (_, index): LyraPathElement => index % 2 === 0
      ? { kind: 'node', node: { id: `n${index}`, label: `Node ${index / 2 + 1}` } }
      : { kind: 'edge', relation: 'links', directed: true })}
  ></lr-path-strip>`,
};
