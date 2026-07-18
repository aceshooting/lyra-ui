import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './audio-visualizer.js';

const meta: Meta = {
  title: 'Audio Visualizer',
  component: 'lr-audio-visualizer',
};
export default meta;
type Story = StoryObj;

export const Idle: Story = {
  render: () => html`<lr-audio-visualizer state="idle"></lr-audio-visualizer>`,
};

export const Listening: Story = {
  render: () => html`<lr-audio-visualizer state="listening"></lr-audio-visualizer>`,
};

export const Thinking: Story = {
  render: () => html`<lr-audio-visualizer state="thinking"></lr-audio-visualizer>`,
};

export const Speaking: Story = {
  render: () => html`<lr-audio-visualizer state="speaking"></lr-audio-visualizer>`,
};

export const WaveformWithLevel: Story = {
  render: () => html`<lr-audio-visualizer variant="waveform" level="0.6" state="speaking"></lr-audio-visualizer>`,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; border: 1px dashed var(--lr-color-border); padding: 8px;">
      <lr-audio-visualizer state="listening" bar-count="8"></lr-audio-visualizer>
    </div>
  `,
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (ambient states only)',
  parameters: {
    docs: {
      description: {
        story:
          'With `prefers-reduced-motion: reduce` set at the OS/browser level, the signal-less ambient animation collapses to a static frame (a quiet flat idle, a steady mid-height pulse for listening/speaking, and a flat mid-height bar for thinking instead of a moving sweep). A real `stream` or `level` signal keeps animating regardless — that is live feedback, not decorative motion.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <lr-audio-visualizer state="idle"></lr-audio-visualizer>
      <lr-audio-visualizer state="listening"></lr-audio-visualizer>
      <lr-audio-visualizer state="thinking"></lr-audio-visualizer>
      <lr-audio-visualizer state="speaking"></lr-audio-visualizer>
    </div>
  `,
};
