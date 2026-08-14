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

export const NativeMethods: StoryObj = {
  name: 'Native method semantics',
  parameters: {
    docs: {
      description: {
        story:
          '`focus()` and `blur()` forward to the checked enabled radio, or the first available radio. `click()` activates that same option and emits the native-compatible selection events. `reportValidity()` validates the group aggregate.',
      },
    },
  },
  render: () => {
    const invoke = (event: Event, method: 'focus' | 'blur' | 'click' | 'reportValidity') => {
      const demo = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-radio-methods]')!;
      const group = demo.querySelector('lr-radio-group')!;
      const status = demo.querySelector<HTMLElement>('[role="status"]')!;
      if (method === 'reportValidity') {
        status.textContent = `reportValidity() returned ${group.reportValidity()}`;
      } else {
        group[method]();
        status.textContent = `${method}() called; value is ${JSON.stringify(group.value)}`;
      }
    };
    return html`
      <div data-radio-methods style="display:grid;gap:var(--lr-space-m);justify-items:start">
        <lr-radio-group label="Delivery speed" name="native-delivery" required>
          <lr-radio value="unavailable" disabled>Unavailable first option</lr-radio>
          <lr-radio value="standard">Standard</lr-radio>
          <lr-radio value="express">Express</lr-radio>
        </lr-radio-group>
        <div style="display:flex;gap:var(--lr-space-s);flex-wrap:wrap">
          ${(['focus', 'blur', 'click', 'reportValidity'] as const).map(
            (method) => html`<button type="button" @click=${(event: Event) => invoke(event, method)}>${method}()</button>`,
          )}
        </div>
        <p role="status">Choose a method.</p>
      </div>
    `;
  },
};

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
