import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './provenance-panel.js';
import type { LyraProvenance } from './provenance-panel.class.js';

const meta: Meta = {
  title: 'Provenance Panel',
  component: 'lr-provenance-panel',
  parameters: { docs: { description: { component: 'Entity type lookup ignores malformed rows while retaining later valid matching type labels.' } } },
};
export default meta;
type Story = StoryObj;

const provenance: LyraProvenance = {
  entities: [
    { id: 'e1', label: 'Marie Curie', type: 'person' },
    { id: 'e2', label: 'Pierre Curie', type: 'person' },
  ],
  relationships: [
    {
      path: [
        { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
        { kind: 'edge', relation: 'discovered', directed: true },
        { kind: 'node', node: { id: 'elem1', label: 'Polonium' } },
      ],
    },
  ],
  communities: [{ id: 'c1', label: 'Nobel laureates', memberCount: 3 }],
  chunks: [{ id: 'ch1', text: 'Radium and polonium were both discovered by Marie and Pierre Curie in 1898.', score: 0.92, sourceId: 's1', title: 'curie-bio.pdf', page: 3 }],
};

export const Default: Story = {
  render: () => html`<lr-provenance-panel .provenance=${provenance} .types=${[{ id: 'person', label: 'Person' }]}></lr-provenance-panel>`,
};

export const Empty: Story = {
  render: () => html`<lr-provenance-panel></lr-provenance-panel>`,
};

export const EntitiesOnly: Story = {
  render: () => html`<lr-provenance-panel .provenance=${{ entities: provenance.entities }}></lr-provenance-panel>`,
};

export const CenteredEntityChips: Story = {
  render: () => html`
    <div style="max-width: 24rem;">
      <lr-provenance-panel
        style="--lr-provenance-panel-entity-justify: center;"
        .provenance=${{
          entities: [
            { id: 'e1', label: 'Marie Curie', type: 'person' },
            { id: 'e2', label: 'Pierre Curie', type: 'person' },
            { id: 'e3', label: 'Henri Becquerel', type: 'person' },
            { id: 'e4', label: 'Polonium', type: 'element' },
            { id: 'e5', label: 'Radium', type: 'element' },
          ],
        }}
      ></lr-provenance-panel>
    </div>
  `,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-provenance-panel .provenance=${provenance}></lr-provenance-panel></div>`,
};
