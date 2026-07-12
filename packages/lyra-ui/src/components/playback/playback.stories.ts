import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Playback',
  component: 'lyra-playback',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-playback length="10" interval-ms="500" loop></lyra-playback>`,
};
