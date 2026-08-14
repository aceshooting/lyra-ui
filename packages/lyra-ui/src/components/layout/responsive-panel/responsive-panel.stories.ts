import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './responsive-panel.js';
import type { LyraResponsivePanel } from './responsive-panel.js';

const meta: Meta = {
  title: 'ResponsivePanel',
  component: 'lr-responsive-panel',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The same slotted content either docked inline or presented as a full-screen/bottom-sheet overlay. `mode="auto"` (the default) compares the panel’s allocated inline size with `overlay-breakpoint`; `mode="inline"`/`mode="overlay"` force a presentation.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function openPanel(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const panel = trigger.parentElement!.querySelector('lr-responsive-panel') as LyraResponsivePanel;
  panel.open = true;
}

function vetoPanelClose(event: Event): void {
  event.preventDefault();
  const panel = event.currentTarget as LyraResponsivePanel;
  const status = panel.querySelector<HTMLOutputElement>('[data-close-veto-status]');
  if (status) {
    status.textContent = `Kept open: ${String((event as CustomEvent<string>).detail)} was vetoed.`;
  }
}

export const DockedInline: Story = {
  name: 'mode="inline" (docked)',
  render: () => html`
    <lr-responsive-panel mode="inline" open style="max-width: 20rem;">
      <span slot="header" style="font-weight: 600;">Filters</span>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <label><input type="checkbox" checked /> Show archived</label>
        <label><input type="checkbox" /> Only mine</label>
      </div>
      <div slot="footer">
        <button>Apply</button>
      </div>
    </lr-responsive-panel>
  `,
};

export const ThemedOverlay: Story = {
  name: 'Themed overlay surface (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set the overlay scrim, panel background, and panel shadow on this panel or any ancestor. These properties affect only the overlay presentation; docked inline panels retain their page-surface treatment.',
      },
    },
  },
  render: () => html`
    <div
      style="
        --lr-responsive-panel-overlay-color: var(--lr-color-danger-quiet);
        --lr-responsive-panel-overlay-panel-bg: var(--lr-color-surface);
        --lr-responsive-panel-overlay-panel-shadow: var(--lr-shadow-xl);
      "
    >
      <lr-responsive-panel mode="overlay" variant="bottom-sheet" open label="Themed settings">
        <span slot="header" style="font-weight: 600;">Themed settings</span>
        <p style="margin: 0;">This sheet inherits its scrim, surface, and elevation from its wrapper.</p>
        <div slot="footer"><button type="button">Apply</button></div>
      </lr-responsive-panel>
    </div>
  `,
};

export const ForcedOverlayFullscreen: Story = {
  name: 'mode="overlay" variant="fullscreen"',
  render: () => html`
    <div>
      <button @click=${openPanel}>Open panel</button>
      <lr-responsive-panel mode="overlay" variant="fullscreen" label="Settings">
        <span slot="header" style="font-weight: 600;">Settings</span>
        <p style="margin: 0;">Fullscreen covers the entire viewport -- no docked layout, no visible backdrop.</p>
        <div slot="footer">
          <button
            @click=${(e: Event) =>
              ((e.target as HTMLElement).closest('lr-responsive-panel') as LyraResponsivePanel).close('cancel')}
          >
            Close
          </button>
        </div>
      </lr-responsive-panel>
    </div>
  `,
};

export const ForcedOverlayBottomSheet: Story = {
  name: 'mode="overlay" variant="bottom-sheet"',
  render: (_args, context) => html`
    <div>
      <button @click=${openPanel}>Open panel</button>
      <lr-responsive-panel
        mode="overlay"
        variant="bottom-sheet"
        label="Share"
        .open=${context.viewMode !== 'docs'}
      >
        <span slot="header" style="font-weight: 600;">Share</span>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button dir="auto">Copy link</button>
          <button dir="auto">Share to...</button>
        </div>
      </lr-responsive-panel>
    </div>
  `,
};

export const CancelableClose: Story = {
  name: 'Cancelable close veto',
  parameters: {
    docs: {
      description: {
        story:
          'The same cancelable `lr-close` event covers `close()`, Escape, and backdrop dismissal. This listener calls `preventDefault()`, so each attempt leaves the panel, focus trap, and scroll lock active.',
      },
    },
  },
  render: () => html`
    <lr-responsive-panel
      mode="overlay"
      variant="bottom-sheet"
      open
      label="Unsaved changes"
      @lr-close=${vetoPanelClose}
    >
      <span slot="header" style="font-weight: 600;">Unsaved changes</span>
      <p style="margin: 0;">Try the footer button, Escape, or the backdrop. Each close request is vetoed.</p>
      <div slot="footer" style="display: grid; gap: var(--lr-space-s);">
        <button
          @click=${(event: Event) =>
            ((event.currentTarget as HTMLElement).closest('lr-responsive-panel') as LyraResponsivePanel).close('footer')}
        >
          Try closing
        </button>
        <output data-close-veto-status role="status">No close request yet.</output>
      </div>
    </lr-responsive-panel>
  `,
};

export const AutoModeResolvesToOverlayHere: Story = {
  name: 'mode="auto" (allocation-based)',
  parameters: {
    docs: {
      description: {
        story:
          'Resize the bounded wrapper below. The same panel switches presentation when its own allocation crosses `overlay-breakpoint`, independently of the browser viewport.',
      },
    },
  },
  render: () => html`
    <div style="inline-size: min(100%, 36rem); resize: horizontal; overflow: auto;">
      <button @click=${openPanel}>Open panel</button>
      <lr-responsive-panel mode="auto" overlay-breakpoint="32rem" open label="Conversation history">
        <span slot="header" style="font-weight: 600;">History</span>
        <p style="margin: 0;">
          Resize this wrapper across 32rem. The panel follows its allocation without replacing this content.
        </p>
        <div slot="footer">
          <button
            @click=${(e: Event) =>
              ((e.target as HTMLElement).closest('lr-responsive-panel') as LyraResponsivePanel).close('cancel')}
          >
            Close
          </button>
        </div>
      </lr-responsive-panel>
    </div>
  `,
};

export const SettingsSidebarPattern: Story = {
  name: 'Realistic pattern: allocation-responsive settings panel',
  parameters: {
    docs: {
      description: {
        story:
          'This open panel is docked while its flex allocation is wider than 28rem and becomes a modal bottom sheet below that allocation. Resize the canvas or wrapper to exercise both states.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: flex-start;">
      <div style="flex: 1; min-inline-size: 12rem; padding: 1rem; border: 1px dashed var(--lr-color-border); border-radius: 0.375rem;">
        Main content area
      </div>
      <button @click=${openPanel}>Open settings (below 900px)</button>
      <lr-responsive-panel
        mode="auto"
        overlay-breakpoint="28rem"
        variant="bottom-sheet"
        open
        label="Settings"
        style="min-inline-size: 16rem;"
      >
        <span slot="header" style="font-weight: 600;">Settings</span>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <label><input type="checkbox" checked /> Notifications</label>
          <label><input type="checkbox" /> Dark mode</label>
        </div>
      </lr-responsive-panel>
    </div>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow long content LTR/RTL (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Paired exact 320px docked allocations keep unbroken localized header, body, and footer content inside the panel. The same wrappers also protect the overlay presentation, whose panel fills the viewport rather than an ancestor allocation.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
            <lr-responsive-panel mode="inline" open style="inline-size: 100%;">
              <span slot="header"
                >${direction === 'rtl'
                  ? 'عنوانلوحةمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedResponsivePanelHeaderWithoutAnyNaturalBreakOpportunity'}</span
              >
              ${direction === 'rtl'
                ? 'محتوىلوحةمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                : 'InternationalizedResponsivePanelBodyWithoutAnyNaturalBreakOpportunity'}
              <button slot="footer" type="button"
                >${direction === 'rtl'
                  ? 'إجراءلوحةمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedResponsivePanelFooterActionWithoutAnyNaturalBreakOpportunity'}</button
              >
            </lr-responsive-panel>
          </div>
        `,
      )}
    </div>
  `,
};
