import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Widget',
  component: 'lyra-widget',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-widget
      label="Load profile"
      sublabel="Last 7 days"
      collapsible
      expandable
      style="max-width: 28rem;"
    >
      <span slot="actions"><button>Refresh</button></span>
      <div style="padding: 1rem;">
        <p style="margin: 0 0 0.5rem;">Panel body content — a chart, a table, anything.</p>
        <p style="margin: 0; color: var(--lyra-color-text-quiet);">Click the chevron to collapse, or the expand icon to go fullscreen.</p>
      </div>
    </lyra-widget>
  `,
};

export const CollapsedInitially: Story = {
  render: () => html`
    <lyra-widget label="Alerts" sublabel="3 active" collapsible collapsed style="max-width: 28rem;">
      <div style="padding: 1rem;">This body is hidden until the panel is expanded.</div>
    </lyra-widget>
  `,
};

export const FullscreenInitially: Story = {
  render: () => html`
    <lyra-widget label="Load profile" sublabel="Last 7 days" expandable fullscreen style="max-width: 28rem;">
      <span slot="actions"><button>Refresh</button></span>
      <div style="padding: 1rem;">
        <p style="margin: 0;">Rendered already fullscreen — backdrop, fixed panel, and dialog semantics.</p>
      </div>
    </lyra-widget>
  `,
};

export const FullscreenWithSidebarInset: Story = {
  render: () => html`
    <div style="position: relative;">
      <div
        style="position: fixed; inset: 0 auto 0 0; inline-size: 240px; background: var(--lyra-color-text); color: var(--lyra-color-surface); padding: 1rem; z-index: 1001;"
      >
        Persistent sidebar (stays visible above the widget's fullscreen panel)
      </div>
      <lyra-widget
        label="Load profile"
        sublabel="Last 7 days"
        expandable
        fullscreen
        fullscreen-inset="0 0 0 240px"
        style="max-width: 28rem;"
      >
        <div style="padding: 1rem;">
          <p style="margin: 0;">
            Fullscreen with <code>fullscreen-inset="0 0 0 240px"</code> — the panel and backdrop leave
            room for the 240px sidebar instead of covering it.
          </p>
        </div>
      </lyra-widget>
    </div>
  `,
};

export const Compact: Story = {
  render: () => html`
    <lyra-widget label="Alerts" sublabel="3 active" compact collapsible expandable style="max-width: 28rem;">
      <div style="padding: 0.5rem;">Tighter header/body padding for constrained spaces.</div>
    </lyra-widget>
  `,
};
