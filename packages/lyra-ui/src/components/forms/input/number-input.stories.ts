import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './number-input.js';

const meta: Meta = { title: 'Input/Number input', component: 'lr-number-input', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-number-input label="Quantity" value="2" min="0" max="10"></lr-number-input>` };

/** Both stepper spellings plus the increment/decrement icon slots. */
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
      <lr-number-input label="Positive without-steppers spelling" without-steppers value="2"></lr-number-input>
      <lr-number-input label="Custom stepper icons" value="2">
        <span slot="decrement-icon" aria-hidden="true">−</span>
        <span slot="increment-icon" aria-hidden="true">+</span>
      </lr-number-input>
    </div>
  `,
};
