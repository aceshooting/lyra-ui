import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraPlayback } from './playback.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Playback',
  component: 'lr-playback',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Index playback controls with native `FocusEvent` relays from the active internal control and matching `lr-focus`/`lr-blur` aliases.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-playback length="10" interval-ms="500" loop></lr-playback>`,
};

/** `focus()` targets the primary play/pause control; native and prefixed focus listeners each
 * receive exactly one notification. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      <lr-playback length="10" interval-ms="500" loop></lr-playback>
      <button
        type="button"
        @click=${(event: Event) => {
          const playback = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-playback',
          ) as LyraPlayback;
          playback.focus();
        }}
      >Focus play/pause</button>
    </div>
  `,
};

export const NoLoop: Story = {
  render: () =>
    html`<lr-playback length="10" interval-ms="500" .loop=${false}></lr-playback>`,
};

export const SingleFrame: Story = {
  render: () => html`<lr-playback length="1"></lr-playback>`,
};

export const ThemedActivePlayButton: Story = {
  name: 'Themed active play button (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-playback-play-button-active-bg` and `--lr-playback-play-button-active-border-color` retint only the pressed play/pause button. They are read as inline fallbacks rather than declared on `:host`, so a theme set on an ancestor flows into the component.',
      },
    },
  },
  render: () => html`
    <div
      style="
        --lr-playback-play-button-active-bg: ${storyColor('successQuiet')};
        --lr-playback-play-button-active-border-color: ${storyColor('success')};
      "
    >
      <lr-playback length="10" interval-ms="500" loop></lr-playback>
    </div>
  `,
};
