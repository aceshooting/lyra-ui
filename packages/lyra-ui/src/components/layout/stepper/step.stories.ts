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
