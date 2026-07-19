import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Widget',
  component: 'lr-widget',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-widget
      label="Load profile"
      sublabel="Last 7 days"
      collapsible
      expandable
      style="max-width: 28rem;"
    >
      <span slot="actions"><button>Refresh</button></span>
      <div style="padding: 1rem;">
        <p style="margin: 0 0 0.5rem;">Panel body content — a chart, a table, anything.</p>
        <p style="margin: 0; color: var(--lr-color-text-quiet);">Click the chevron to collapse, or the expand icon to go fullscreen.</p>
      </div>
    </lr-widget>
  `,
};

export const CollapsedInitially: Story = {
  render: () => html`
    <lr-widget label="Alerts" sublabel="3 active" collapsible collapsed style="max-width: 28rem;">
      <div style="padding: 1rem;">This body is hidden until the panel is expanded.</div>
    </lr-widget>
  `,
};

export const FullscreenInitially: Story = {
  render: (_args, context) => html`
    <lr-widget label="Load profile" sublabel="Last 7 days" expandable .fullscreen=${context.viewMode !== 'docs'} style="max-width: 28rem;">
      <span slot="actions"><button>Refresh</button></span>
      <div style="padding: 1rem;">
        <p style="margin: 0;">Rendered already fullscreen — backdrop, fixed panel, and dialog semantics.</p>
      </div>
    </lr-widget>
  `,
};

export const FullscreenWithSidebarInset: Story = {
  render: (_args, context) => html`
    <div style="position: relative;">
      <div
        style="position: fixed; inset: 0 auto 0 0; inline-size: 240px; background: var(--lr-color-text); color: var(--lr-color-surface); padding: 1rem; z-index: 1001;"
      >
        Persistent sidebar (stays visible above the widget's fullscreen panel)
      </div>
      <lr-widget
        label="Load profile"
        sublabel="Last 7 days"
        expandable
        .fullscreen=${context.viewMode !== 'docs'}
        fullscreen-inset="0 0 0 240px"
        style="max-width: 28rem;"
      >
        <div style="padding: 1rem;">
          <p style="margin: 0;">
            Fullscreen with <code>fullscreen-inset="0 0 0 240px"</code> — the panel and backdrop leave
            room for the 240px sidebar instead of covering it.
          </p>
        </div>
      </lr-widget>
    </div>
  `,
};

export const Compact: Story = {
  render: () => html`
    <lr-widget label="Alerts" sublabel="3 active" compact collapsible expandable style="max-width: 28rem;">
      <div style="padding: 0.5rem;">Tighter header/body padding for constrained spaces.</div>
    </lr-widget>
  `,
};

const barChartIcon = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="18" y1="20" x2="18" y2="14"></line></svg>`;
const tableIcon = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="4" x2="9" y2="20"></line></svg>`;

export const IconOnlyViewToggles: Story = {
  render: () => html`
    <lr-widget
      label="Usage"
      sublabel="Last 7 days"
      .views=${[
        { id: 'chart', icon: barChartIcon, ariaLabel: 'Chart view' },
        { id: 'table', icon: tableIcon, ariaLabel: 'Table view' },
      ]}
      style="max-width: 28rem;"
    >
      <div slot="view-chart" style="padding: 1rem;">Chart view body.</div>
      <div slot="view-table" style="padding: 1rem;">Table view body.</div>
    </lr-widget>
  `,
};

export const CustomCollapseAndFullscreenIcons: Story = {
  render: () => html`
    <lr-widget label="Load profile" sublabel="Last 7 days" collapsible expandable style="max-width: 28rem;">
      <span slot="collapse-icon">▾</span>
      <span slot="fullscreen-icon">⤢</span>
      <div style="padding: 1rem;">
        The <code>collapse-icon</code> and <code>fullscreen-icon</code> slots override the built-in
        chevron/expand glyphs entirely -- omit either to keep the library default.
      </div>
    </lr-widget>
  `,
};
