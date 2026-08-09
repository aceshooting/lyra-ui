import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio-group.js';
import './radio.js';
import './radio-button.js';

const meta: Meta = {
  title: 'Input/Radio group',
  component: 'lr-radio-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A form-associated radiogroup. Host `aria-label` wins by attribute presence, including an explicitly empty override that suppresses visible-label linkage.',
      },
    },
  },
};
export default meta;
export const Default: StoryObj = { render: () => html`<lr-radio-group label="Size"><lr-radio value="small">Small</lr-radio><lr-radio value="large">Large</lr-radio></lr-radio-group>` };

export const HorizontalWithAliases: StoryObj = {
  name: 'Horizontal, default value, and help text',
  render: () => html`
    <lr-radio-group
      label="Delivery speed"
      name="delivery"
      default-value="standard"
      orientation="horizontal"
      help-text="Arrow keys move between enabled choices"
    >
      <lr-radio value="standard">Standard</lr-radio>
      <lr-radio value="express">Express</lr-radio>
      <lr-radio value="overnight" disabled>Overnight</lr-radio>
    </lr-radio-group>
  `,
};

export const HorizontalButtonsNarrow: StoryObj = {
  name: 'Horizontal buttons narrow LTR/RTL (320px)',
  render: () => {
    const label = 'InternationalizedRadioGroupLabelWithoutAnyNaturalBreakOpportunity';
    return html`
      <div style="display: grid; gap: var(--lr-space-m)">
        ${(['ltr', 'rtl'] as const).map(
          (direction) => html`
            <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
              <lr-radio-group
                orientation="horizontal"
                label=${label}
                hint=${label}
                name="narrow-${direction}"
              >
                <lr-radio-button value="one">${label}One</lr-radio-button>
                <lr-radio-button value="two">${label}Two</lr-radio-button>
              </lr-radio-group>
            </div>
          `,
        )}
      </div>
    `;
  },
};
