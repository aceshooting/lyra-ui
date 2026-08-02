import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu-item.js';
import './menu.js';

const meta: Meta = { title: 'Navigation/Menu item', component: 'lr-menu-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-menu-item value="save">Save</lr-menu-item>` };

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
