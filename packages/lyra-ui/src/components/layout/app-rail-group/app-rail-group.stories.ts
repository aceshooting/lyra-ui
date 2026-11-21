import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-app-rail-group.js';
import '../../lr-app-rail-item.js';
import '../../lr-app-rail.js';

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
    <lr-app-rail-group collapsible heading="Archived" collapsed>
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

export const HeadingLevels: StoryObj = {
  render: () => html`
    <lr-app-rail-group heading="Secondary navigation" heading-level="2">
      <lr-app-rail-item href="/docs">Documentation</lr-app-rail-item>
    </lr-app-rail-group>
    <lr-app-rail-group heading="Quick links" heading-level="none">
      <lr-app-rail-item href="/help">Help</lr-app-rail-item>
    </lr-app-rail-group>
  `,
};

export const QuietHeading: StoryObj = {
  render: () => html`
    <lr-app-rail-group heading="Recent"
      style="--lr-app-rail-group-heading-font-weight: var(--lr-font-weight-normal);
        --lr-app-rail-group-heading-gap: var(--lr-space-2xs);">
      <lr-app-rail-item href="/atlas">Atlas</lr-app-rail-item>
      <lr-app-rail-item href="/beacon">Beacon</lr-app-rail-item>
    </lr-app-rail-group>
  `,
};

/** `highlight="header"` paints one fill behind the collapse control and its add button, and
 *  `header-actions-reveal="hover"` shows the button only while the header is hovered or focused. */
export const HeaderHighlight: StoryObj = {
  render: () => html`
    <div style="inline-size: 16rem">
      <lr-app-rail-group collapsible highlight="header" header-actions-reveal="hover" heading="Projects">
        <button slot="header-actions" type="button" aria-label="Add project">+</button>
        <lr-app-rail-item href="/atlas">Atlas</lr-app-rail-item>
        <lr-app-rail-item href="/beacon">Beacon</lr-app-rail-item>
      </lr-app-rail-group>
    </div>
  `,
};
