import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu.js';
import './menu-item.js';
import '../../forms/icon-button/icon-button.js';
import type { MenuSelectDetail } from './menu.js';

const meta: Meta = {
  title: 'Menu',
  component: 'lr-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An anchored dropdown of `<lr-menu-item>` actions, opened from a `trigger`-slotted element (typically an icon button). `role="menu"`/`role="menuitem"` with real roving DOM focus, not a listbox — see the class doc for why.',
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
    <lr-menu label="Settings" open>
      <button
        slot="trigger"
        aria-label="Settings"
        style="display:inline-flex;align-items:center;justify-content:center;inline-size:2.5rem;block-size:2.5rem;border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);cursor:pointer;font-size:1.1rem;"
      >
        ⚙️
      </button>
      <lr-menu-item value="profile"><span slot="icon">👤</span>Edit profile</lr-menu-item>
      <lr-menu-item value="preferences"><span slot="icon">🎛️</span>Preferences</lr-menu-item>
      <hr />
      <lr-menu-item value="signout" destructive><span slot="icon">🚪</span>Sign out</lr-menu-item>
    </lr-menu>
  `,
};

/** Lyra's own icon-button can be the trigger without losing the menu-button relationship:
 *  `aria-haspopup`, `aria-expanded`, and the controls reference reach its shadow-internal native
 *  button, which is the element that actually receives focus. */
export const LyraIconButtonTrigger: Story = {
  render: () => html`
    <lr-menu label="Account actions">
      <lr-icon-button slot="trigger" aria-label="Account actions">👤</lr-icon-button>
      <lr-menu-item value="profile">Profile</lr-menu-item>
      <lr-menu-item value="preferences">Preferences</lr-menu-item>
      <lr-menu-item value="signout" destructive>Sign out</lr-menu-item>
    </lr-menu>
  `,
};

/** A history row's overflow menu — the exact "reached outside the library
 *  for a third-party dropdown" use case this component replaces. */
export const RowOverflowMenu: Story = {
  render: () => html`
    <div
      style="display:flex;align-items:center;gap:0.75rem;max-inline-size:24rem;padding:0.5rem 0.75rem;border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);"
    >
      <span style="flex:1 1 auto;min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        Migrating the table component to lyra-ui
      </span>
      <lr-menu label="Conversation actions" placement="bottom-end">
        <button
          slot="trigger"
          aria-label="Conversation actions"
          style="border:none;background:none;cursor:pointer;font-size:1.25rem;line-height:1;padding:0.25rem;"
        >
          ⋮
        </button>
        <lr-menu-item value="rename">Rename</lr-menu-item>
        <lr-menu-item value="pin">Pin to top</lr-menu-item>
        <lr-menu-item value="archive">Archive</lr-menu-item>
        <hr />
        <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
      </lr-menu>
    </div>
  `,
};

/** A `disabled` item is skipped by keyboard navigation and can't be clicked,
 *  but still renders (dimmed) so its existence stays visible. */
export const WithDisabledItem: Story = {
  render: () => html`
    <lr-menu label="Document actions">
      <button
        slot="trigger"
        aria-label="Document actions"
        style="border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);cursor:pointer;padding:0.4rem 0.75rem;"
      >
        Actions ▾
      </button>
      <lr-menu-item value="download">Download</lr-menu-item>
      <lr-menu-item value="share" disabled>Share (requires admin)</lr-menu-item>
      <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
    </lr-menu>
  `,
};

/** A filter field belongs in the `header` slot: it renders above the items but
 *  *outside* the `role="menu"` list, so it is ARIA-valid (arbitrary content
 *  inside `role="menu"` is not), Tab reaches it from the items instead of
 *  closing the menu, Escape from it closes and refocuses the trigger with no
 *  opt-in, and Arrow/Home/End/Enter/Space are never hijacked from it. */
export const HeaderFilterField: Story = {
  render: () => html`
    <lr-menu label="Filtered actions">
      <button
        slot="trigger"
        aria-label="Filtered actions"
        style="border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);cursor:pointer;padding:0.4rem 0.75rem;"
      >
        Actions ▾
      </button>
      <input
        slot="header"
        type="text"
        placeholder="Filter…"
        aria-label="Filter actions"
        style="inline-size:100%;box-sizing:border-box;padding:0.3rem 0.5rem;border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);"
      />
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
    </lr-menu>
  `,
};

/** The legacy shape the `header`/`footer` slots replace: a non-`<lr-menu-item>`
 *  control slotted into the *default* slot, i.e. inside `role="menu"`. It still
 *  works and still keeps its own full default keyboard behavior, but it is not
 *  reachable with Tab from an item, and only closes on Escape when
 *  `close-on-escape-anywhere` is set (the default is `false`, which leaves
 *  Escape from the input alone). Prefer the story above for new code. */
export const SlottedControlWithEscapeAnywhere: Story = {
  render: () => html`
    <lr-menu label="Filtered actions" close-on-escape-anywhere>
      <button
        slot="trigger"
        aria-label="Filtered actions"
        style="border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);cursor:pointer;padding:0.4rem 0.75rem;"
      >
        Actions ▾
      </button>
      <div style="padding:0.4rem 0.6rem;">
        <input
          type="text"
          placeholder="Filter…"
          aria-label="Filter actions"
          style="inline-size:100%;box-sizing:border-box;padding:0.3rem 0.5rem;border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);"
        />
      </div>
      <hr />
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
    </lr-menu>
  `,
};

/** An Apply button in the `footer` slot — outside the `role="menu"` list, Tab-reachable from the
 *  last item — closing the menu through the public `hide({ focusTrigger: true })`. That is the case
 *  the trigger alone can't express: the user is done, but nothing has moved focus anywhere, so the
 *  menu has to hand it back to the trigger itself. `show()` is the symmetric opener. */
export const ImperativeShowHide: Story = {
  name: 'show() / hide({ focusTrigger: true })',
  render: () => html`
    <div>
      <lr-menu label="Filters" id="imperative-menu">
        <button
          slot="trigger"
          aria-label="Filters"
          style="border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);cursor:pointer;padding:0.4rem 0.75rem;"
        >
          Filters ▾
        </button>
        <lr-menu-item value="unread">Unread only</lr-menu-item>
        <lr-menu-item value="starred">Starred only</lr-menu-item>
        <div slot="footer" style="text-align:end;">
          <button
            type="button"
            style="border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);cursor:pointer;padding:0.25rem 0.6rem;"
            @click=${(e: Event) => {
              (e.target as HTMLElement).closest('lr-menu')?.hide({ focusTrigger: true });
            }}
          >
            Apply
          </button>
        </div>
      </lr-menu>
      <p>
        <button
          type="button"
          @click=${() => (document.getElementById('imperative-menu') as HTMLElement & { show(): void })?.show()}
        >
          Open the menu from out here (show())
        </button>
      </p>
    </div>
  `,
};

/** `lr-menu-select` is the recommended single event to listen to on
 *  `<lr-menu>` itself, rather than every individual `<lr-menu-item>`. */
export const SelectEvent: Story = {
  render: () => html`
    <div>
      <lr-menu
        label="Row actions"
        @lr-menu-select=${(e: CustomEvent<MenuSelectDetail>) => {
          const out = document.getElementById('menu-select-log');
          if (out) out.textContent = `Selected: ${e.detail.value}`;
        }}
      >
        <button slot="trigger" aria-label="Row actions" style="cursor:pointer;">⋮</button>
        <lr-menu-item value="rename">Rename</lr-menu-item>
        <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
        <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
      </lr-menu>
      <p id="menu-select-log">Selected: (none yet)</p>
    </div>
  `,
};
