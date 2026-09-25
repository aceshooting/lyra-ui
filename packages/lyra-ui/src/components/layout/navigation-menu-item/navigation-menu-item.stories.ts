import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './navigation-menu-item.js';

const meta: Meta = {
  title: 'Layout/Navigation Menu Item',
  component: 'lr-navigation-menu-item',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One entry of an `lr-navigation-menu`. A safe `href` renders a link; otherwise the item is a button, and a disclosure trigger when its `panel` slot has content. Outside a menu the item works as a plain in-flow disclosure.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;

export const UnownedDisclosure: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Without an owning menu the panel opens in flow below its trigger, with no positioning and no hover opening.',
      },
    },
  },
  render: () => html`
    <lr-navigation-menu-item open>
      Products
      <ul slot="panel" style="margin: 0">
        <li><a href="#analytics">Analytics</a></li>
        <li><a href="#billing">Billing</a></li>
      </ul>
    </lr-navigation-menu-item>
  `,
};

export const LinkItem: Story = {
  render: () => html`
    <lr-navigation-menu-item href="#docs" current>Docs</lr-navigation-menu-item>
    <lr-navigation-menu-item href="https://example.com/" target="_blank" rel="external">Example</lr-navigation-menu-item>
  `,
};
