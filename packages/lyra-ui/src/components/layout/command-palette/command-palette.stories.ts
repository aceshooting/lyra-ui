import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html, svg } from 'lit'; import './command-palette.js'; import type { LyraCommandPalette } from './command-palette.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';
const meta: Meta = {
  title: 'Command Palette',
  component: 'lr-command-palette',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Command sequences are copied, bounded, and frozen while each row retains its identity for `onSelect`; create and reassign a new array after sequence or row changes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;
const documentIcon = svg`<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path fill="currentColor" d="M6 2h8l4 4v16H6zM13 3v4h4"></path></svg>`;
export const Default: Story = { render: () => html`<button @click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as LyraCommandPalette).openPalette()}>Open command palette</button><lr-command-palette hotkey="mod+k" .commands=${[{ commandId: 'new', label: 'New document', group: 'File', shortcut: '⌘N' }, { commandId: 'search', label: 'Search workspace', group: 'Navigation' }]}></lr-command-palette>` };

export const MixedCommandIcons: Story = {
  name: 'Mixed command icons',
  parameters: {
    docs: {
      description: {
        story:
          'A command can supply a decorative leading icon while adjacent commands omit one. The `icon` part renders only for the first row; every row retains its own `label` part.',
      },
    },
  },
  render: (_args, context) => html`<lr-command-palette
    .open=${context.viewMode !== 'docs'}
    .commands=${[
      { commandId: 'new', label: 'New document', description: 'Create a blank workspace document', group: 'File', icon: documentIcon },
      { commandId: 'search', label: 'Search workspace', description: 'Find documents and conversations', group: 'Navigation' },
    ]}
  ></lr-command-palette>`,
};

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
    <lr-command-palette .commands=${[{ commandId: 'new', label: 'New document', group: 'File', shortcut: '⌘N' }, { commandId: 'search', label: 'Search workspace', group: 'Navigation' }]}></lr-command-palette>
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
      { commandId: 'open', label: 'Open File', description: '/workspace/example-project/very-long-nested-directory-path/index.ts', shortcut: '⌘O' },
      { commandId: 'save', label: 'Save', group: 'File' },
    ]}
  ></lr-command-palette>`,
};

export const CustomVirtualPitch: Story = {
  name: 'Custom virtual row and group heights',
  parameters: {
    docs: {
      description: {
        story:
          'The documented row and group height tokens drive painted sizes, virtual transforms, keyboard-scroll coordinates, and the spacer extent together—even when changed while open.',
      },
    },
  },
  render: (_args, context) => html`<lr-command-palette
    style="--lr-command-palette-row-height: 60px; --lr-command-palette-group-height: 40px;"
    .open=${context.viewMode !== 'docs'}
    .commands=${[
      { commandId: 'new', label: 'New document', group: 'File' },
      { commandId: 'open', label: 'Open document', group: 'File' },
      { commandId: 'search', label: 'Search workspace', group: 'Navigation' },
      { commandId: 'symbols', label: 'Go to symbol', group: 'Navigation' },
    ]}
  ></lr-command-palette>`,
};
