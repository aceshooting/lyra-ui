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
        <p style="margin: 0; color: #666;">Click the chevron to collapse, or the expand icon to go fullscreen.</p>
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
