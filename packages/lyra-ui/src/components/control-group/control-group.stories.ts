import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './control-group.js';
import '../select/select.js';
import '../segmented/segmented.js';
import '../button/button.js';
import '../input/input.js';
import '../combobox/combobox.js';

const meta: Meta = { title: 'Primitives/Control Group', component: 'lr-control-group' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-control-group label="Chart controls">
    <lr-input size="s" aria-label="Search" placeholder="Search"></lr-input>
    <lr-segmented
      size="s"
      .items=${[
        { value: 'revenue', label: 'Revenue' },
        { value: 'users', label: 'Users' },
      ]}
      value="revenue"
    ></lr-segmented>
    <lr-select size="s" placeholder="Pick a range" style="max-width: 9rem">
      <lr-option value="day">Day</lr-option>
      <lr-option value="week">Week</lr-option>
    </lr-select>
    <lr-combobox size="s" aria-label="Timezone" placeholder="Timezone" style="max-width: 9rem">
      <lr-option value="utc">UTC</lr-option>
      <lr-option value="local">Local</lr-option>
    </lr-combobox>
    <lr-button size="s" variant="brand">Export</lr-button>
  </lr-control-group>`,
};

export const NarrowAllocation: Story = {
  render: () => html`<div style="inline-size: 220px; border: 1px dashed var(--lr-color-border); padding: var(--lr-space-s);">
    <lr-control-group label="Chart controls">
      <lr-segmented
        size="s"
        .items=${[
          { value: 'revenue', label: 'Revenue' },
          { value: 'users', label: 'Users' },
        ]}
        value="revenue"
      ></lr-segmented>
      <lr-select size="s" placeholder="Pick a range" style="max-width: 9rem">
        <lr-option value="day">Day</lr-option>
        <lr-option value="week">Week</lr-option>
      </lr-select>
      <lr-button size="s">Export</lr-button>
    </lr-control-group>
  </div>`,
};
