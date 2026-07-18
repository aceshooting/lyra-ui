import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './path-strip.js';
import type { LyraPathElement } from './path-strip.class.js';

const meta: Meta = {
  title: 'Path Strip',
  component: 'lyra-path-strip',
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
  render: () => html`<lyra-path-strip .path=${path}></lyra-path-strip>`,
};

export const Empty: Story = {
  render: () => html`<lyra-path-strip></lyra-path-strip>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lyra-path-strip .path=${path}></lyra-path-strip></div>`,
};
