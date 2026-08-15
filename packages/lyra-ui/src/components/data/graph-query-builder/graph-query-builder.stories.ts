import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  GraphQuery,
  GraphQueryDeleteDetail,
  GraphQueryLoadDetail,
  GraphQueryRunDetail,
  GraphQuerySaveDetail,
  GraphQuerySavedItem,
  GraphQueryTypeOption,
  LyraGraphQueryBuilder,
} from './graph-query-builder.js';

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
  parameters: {
    docs: {
      description: {
        component:
          'The query, type options, and saved queries are normalized into bounded deeply frozen snapshots (500 type entries and 200 saved queries). Empty and blank option values and saved-query IDs are omitted and later duplicates are first-wins. Load/delete details use `queryId`. Create and reassign a new object or array after changes; query event details are detached and frozen.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Run, save, load, and delete each emit a cancelable `lr-before-query-*` request followed by a non-cancelable accepted `lr-query-*` notification. The console logs both phases for every action.',
      },
    },
  },
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 40rem"
      .relationshipTypeOptions=${relationshipTypeOptions}
      .nodeTypeOptions=${nodeTypeOptions}
      .savedQueries=${savedQueries}
      .value=${populatedValue}
      @lr-before-query-run=${(e: CustomEvent<GraphQueryRunDetail>) => console.log('before run', e.detail)}
      @lr-query-run=${(e: CustomEvent<GraphQueryRunDetail>) => console.log('run accepted', e.detail)}
      @lr-before-query-save=${(e: CustomEvent<GraphQuerySaveDetail>) => console.log('before save', e.detail)}
      @lr-query-save=${(e: CustomEvent<GraphQuerySaveDetail>) => console.log('save accepted', e.detail)}
      @lr-before-query-load=${(e: CustomEvent<GraphQueryLoadDetail>) => console.log('before load', e.detail)}
      @lr-query-load=${(e: CustomEvent<GraphQueryLoadDetail>) => console.log('load accepted', e.detail)}
      @lr-before-query-delete=${(e: CustomEvent<GraphQueryDeleteDetail>) => console.log('before delete', e.detail)}
      @lr-query-delete=${(e: CustomEvent<GraphQueryDeleteDetail>) => console.log('delete accepted', e.detail)}
    ></lr-graph-query-builder>
  `,
};

/** Edit the populated query, then use the native reset button to restore its normalized initial
 * model rather than an unrelated empty query. */
export const FormResetDefault: Story = {
  render: () => html`
    <form style="display: grid; gap: var(--lr-space-m); max-width: 40rem">
      <lr-graph-query-builder
        name="query"
        .relationshipTypeOptions=${relationshipTypeOptions}
        .nodeTypeOptions=${nodeTypeOptions}
        .value=${populatedValue}
      ></lr-graph-query-builder>
      <button type="reset">Reset query</button>
    </form>
  `,
};

/** Save uses the shared two-phase action contract: this example vetoes the reserved name
 * `Production` in the before phase and leaves that draft in the field for correction; accepted
 * names clear normally and then emit `lr-query-save`. */
export const CancelableSave: Story = {
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 40rem"
      .value=${populatedValue}
      @lr-before-query-save=${(event: CustomEvent<GraphQuerySaveDetail>) => {
        if (event.detail.name === 'Production') event.preventDefault();
      }}
    >
      <span slot="label">Account relationship query</span>
    </lr-graph-query-builder>
  `,
};

export const RetintedActionStates: Story = {
  name: 'Retinted action states',
  parameters: {
    docs: {
      description: {
        story:
          'Rest, hover, and pressed colors for Run, Save, Load, and delete are independently inheritable. Hover and press the actions to inspect the scoped state hooks.',
      },
    },
  },
  render: () => html`
    <div
      style="
        max-width: 40rem;
        --lr-graph-query-builder-run-bg: var(--lr-color-success);
        --lr-graph-query-builder-run-border-color: var(--lr-color-success);
        --lr-graph-query-builder-run-hover-bg: var(--lr-color-success-quiet);
        --lr-graph-query-builder-run-active-bg: var(--lr-color-warning);
        --lr-graph-query-builder-save-hover-bg: var(--lr-color-warning-quiet);
        --lr-graph-query-builder-save-active-bg: var(--lr-color-warning);
        --lr-graph-query-builder-saved-load-active-bg: var(--lr-color-brand-quiet);
        --lr-graph-query-builder-saved-delete-hover-color: var(--lr-color-warning);
        --lr-graph-query-builder-saved-delete-active-color: var(--lr-color-on-danger);
        --lr-graph-query-builder-saved-delete-active-bg: var(--lr-color-danger);
      "
    >
      <lr-graph-query-builder
        .relationshipTypeOptions=${relationshipTypeOptions}
        .nodeTypeOptions=${nodeTypeOptions}
        .savedQueries=${savedQueries}
        .value=${populatedValue}
      ></lr-graph-query-builder>
    </div>
  `,
};

/** Remove a focused filter chip to follow its adjacent chip/picker, or activate a saved-query
 * delete action. This fixture immediately accepts the controlled delete request, so focus follows
 * the nearest saved row (and eventually the save-name input). */
export const ControlledRemovalFocus: Story = {
  render: () => html`
    <lr-graph-query-builder
      style="max-width: 40rem"
      .relationshipTypeOptions=${relationshipTypeOptions}
      .nodeTypeOptions=${nodeTypeOptions}
      .value=${{
        ...populatedValue,
        relationshipTypes: ['works_for', 'founded_by'],
      }}
      .savedQueries=${[...savedQueries, { ...savedQueries[0]!, id: 'saved-2', name: 'Second saved traversal' }]}
      @lr-query-delete=${(event: CustomEvent<{ queryId: string }>) => {
        const builder = event.currentTarget as LyraGraphQueryBuilder;
        builder.savedQueries = builder.savedQueries.filter((item) => item.id !== event.detail.queryId);
      }}
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
