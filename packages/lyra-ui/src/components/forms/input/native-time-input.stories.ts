import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './native-time-input.js';

const meta: Meta = {
  title: 'Input/Native time input',
  component: 'lr-native-time-input',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-native-time-input label="Start time" value="09:30"></lr-native-time-input>`,
};

/** Host-owned guidance is resolved onto the inherited native time field. */
export const ExternalDescription: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-20rem)">
      <p id="native-time-input-external-description">Choose a time within staffed support hours.</p>
      <lr-native-time-input
        aria-describedby="native-time-input-external-description"
        label="Start time"
        value="09:30"
      ></lr-native-time-input>
    </div>
  `,
};

/** Shared input theme values remain inheritable by the native-time-input subclass. */
export const AncestorTheme: StoryObj = {
  render: () => html`
    <div style="--lr-input-radius: var(--lr-radius-pill)">
      <lr-native-time-input label="Start time" value="09:30"></lr-native-time-input>
    </div>
  `,
};

export const PendingStepConstraints: StoryObj = {
  parameters: { docs: { description: { story: 'Native stepping uses newly assigned constraints immediately and remains silent for programmatic edits.' } } },
  render: () => html`
    <div>
      <lr-native-time-input  label="Start time" value="09:06"></lr-native-time-input>
      <button type="button" @click=${(event: Event) => {
        const input = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-native-time-input')!;
        input.step = 180;
        input.stepUp();
      }}>Advance by three minutes</button>
    </div>
  `,
};
