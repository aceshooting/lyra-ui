import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './dropdown-item.js';

const meta: Meta = { title: 'Components/Dropdown Item', component: 'lr-dropdown-item' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-dropdown-item value="archive">Archive</lr-dropdown-item>`,
};
