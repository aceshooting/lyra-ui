import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-stepper.js';
import '../../lr-step.js';

const meta: Meta = {
  title: 'Stepper/Step',
  component: 'lr-step',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-stepper aria-label="Checkout">
      <lr-step name="cart" completed>Cart</lr-step>
      <lr-step name="shipping">Shipping</lr-step>
      <lr-step name="pay">Payment</lr-step>
    </lr-stepper>
  `,
};

/** `custom-states` publishes author-defined states for styling: here a failed step is styled with
 *  `lr-step:state(error)` and keeps a visible label and icon so the state is not color alone. */
export const CustomStates: StoryObj = {
  render: () => html`
    <style>
      lr-step:state(error)::part(marker) {
        border-color: var(--lr-color-danger);
        color: var(--lr-color-danger);
      }
      lr-step:state(error)::part(label) {
        color: var(--lr-color-danger);
      }
    </style>
    <lr-stepper aria-label="Deployment">
      <lr-step name="build" completed>Build</lr-step>
      <lr-step name="test" custom-states="error" variant="danger">Tests failed</lr-step>
      <lr-step name="deploy">Deploy</lr-step>
    </lr-stepper>
  `,
};
