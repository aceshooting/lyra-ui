import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu.js';
import './menu-item.js';
import './menu-label.js';
import '../../forms/icon-button/icon-button.js';
import type { MenuItemSelectDetail } from './menu.js';

const meta: Meta = {
  title: 'Menu',
  component: 'lr-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A menu of `<lr-menu-item>` actions. Supply a `trigger` to make it an anchored dropdown; omit both trigger and anchor for the always-visible standalone shape mapped from `sl-menu`. `role="menu"`/`role="menuitem"` uses real roving DOM focus, not a listbox.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** The exact standalone Shoelace authoring shape after a mechanical `sl-` → `lr-` rename. With
 * no trigger or anchor, the menu stays inline and visible and exposes one roving Tab stop. */
export const StandaloneMappedMenu: Story = {
  render: () => html`
    <lr-menu label="File actions">
      <lr-menu-label>File</lr-menu-label>
      <lr-menu-item value="open">Open…</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
    </lr-menu>
  `,
};

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
 *  button, which is the element that actually receives focus. Supporting browsers expose the
 *  cross-shadow relationship through `ariaControlsElements`, whose setter intentionally clears
 *  the internal button's serialized `aria-controls` string. */
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

/** `lr-select` is the mapped single event to listen to on `<lr-menu>` itself, rather than every
 * individual `<lr-menu-item>`. Its complete item detail and veto point are retained through nested
 * submenus. */
export const SelectEvent: Story = {
  render: () => html`
    <div>
      <lr-menu
        label="Row actions"
        @lr-select=${(e: CustomEvent<MenuItemSelectDetail>) => {
          const out = document.getElementById('menu-select-log');
          if (out) out.textContent = `Selected: ${e.detail.item.value}`;
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

/** A row that owns an `<lr-menu slot="submenu">` becomes a submenu parent: `aria-haspopup="menu"`,
 *  a chevron, and a nested menu that opens beside it. ArrowRight steps in and ArrowLeft steps back
 *  out (swapped under RTL); hovering opens after a short intent delay, with enough grace on the way
 *  out to cut diagonally across the rows in between. Selections made in a submenu arrive as the
 *  outer menu as one `lr-select`. */
export const NestedSubmenus: Story = {
  render: () => html`
    <div>
      <lr-menu
        label="Row actions"
        @lr-select=${(e: CustomEvent<MenuItemSelectDetail>) => {
          const out = document.getElementById('menu-submenu-log');
          if (out) out.textContent = `Selected: ${e.detail.item.value}`;
        }}
      >
        <button slot="trigger" aria-label="Row actions" style="cursor:pointer;">⋮</button>
        <lr-menu-item value="rename">Rename</lr-menu-item>
        <lr-menu-item value="share">
          Share
          <lr-menu slot="submenu">
            <lr-menu-item value="share-email">Email</lr-menu-item>
            <lr-menu-item value="share-link">Copy link</lr-menu-item>
            <lr-menu-item value="share-more">
              More
              <lr-menu slot="submenu">
                <lr-menu-item value="share-teams">Teams</lr-menu-item>
                <lr-menu-item value="share-embed">Embed code</lr-menu-item>
              </lr-menu>
            </lr-menu-item>
          </lr-menu>
        </lr-menu-item>
        <lr-menu-item value="move">
          Move to
          <lr-menu slot="submenu">
            <lr-menu-item value="move-inbox">Inbox</lr-menu-item>
            <lr-menu-item value="move-archive">Archive</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
        <hr />
        <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
      </lr-menu>
      <p id="menu-submenu-log">Selected: (none yet)</p>
    </div>
  `,
};
