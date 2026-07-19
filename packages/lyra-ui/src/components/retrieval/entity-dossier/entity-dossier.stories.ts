import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './entity-dossier.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraNeighborRow } from '../neighbor-list/neighbor-list.class.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraProvenance } from '../provenance-panel/provenance-panel.class.js';
import type { LyraEntityDossierConfidence } from './entity-dossier.class.js';

const meta: Meta = {
  title: 'Entity Dossier',
  component: 'lr-entity-dossier',
};
export default meta;
type Story = StoryObj;

const entity: LyraEntity = {
  id: 'e1',
  label: 'Marie Curie',
  type: 'person',
  description: 'Physicist and chemist, pioneer of research on radioactivity.',
  properties: { born: '1867', nationality: 'Polish-French' },
  degree: 5,
  communityId: 'c1',
};

const types = [
  { id: 'person', label: 'Person', color: 'var(--lr-color-brand)' },
  { id: 'element', label: 'Element', color: 'var(--lr-color-success)' },
  { id: 'org', label: 'Organization', color: 'var(--lr-color-danger)' },
];

const confidence: LyraEntityDossierConfidence = {
  label: 'Confidence',
  value: '92%',
  variant: 'success',
  caption: 'From 3 supporting chunks',
  rows: [
    { label: 'Extraction', value: '95%' },
    { label: 'Disambiguation', value: '88%' },
  ],
};

const neighbors: LyraNeighborRow[] = [
  { relation: 'discovered', direction: 'out', node: { id: 'elem1', label: 'Polonium', type: 'element' } },
  { relation: 'discovered', direction: 'out', node: { id: 'elem2', label: 'Radium', type: 'element' } },
  { relation: 'married_to', direction: 'both', node: { id: 'p2', label: 'Pierre Curie', type: 'person' } },
  { relation: 'works_for', direction: 'out', node: { id: 'org1', label: 'Sorbonne', type: 'org' } },
];

const chunks: LyraChunk[] = [
  {
    id: 'ch1',
    text: 'Marie Curie discovered polonium and radium while studying the mineral pitchblende in 1898.',
    score: 0.92,
    sourceId: 's1',
    title: 'curie-bio.pdf',
    page: 3,
  },
  { id: 'ch2', text: 'She was the first woman to win a Nobel Prize.', score: 0.71, sourceId: 's1', page: 5 },
];

const provenance: LyraProvenance = {
  entities: [entity, { id: 'p2', label: 'Pierre Curie', type: 'person' }],
  relationships: [
    {
      path: [
        { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
        { kind: 'edge', relation: 'married_to' },
        { kind: 'node', node: { id: 'p2', label: 'Pierre Curie' } },
      ],
    },
  ],
  communities: [{ id: 'c1', label: 'Nobel laureates', memberCount: 3 }],
  chunks,
};

export const Default: Story = {
  render: () => html`
    <lr-entity-dossier
      .entity=${entity}
      .types=${types}
      community-label="Nobel laureates"
      .confidence=${confidence}
      .neighbors=${neighbors}
      expandable
      .chunks=${chunks}
      .provenance=${provenance}
    ></lr-entity-dossier>
  `,
};

export const NoConfidence: Story = {
  render: () => html`<lr-entity-dossier .entity=${entity} .types=${types} .neighbors=${neighbors} .chunks=${chunks} .provenance=${provenance}></lr-entity-dossier>`,
};

export const Empty: Story = {
  render: () => html`<lr-entity-dossier></lr-entity-dossier>`,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-entity-dossier
        .entity=${entity}
        .types=${types}
        .confidence=${confidence}
        .neighbors=${neighbors}
        .chunks=${chunks}
        .provenance=${provenance}
      ></lr-entity-dossier>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-entity-dossier
        .entity=${entity}
        .types=${types}
        .confidence=${confidence}
        .neighbors=${neighbors}
        .chunks=${chunks}
        .provenance=${provenance}
      ></lr-entity-dossier>
    </div>
  `,
};
