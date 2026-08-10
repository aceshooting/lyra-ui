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
  render: () => html`<lr-accordion-item heading-level="2" icon-placement="start">
    <span slot="label"><strong>Rich label</strong> with supporting text</span>
    <span slot="icon" aria-hidden="true">+</span>
    The label and decorative icon both accept slotted markup.
  </lr-accordion-item>`,
};

export const DetailsCompatibility: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`open`, `summary`, the `summary` slot, and `show()`/`hide()` remain aliases for existing Details-style markup.',
      },
    },
  },
  render: () => html`<lr-accordion-item summary="Legacy Details vocabulary" open>
    Existing markup remains expandable.
  </lr-accordion-item>`,
};
