import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './number-input.js';

const meta: Meta = { title: 'Input/Number input', component: 'lr-number-input', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-number-input label="Quantity" value="2" min="0" max="10"></lr-number-input>` };

/** `steppers="false"` drops the Lyra pair; `without-spin-buttons="false"` brings the browser's back. */
export const StepperVariants: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 20rem">
      <lr-number-input label="Lyra steppers (default)" value="2" min="0" max="10" step="1"></lr-number-input>
      <lr-number-input
        label="Native spin buttons"
        steppers="false"
        without-spin-buttons="false"
        value="2"
        min="0"
        max="10"
        step="1"
      ></lr-number-input>
      <lr-number-input label="No steppers at all" steppers="false" value="2"></lr-number-input>
    </div>
  `,
};
