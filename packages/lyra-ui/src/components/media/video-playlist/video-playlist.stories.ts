import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { LyraVideoPlaylistItem } from './video-playlist.js';
import './video-playlist.js';

const VIDEO_SRC = '/fixtures/sample-video.mp4';
const POSTER_BLUE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%231a2438%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%235b8def%22/%3E%3C/svg%3E';
const POSTER_GREEN =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%231b312b%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%2346a57b%22/%3E%3C/svg%3E';
const POSTER_GOLD =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%233a2c17%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%23d79a36%22/%3E%3C/svg%3E';
const INITIAL_ITEMS: readonly LyraVideoPlaylistItem[] = [
  { title: 'Getting started with Lyra', poster: POSTER_BLUE, duration: 65 },
  { title: 'Build an accessible conversation', poster: POSTER_GREEN, duration: 125 },
  { title: 'Ship the finished interface', poster: POSTER_GOLD, duration: 185 },
];

const meta: Meta = {
  title: 'Media/Video Playlist',
  component: 'lr-video-playlist',
  tags: ['autodocs', 'experimental'],
  parameters: {
    docs: {
      description: {
        component:
          'Experimental direct-child video playlist with reversible child-state ownership, safe current-video switching, ended-only automatic advancement, repeat modes, fresh detached mutable change snapshots, and ordinary Tab-reachable row buttons with optional arrow shortcuts. Visible durations are programmatic row descriptions. Row focus transitions relay exactly one native `FocusEvent` plus the `lr-focus`/`lr-blur` alias.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function videos(): unknown {
  return html`
    <lr-video title="Getting started with Lyra" poster=${POSTER_BLUE} preload="none">
      <source src=${VIDEO_SRC} type="video/mp4">
    </lr-video>
    <lr-video title="Build an accessible conversation" poster=${POSTER_GREEN} preload="none">
      <source src=${VIDEO_SRC} type="video/mp4">
      <track src="data:text/vtt,WEBVTT" kind="captions" srclang="en" label="English">
    </lr-video>
    <lr-video title="Ship the finished interface" poster=${POSTER_GOLD} preload="none">
      <source src=${VIDEO_SRC} type="video/mp4">
    </lr-video>
  `;
}

export const FullControls: Story = {
  render: () => html`<lr-video-playlist>${videos()}</lr-video-playlist>`,
};

export const DeterministicFirstRender: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Assign `items` before the server and browser first render to emit deterministic playlist rows, including localized duration descriptions, before live child metadata is observable. The direct videos take ownership after hydration.',
      },
    },
  },
  render: () => html`
    <lr-video-playlist .items=${INITIAL_ITEMS}>${videos()}</lr-video-playlist>
  `,
};

export const StandardControls: Story = {
  render: () => html`<lr-video-playlist controls="standard">${videos()}</lr-video-playlist>`,
};

export const RepeatAll: Story = {
  render: () => html`<lr-video-playlist repeat="all">${videos()}</lr-video-playlist>`,
};

export const UnavailableItem: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Set the native `inert` property on an `<lr-video>` child to make it unavailable. The playlist skips it and disables its corresponding row; every other row remains an ordinary Tab stop, and `<lr-video>` intentionally has no `disabled` API.',
      },
    },
  },
  render: () => html`
    <lr-video-playlist>
      <lr-video title="Available introduction" poster=${POSTER_BLUE} preload="none">
        <source src=${VIDEO_SRC} type="video/mp4">
      </lr-video>
      <lr-video title="Unavailable lesson" poster=${POSTER_GREEN} preload="none" inert>
        <source src=${VIDEO_SRC} type="video/mp4">
      </lr-video>
      <lr-video title="Available conclusion" poster=${POSTER_GOLD} preload="none">
        <source src=${VIDEO_SRC} type="video/mp4">
      </lr-video>
    </lr-video-playlist>
  `,
};

export const CurrentItemTheme: Story = {
  render: () => html`
    <lr-video-playlist
      style="--lr-video-playlist-item-current-border-color: var(--lr-color-success); --lr-video-playlist-item-current-background: var(--lr-color-success-quiet);"
    >
      ${videos()}
    </lr-video-playlist>
  `,
};

export const NarrowLongTitles: Story = {
  render: () => html`
    <div style="inline-size: var(--lr-size-20rem)">
      <lr-video-playlist>
        <lr-video
          title="A deliberately long playlist title that remains readable in a narrow allocation"
          poster=${POSTER_BLUE}
          preload="none"
        >
          <source src=${VIDEO_SRC} type="video/mp4">
        </lr-video>
        <lr-video title="A second long title for overflow coverage" poster=${POSTER_GREEN} preload="none">
          <source src=${VIDEO_SRC} type="video/mp4">
        </lr-video>
      </lr-video-playlist>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-video-playlist>
        <lr-video title="مقدمة إلى ليرا" poster=${POSTER_BLUE} preload="none">
          <source src=${VIDEO_SRC} type="video/mp4">
        </lr-video>
        <lr-video title="إنشاء واجهة سهلة الوصول" poster=${POSTER_GREEN} preload="none">
          <source src=${VIDEO_SRC} type="video/mp4">
        </lr-video>
      </lr-video-playlist>
    </div>
  `,
};

export const Empty: Story = {
  render: () => html`<lr-video-playlist></lr-video-playlist>`,
};
