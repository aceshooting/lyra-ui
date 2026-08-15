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

/** A dense point set with long, unbroken labels -- exercises a 320px allocation harder than the
 * short 1-2 word labels above: more points crowd the plot, and long labels stress the per-point
 * accessible name and tooltip without being allowed to expand the allocation. */
const denseLongLabelPoints: EmbeddingPoint[] = [
  { id: '1', x: -1.2, y: 0.2, label: 'Deployment guide: zero-downtime blue-green rollout procedure', cluster: 'docs' },
  { id: '2', x: -0.8, y: 0.5, label: 'Runbook: database failover and replica promotion checklist', cluster: 'docs' },
  { id: '3', x: -0.3, y: 0.8, label: 'Onboarding guide for new platform engineering contributors', cluster: 'docs' },
  { id: '4', x: 0.1, y: 0.3, label: 'Architecture decision record: message queue backpressure strategy', cluster: 'docs' },
  { id: '5', x: 0.8, y: -0.3, label: 'Incident report: elevated latency in the payments gateway', cluster: 'incidents' },
  { id: '6', x: 1.2, y: -0.7, label: 'Postmortem: cascading failure across the ingestion pipeline', cluster: 'incidents' },
  { id: '7', x: 0.6, y: -0.9, label: 'Incident report: authentication service certificate expiry', cluster: 'incidents' },
  { id: '8', x: 0.9, y: -0.1, label: 'Postmortem: region-wide outage during scheduled maintenance', cluster: 'incidents' },
  { id: '9', x: 0.2, y: 0.9, label: 'API reference: embedding search and reranking endpoints', cluster: 'reference' },
  { id: '10', x: -0.1, y: 0.6, label: 'API reference: authentication and rate-limit headers', cluster: 'reference' },
  { id: '11', x: 0.4, y: 0.4, label: 'API reference: pagination cursors and batch export limits', cluster: 'reference' },
  { id: '12', x: -0.6, y: -0.4, label: 'unbrokenidentifierstringusedtoexercisenarrowallocationwrapping', cluster: 'reference' },
];

export const Default: Story = { render: () => html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>` };
export const Empty: Story = { render: () => html`<lr-embedding-explorer></lr-embedding-explorer>` };

/** `height` sizes the plot through `--lr-embedding-explorer-height`. */
export const CustomHeight: Story = {
  render: () => html`<lr-embedding-explorer height="220px" .points=${points}></lr-embedding-explorer>`,
};

/** `height="auto"` sizes the plot from the `viewBox` aspect ratio instead of a fixed block size. */
export const AutoHeight: Story = {
  render: () => html`<lr-embedding-explorer height="auto" .points=${points}></lr-embedding-explorer>`,
};

/** A dense point set with long labels at a 320px allocation: the plot must scale to fit without
 * expanding the allocation, and each point's 24px hit target must stay reachable. */
export const Narrow: Story = {
  name: 'Narrow (320px), dense long labels',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-embedding-explorer .points=${denseLongLabelPoints}></lr-embedding-explorer>
    </div>
  `,
};
