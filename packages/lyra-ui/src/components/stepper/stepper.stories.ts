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
  component: 'lyra-stepper',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An ordered multi-step wizard/form navigation strip: label + index per step, current/completed/disabled/error state, click-to-jump. Fully data-driven and controlled -- like `lyra-table`, it never mutates its own `steps`; a click or Enter/Space on a non-disabled step fires a cancelable `lyra-step-select` event and the host decides whether/how `steps` changes in response.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => html`<lyra-stepper .steps=${wizardSteps}></lyra-stepper>`,
};

export const Vertical: Story = {
  render: () => html`<lyra-stepper orientation="vertical" .steps=${wizardSteps}></lyra-stepper>`,
};

export const WithError: Story = {
  render: () => html`<lyra-stepper .steps=${errorSteps}></lyra-stepper>`,
};

export const LockedStepWithTitle: Story = {
  render: () => html`<lyra-stepper .steps=${lockedStepsWithTitle}></lyra-stepper>`,
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
      <lyra-stepper
        .steps=${wizardSteps}
        @lyra-step-select=${(e: CustomEvent<{ index: number; id: string }>) => {
          const out = document.getElementById('stepper-select-log');
          if (out) out.textContent = `Selected step: ${e.detail.id} (index ${e.detail.index})`;
        }}
      ></lyra-stepper>
      <p id="stepper-select-log">Selected step: (none yet)</p>
    </div>
  `,
};
