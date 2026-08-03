import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './video-playlist.js';

const VIDEO_SRC = '/fixtures/sample-video.mp4';
const POSTER_BLUE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%231a2438%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%235b8def%22/%3E%3C/svg%3E';
const POSTER_GREEN =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%231b312b%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%2346a57b%22/%3E%3C/svg%3E';
const POSTER_GOLD =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%233a2c17%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%23d79a36%22/%3E%3C/svg%3E';

const meta: Meta = {
  title: 'Media/Video Playlist',
  component: 'lr-video-playlist',
  tags: ['autodocs', 'experimental'],
  parameters: {
    docs: {
      description: {
        component:
          'Experimental direct-child video playlist with full/standard/none control forwarding, safe current-video switching, automatic advancement, repeat modes, immutable change metadata, and an accessible roving item list.',
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

export const StandardControls: Story = {
  render: () => html`<lr-video-playlist controls="standard">${videos()}</lr-video-playlist>`,
};

export const RepeatAll: Story = {
  render: () => html`<lr-video-playlist repeat="all">${videos()}</lr-video-playlist>`,
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
