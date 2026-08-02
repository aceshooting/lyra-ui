import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './video.js';

const VIDEO_SRC = '/fixtures/sample-video.mp4';
const POSTER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 540%22%3E%3Crect width=%22960%22 height=%22540%22 fill=%22%231a2438%22/%3E%3Ccircle cx=%22480%22 cy=%22270%22 r=%22110%22 fill=%22%235b8def%22/%3E%3Cpath d=%22M450 205v130l105-65z%22 fill=%22white%22/%3E%3C/svg%3E';

const meta: Meta = {
  title: 'Media/Video',
  component: 'lr-video',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline native video with none, standard, and full custom-control presets. Safe light-DOM sources and tracks are cloned into the private media element; full controls add playback rate and capability-gated picture in picture.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Standard: Story = {
  render: () => html`
    <lr-video src=${VIDEO_SRC} poster=${POSTER} title="Lyra video demo"></lr-video>
  `,
};

export const FullControls: Story = {
  render: () => html`
    <lr-video controls="full" src=${VIDEO_SRC} poster=${POSTER} title="Full controls"></lr-video>
  `,
};

export const ControlsNone: Story = {
  render: () => html`
    <lr-video controls="none" src=${VIDEO_SRC} poster=${POSTER} title="No custom controls"></lr-video>
  `,
};

export const DeclarativeSources: Story = {
  render: () => html`
    <lr-video poster=${POSTER} title="Declarative source">
      <source src=${VIDEO_SRC} type="video/mp4">
    </lr-video>
  `,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="inline-size: var(--lr-size-20rem)">
      <lr-video
        controls="full"
        src=${VIDEO_SRC}
        poster=${POSTER}
        title="A long video title at a narrow 320 pixel allocation"
      ></lr-video>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-video src=${VIDEO_SRC} poster=${POSTER} title="عرض فيديو"></lr-video>
    </div>
  `,
};

export const CustomControlTheme: Story = {
  render: () => html`
    <lr-video
      style="--controls-background: color-mix(in oklab, var(--lr-color-brand), transparent 25%); --controls-color: var(--lr-color-on-brand); --poster-play-button-background: var(--lr-color-brand);"
      src=${VIDEO_SRC}
      poster=${POSTER}
      title="Custom control hooks"
    ></lr-video>
  `,
};
