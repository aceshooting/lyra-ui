import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, type TemplateResult } from 'lit';
import './navigation-menu.js';

const meta: Meta = {
  title: 'Layout/Navigation Menu',
  component: 'lr-navigation-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Disclosure-pattern site navigation: link items and disclosure triggers whose flyout panels share one region below the bar. Panels open on hover, click, Enter or Space; ArrowLeft/ArrowRight move between items and ArrowDown enters an open panel. Every story opens its panel through the `open` attribute so the rendered state is deterministic.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;

const panelList = (links: readonly [string, string][]): TemplateResult => html`
  <ul slot="panel" style="margin: 0; padding: 0; list-style: none; display: grid; gap: var(--lr-space-2xs); min-inline-size: 14rem">
    ${links.map(
      ([label, description]) => html`<li>
        <a href="#${label.toLowerCase().replace(/\s+/g, '-')}" style="display: block; padding: var(--lr-space-xs) var(--lr-space-s); border-radius: var(--lr-radius); color: inherit; text-decoration: none">
          <strong>${label}</strong><br /><span style="color: var(--lr-color-text-quiet)">${description}</span>
        </a>
      </li>`,
    )}
  </ul>
`;

const items = (openFirst = false, openLast = false): TemplateResult => html`
  <lr-navigation-menu-item ?open=${openFirst}
    >Products${panelList([
      ['Analytics', 'Understand every visitor'],
      ['Automation', 'Run workflows on a schedule'],
      ['Billing', 'Invoices and payment methods'],
    ])}</lr-navigation-menu-item
  >
  <lr-navigation-menu-item ?open=${openLast}
    >Resources${panelList([
      ['Guides', 'Step-by-step walkthroughs'],
      ['Changelog', 'What shipped this month'],
    ])}</lr-navigation-menu-item
  >
  <lr-navigation-menu-item href="#docs" current>Docs</lr-navigation-menu-item>
  <lr-navigation-menu-item href="#pricing">Pricing</lr-navigation-menu-item>
`;

const canvas = (content: TemplateResult): TemplateResult =>
  html`<div style="min-block-size: 20rem">${content}</div>`;

export const Default: Story = {
  render: () => html`<lr-navigation-menu aria-label="Main">${items()}</lr-navigation-menu>`,
};

export const OpenPanel: Story = {
  render: () => canvas(html`<lr-navigation-menu aria-label="Main">${items(true)}</lr-navigation-menu>`),
};

export const PanelAnchorItem: Story = {
  parameters: {
    docs: {
      description: {
        story: '`panel-anchor="item"` aligns each panel with its own trigger instead of the start of the item row.',
      },
    },
  },
  render: () =>
    canvas(html`<lr-navigation-menu aria-label="Main" panel-anchor="item">${items(false, true)}</lr-navigation-menu>`),
};

export const Indicator: Story = {
  render: () => canvas(html`<lr-navigation-menu aria-label="Main" indicator>${items(true)}</lr-navigation-menu>`),
};

export const CollapsedExpanded: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'With `mobile-breakpoint` set, the menu collapses when its own allocation is at or below that length. The toggle then shows the items as a column, and each panel opens in place below its trigger.',
      },
    },
  },
  render: () =>
    canvas(html`<lr-navigation-menu aria-label="Main" mobile-breakpoint="100rem" expanded>${items(true)}</lr-navigation-menu>`),
};

export const Rtl: Story = {
  render: () => canvas(html`<lr-navigation-menu aria-label="Main" dir="rtl">${items(true)}</lr-navigation-menu>`),
};

export const NarrowLongLabels: Story = {
  name: 'Narrow long labels (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%">
      <lr-navigation-menu aria-label="Main">
        <lr-navigation-menu-item
          >Enterprise integrations and platform services${panelList([
            ['Connectors', 'Synchronize records between systems'],
          ])}</lr-navigation-menu-item
        >
        <lr-navigation-menu-item href="#documentation">Documentation and developer reference</lr-navigation-menu-item>
        <lr-navigation-menu-item href="#support">Customer support and service status</lr-navigation-menu-item>
      </lr-navigation-menu>
    </div>
  `,
};

export const SiteHeader: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Header chrome sits outside the menu. The host defaults to `flex: 1 1 0%`, so a flex-row header gives the menu its remaining space.',
      },
    },
  },
  render: () => html`
    <header
      style="display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-m); padding: var(--lr-space-s) var(--lr-space-m); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle)"
    >
      <strong>Acme</strong>
      <lr-navigation-menu aria-label="Main" mobile-breakpoint="30rem">${items()}</lr-navigation-menu>
      <a href="#sign-in">Sign in</a>
    </header>
  `,
};
