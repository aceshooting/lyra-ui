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

// Leaves `groups` unset, exercising the optional emoji-picker-element-data auto-loader from
// emoji-data-loader.ts -- renders empty (just the search input) if that peer isn't installed in
// whatever environment is running Storybook, which is the fully-supported default, not an error.
export const WithAutoLoadedData: Story = {
  render: () => html`<lr-emoji-picker></lr-emoji-picker>`,
};
