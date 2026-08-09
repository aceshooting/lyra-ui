import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { QueryBuilderField, QueryBuilderValue } from './query-builder.js';

const fields: QueryBuilderField[] = [
  { name: 'name', label: 'Name', type: 'string', placeholder: 'e.g. Acme Corp' },
  { name: 'age', label: 'Age', type: 'number' },
  { name: 'active', label: 'Active', type: 'boolean' },
  { name: 'createdAt', label: 'Created', type: 'date' },
  {
    name: 'status',
    label: 'Status',
    type: 'enum',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
      { value: 'pending', label: 'Pending' },
    ],
  },
];

const value: QueryBuilderValue = {
  combinator: 'and',
  conditions: [
    { id: 'c1', field: 'status', operator: 'in', value: ['open', 'pending'] },
    { id: 'c2', field: 'createdAt', operator: 'gte', value: '2026-01-01' },
  ],
};

const meta: Meta = {
  title: 'Query Builder',
  component: 'lr-query-builder',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-query-builder style="max-width: 42rem" .fields=${fields} .value=${value}></lr-query-builder>`,
};

/** No conditions yet -- the empty state prompts adding the first one. */
export const Empty: Story = {
  render: () => html`<lr-query-builder style="max-width: 42rem" .fields=${fields}></lr-query-builder>`,
};

/** No `fields` supplied at all -- there is nothing to build a condition against. */
export const NoFields: Story = {
  render: () => html`<lr-query-builder style="max-width: 42rem"></lr-query-builder>`,
};

/** One row per `QueryBuilderFieldType`: text, number, boolean, date, single-select enum, and a
 *  multi-select enum (`in`). */
export const EveryFieldType: Story = {
  render: () =>
    html`<lr-query-builder
      style="max-width: 42rem"
      .fields=${fields}
      .value=${{
        combinator: 'and',
        conditions: [
          { id: 'c-string', field: 'name', operator: 'contains', value: 'acme' },
          { id: 'c-number', field: 'age', operator: 'gt', value: 21 },
          { id: 'c-boolean', field: 'active', operator: 'eq', value: true },
          { id: 'c-date', field: 'createdAt', operator: 'gte', value: '2026-01-01' },
          { id: 'c-enum', field: 'status', operator: 'eq', value: 'open' },
          { id: 'c-enum-multi', field: 'status', operator: 'in', value: ['open', 'pending'] },
          { id: 'c-unary', field: 'name', operator: 'isEmpty' },
        ],
      } satisfies QueryBuilderValue}
    ></lr-query-builder>`,
};

/** Provider data containing a non-finite numeric condition fails closed to an unset number rather
 * than displaying blank while retaining an Infinity that JSON would persist as null. */
export const NonFiniteNumberModel: Story = {
  render: () => html`
    <lr-query-builder
      style="max-width: 42rem"
      .fields=${fields}
      .value=${{
        combinator: 'and',
        conditions: [{ id: 'overflow', field: 'age', operator: 'gt', value: Number.POSITIVE_INFINITY }],
      } satisfies QueryBuilderValue}
    ></lr-query-builder>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-query-builder style="max-width: 42rem" disabled .fields=${fields} .value=${value}></lr-query-builder>`,
};

/** Exact 320px containers with adversarial field/operator labels. The composed selects shrink and
 *  ellipsize inside the stacked condition row in both directions instead of widening the page. */
export const Narrow: Story = {
  name: 'Narrow long labels (320px, LTR / RTL)',
  render: () => {
    const longFields: QueryBuilderField[] = [
      {
        name: 'long-field',
        label: `Customer lifecycle classification ${'unbroken'.repeat(24)}`,
        type: 'string',
        operators: ['contains'],
      },
    ];
    const longValue: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'long', field: 'long-field', operator: 'contains', value: 'enterprise' }],
    };
    const strings = {
      queryBuilderOperatorContains:
        'contains the following exceptionally long localized matching phrase without widening the allocation',
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-l); justify-items: start">
        ${(['ltr', 'rtl'] as const).map(
          (direction) => html`
            <div
              dir=${direction}
              style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) dashed var(--lr-color-border)"
            >
              <lr-query-builder
                style="inline-size: 100%"
                .fields=${longFields}
                .value=${longValue}
                .strings=${strings}
              ></lr-query-builder>
            </div>
          `
        )}
      </div>
    `;
  },
};
