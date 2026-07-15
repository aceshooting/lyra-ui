import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraPlayback } from './playback.js';

const meta: Meta = {
  title: 'Playback',
  component: 'lyra-playback',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-playback length="10" interval-ms="500" loop></lyra-playback>`,
};

/** `focus()` targets the primary play/pause control and host focus listeners remain observable. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      <lyra-playback length="10" interval-ms="500" loop></lyra-playback>
      <button
        type="button"
        @click=${(event: Event) => {
          const playback = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lyra-playback',
          ) as LyraPlayback;
          playback.focus();
        }}
      >Focus play/pause</button>
    </div>
  `,
};

export const NoLoop: Story = {
  render: () =>
    html`<lyra-playback length="10" interval-ms="500" .loop=${false}></lyra-playback>`,
};

export const SingleFrame: Story = {
  render: () => html`<lyra-playback length="1"></lyra-playback>`,
};
