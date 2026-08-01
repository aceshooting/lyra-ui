import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu-item.js';

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
