import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

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

export const ResponsiveGrid: Story = {
  render: () => html`
    <div
      style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: 12rem 16rem; inline-size: min(100%, 48rem); gap: 1rem;"
    >
      <lr-widget label="Summary">A short panel body.</lr-widget>
      <lr-widget label="Details">Another short panel body.</lr-widget>
      <lr-widget label="Activity">A panel stretching to the taller grid row.</lr-widget>
      <lr-widget label="Notes">The panel base follows each grid allocation.</lr-widget>
    </div>
  `,
};

export const NarrowLongActions: Story = {
  render: () => html`
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 1rem;">
      <div dir="ltr">
        <lr-widget label="Usage" collapsible expandable>
          <button slot="actions" style="white-space: nowrap;">
            An exceptionally long header action stays horizontally scrollable
          </button>
          LTR panel body.
        </lr-widget>
      </div>
      <div dir="rtl">
        <lr-widget label="Usage" collapsible expandable>
          <button slot="actions" style="white-space: nowrap;">
            An exceptionally long header action stays horizontally scrollable
          </button>
          RTL panel body.
        </lr-widget>
      </div>
    </div>
  `,
};

const barChartIcon = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="18" y1="20" x2="18" y2="14"></line></svg>`;
const tableIcon = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="4" x2="9" y2="20"></line></svg>`;

export const NarrowLongHeaderContent: Story = {
  name: 'Long unbroken header content at 320px (LTR / RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'At an exact 320px allocation, long title and view labels ellipsize while a long action stays reachable through its own scroll strip in both text directions.',
      },
    },
  },
  render: () => {
    const longTitle =
      'AnExtremelyLongUnbrokenLocalizedWidgetTitleThatMustRemainContained'.repeat(4);
    const longView =
      'AnExtremelyLongUnbrokenLocalizedViewLabelThatMustRemainContained'.repeat(4);
    const longAction =
      'AnExtremelyLongUnbrokenHeaderActionLabelThatMustRemainScrollable'.repeat(4);
    return html`
      <div style="display: grid; gap: var(--lr-space-l);">
        ${(['ltr', 'rtl'] as const).map(
          (direction) => html`
            <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
              <lr-widget
                style="inline-size: 100%;"
                label=${longTitle}
                collapsible
                expandable
                .views=${[{ id: 'long', label: longView }]}
              >
                <button slot="actions" style="white-space: nowrap;">${longAction}</button>
                Panel body.
              </lr-widget>
            </div>
          `,
        )}
      </div>
    `;
  },
};

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

/** The pressed view toggle's background, text, and border are themeable through
 *  `--lr-widget-view-toggle-active-bg`, `--lr-widget-view-toggle-active-color`, and
 *  `--lr-widget-view-toggle-active-border-color`. None is declared on `:host`, so setting
 *  them on an ancestor recolors only the active toggle — not everything else reading the shared
 *  brand tokens. */
export const ThemedViewToggle: Story = {
  name: 'Themed view toggle (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set --lr-widget-view-toggle-active-bg, --lr-widget-view-toggle-active-color, and --lr-widget-view-toggle-active-border-color on the element or any ancestor to recolor the active view toggle without hijacking the library-wide brand tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="max-width: 28rem; --lr-widget-view-toggle-active-bg: ${storyColor(
        'successQuiet',
      )}; --lr-widget-view-toggle-active-color: ${storyColor('success')}; --lr-widget-view-toggle-active-border-color: ${storyColor(
        'success',
      )};"
    >
      <lr-widget label="Usage" sublabel="Last 7 days" .views=${[{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]}>
        <div slot="view-chart" style="padding: 1rem;">Chart view body.</div>
        <div slot="view-table" style="padding: 1rem;">Table view body.</div>
      </lr-widget>
    </div>
  `,
};

export const CustomCollapseAndFullscreenIcons: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The collapse-icon and fullscreen-icon slots are decorative visual overrides. Their content is inert and aria-hidden, so the native toggle button remains the only action.',
      },
    },
  },
  render: () => html`
    <lr-widget label="Load profile" sublabel="Last 7 days" collapsible expandable style="max-width: 28rem;">
      <span slot="collapse-icon">▾</span>
      <span slot="fullscreen-icon">⤢</span>
      <div style="padding: 1rem;">
        The <code>collapse-icon</code> and <code>fullscreen-icon</code> slots override the built-in
        chevron/expand glyphs entirely. They are decorative, so omit either to keep the library
        default and keep interactive controls outside the slots.
      </div>
    </lr-widget>
  `,
};
