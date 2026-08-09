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

/** Shared input theme values remain inheritable by the native-time-input subclass. */
export const AncestorTheme: StoryObj = {
  render: () => html`
    <div style="--lr-input-radius: var(--lr-radius-pill)">
      <lr-native-time-input label="Start time" value="09:30"></lr-native-time-input>
    </div>
  `,
};
