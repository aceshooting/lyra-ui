import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail-item.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = { title: 'Navigation/App rail item', component: 'lr-app-rail-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-app-rail-item href="/home">Home</lr-app-rail-item>` };

/** The `active`/`aria-current="page"` treatment is themeable through `--lr-app-rail-item-current-bg`
 *  and `--lr-app-rail-item-current-color`. Neither is declared on `:host`, so setting them on an
 *  ancestor is never shadowed, and they recolor only the current item — not everything else that
 *  reads `--lr-color-brand-quiet`/`--lr-color-brand`. */
export const ThemedCurrent: StoryObj = {
  name: 'Themed current item (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-app-rail-item-current-bg` and `--lr-app-rail-item-current-color` on the element or any ancestor to recolor the current item without hijacking the library-wide brand tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 0.25rem; inline-size: 12rem; --lr-app-rail-item-current-bg: ${storyColor(
        'successQuiet',
      )}; --lr-app-rail-item-current-color: ${storyColor('success')};"
    >
      <lr-app-rail-item href="/home" active>Home</lr-app-rail-item>
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
      <lr-app-rail-item href="/settings">Settings</lr-app-rail-item>
    </div>
  `,
};
