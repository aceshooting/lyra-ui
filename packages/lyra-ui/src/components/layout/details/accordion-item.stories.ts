import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './accordion-item.js';

const meta: Meta = {
  title: 'Disclosure/Accordion item',
  component: 'lr-accordion-item',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-accordion-item label="Details" expanded>Expandable content.</lr-accordion-item>`,
};

/** A present host `aria-label` names the trigger ahead of its visible label, including an
 *  explicitly empty attribute; without it, the trigger keeps its content-derived name. */
export const AccessibleNamePrecedence: StoryObj = {
  render: () => html`<lr-accordion-item label="Visible fallback" aria-label="Account settings">
    Update profile and sign-in preferences.
  </lr-accordion-item>`,
};

export const CustomLabelAndIcon: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Rich label markup remains visible and names the sole trigger. The label and icon slots are decorative layers: their flattened content is inert, and the trigger remains the only action.',
      },
    },
  },
  render: () => html`<lr-accordion-item heading-level="2" icon-placement="start">
    <span slot="label"><strong>Rich label</strong> with supporting text</span>
    <span slot="icon" aria-hidden="true">+</span>
    The rich label names the trigger; the decorative icon accepts visible, non-actionable markup.
  </lr-accordion-item>`,
};
