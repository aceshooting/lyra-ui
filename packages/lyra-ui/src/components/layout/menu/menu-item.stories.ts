import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu-item.js';
import './menu.js';

const meta: Meta = { title: 'Navigation/Menu item', component: 'lr-menu-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-menu-item value="save">Save</lr-menu-item>` };

export const HostClick: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Calling `click()` on the focusable menu-item host follows the same visual-row path as pointer activation. The host remains inert while disabled or loading; checkbox items toggle and submenu parents open their panel through that same path.',
      },
    },
  },
  render: () => html`
    <div data-host-click-example style="display: grid; gap: var(--lr-space-s); inline-size: 18rem;">
      <div role="menu" aria-label="Programmatic activation">
        <lr-menu-item
          value="archive"
          @lr-menu-item-select=${(event: Event) => {
            const example = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-host-click-example]');
            const status = example?.querySelector<HTMLOutputElement>('[data-host-click-status]');
            if (status) status.value = 'Archive selected';
          }}
        >Archive</lr-menu-item>
      </div>
      <button
        type="button"
        @click=${(event: Event) => {
          const example = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-host-click-example]');
          example?.querySelector<HTMLElement>('lr-menu-item')?.click();
        }}
      >Call item.click()</button>
      <output data-host-click-status aria-live="polite">Waiting for selection</output>
    </div>
  `,
};

export const VisualSlots: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'The focusable menu-item host is the row’s sole action. Default, icon, prefix, details, and suffix content remains visual-only; default-slot text supplies the host’s accessible name and type-ahead label. Put an independent action outside the item, or use the dedicated submenu slot for nested menu content.',
      },
    },
  },
  render: () => html`
    <div role="menu" aria-label="Document actions" style="inline-size: 18rem;">
      <lr-menu-item value="rename">
        <span slot="icon">✏️</span>
        <span slot="prefix">File</span>
        Rename
        <span slot="details">⌘R</span>
        <span slot="suffix">…</span>
      </lr-menu-item>
    </div>
  `,
};

export const Sizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'The shared six-step ladder scales the row height, padding and font size together. `small`/`medium`/`large` are accepted as synonyms of `s`/`m`/`l`. Size is per item rather than per menu, so one compact row inside an otherwise default menu needs no wrapper — and every tier still resolves to at least the 24px pointer-target minimum.',
      },
    },
  },
  render: () => html`
    <div role="menu" aria-label="Sizes" style="display: flex; flex-direction: column; inline-size: 18rem;">
      <lr-menu-item size="2xs" value="a">2x extra small</lr-menu-item>
      <lr-menu-item size="xs" value="b">Extra small</lr-menu-item>
      <lr-menu-item size="s" value="c">Small</lr-menu-item>
      <lr-menu-item size="m" value="d">Medium (default)</lr-menu-item>
      <lr-menu-item size="l" value="e">Large</lr-menu-item>
      <lr-menu-item size="xl" value="f">Extra large</lr-menu-item>
      <lr-menu-item size="large" value="g">size="large" — the same tier as "l"</lr-menu-item>
    </div>
  `,
};

/** Row-chrome hooks use inline fallbacks, not host declarations, so one menu-level value reaches
 * every contained item without a `::part(base)` rule. */
export const ThemedRowChrome: StoryObj = {
  name: 'Themed row chrome (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-menu-item-gap` and `--lr-menu-item-radius` on an item or any ancestor to retune its visual row without a `::part(base)` rule. The gap remains constant across sizes; the default radius follows the shared size ladder.',
      },
    },
  },
  render: () => html`
    <div
      role="menu"
      aria-label="Themed document actions"
      style="--lr-menu-item-gap: var(--lr-space-m); --lr-menu-item-radius: var(--lr-radius-pill); inline-size: 18rem;"
    >
      <lr-menu-item value="rename">
        <span slot="icon">✏️</span>
        Rename
        <span slot="details">⌘R</span>
        <span slot="suffix">…</span>
      </lr-menu-item>
    </div>
  `,
};

export const SubmenuOffset: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`--submenu-offset` is the final signed distance from the parent row: the `-2px` default overlaps its edge, while a positive value creates separation. This story keeps the submenu open and uses a spacing token as a positive override.',
      },
    },
  },
  render: () => html`
    <div role="menu" aria-label="Share actions" style="inline-size: 12rem; margin: var(--lr-space-2xl);">
      <lr-menu-item value="share" style="--submenu-offset: var(--lr-space-l);">
        Share
        <lr-menu slot="submenu" label="Share" open>
          <lr-menu-item value="email">Email</lr-menu-item>
          <lr-menu-item value="link">Copy link</lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </div>
  `,
};
