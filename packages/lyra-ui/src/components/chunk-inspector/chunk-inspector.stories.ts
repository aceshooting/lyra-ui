import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './chunk-inspector.js';
import type { LyraChunk } from './chunk-inspector.class.js';

const meta: Meta = {
  title: 'Chunk Inspector',
  component: 'lr-chunk-inspector',
};
export default meta;
type Story = StoryObj;

const chunks: LyraChunk[] = [
  {
    id: 'c1',
    text: 'Radium and polonium were both discovered by Marie and Pierre Curie in 1898, while studying the mineral pitchblende.',
    score: 0.92,
    sourceId: 's1',
    title: 'curie-bio.pdf',
    page: 3,
    anchor: { kind: 'page', page: 3 },
  },
  { id: 'c2', text: 'Marie Curie won the Nobel Prize in Physics in 1903 and Chemistry in 1911.', score: 0.6, sourceId: 's1', page: 5 },
  { id: 'c3', text: 'Unrelated background text about the periodic table of elements.', score: 0.2, sourceId: 's2' },
];

export const Default: Story = {
  render: () => html`<lr-chunk-inspector .chunks=${chunks} @lr-chunk-open=${(e: CustomEvent) => console.log(e.detail)}></lr-chunk-inspector>`,
};

export const Compact: Story = {
  render: () => html`<lr-chunk-inspector .chunks=${chunks} compact></lr-chunk-inspector>`,
};

export const Empty: Story = {
  render: () => html`<lr-chunk-inspector></lr-chunk-inspector>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-chunk-inspector .chunks=${chunks}></lr-chunk-inspector></div>`,
};
