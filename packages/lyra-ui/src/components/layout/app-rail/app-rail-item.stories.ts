import './app-rail.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail-item.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'Navigation/App rail item', component: 'lr-app-rail-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-app-rail-item href="/home">Home</lr-app-rail-item>` };

export const ProgrammaticActivation: StoryObj = {
  name: 'Programmatic click()',
  parameters: {
    docs: {
      description: {
        story:
          'Calling `click()` on the custom-element host forwards to its native link or button. Disabled items remain inert.',
      },
    },
  },
  render: () => html`
    <div>
      <lr-app-rail-item id="programmatic-app-rail-item">Open settings</lr-app-rail-item>
      <button
        type="button"
        @click=${() => document.getElementById('programmatic-app-rail-item')?.click()}
      >
        Call host click()
      </button>
    </div>
  `,
};

export const IconOnlyTooltip: StoryObj = {
  name: 'Icon-only tooltip',
  parameters: {
    docs: {
      description: {
        story:
          'With both `icon-only` and `tooltip`, hover or focus the named item to reveal its label flyout. The visible icon subtree remains inert and aria-hidden while the native link keeps the supplied accessible name and action.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:var(--lr-icon-button-size);">
      <lr-app-rail-item href="#inbox" aria-label="Inbox" icon-only tooltip>
        <span slot="icon" aria-hidden="true">📥</span>Inbox
      </lr-app-rail-item>
    </div>
  `,
};

/** The `current`/`aria-current="page"` treatment is themeable through `--lr-app-rail-item-current-bg`,
 *  `--lr-app-rail-item-current-color`, and `--lr-app-rail-item-current-font-weight`. None are
 *  declared on `:host`, so setting them on an ancestor is never shadowed, and they recolor/reweight
 *  only the current item — not everything else that reads
 *  `--lr-color-brand-quiet`/`--lr-color-brand`/`--lr-font-weight-semibold`. */
export const ThemedCurrent: StoryObj = {
  name: 'Themed current item (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set the scoped current, hover, and active hooks on the element or any ancestor to recolor each state without hijacking the library-wide brand tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="
        display: flex;
        flex-direction: column;
        gap: var(--lr-space-xs);
        inline-size: var(--lr-size-12rem);
        --lr-app-rail-item-current-bg: ${storyColor('successQuiet')};
        --lr-app-rail-item-current-color: ${storyColor(
        'success',
      )};
        --lr-app-rail-item-current-font-weight: var(--lr-font-weight-bold);
        --lr-app-rail-item-hover-bg: ${storyColor(
        'warningQuiet',
      )};
        --lr-app-rail-item-hover-color: ${storyColor(
        'warning',
      )};
        --lr-app-rail-item-active-bg: ${storyColor(
        'dangerQuiet',
      )};
        --lr-app-rail-item-active-color: ${storyColor('danger')};
      "
    >
      <lr-app-rail-item href="/home" current>Home</lr-app-rail-item>
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
      <lr-app-rail-item href="/settings">Settings</lr-app-rail-item>
    </div>
  `,
};

/** In icon-only presentation the full-height `[part="current-indicator"]` bar is suppressed by
 *  default (it reads as a rendering glitch on a square tile) and replaced automatically by an
 *  inset `--lr-app-rail-item-current-ring`, which stays perceivable without relying on color
 *  alone. `--lr-app-rail-item-current-indicator-display` restores the bar per instance instead. */
export const IconOnlyCurrent: StoryObj = {
  name: 'Icon-only current indicator (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'The first item restores the full-height indicator bar via ' +
          '`--lr-app-rail-item-current-indicator-display: block`. The second keeps the default ' +
          'suppressed bar and its automatic ring. The third opts a non-icon-only item into the ' +
          'same ring via `--lr-app-rail-item-current-ring`.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: var(--lr-space-m);">
      <div style="inline-size: var(--lr-icon-button-size); --lr-app-rail-item-current-indicator-display: block;">
        <lr-app-rail-item href="/home" icon-only current
          ><span slot="icon" aria-hidden="true">🏠</span>Home</lr-app-rail-item
        >
      </div>
      <div style="inline-size: var(--lr-icon-button-size);">
        <lr-app-rail-item href="/inbox" icon-only current
          ><span slot="icon" aria-hidden="true">📥</span>Inbox</lr-app-rail-item
        >
      </div>
      <div style="inline-size: var(--lr-size-12rem); --lr-app-rail-item-current-ring: inset 0 0 0 1px var(--lr-color-brand);">
        <lr-app-rail-item href="/settings" current
          ><span slot="icon" aria-hidden="true">⚙️</span>Settings</lr-app-rail-item
        >
      </div>
    </div>
  `,
};

export const GeometryHooks: StoryObj = {
  name: 'Geometry hooks (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '--lr-app-rail-item-font-size retunes the label/icon column font size without disturbing family, weight, or line-height (declared after the `font` shorthand). In icon-only presentation, [part="base"] resolves to a square hit target matching the icon-button footprint instead of stretching across the rail\'s icon column. --lr-app-rail-item-icon-only-size sizes that square independently of a taller row set through --lr-app-rail-item-min-block-size.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: var(--lr-space-m);">
      <div style="inline-size: var(--lr-size-12rem); --lr-app-rail-item-font-size: 1.125rem;">
        <lr-app-rail-item href="/home"
          ><span slot="icon" aria-hidden="true">🏠</span>Home</lr-app-rail-item
        >
      </div>
      <div style="inline-size: var(--lr-icon-button-size);">
        <lr-app-rail-item href="/home" icon-only
          ><span slot="icon" aria-hidden="true">🏠</span>Home</lr-app-rail-item
        >
      </div>
      <div
        style="
          inline-size: var(--lr-icon-button-size);
          --lr-app-rail-item-min-block-size: 3.5rem;
          --lr-app-rail-item-icon-only-size: var(--lr-icon-button-size);
        "
      >
        <lr-app-rail-item href="/home" icon-only
          ><span slot="icon" aria-hidden="true">🏠</span>Home</lr-app-rail-item
        >
      </div>
    </div>
  `,
};

export const WithMetaAndEndSlots: StoryObj = {
  name: 'Meta and end slots',
  render: () => html`
    <div
      style="inline-size: 16rem; border: 1px solid var(--lr-color-border); border-radius: 0.5rem; padding: 0.5rem;"
    >
      <lr-app-rail-item href="/inbox" current>
        <span slot="icon">📥</span>Inbox
        <span slot="meta">12</span>
        <button slot="end" aria-label="Archive inbox">×</button>
      </lr-app-rail-item>
      <lr-app-rail-item href="/chats">
        <span slot="icon">💬</span>Chats
        <span slot="meta">3</span>
      </lr-app-rail-item>
    </div>
  `,
};

/** The treeitem-with-link pattern: the row itself navigates (`href`) while a separate built-in
 *  disclosure -- a sibling of the link, never nested inside it -- expands that one item's own
 *  `children`. Clicking the chevron never navigates; activating the link never toggles. */
export const NestedChildren: StoryObj = {
  name: 'Nested children (disclosure)',
  parameters: {
    docs: {
      description: {
        story:
          'Nested `<lr-app-rail-item>`s slotted into `children` grow a built-in disclosure ' +
          '(`[part="toggle"]`) as a sibling of the parent item\'s own link. `expanded` is ' +
          'reflected and drives a cancelable `lr-toggle-request`/settled `lr-toggle` pair, ' +
          'mirroring `<lr-app-rail-group>`\'s collapsible contract exactly. An item with nothing ' +
          'slotted into `children` (Settings, below) renders no disclosure at all.',
      },
    },
  },
  render: () => html`
    <div
      style="inline-size: 16rem; border: 1px solid var(--lr-color-border); border-radius: 0.5rem; padding: 0.5rem;"
    >
      <lr-app-rail-item href="/projects" expanded>
        <span slot="icon" aria-hidden="true">📁</span>Projects
        <lr-app-rail-item slot="children" href="/projects/atlas">
          <span slot="icon" aria-hidden="true">🛰️</span>Atlas
        </lr-app-rail-item>
        <lr-app-rail-item slot="children" href="/projects/beacon" current>
          <span slot="icon" aria-hidden="true">🔦</span>Beacon
        </lr-app-rail-item>
      </lr-app-rail-item>
      <lr-app-rail-item href="/settings">
        <span slot="icon" aria-hidden="true">⚙️</span>Settings
      </lr-app-rail-item>
    </div>
  `,
};


export const IconOnlyWithChildren: StoryObj = {
  parameters: { docs: { description: { story: 'Collapse the rail to hide nested disclosure controls and lists. Returning to full restores the previous expanded state.' } } },
  render: () => html`<lr-app-rail label="Workspace" collapsible icon-only-breakpoint="0px"><lr-app-rail-item expanded><span slot="icon">○</span>Account<lr-app-rail-item slot="children">Profile</lr-app-rail-item><lr-app-rail-item slot="children">Security</lr-app-rail-item></lr-app-rail-item></lr-app-rail>`,
};
