import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu.js';
import './menu-item.js';
import type { MenuSelectDetail } from './menu.js';

const meta: Meta = {
  title: 'Menu',
  component: 'lyra-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An anchored dropdown of `<lyra-menu-item>` actions, opened from a `trigger`-slotted element (typically an icon button). `role="menu"`/`role="menuitem"` with real roving DOM focus, not a listbox — see the class doc for why.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** The gear-menu/avatar-menu/history-row-overflow-menu shape this component
 *  exists to replace: an icon-only trigger, a short action list, and a
 *  destructive item set apart with `destructive`. */
export const GearMenu: Story = {
  render: () => html`
    <lyra-menu label="Settings">
      <button
        slot="trigger"
        aria-label="Settings"
        style="display:inline-flex;align-items:center;justify-content:center;inline-size:2.5rem;block-size:2.5rem;border:1px solid var(--lyra-color-border);border-radius:var(--lyra-radius);background:var(--lyra-color-surface);cursor:pointer;font-size:1.1rem;"
      >
        ⚙️
      </button>
      <lyra-menu-item value="profile"><span slot="icon">👤</span>Edit profile</lyra-menu-item>
      <lyra-menu-item value="preferences"><span slot="icon">🎛️</span>Preferences</lyra-menu-item>
      <hr />
      <lyra-menu-item value="signout" destructive><span slot="icon">🚪</span>Sign out</lyra-menu-item>
    </lyra-menu>
  `,
};

/** A history row's overflow menu — the exact "reached outside the library
 *  for a third-party dropdown" use case this component replaces. */
export const RowOverflowMenu: Story = {
  render: () => html`
    <div
      style="display:flex;align-items:center;gap:0.75rem;max-inline-size:24rem;padding:0.5rem 0.75rem;border:1px solid var(--lyra-color-border);border-radius:var(--lyra-radius);"
    >
      <span style="flex:1 1 auto;min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        Migrating the table component to lyra-ui
      </span>
      <lyra-menu label="Conversation actions" placement="bottom-end">
        <button
          slot="trigger"
          aria-label="Conversation actions"
          style="border:none;background:none;cursor:pointer;font-size:1.25rem;line-height:1;padding:0.25rem;"
        >
          ⋮
        </button>
        <lyra-menu-item value="rename">Rename</lyra-menu-item>
        <lyra-menu-item value="pin">Pin to top</lyra-menu-item>
        <lyra-menu-item value="archive">Archive</lyra-menu-item>
        <hr />
        <lyra-menu-item value="delete" destructive>Delete</lyra-menu-item>
      </lyra-menu>
    </div>
  `,
};

/** A `disabled` item is skipped by keyboard navigation and can't be clicked,
 *  but still renders (dimmed) so its existence stays visible. */
export const WithDisabledItem: Story = {
  render: () => html`
    <lyra-menu label="Document actions">
      <button
        slot="trigger"
        aria-label="Document actions"
        style="border:1px solid var(--lyra-color-border);border-radius:var(--lyra-radius);background:var(--lyra-color-surface);cursor:pointer;padding:0.4rem 0.75rem;"
      >
        Actions ▾
      </button>
      <lyra-menu-item value="download">Download</lyra-menu-item>
      <lyra-menu-item value="share" disabled>Share (requires admin)</lyra-menu-item>
      <lyra-menu-item value="delete" destructive>Delete</lyra-menu-item>
    </lyra-menu>
  `,
};

/** A non-`<lyra-menu-item>` control (here, a text filter input) slotted
 *  alongside the items keeps its own full default keyboard behavior —
 *  Arrow/Home/End/Enter/Space never get hijacked from it. With
 *  `close-on-escape-anywhere` set, Escape from that input still closes the
 *  menu and refocuses the trigger, matching what Escape already does from a
 *  real item; without it (the default), Escape from the input is left alone. */
export const SlottedControlWithEscapeAnywhere: Story = {
  render: () => html`
    <lyra-menu label="Filtered actions" close-on-escape-anywhere>
      <button
        slot="trigger"
        aria-label="Filtered actions"
        style="border:1px solid var(--lyra-color-border);border-radius:var(--lyra-radius);background:var(--lyra-color-surface);cursor:pointer;padding:0.4rem 0.75rem;"
      >
        Actions ▾
      </button>
      <div style="padding:0.4rem 0.6rem;">
        <input
          type="text"
          placeholder="Filter…"
          style="inline-size:100%;box-sizing:border-box;padding:0.3rem 0.5rem;border:1px solid var(--lyra-color-border);border-radius:var(--lyra-radius);"
        />
      </div>
      <hr />
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
      <lyra-menu-item value="duplicate">Duplicate</lyra-menu-item>
      <lyra-menu-item value="delete" destructive>Delete</lyra-menu-item>
    </lyra-menu>
  `,
};

/** `lyra-menu-select` is the recommended single event to listen to on
 *  `<lyra-menu>` itself, rather than every individual `<lyra-menu-item>`. */
export const SelectEvent: Story = {
  render: () => html`
    <div>
      <lyra-menu
        label="Row actions"
        @lyra-menu-select=${(e: CustomEvent<MenuSelectDetail>) => {
          const out = document.getElementById('menu-select-log');
          if (out) out.textContent = `Selected: ${e.detail.value}`;
        }}
      >
        <button slot="trigger" aria-label="Row actions" style="cursor:pointer;">⋮</button>
        <lyra-menu-item value="rename">Rename</lyra-menu-item>
        <lyra-menu-item value="duplicate">Duplicate</lyra-menu-item>
        <lyra-menu-item value="delete" destructive>Delete</lyra-menu-item>
      </lyra-menu>
      <p id="menu-select-log">Selected: (none yet)</p>
    </div>
  `,
};
