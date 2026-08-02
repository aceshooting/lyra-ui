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
