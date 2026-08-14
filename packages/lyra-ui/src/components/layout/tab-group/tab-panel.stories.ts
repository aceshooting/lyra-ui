import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';

const meta: Meta = {
  title: 'Tabs/Tab panel',
  component: 'lr-tab-panel',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-tab-group>
      <lr-tab panel="general" active>General</lr-tab>
      <lr-tab panel="advanced">Advanced</lr-tab>
      <lr-tab-panel name="general" active>General settings.</lr-tab-panel>
      <lr-tab-panel name="advanced">Advanced settings.</lr-tab-panel>
    </lr-tab-group>
  `,
};
