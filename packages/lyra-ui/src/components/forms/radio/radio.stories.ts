import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio.js';
import './radio-group.js';
const meta: Meta = { title: 'Form/Radio', component: 'lr-radio-group', tags: ['autodocs'] };
export default meta;
export const Group: StoryObj = { render: () => html`<lr-radio-group label="Format" name="format"><lr-radio value="json">JSON</lr-radio><lr-radio value="csv">CSV</lr-radio></lr-radio-group>` };

export const LabelIndent: StoryObj = {
  name: 'Aligning per-option hint text',
  render: () => html`
    <lr-radio-group label="Export format" name="format-indent">
      <div>
        <lr-radio value="json">JSON</lr-radio>
        <p
          style="margin: 0.25rem 0 0; padding-inline-start: var(--lr-radio-label-indent, 2.25rem); color: var(--lr-color-text-muted); font-size: var(--lr-font-size-sm);"
        >
          Nested objects preserved; largest file size.
        </p>
      </div>
      <div>
        <lr-radio value="csv">CSV</lr-radio>
        <p
          style="margin: 0.25rem 0 0; padding-inline-start: var(--lr-radio-label-indent, 2.25rem); color: var(--lr-color-text-muted); font-size: var(--lr-font-size-sm);"
        >
          Flat rows only; opens directly in a spreadsheet.
        </p>
      </div>
    </lr-radio-group>
  `,
};
