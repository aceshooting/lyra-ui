import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './drilldown-panel.js';
import type { DrilldownNode } from './drilldown-panel.class.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';

const meta: Meta = {
  title: 'Drilldown Panel',
  component: 'lr-drilldown-panel',
};
export default meta;
type Story = StoryObj;

const entity: LyraEntity = {
  id: 'e1',
  label: 'Acme EMEA Holdings',
  type: 'org',
  description: 'Regional holding entity for EMEA operations.',
  properties: { region: 'EMEA', founded: '1998' },
  degree: 7,
};

const types = [{ id: 'org', label: 'Organization', color: 'var(--lr-color-brand)' }];

const path: DrilldownNode[] = [
  {
    id: 'chart-q3-revenue',
    label: 'Q3 revenue',
    evidence: [
      {
        id: 'src-1',
        title: 'q3_close_summary.pdf',
        page: 4,
        href: 'https://example.com/q3_close_summary.pdf',
        excerpt: 'Q3 revenue grew 12% year over year, driven primarily by EMEA…',
        full: 'Q3 revenue grew 12% year over year, driven primarily by EMEA (+18%) offsetting a soft APAC quarter (-3%).',
      },
    ],
  },
  {
    id: 'emea-region',
    label: 'EMEA region',
    evidence: [
      { id: 'src-2', title: 'regional_notes.txt', excerpt: 'Anomaly flagged by the finance team on 2026-07-14.' },
    ],
    documents: [
      { id: 'doc-1', name: 'emea_contract_renewal.pdf', mimeType: 'application/pdf', uri: 'https://example.com/emea_contract_renewal.pdf' },
    ],
    entities: [entity],
  },
];

export const Default: Story = {
  render: () => html`<lr-drilldown-panel .path=${path} .types=${types}></lr-drilldown-panel>`,
};

export const SingleCategoryNoTabs: Story = {
  render: () => html`<lr-drilldown-panel .path=${[path[0]]}></lr-drilldown-panel>`,
};

export const WithAgentRuns: Story = {
  render: () => html`
    <lr-drilldown-panel .path=${path} .types=${types}>
      <div slot="runs">
        <p>Run #42 — completed in 4.2s, 3 tool calls, no errors.</p>
      </div>
    </lr-drilldown-panel>
  `,
};

export const EmptySelection: Story = {
  render: () => html`<lr-drilldown-panel></lr-drilldown-panel>`,
};

export const NoContentForCurrentNode: Story = {
  render: () => html`<lr-drilldown-panel .path=${[{ id: 'datum-empty', label: 'Datum with no related content' }]}></lr-drilldown-panel>`,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-drilldown-panel .path=${path} .types=${types}></lr-drilldown-panel>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-drilldown-panel .path=${path} .types=${types}></lr-drilldown-panel>
    </div>
  `,
};
