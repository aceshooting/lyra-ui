import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './data-grid.js';
const meta: Meta = { title: 'Data Grid', component: 'lr-data-grid', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-data-grid aria-label="People" .columns=${[{ key: 'name', label: 'Name', sortable: true }, { key: 'role', label: 'Role' }]} .rows=${[{ name: 'Ada Lovelace', role: 'Mathematician' }, { name: 'Grace Hopper', role: 'Engineer' }]}></lr-data-grid>` };
export const NarrowAllocation: Story = {
  name: 'Multi-column grid at a 320px allocation',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px allocation -- narrower than the sum of the column widths -- [part="viewport"] scrolls horizontally instead of overflowing the panel.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%;">
      <lr-data-grid
        aria-label="People"
        .columns=${[
          { key: 'name', label: 'Name', sortable: true, width: '10rem' },
          { key: 'role', label: 'Role', width: '10rem' },
          { key: 'location', label: 'Location', width: '10rem' },
          { key: 'email', label: 'Email', width: '14rem' },
        ]}
        .rows=${[
          { name: 'Ada Lovelace', role: 'Mathematician', location: 'London', email: 'ada@example.com' },
          { name: 'Grace Hopper', role: 'Engineer', location: 'New York', email: 'grace@example.com' },
        ]}
      ></lr-data-grid>
    </div>
  `,
};

export const RetintedSelectedRow: Story = {
  name: 'Retinted selected row',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-data-grid-row-selected-bg` recolors the selected row on its own. Shadow Parts forbids an attribute selector after `::part()`, so `::part(row)[aria-selected]` is invalid CSS; without this property the selected row could only be restyled by overriding the library-wide `--lr-color-brand-quiet` token. Unset, it renders exactly as before.',
      },
    },
  },
  render: () => html`
    <lr-data-grid
      style="--lr-data-grid-row-selected-bg: var(--lr-color-success-quiet)"
      aria-label="People"
      .columns=${[{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }]}
      .rows=${[{ name: 'Ada Lovelace', role: 'Mathematician' }, { name: 'Grace Hopper', role: 'Engineer' }]}
      .selectedKey=${1}
    ></lr-data-grid>
  `,
};
