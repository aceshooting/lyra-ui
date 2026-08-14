import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dropdown.js';
import '../../layout/menu/dropdown-item.js';
import '../../layout/menu/menu.js';

const meta: Meta = {
  title: 'Overlay/Dropdown',
  component: 'lr-dropdown',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A trigger-owned action menu. The contained menu owns role/name while the positioned shell stays neutral; `focusOnTrigger()` focuses the assigned trigger and `getMenu()` returns the live generated or consumer-supplied menu engine.',
      },
    },
  },
};
export default meta;
// Forced open in the story canvas (but not in autodocs, viewMode === 'docs') so the visual-
// regression harness and anyone opening the story lands on the actual dropdown surface rather than
// a bare closed trigger -- the same `.open` pattern lr-dialog and lr-drawer use.
export const Default: StoryObj = {
  render: (_args, context) =>
    html`
      <lr-dropdown aria-label="Document actions" .open=${context.viewMode !== 'docs'}>
        <button slot="trigger">Open menu</button>
        <lr-dropdown-item value="rename"><span slot="icon">✏️</span>Rename</lr-dropdown-item>
        <lr-dropdown-item value="duplicate"><span slot="details">⌘D</span>Duplicate</lr-dropdown-item>
        <lr-dropdown-item value="archive" disabled>Archive</lr-dropdown-item>
        <lr-dropdown-item value="delete" variant="danger">Delete</lr-dropdown-item>
      </lr-dropdown>
    `,
};

/** Disabled is an opening invariant: even declarative `open` markup normalizes closed before the
 * first rendered/positioned state, independent of attribute order. */
export const DisabledOpenNormalizesClosed: StoryObj = {
  render: () => html`
    <lr-dropdown open disabled aria-label="Unavailable actions">
      <button slot="trigger">Unavailable</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
    </lr-dropdown>
  `,
};

/** The Web Awesome direct-item submenu shape. The same controller also accepts Shoelace's nested
 * `<lr-menu slot="submenu">` shape, as shown by the consumer-menu story below. */
export const DirectItemSubmenus: StoryObj = {
  render: () => html`
    <lr-dropdown aria-label="Share actions">
      <button slot="trigger">Share ▾</button>
      <lr-dropdown-item value="copy">Copy</lr-dropdown-item>
      <lr-dropdown-item>
        Send to
        <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
        <lr-dropdown-item slot="submenu" value="team">Team</lr-dropdown-item>
      </lr-dropdown-item>
      <lr-dropdown-item value="remove" variant="danger">Remove access</lr-dropdown-item>
    </lr-dropdown>
  `,
};

/** A consumer-supplied menu becomes the dropdown's owned content instead of creating a second
 * popup. Selection travels through the dropdown's single cancelable `lr-select` path. */
export const ConsumerMenu: StoryObj = {
  render: () => html`
    <lr-dropdown aria-label="Account actions" stay-open-on-select>
      <button slot="trigger">Account ▾</button>
      <lr-menu label="Account actions">
        <input slot="header" aria-label="Filter account actions" placeholder="Filter actions" />
        <lr-dropdown-item type="checkbox" value="online">Appear online</lr-dropdown-item>
        <lr-dropdown-item value="settings">Settings</lr-dropdown-item>
        <lr-dropdown-item value="sign-out" variant="danger">Sign out</lr-dropdown-item>
        <button slot="footer" type="button">Manage account</button>
      </lr-menu>
    </lr-dropdown>
  `,
};
