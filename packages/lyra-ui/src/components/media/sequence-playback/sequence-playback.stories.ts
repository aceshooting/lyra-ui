import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSequencePlayback } from './sequence-playback.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Sequence Playback',
  component: 'lr-sequence-playback',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Discrete sequence playback controls with `itemCount`/`currentIndex`, native `FocusEvent` relays from the active internal control, and matching `lr-focus`/`lr-blur` aliases.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-sequence-playback item-count="10" interval-ms="500" loop></lr-sequence-playback>`,
};

/** `focus()` targets the primary play/pause control; native and prefixed focus listeners each
 * receive exactly one notification. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      <lr-sequence-playback item-count="10" interval-ms="500" loop></lr-sequence-playback>
      <button
        type="button"
        @click=${(event: Event) => {
          const playback = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-sequence-playback',
          ) as LyraSequencePlayback;
          playback.focus();
        }}
      >Focus play/pause</button>
    </div>
  `,
};

export const NoLoop: Story = {
  render: () =>
    html`<lr-sequence-playback item-count="10" interval-ms="500" .loop=${false}></lr-sequence-playback>`,
};

export const SingleFrame: Story = {
  render: () => html`<lr-sequence-playback item-count="1"></lr-sequence-playback>`,
};

export const ThemedActivePlayButton: Story = {
  name: 'Themed active play button (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-sequence-playback-play-button-active-bg` and `--lr-sequence-playback-play-button-active-border-color` retint only the pressed play/pause button. They are read as inline fallbacks rather than declared on `:host`, so a theme set on an ancestor flows into the component.',
      },
    },
  },
  render: () => html`
    <div
      style="
        --lr-sequence-playback-play-button-active-bg: ${storyColor('successQuiet')};
        --lr-sequence-playback-play-button-active-border-color: ${storyColor('success')};
      "
    >
      <lr-sequence-playback item-count="10" interval-ms="500" loop></lr-sequence-playback>
    </div>
  `,
};
