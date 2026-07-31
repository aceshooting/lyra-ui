import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio.js';
import './radio-group.js';
const meta: Meta = { title: 'Form/Radio', component: 'lr-radio-group', tags: ['autodocs'] };
export default meta;
export const Group: StoryObj = { render: () => html`<lr-radio-group label="Format" name="format"><lr-radio value="json">JSON</lr-radio><lr-radio value="csv">CSV</lr-radio></lr-radio-group>` };

export const EventOwnership: StoryObj = {
  name: 'Standalone and group event ownership',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      <section>
        <lr-radio
          value="standalone"
          @lr-change=${(event: CustomEvent<{ checked: boolean; value: string }>) => {
            const output = (event.currentTarget as HTMLElement).nextElementSibling;
            if (output) output.textContent = `Standalone: ${event.detail.value}`;
          }}
        >Standalone option</lr-radio>
        <output>Standalone: not selected</output>
      </section>
      <section>
        <lr-radio-group
          label="Owned options"
          @lr-change=${(event: CustomEvent<{ value: string }>) => {
            const output = (event.currentTarget as HTMLElement).nextElementSibling;
            if (output) output.textContent = `Group: ${event.detail.value}`;
          }}
        >
          <lr-radio value="one">One</lr-radio>
          <lr-radio value="two">Two</lr-radio>
        </lr-radio-group>
        <output>Group: not selected</output>
      </section>
    </div>
  `,
};

export const LabelIndent: StoryObj = {
  name: 'Aligning per-option hint text',
  render: () => html`
    <lr-radio-group label="Export format" name="format-indent">
      <div>
        <lr-radio value="json">JSON</lr-radio>
        <p
          style="margin: 0.25rem 0 0; padding-inline-start: var(--lr-radio-label-indent, 2.25rem); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm);"
        >
          Nested objects preserved; largest file size.
        </p>
      </div>
      <div>
        <lr-radio value="csv">CSV</lr-radio>
        <p
          style="margin: 0.25rem 0 0; padding-inline-start: var(--lr-radio-label-indent, 2.25rem); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm);"
        >
          Flat rows only; opens directly in a spreadsheet.
        </p>
      </div>
    </lr-radio-group>
  `,
};
