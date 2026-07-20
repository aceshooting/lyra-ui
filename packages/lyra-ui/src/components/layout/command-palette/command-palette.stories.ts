import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './command-palette.js'; import type { LyraCommandPalette } from './command-palette.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';
const meta: Meta = { title: 'Command Palette', component: 'lr-command-palette', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<button @click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as LyraCommandPalette).openPalette()}>Open command palette</button><lr-command-palette .commands=${[{ id: 'new', label: 'New document', group: 'File', shortcut: '⌘N' }, { id: 'search', label: 'Search workspace', group: 'Navigation' }]}></lr-command-palette>` };

/** The active (keyboard-highlighted) command row's background is themeable through
 *  `--lr-command-palette-active-bg`. It is not declared on `:host`, so setting it on an ancestor
 *  recolors only the active row — not everything else reading `--lr-color-brand-quiet`. */
export const ThemedActiveCommand: Story = {
  name: 'Themed active command (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-command-palette-active-bg` on the element or any ancestor to recolor the active command row without hijacking the library-wide `--lr-color-brand-quiet` token.',
      },
    },
  },
  render: () => html`<div style="--lr-command-palette-active-bg: ${storyColor('successQuiet')};">
    <button @click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as LyraCommandPalette).openPalette()}>Open command palette</button>
    <lr-command-palette .commands=${[{ id: 'new', label: 'New document', group: 'File', shortcut: '⌘N' }, { id: 'search', label: 'Search workspace', group: 'Navigation' }]}></lr-command-palette>
  </div>`,
};

/** A narrow (320px) dialog allocation, set through the documented
 *  `--lr-command-palette-max-inline-size` cssprop (the backdrop itself is a fixed-position
 *  overlay spanning the whole viewport, so an ancestor's own inline-size can't constrain the
 *  dialog the way it would a static-flow component). A long, unbreakable description column
 *  shrinks to fit the row instead of overflowing the dialog. */
export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  render: (_args, context) => html`<lr-command-palette
    style="--lr-command-palette-max-inline-size: 320px;"
    .open=${context.viewMode !== 'docs'}
    .commands=${[
      { id: 'open', label: 'Open File', description: '/Users/alexandra-morrison/Projects/lyra-ui-workspace/very-long-nested-directory-path/index.ts', shortcut: '⌘O' },
      { id: 'save', label: 'Save', group: 'File' },
    ]}
  ></lr-command-palette>`,
};
