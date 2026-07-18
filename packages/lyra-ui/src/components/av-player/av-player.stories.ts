import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './av-player.js';
import type { LyraAvCue } from './av-player.class.js';

const meta: Meta = {
  title: 'DocumentViewer/AvPlayer',
  component: 'lr-av-player',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Audio/video player built on a native media element with a cue transcript synced to playback, time-range anchor/highlight support, an optional dependency-free waveform, and playback-rate control. Self-registers into the document-viewer registry for common audio/video MIME types.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const CUES: LyraAvCue[] = [
  { id: 'c1', start: 0, end: 8, text: 'Welcome to the show.', speaker: 'Host' },
  { id: 'c2', start: 8, end: 22, text: 'Today we discuss agentic UI.', speaker: 'Host' },
  { id: 'c3', start: 22, end: 40, text: 'Thanks for having me.', speaker: 'Guest' },
];
const PEAKS = Array.from({ length: 120 }, (_v, i) => Math.abs(Math.sin(i / 6)) * 0.9 + 0.05);

export const AudioWithTranscript: Story = {
  render: () => html`<lr-av-player
    src="https://example.test/podcast.mp3"
    mime-type="audio/mpeg"
    name="Episode 1"
    .cues=${CUES}
    .peaks=${PEAKS}
    .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 8, end: 22 }, label: 'Agentic UI segment' }]}
  ></lr-av-player>`,
};

export const Video: Story = {
  render: () => html`<lr-av-player src="https://example.test/clip.mp4" mime-type="video/mp4" name="Demo clip"></lr-av-player>`,
};

export const NoSrc: Story = {
  render: () => html`<lr-av-player></lr-av-player>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px">
    <lr-av-player src="https://example.test/podcast.mp3" mime-type="audio/mpeg" name="Episode 1" .cues=${CUES} .peaks=${PEAKS}></lr-av-player>
  </div>`,
};
