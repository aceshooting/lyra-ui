import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './emoji-picker.js';
import type { EmojiPickerGroup } from './emoji-picker.class.js';

const meta: Meta = {
  title: 'Emoji Picker',
  component: 'lr-emoji-picker',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const groups: EmojiPickerGroup[] = [
  {
    key: 'smileys',
    label: 'Smileys & Emotion',
    emojis: [
      { emoji: '😀', name: 'grinning face', shortcodes: ['grinning'] },
      { emoji: '😂', name: 'face with tears of joy', shortcodes: ['joy'] },
      { emoji: '😍', name: 'heart eyes', shortcodes: ['heart_eyes'] },
    ],
  },
  {
    key: 'animals',
    label: 'Animals & Nature',
    emojis: [
      { emoji: '🐶', name: 'dog face', shortcodes: ['dog'] },
      { emoji: '🐱', name: 'cat face', shortcodes: ['cat'] },
    ],
  },
];

export const WithSuppliedGroups: Story = {
  render: () => html`<lr-emoji-picker .groups=${groups}></lr-emoji-picker>`,
};

/** The active (keyboard-highlighted) and hovered emoji share one background hook,
 *  `--lr-emoji-picker-active-bg`. It is not declared on `:host`, so setting it on an ancestor
 *  recolors only the emoji highlight — not everything else reading `--lr-color-brand-quiet`.
 *  Hover an emoji, or arrow-key through the grid, to see it. */
export const ThemedHighlight: Story = {
  name: 'Themed highlight (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-emoji-picker-active-bg` on the element or any ancestor to retint the hovered/active emoji highlight without hijacking the library-wide `--lr-color-brand-quiet` token.',
      },
    },
  },
  render: () => html`<lr-emoji-picker
    style="--lr-emoji-picker-active-bg: var(--lr-color-success-quiet);"
    .groups=${groups}
  ></lr-emoji-picker>`,
};

// The windowed path (200+ filtered items) with all three geometry tokens overridden in `rem`.
// Row pitch and columns-per-row are resolved to real pixels from those tokens, so the windowed
// geometry stays in step with what is painted for any CSS length unit, `calc()` included.
const pool = ['😀', '😂', '😍', '🐶', '🐱', '🦊', '🍎', '🍇', '⚽', '🚀'];
const largeGroups: EmojiPickerGroup[] = [
  {
    key: 'all',
    label: 'A large set',
    emojis: Array.from({ length: 400 }, (_, index) => ({
      emoji: pool[index % pool.length],
      name: `sample emoji ${index + 1}`,
    })),
  },
];

export const WindowedWithRemGeometry: Story = {
  render: () => html`<lr-emoji-picker
    style="--lr-emoji-picker-item-size: 3rem; --lr-emoji-picker-gap: 0.5rem; --lr-emoji-picker-row-height: calc(3rem + 1rem)"
    .groups=${largeGroups}
  ></lr-emoji-picker>`,
};

// Leaves `groups` unset, exercising the optional emoji-picker-element-data auto-loader from
// emoji-data-loader.ts -- renders empty (just the search input) if that peer isn't installed in
// whatever environment is running Storybook, which is the fully-supported default, not an error.
export const WithAutoLoadedData: Story = {
  render: () => html`<lr-emoji-picker></lr-emoji-picker>`,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`
          <div>
            <p style="margin: 0 0 0.5rem 0; font-size: var(--lr-font-size-sm); color: var(--lr-color-text-quiet);">
              size="${size}"
            </p>
            <lr-emoji-picker size=${size} .groups=${groups}></lr-emoji-picker>
          </div>
        `,
      )}
    </div>
  `,
};
