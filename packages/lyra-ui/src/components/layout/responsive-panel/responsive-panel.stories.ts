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
          'The same slotted content either docked inline in the page layout (desktop) or presented as a full-screen/bottom-sheet overlay (mobile), depending on viewport width. `mode="auto"` (the default) switches live via `matchMedia` against `mobile-breakpoint`; `mode="inline"`/`mode="overlay"` force a presentation regardless of viewport width.',
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

export const AutoModeResolvesToOverlayHere: Story = {
  name: 'mode="auto" (resolves to overlay in this narrow canvas)',
  parameters: {
    docs: {
      description: {
        story:
          'A deliberately large `mobile-breakpoint` makes `mode="auto"` resolve to the overlay presentation inside Storybook’s canvas width, without needing to actually resize the browser window -- shrink the canvas panel or view this story full-screen at different widths to see it flip back to docked inline once the canvas is wider than `mobile-breakpoint`.',
      },
    },
  },
  render: () => html`
    <div>
      <button @click=${openPanel}>Open panel</button>
      <lr-responsive-panel mode="auto" mobile-breakpoint="1400px" label="Conversation history">
        <span slot="header" style="font-weight: 600;">History</span>
        <p style="margin: 0;">
          Resize the browser window (or this canvas) past 1400px wide and this same panel switches to a
          docked inline layout instead, with no backdrop or focus trap.
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
  name: 'Realistic pattern: docked sidebar on desktop, sheet on mobile',
  parameters: {
    docs: {
      description: {
        story:
          'A settings sidebar that stays permanently docked next to the main content above 900px, and becomes a bottom-sheet overlay triggered by a button below it -- the common responsive-panel use case this component targets.',
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
        mobile-breakpoint="900px"
        variant="bottom-sheet"
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
