import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './embedding-explorer.js';
import type { EmbeddingPoint } from './embedding-explorer.class.js';

const meta: Meta = { title: 'EmbeddingExplorer', component: 'lr-embedding-explorer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const points: EmbeddingPoint[] = [
  { id: '1', x: -1.2, y: 0.2, label: 'Deployment guide', cluster: 'docs' },
  { id: '2', x: -0.8, y: 0.5, label: 'Runbook', cluster: 'docs' },
  { id: '3', x: 0.8, y: -0.3, label: 'Incident report', cluster: 'incidents' },
  { id: '4', x: 1.2, y: -0.7, label: 'Postmortem', cluster: 'incidents' },
  { id: '5', x: 0.2, y: 0.9, label: 'API reference', cluster: 'reference' },
];

export const Default: Story = { render: () => html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>` };
export const Empty: Story = { render: () => html`<lr-embedding-explorer></lr-embedding-explorer>` };
