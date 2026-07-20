import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './breadcrumb-item.js';
import './breadcrumb.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = { title: 'Navigation/Breadcrumb item', component: 'lr-breadcrumb-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-breadcrumb-item href="/docs">Documentation</lr-breadcrumb-item>` };

/** The current-page item's color is themeable through `--lr-breadcrumb-current-color`. It is not
 *  declared on `:host`, so setting it on an ancestor recolors only the current item — not
 *  everything else reading `--lr-color-text-quiet`. */
export const ThemedCurrent: StoryObj = {
  name: 'Themed current item (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-breadcrumb-current-color` on the element or any ancestor to recolor the current-page item without hijacking the library-wide `--lr-color-text-quiet` token.',
      },
    },
  },
  render: () => html`
    <lr-breadcrumb style="--lr-breadcrumb-current-color: ${storyColor('brand')};">
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Q3 summary</lr-breadcrumb-item>
    </lr-breadcrumb>
  `,
};
