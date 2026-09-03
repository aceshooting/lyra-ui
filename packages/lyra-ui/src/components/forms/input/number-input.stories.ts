import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './number-input.js';

const meta: Meta = { title: 'Input/Number input', component: 'lr-number-input', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-number-input label="Quantity" value="2" min="0" max="10"></lr-number-input>` };

/** Host-owned guidance is resolved onto the inherited native input. */
export const ExternalDescription: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-20rem)">
      <p id="number-input-external-description">Enter the quantity approved for this order.</p>
      <lr-number-input
        aria-describedby="number-input-external-description"
        label="Quantity"
        value="2"
        min="0"
        max="10"
      ></lr-number-input>
    </div>
  `,
};

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

/** Shared input theme values remain inheritable by the number-input subclass. */
export const AncestorTheme: StoryObj = {
  render: () => html`
    <div style="--lr-input-radius: var(--lr-radius-pill)">
      <lr-number-input label="Quantity" value="2" min="0" max="10"></lr-number-input>
    </div>
  `,
};

/** Stepper-bearing rows use the shared hit-floor-aware control ladder at every size. */
export const Sizes: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem)">
      ${['2xs', 'xs', 's', 'm', 'l', 'xl'].map(
        (size) => html`<lr-number-input size=${size} label=${size} value="2"></lr-number-input>`,
      )}
    </div>
  `,
};

/** Mirrored Web Awesome/Shoelace size spellings retain the canonical number-input geometry. */
export const MappedSizeAliases: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem)">
      ${[['small', 's'], ['medium', 'm'], ['large', 'l']].map(
        ([alias, canonical]) => html`
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--lr-space-s)">
            <lr-number-input size=${alias} label=${alias} value="2"></lr-number-input>
            <lr-number-input size=${canonical} label=${canonical} value="2"></lr-number-input>
          </div>
        `,
      )}
    </div>
  `,
};

/** The shared input action hooks independently retheme number steppers. */
export const StateTheme: StoryObj = {
  render: () => html`
    <div
      style="
        --lr-input-action-color: var(--lr-color-brand);
        --lr-input-action-hover-color: var(--lr-color-danger);
        --lr-input-action-active-bg: var(--lr-color-danger-quiet);
      "
    >
      <lr-number-input label="Quantity" value="2"></lr-number-input>
    </div>
  `,
};

/** Exact 320px RTL allocation with an unbroken label, hint, and both steppers. */
export const NarrowRightToLeft: StoryObj = {
  name: 'Narrow RTL (320px)',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%">
      <lr-number-input
        value="2"
        label="InternationalizedUnbrokenQuantityLabelThatMustRemainInsideTheAllocation"
        hint="Supporting copy wraps within the same narrow allocation."
      ></lr-number-input>
    </div>
  `,
};
