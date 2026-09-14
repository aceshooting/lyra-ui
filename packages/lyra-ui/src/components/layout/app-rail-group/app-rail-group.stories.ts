import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail-group.js';
import '../app-rail/app-rail-item.js';
import '../app-rail/app-rail.js';

const meta: Meta = {
  title: 'Layout/App Rail Group',
  component: 'lr-app-rail-group',
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-app-rail-group heading="Workspaces">
      <lr-app-rail-item href="/atlas">Atlas</lr-app-rail-item>
      <lr-app-rail-item href="/beacon">Beacon</lr-app-rail-item>
    </lr-app-rail-group>
  `,
};

export const Collapsible: StoryObj = {
  render: () => html`
    <lr-app-rail-group collapsible heading="Workspaces">
      <button slot="header-actions" aria-label="Add workspace">+</button>
      <lr-app-rail-item href="/atlas">Atlas</lr-app-rail-item>
      <lr-app-rail-item href="/beacon">Beacon</lr-app-rail-item>
    </lr-app-rail-group>
    <lr-app-rail-group collapsible heading="Archived" open="false">
      <lr-app-rail-item href="/older">Older</lr-app-rail-item>
    </lr-app-rail-group>
  `,
};

export const InsideARail: StoryObj = {
  render: () => html`
    <div style="block-size: 20rem;">
      <lr-app-rail>
        <span slot="header">Acme</span>
        <lr-app-rail-group collapsible heading="Workspaces">
          <lr-app-rail-item href="/atlas" current>Atlas</lr-app-rail-item>
          <lr-app-rail-item href="/beacon">Beacon</lr-app-rail-item>
        </lr-app-rail-group>
        <lr-app-rail-group heading="Support">
          <lr-app-rail-item href="/docs">Docs</lr-app-rail-item>
        </lr-app-rail-group>
      </lr-app-rail>
    </div>
  `,
};
