import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './stepper.js';
import type { StepItem } from './stepper.js';

const wizardSteps: StepItem[] = [
  { id: 'account', label: 'Account', state: 'completed' },
  { id: 'profile', label: 'Profile', state: 'completed' },
  { id: 'plan', label: 'Plan', state: 'current' },
  { id: 'payment', label: 'Payment', state: 'pending' },
  { id: 'confirm', label: 'Confirm', state: 'disabled' },
];

const errorSteps: StepItem[] = [
  { id: 'account', label: 'Account', state: 'completed' },
  { id: 'profile', label: 'Profile', state: 'error' },
  { id: 'plan', label: 'Plan', state: 'pending' },
  { id: 'payment', label: 'Payment', state: 'disabled' },
];

const lockedStepsWithTitle: StepItem[] = [
  { id: 'account', label: 'Account', state: 'current' },
  {
    id: 'profile',
    label: 'Profile',
    state: 'disabled',
    title: 'Complete Account first',
  },
  {
    id: 'plan',
    label: 'Plan',
    state: 'disabled',
    title: 'Complete Account first',
  },
];

const meta: Meta = {
  title: 'Stepper',
  component: 'lr-stepper',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An ordered multi-step wizard/form navigation strip: label + index per step, current/completed/disabled/error state, click-to-jump. Fully data-driven and controlled -- like `lr-table`, it never mutates its own `steps`; a click or Enter/Space on a non-disabled step fires a cancelable `lr-step-select` event and the host decides whether/how `steps` changes in response.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => html`<lr-stepper .steps=${wizardSteps}></lr-stepper>`,
};

export const Vertical: Story = {
  render: () => html`<lr-stepper orientation="vertical" .steps=${wizardSteps}></lr-stepper>`,
};

export const WithError: Story = {
  render: () => html`<lr-stepper .steps=${errorSteps}></lr-stepper>`,
};

export const LockedStepWithTitle: Story = {
  render: () => html`<lr-stepper .steps=${lockedStepsWithTitle}></lr-stepper>`,
  parameters: {
    docs: {
      description: {
        story:
          'A locked step can set `title` to explain why it\'s disabled -- hover a disabled step to see the native browser tooltip.',
      },
    },
  },
};

export const StepSelectEvent: Story = {
  render: () => html`
    <div>
      <lr-stepper
        .steps=${wizardSteps}
        @lr-step-select=${(e: CustomEvent<{ index: number; id: string }>) => {
          const out = document.getElementById('stepper-select-log');
          if (out) out.textContent = `Selected step: ${e.detail.id} (index ${e.detail.index})`;
        }}
      ></lr-stepper>
      <p id="stepper-select-log">Selected step: (none yet)</p>
    </div>
  `,
};

export const ResponsiveOrientation: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)">
        Drag this box's bottom-right corner to shrink it below 500px — the
        stepper switches to a vertical strip (<code>orientation-breakpoint="500"
        narrow-orientation="vertical"</code>) even though the surrounding page
        is wide. Mirrors <code>lr-split</code>'s identically-named contract.
      </p>
      <lr-stepper
        orientation-breakpoint="500"
        narrow-orientation="vertical"
        .steps=${wizardSteps}
        @lr-stepper-orientation-change=${(e: CustomEvent<{ orientation: string }>) =>
          console.log('lr-stepper-orientation-change', e.detail.orientation)}
      ></lr-stepper>
    </div>
  `,
};

export const ResponsiveOrientationRem: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)">
        The same breakpoint authored as a CSS length —
        <code>orientation-breakpoint="31.25rem"</code> — which is 500px at the default 16px root
        font size. <code>rem</code> resolves against the <strong>document root</strong>, exactly as
        it does in a CSS <code>@media</code> query (not against the stepper), so this stays in step
        with a sibling <code>@media (max-width: 31.25rem)</code> rule even when the root font size
        changes; it is re-resolved on every measurement, never cached. <code>px</code> and
        <code>em</code> lengths and the historical bare number all still work.
      </p>
      <lr-stepper
        orientation-breakpoint="31.25rem"
        narrow-orientation="vertical"
        .steps=${wizardSteps}
        @lr-stepper-orientation-change=${(e: CustomEvent<{ orientation: string }>) =>
          console.log('lr-stepper-orientation-change', e.detail.orientation)}
      ></lr-stepper>
    </div>
  `,
};
