import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-radio-group.js';
import '../../lr-radio.js';
import '../../lr-radio-button.js';

const meta: Meta = {
  title: 'Input/Radio group',
  component: 'lr-radio-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A form-associated radiogroup. Typed value events include the chosen `option` and its `radio` alias. The committed `lr-change` also includes `previousValue`. Host `aria-label` wins by attribute presence, including an explicitly empty override that suppresses visible-label linkage.',
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

export const ExternalDescription: StoryObj = {
  render: () => html`
    <p id="radio-group-guidance">Choose one delivery method.</p>
    <lr-radio-group label="Delivery" hint="You can change this later." aria-describedby="radio-group-guidance">
      <lr-radio value="email">Email</lr-radio><lr-radio value="post">Post</lr-radio>
    </lr-radio-group>
  `,
};

export const ReactivationAndInvalid: StoryObj = {
  name: 'Re-selecting the chosen option and invalid chrome',
  parameters: {
    docs: {
      description: {
        story:
          '`lr-activate` fires on every activation, including a click on the option that is already selected. A required group outlines its options (`--lr-radio-group-invalid-border-color`) once focus has left it without a choice.',
      },
    },
  },
  render: () => html`
    <div style="display:grid; gap:1rem;">
      <lr-radio-group
        label="Plan"
        value="a"
        @lr-activate=${(e: CustomEvent<{ value: string }>) => {
          const out = document.getElementById('radio-group-activate-log');
          if (out) out.textContent = `lr-activate: ${e.detail.value}`;
        }}
      >
        <lr-radio value="a">Starter</lr-radio><lr-radio value="b">Team</lr-radio>
      </lr-radio-group>
      <p id="radio-group-activate-log" style="font-family: monospace;">No activation yet.</p>
      <lr-radio-group label="Delivery" required>
        <lr-radio value="email">Email</lr-radio><lr-radio value="post">Post</lr-radio>
      </lr-radio-group>
    </div>
  `,
};

export const WithToolbar: StoryObj = {
  render: () => html`
    <lr-radio-group label="Topics" label-display="hidden">
      <label slot="toolbar">Filter topics
        <input type="search" @input=${(event: Event) => {
          const field = event.currentTarget as HTMLInputElement;
          for (const option of field.closest('lr-radio-group')!.querySelectorAll('lr-radio')) {
            option.hidden = !(option.textContent ?? '').toLowerCase().includes(field.value.toLowerCase());
          }
        }}>
      </label>
      <lr-radio value="news">News</lr-radio>
      <lr-radio value="sports">Sports</lr-radio>
    </lr-radio-group>
  `,
};

export const ConfirmBeforeSwitching: StoryObj = {
  name: 'Confirming a selection before it commits',
  parameters: {
    docs: {
      description: {
        story:
          '`lr-change-request` is cancelable and fires before the selection moves. Calling `preventDefault()` keeps the current plan, so no `input`/`change` events fire; here the Enterprise plan is held back until its checkbox is ticked.',
      },
    },
  },
  render: () => html`
    <div style="display:grid; gap:1rem;">
      <label><input id="radio-group-allow-enterprise" type="checkbox"> Allow Enterprise</label>
      <lr-radio-group
        label="Plan"
        value="team"
        @lr-change-request=${(e: CustomEvent<{ value: string }>) => {
          const allowed = (document.getElementById('radio-group-allow-enterprise') as HTMLInputElement | null)?.checked;
          if (e.detail.value === 'enterprise' && !allowed) e.preventDefault();
        }}
      >
        <lr-radio value="team">Team</lr-radio><lr-radio value="enterprise">Enterprise</lr-radio>
      </lr-radio-group>
    </div>
  `,
};

/** The label sits in an inline-start column beside the options, like the other fields. */
export const LabelPlacementStart: StoryObj = {
  render: () => html`<lr-radio-group label="Size" hint="Pick one" label-placement="start" style="max-inline-size: 36rem"><lr-radio value="small">Small</lr-radio><lr-radio value="large">Large</lr-radio></lr-radio-group>`,
};
