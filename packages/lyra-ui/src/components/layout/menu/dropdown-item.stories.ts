import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './dropdown-item.js';

const meta: Meta = { title: 'Components/Dropdown Item', component: 'lr-dropdown-item' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div role="menu" aria-label="Actions">
      <lr-dropdown-item value="archive">Archive</lr-dropdown-item>
    </div>
  `,
};

export const CompatibilitySurface: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The focusable dropdown-item host remains the row’s sole action. Default, icon, prefix, details, and suffix content is visual-only; default-slot text supplies the host’s accessible name and type-ahead label. Use the dedicated submenu slot for nested menu content.',
      },
    },
  },
  render: () => html`
    <div role="menu" aria-label="Compatibility states" style="inline-size: 18rem;">
      <lr-dropdown-item value="rename">
        <span slot="prefix">✏️</span>
        Rename
        <span slot="details">⌘R</span>
      </lr-dropdown-item>
      <lr-dropdown-item type="checkbox" checked value="wrap">Wrap text</lr-dropdown-item>
      <lr-dropdown-item loading value="saving">Saving</lr-dropdown-item>
      <lr-dropdown-item variant="danger" value="delete">Delete</lr-dropdown-item>
    </div>
  `,
};

export const SubmenuControl: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The mapped `openSubmenu()` / `closeSubmenu()` methods settle after `submenuOpen` and its `submenu-open` reflection agree. Native focus and blur remain on the focusable item host.',
      },
    },
  },
  render: () => html`
    <div data-submenu-story style="display: grid; gap: var(--lr-space-s); inline-size: 18rem;">
      <div style="display: flex; gap: var(--lr-space-xs);">
        <button
          type="button"
          @click=${(event: Event) => {
            const item = (event.currentTarget as HTMLElement)
              .closest('[data-submenu-story]')!
              .querySelector('lr-dropdown-item')!;
            void item.openSubmenu('none');
          }}
        >Open submenu</button>
        <button
          type="button"
          @click=${(event: Event) => {
            const item = (event.currentTarget as HTMLElement)
              .closest('[data-submenu-story]')!
              .querySelector('lr-dropdown-item')!;
            void item.closeSubmenu();
          }}
        >Close submenu</button>
      </div>
      <div role="menu" aria-label="Share actions">
        <lr-dropdown-item>
          Share
          <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
          <lr-dropdown-item slot="submenu" value="link">Copy link</lr-dropdown-item>
        </lr-dropdown-item>
      </div>
    </div>
  `,
};

/** Web Awesome publishes the mixed-case `submenuOpen` attribute. HTML normalizes that spelling to
 * `submenuopen`; Lyra accepts it permanently alongside the canonical `submenu-open` reflection. */
export const UpstreamSubmenuOpenAttribute: Story = {
  render: () => html`
    <div role="menu" aria-label="Share actions" style="inline-size: 18rem;">
      <lr-dropdown-item submenuOpen>
        Share
        <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
        <lr-dropdown-item slot="submenu" value="link">Copy link</lr-dropdown-item>
      </lr-dropdown-item>
    </div>
  `,
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same six-step ladder `<lr-menu-item>` carries, inherited rather than reimplemented. `small`/`medium`/`large` are accepted as synonyms of `s`/`m`/`l`.',
      },
    },
  },
  render: () => html`
    <div role="menu" aria-label="Sizes" style="display: flex; flex-direction: column; inline-size: 18rem;">
      <lr-dropdown-item size="xs" value="a">Extra small</lr-dropdown-item>
      <lr-dropdown-item size="s" value="b">Small</lr-dropdown-item>
      <lr-dropdown-item size="m" value="c">Medium (default)</lr-dropdown-item>
      <lr-dropdown-item size="l" value="d">Large</lr-dropdown-item>
      <lr-dropdown-item size="xl" value="e">Extra large</lr-dropdown-item>
    </div>
  `,
};
