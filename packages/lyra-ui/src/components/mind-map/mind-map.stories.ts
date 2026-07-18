import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './mind-map.js';
import type { LyraTopic } from './mind-map.class.js';

const meta: Meta = {
  title: 'Mind Map',
  component: 'lr-mind-map',
};
export default meta;
type Story = StoryObj;

const topics: LyraTopic[] = [
  {
    id: 'root',
    label: 'Knowledge Graph RAG',
    children: [
      { id: 'kg', label: 'Knowledge graphs', children: [{ id: 'entities', label: 'Entities' }, { id: 'communities', label: 'Communities' }] },
      { id: 'rag', label: 'Retrieval', children: [{ id: 'chunking', label: 'Chunking' }, { id: 'ranking', label: 'Ranking' }] },
      { id: 'viz', label: 'Visualization' },
    ],
  },
];

export const Default: Story = {
  render: () => html`<div style="height: 480px;"><lr-mind-map .topics=${topics}></lr-mind-map></div>`,
};

export const MultiRoot: Story = {
  render: () => html`<div style="height: 480px;">
    <lr-mind-map label="Session topics" .topics=${[{ id: 'a', label: 'Chunking strategies' }, { id: 'b', label: 'Graph layouts' }]}></lr-mind-map>
  </div>`,
};

export const DeeplyExpanded: Story = {
  render: () => html`<div style="height: 480px;"><lr-mind-map .topics=${topics} expand-depth="3"></lr-mind-map></div>`,
};

export const Empty: Story = {
  render: () => html`<lr-mind-map></lr-mind-map>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px; height: 400px;"><lr-mind-map .topics=${topics}></lr-mind-map></div>`,
};
