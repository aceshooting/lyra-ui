import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { GraphQuery, GraphQuerySavedItem, GraphQueryTypeOption } from './graph-query-builder.js';

const relationshipTypeOptions: GraphQueryTypeOption[] = [
  { value: 'works_for', label: 'Works for' },
  { value: 'founded_by', label: 'Founded by' },
  { value: 'located_in', label: 'Located in' },
  { value: 'cites', label: 'Cites' },
];

const nodeTypeOptions: GraphQueryTypeOption[] = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
  { value: 'location', label: 'Location' },
  { value: 'document', label: 'Document' },
];

const savedQueries: GraphQuerySavedItem[] = [
  {
    id: 'saved-1',
    name: 'Who founded my employer',
    query: {
      startId: 'person-42',
      endId: '',
      relationshipTypes: ['works_for', 'founded_by'],
      nodeTypes: ['organization'],
      direction: 'out',
      minHops: 1,
      maxHops: 2,
    },
  },
];

const meta: Meta = {
  title: 'Knowledge Graph/Graph Query Builder',
  component: 'lr-graph-query-builder',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 40rem"
      .relationshipTypeOptions=${relationshipTypeOptions}
      .nodeTypeOptions=${nodeTypeOptions}
    ></lr-graph-query-builder>
  `,
};

const populatedValue: GraphQuery = {
  startId: 'person-42',
  endId: '',
  relationshipTypes: ['works_for'],
  nodeTypes: ['organization'],
  direction: 'both',
  minHops: 1,
  maxHops: 3,
};

/** An already-populated query with active relationship/node-type filters and a saved-query list. */
export const Populated: Story = {
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 40rem"
      .relationshipTypeOptions=${relationshipTypeOptions}
      .nodeTypeOptions=${nodeTypeOptions}
      .savedQueries=${savedQueries}
      .value=${populatedValue}
      @lr-query-run=${(e: CustomEvent<{ query: GraphQuery }>) => console.log('run', e.detail.query)}
      @lr-query-save=${(e: CustomEvent<{ name: string; query: GraphQuery }>) => console.log('save', e.detail)}
      @lr-query-load=${(e: CustomEvent<{ id: string; query: GraphQuery }>) => console.log('load', e.detail)}
      @lr-query-delete=${(e: CustomEvent<{ id: string }>) => console.log('delete', e.detail)}
    ></lr-graph-query-builder>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 40rem"
      disabled
      .relationshipTypeOptions=${relationshipTypeOptions}
      .savedQueries=${savedQueries}
    ></lr-graph-query-builder>
  `,
};

/** 320px container — path fields, type-filter rows, and the footer all wrap onto their own lines. */
export const Narrow: Story = {
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 320px"
      .relationshipTypeOptions=${relationshipTypeOptions}
      .nodeTypeOptions=${nodeTypeOptions}
      .savedQueries=${savedQueries}
    ></lr-graph-query-builder>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-graph-query-builder
        style="max-width: 40rem"
        .relationshipTypeOptions=${relationshipTypeOptions}
        .nodeTypeOptions=${nodeTypeOptions}
        .savedQueries=${savedQueries}
      ></lr-graph-query-builder>
    </div>
  `,
};
