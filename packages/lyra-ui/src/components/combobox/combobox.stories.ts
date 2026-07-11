import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Combobox',
  component: 'lyra-combobox',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-combobox label="Fruit" placeholder="Pick one…" with-clear style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `,
};

export const Multiple: Story = {
  render: () => html`
    <lyra-combobox label="Fruit" multiple with-clear style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `,
};
